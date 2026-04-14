from __future__ import annotations
"""
memory_graph.py
---------------
Selective, decaying concept graph for each bot.

How it works:
  1. After generating a tweet, the bot does a second short generation pass:
         "[MAUK] remembers:"
     and only stores whatever phrase the model completes with.
     This means the bot curates its own memory — it only keeps what
     it "found interesting" about the exchange.

  2. Concepts decay over time (weight *= DECAY_RATE each update cycle)
     so old obsessions fade unless they keep getting reinforced.

  3. A salience filter blocks extremely common words even if they slip
     past the stopword list (e.g. "thing", "want", "make").

  4. Total concept nodes are capped at MAX_CONCEPTS — the lowest-weight
     concepts are pruned when the cap is hit.

Two backends:
  - LOCAL mode: NetworkX graph + JSON file (default, works offline)
  - SUPABASE mode: writes to memory_concepts table in Supabase
    (set SUPABASE_URL + SUPABASE_SERVICE_KEY env vars to enable)
"""

import os
import re
import json
import math
import random
import logging
from datetime import datetime
from pathlib import Path

log = logging.getLogger(__name__)

# ── Supabase (optional) ───────────────────────────────────────────────────────

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY")   # service role key — bypasses RLS

_sb = None
def _supabase():
    global _sb
    if _sb is None and SUPABASE_URL and SUPABASE_KEY:
        try:
            from supabase import create_client
            _sb = create_client(SUPABASE_URL, SUPABASE_KEY)
        except Exception as e:
            log.warning(f"Supabase init failed: {e}")
    return _sb


# ── Config ─────────────────────────────────────────────────────────────────────

DECAY_RATE   = 0.97     # weight multiplied by this each update cycle
MAX_CONCEPTS = 150      # prune lowest-weight concepts beyond this cap
MIN_WEIGHT   = 0.05     # concepts below this are removed during pruning
MIN_WORD_LEN = 4        # minimum character length for a concept word

# Words that pass the stopword filter but aren't interesting concepts
_EXTRA_STOP = {
    "thing", "things", "want", "make", "made", "just", "know", "think",
    "people", "really", "going", "something", "actually", "probably",
    "maybe", "already", "still", "also", "much", "many", "every",
    "never", "always", "together", "between", "because", "being",
    "mauk", "abaci", "airport", "went", "straight", "about", "could",
    "would", "should", "there", "their", "where", "which",
    "people", "really", "going", "something", "actually", "probably",
    "maybe", "already", "still", "also", "much", "many", "every",
    "never", "always", "together", "between", "because", "being",
    "nothing", "everything", "anything", "someone", "anyone",
    "thing", "things", "want", "make", "made", "just", "know", "think",
}
_STOP = {
    "i", "a", "the", "and", "or", "but", "in", "on", "at", "to",
    "is", "it", "of", "my", "your", "just", "that", "this", "for",
    "with", "are", "be", "was", "not", "so", "do", "as", "an", "by",
    "its", "if", "me", "we", "he", "she", "they", "you", "no", "s",
    "has", "have", "had", "will", "would", "could", "should", "may",
    "can", "been", "which", "there", "their", "from", "all", "one",
    "are", "into", "more", "out", "up", "what", "when", "than", "then",
    "like", "only", "any", "now", "about", "some", "time", "very",
    "from", "have", "been", "through", "would", "should",
} | _EXTRA_STOP


def _extract_salient_phrases(text: str) -> list[str]:
    """Extract content words, filtering for salience."""
    words = re.findall(r"[a-z']+", text.lower())
    out = []
    for w in words:
        clean = w.strip("'")
        if (clean not in _STOP
                and len(clean) >= MIN_WORD_LEN
                and not clean.isdigit()):
            out.append(clean)
    return out


# ── MemoryGraph ────────────────────────────────────────────────────────────────

