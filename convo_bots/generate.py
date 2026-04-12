"""
generate.py
-----------
MPS-aware inference engine for both bots.
Loads a saved model checkpoint and generates tweet-length text.

Usage (standalone test):
    python generate.py --model path/to/model_checkpoint --prompt "the moon is an open set"
"""

import argparse
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer


# ── Device selection (MPS → CUDA → CPU) ──────────────────────────────────────

def get_device() -> torch.device:
    if torch.backends.mps.is_available():
        return torch.device("mps")
    if torch.cuda.is_available():
        return torch.device("cuda")
    return torch.device("cpu")


# ── Model loader ──────────────────────────────────────────────────────────────

def load_model(checkpoint_path: str, device: torch.device = None):
    """Load model + tokenizer from a save_pretrained checkpoint folder.

    Returns (model, tokenizer) ready for inference.
    """
    if device is None:
        device = get_device()

    print(f"[generate] Loading model from {checkpoint_path} on {device}...")
    tokenizer = AutoTokenizer.from_pretrained(checkpoint_path)
    tokenizer.pad_token = tokenizer.eos_token

    model = AutoModelForCausalLM.from_pretrained(checkpoint_path)
    model = model.to(device)
    model.eval()
    print(f"[generate] Model ready.")
    return model, tokenizer


# ── Core generation ───────────────────────────────────────────────────────────

# Tokens known to be overfitting tells — extend this list as you notice issues
BANNED_WORDS = ["iced", " iced", "Iced", " Iced"]

def generate_tweet(
    model,
    tokenizer,
    prompt: str,
    device: torch.device = None,
    temperature: float = 0.9,
    top_p: float = 0.95,
    repetition_penalty: float = 1.3,
    max_new_tokens: int = 55,
    banned_words: list[str] = None,
) -> str:
    """Generate a single tweet-length string from a prompt.

    Returns the generated text with the prompt stripped away,
    trimmed to a clean sentence boundary where possible.
    """
    if device is None:
        device = next(model.parameters()).device

    if banned_words is None:
        banned_words = BANNED_WORDS

    bad_words_ids = [
        tokenizer.encode(w, add_prefix_space=False)
        for w in banned_words
        if tokenizer.encode(w, add_prefix_space=False)
    ]

    inputs = tokenizer(prompt, return_tensors="pt").to(device)
    prompt_len = inputs["input_ids"].shape[1]

    with torch.no_grad():
        output = model.generate(
            **inputs,
            max_new_tokens=max_new_tokens,
            do_sample=True,
            temperature=temperature,
            top_p=top_p,
            repetition_penalty=repetition_penalty,
            bad_words_ids=bad_words_ids if bad_words_ids else None,
            pad_token_id=tokenizer.eos_token_id,
        )

    # Decode only the newly generated tokens (not the prompt)
    new_tokens = output[0][prompt_len:]
    generated = tokenizer.decode(new_tokens, skip_special_tokens=True).strip()

    # Try to end at a clean sentence boundary
    generated = _trim_to_sentence(generated)

    # Twitter hard cap
    full_text = f"{prompt} {generated}".strip()
    return full_text[:280]


def _trim_to_sentence(text: str) -> str:
    """Trim to last complete sentence if possible, else return as-is."""
    for punct in (".", "!", "?", "…"):
        last = text.rfind(punct)
        if last != -1 and last > len(text) // 3:
            return text[: last + 1].strip()
    return text.strip()


# ── Prompt seeding from another bot's tweet ───────────────────────────────────

def seed_prompt_from_tweet(tweet_text: str, max_seed_words: int = 6) -> str:
    """Extract the first few meaningful words from a tweet to use as a prompt.

    Strips common filler words so the response engages with substance.
    """
    stopwords = {
        "i", "a", "the", "and", "or", "but", "in", "on", "at", "to",
        "is", "it", "of", "my", "your", "just", "that", "this", "for",
        "with", "are", "be", "was", "not", "so", "do", "as", "an",
    }
    words = tweet_text.split()
    seed_words = [w for w in words if w.lower().strip(".,!?") not in stopwords]
    seed = " ".join(seed_words[:max_seed_words])
    return seed if seed else tweet_text[:40]


# ── CLI for manual testing ────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate a tweet from a saved model checkpoint.")
    parser.add_argument("--model",  required=True, help="Path to model_checkpoint folder")
    parser.add_argument("--prompt", default="the moon is an open set", help="Prompt text")
    parser.add_argument("--n",      type=int, default=5, help="Number of outputs to generate")
    args = parser.parse_args()

    device = get_device()
    print(f"Device: {device}\n")

    model, tokenizer = load_model(args.model, device)

    for i in range(args.n):
        tweet = generate_tweet(model, tokenizer, args.prompt, device)
        print(f"[{i+1}] {tweet}\n")