class MemoryGraph:
    """Selective, decaying concept memory for a single bot.

    Parameters
    ----------
    save_path : str | Path
        JSON file path for local persistence.
    bot_name : str
        Display name, used in log messages.
    bot_key : str
        'a' or 'b', used as the key in Supabase.
    model, tokenizer
        If provided, enable bot-curated memory (second-pass generation).
    device
        Torch device for the curation generation pass.
    """

    def __init__(
        self,
        save_path,
        bot_name: str = "Bot",
        bot_key:  str = "a",
        model=None,
        tokenizer=None,
        device=None,
    ):
        self.save_path = Path(save_path)
        self.bot_name  = bot_name
        self.bot_key   = bot_key
        self.model     = model
        self.tokenizer = tokenizer
        self.device    = device

        # concept → weight (float)
        self._concepts: dict[str, float] = {}
        # co-occurrence: frozenset({c1,c2}) → count
        self._cooccur: dict[str, float] = {}

        if self.save_path.exists():
            self._load()
            log.info(f"[{bot_name}] Memory loaded: {len(self._concepts)} concepts")
        else:
            log.info(f"[{bot_name}] New memory graph")

    # ── Public API ─────────────────────────────────────────────────────────────

    def curate_and_remember(self, generated_text: str, context_text: str = "") -> list[str]:
        """Main entry point after generation.

        If a model is attached, run a curation pass to extract what the
        bot 'chose to remember'. Otherwise fall back to salient phrase extraction.

        Returns the list of concepts added.
        """
        if self.model is not None and self.tokenizer is not None:
            concept = self._curation_pass(generated_text)
            if concept:
                phrases = [concept]
            else:
                phrases = _extract_salient_phrases(generated_text)[:3]
        else:
            phrases = _extract_salient_phrases(generated_text)

        return self.remember_phrases(phrases, source_text=generated_text)

    def obsessions(self, n: int = 10) -> list[str]:
        """Return the n highest-weight concepts."""
        sorted_c = sorted(self._concepts.items(), key=lambda x: x[1], reverse=True)
        return [c for c, _ in sorted_c[:n]]

    def prompt_injection(self, base_prompt: str, blend_weight: float = 0.45) -> str:
        """Blend a memory concept into a prompt with probability blend_weight."""
        if random.random() > blend_weight:
            return base_prompt
        top = self.obsessions(6)
        if not top:
            return base_prompt
        concept = random.choice(top[:3])   # bias toward top 3
        templates = [
            f"{concept} — {base_prompt}",
            f"{base_prompt}, like {concept}",
            f"consider {concept}: {base_prompt}",
            f"{base_prompt} (always {concept})",
            f"through {concept}, {base_prompt}",
        ]
        return random.choice(templates)

    def related_to(self, word: str, n: int = 5) -> list[str]:
        """Return concepts most co-occurring with a given word."""
        word = word.lower().strip()
        results = []
        for key, weight in self._cooccur.items():
            parts = key.split("__")
            if word in parts:
                other = parts[1] if parts[0] == word else parts[0]
                if other in self._concepts:
                    results.append((other, weight))
        results.sort(key=lambda x: x[1], reverse=True)
        return [r for r, _ in results[:n]]

    def stats(self) -> dict:
        return {
            "concept_count":  len(self._concepts),
            "top_obsessions": self.obsessions(8),
            "total_weight":   round(sum(self._concepts.values()), 2),
        }

    # ── Curation pass ──────────────────────────────────────────────────────────

    def _curation_pass(self, generated_text: str, max_new_tokens: int = 12) -> str | None:
        """Second-pass generation: ask the model for the 'abstract essence'.
        
        Prompt format:
            [MAUK]: the moon is an open set.
            The unseen concept here is:
        """
        try:
            import torch
            # Using a more "intellectual" lead-in to nudge away from slop
            prompt = f"[{self.bot_name}]: {generated_text.strip()}\nThe unseen concept here is:"
            inputs = self.tokenizer(prompt, return_tensors="pt").to(self.device)

            with torch.no_grad():
                output = self.model.generate(
                    **inputs,
                    max_new_tokens=max_new_tokens,
                    do_sample=True,
                    temperature=0.8,
                    top_p=0.9,
                    pad_token_id=self.tokenizer.eos_token_id,
                )

            new_tokens = output[0][inputs["input_ids"].shape[1]:]
            raw = self.tokenizer.decode(new_tokens, skip_special_tokens=True).strip()

            # Take the first line / phrase
            raw = raw.split("\n")[0].split(".")[0].strip().lower()
            # Clean to alphabetic words only
            words = re.findall(r"[a-z]+", raw)
            meaningful = [w for w in words if w not in _STOP and len(w) >= MIN_WORD_LEN]
            if meaningful:
                return " ".join(meaningful[:3])   # keep it tight
        except Exception as e:
            log.debug(f"Curation pass failed: {e}")
        return None

    # ── Decay & pruning ────────────────────────────────────────────────────────

    def _decay_all(self):
        """Apply exponential decay to all concept weights."""
        for concept in list(self._concepts):
            self._concepts[concept] *= DECAY_RATE

    def _prune(self):
        """Remove concepts below MIN_WEIGHT and cap at MAX_CONCEPTS."""
        # Drop faded concepts
        self._concepts = {k: v for k, v in self._concepts.items() if v >= MIN_WEIGHT}

        # Prune to cap
        if len(self._concepts) > MAX_CONCEPTS:
            sorted_c = sorted(self._concepts.items(), key=lambda x: x[1])
            to_remove = len(self._concepts) - MAX_CONCEPTS
            for concept, _ in sorted_c[:to_remove]:
                del self._concepts[concept]

        # Clean up co-occurrence entries for pruned concepts
        self._cooccur = {
            k: v for k, v in self._cooccur.items()
            if all(p in self._concepts for p in k.split("__"))
        }

    # ── Persistence ────────────────────────────────────────────────────────────

    def _save(self):
        data = {
            "concepts": self._concepts,
            "cooccur":  self._cooccur,
            "saved_at": datetime.utcnow().isoformat(),
        }
        self.save_path.parent.mkdir(parents=True, exist_ok=True)
        self.save_path.write_text(json.dumps(data, indent=2))

    def _load(self):
        data = json.loads(self.save_path.read_text())
        self._concepts = data.get("concepts", {})
        self._cooccur  = data.get("cooccur",  {})

    def _sync_supabase(self):
        """Push decaying concepts to 'memory_concepts' for the active UI tier."""
        sb = _supabase()
        if sb is None:
            return
        try:
            # 1. Clear existing active concepts for this bot
            sb.table("memory_concepts").delete().eq("bot", self.bot_key).execute()

            # 2. Prepare new rows
            rows = [
                {"bot": self.bot_key, "concept": c, "weight": round(w, 4)}
                for c, w in self._concepts.items()
            ]
            
            # 3. Insert in batches of 50
            if rows:
                for i in range(0, len(rows), 50):
                    sb.table("memory_concepts").insert(rows[i:i+50]).execute()
                log.info(f"[{self.bot_name}] Active tier synced ({len(rows)} concepts)")
        except Exception as e:
            log.warning(f"[{self.bot_name}] Active sync failed: {e}")

    def _sync_archive(self, phrases: list[str], source_text: str = ""):
        """Persistently archive new concepts into 'memory_archive' with origin context."""
        sb = _supabase()
        if sb is None or not phrases:
            return
        try:
            for phrase in phrases:
                # Upsert to track the last time this concept was thought of.
                # Now including source_text for traceability!
                sb.table("memory_archive").upsert({
                    "bot": self.bot_key,
                    "concept": phrase,
                    "source_text": source_text,
                    "last_thought_at": datetime.utcnow().isoformat()
                }, on_conflict="bot,concept").execute()
            log.info(f"[{self.bot_name}] Archived {len(phrases)} concepts with provenance")
        except Exception as e:
            # Archive failure is usually due to the table/constraint not existing yet
            log.debug(f"[{self.bot_name}] Archive sync withheld: {e}")


# ── Standalone demo ────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import tempfile
    with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as f:
        path = f.name

    mg = MemoryGraph(path, bot_name="MAUK", bot_key="a")

    tweets = [
        "the moon is an open set and I cannot find its boundary",
        "god is a degenerate function defined nowhere and everywhere",
        "proof by contradiction: love exists, therefore I am empty",
        "topology of grief — no boundary, only accumulation points",
        "every limit point of sorrow belongs to the closure of my chest",
        "the axiom of choice selects one shoe from every pair I have lost",
        "set theory is just poetry for people afraid of moonlight",
    ]

    for tweet in tweets:
        # Simulate without a model: fall back to phrase extraction
        added = mg.curate_and_remember(tweet)
        print(f"Added: {added}")

    print("\nStats:", mg.stats())
    print("\nInjected prompt:", mg.prompt_injection("the boundary does not exist"))
    print("Related to 'moon':", mg.related_to("moon"))

    # Simulate a few decay cycles
    for _ in range(10):
        mg._decay_all()
    mg._prune()
    print(f"\nAfter 10 decay cycles: {len(mg._concepts)} concepts remain")
    print("Top:", mg.obsessions(5))
