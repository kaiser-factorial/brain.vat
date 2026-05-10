"""
jaccard_similarity.py
---------------------
Computes exact Jaccard similarity between MAUK and ABACI full vocabularies
(post-stopword filter).  At ~37k / ~45k unique words this runs in < 1 second
locally — no MinHash needed.

    python bot_wordcount/jaccard_similarity.py
"""

import csv
import os

# ── Paths ─────────────────────────────────────────────────────────────────────
BASE    = os.path.dirname(os.path.abspath(__file__))
RESULTS = os.path.join(BASE, "results")

FILES = {
    "MAUK":  os.path.join(RESULTS, "MAUK",  "mauk_full_vocab_5_10_2026.csv"),
    "ABACI": os.path.join(RESULTS, "ABACI", "abaci_full_vocab_5_10_2026.csv"),
}
# ─────────────────────────────────────────────────────────────────────────────


def load_vocab(path: str) -> set[str]:
    """Return the set of words from a word,count CSV."""
    vocab = set()
    with open(path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            word = row["word"].strip()
            if word:
                vocab.add(word)
    return vocab


def jaccard(a: set, b: set) -> float:
    """Exact Jaccard similarity: |A ∩ B| / |A ∪ B|."""
    intersection = a & b
    union        = a | b
    return len(intersection) / len(union) if union else 0.0


def main():
    print("\nLoading vocabularies …")
    vocabs = {bot: load_vocab(path) for bot, path in FILES.items()}

    mauk_v  = vocabs["MAUK"]
    abaci_v = vocabs["ABACI"]

    shared    = mauk_v & abaci_v
    only_mauk = mauk_v - abaci_v
    only_abaci = abaci_v - mauk_v
    union     = mauk_v | abaci_v

    j = jaccard(mauk_v, abaci_v)

    print("\n── Vocabulary sizes ──────────────────────────────────")
    print(f"  MAUK  unique words : {len(mauk_v):>7,}")
    print(f"  ABACI unique words : {len(abaci_v):>7,}")
    print(f"  Shared (∩)         : {len(shared):>7,}")
    print(f"  Union  (∪)         : {len(union):>7,}")
    print(f"  MAUK-only          : {len(only_mauk):>7,}")
    print(f"  ABACI-only         : {len(only_abaci):>7,}")
    print("\n── Jaccard similarity ────────────────────────────────")
    print(f"  J(MAUK, ABACI) = {j:.4f}  ({j*100:.2f}%)")
    print()

    # ── Save shared / exclusive word lists ────────────────────────────────────
    out_dir = os.path.join(RESULTS)
    os.makedirs(out_dir, exist_ok=True)

    def save_words(words, filename):
        path = os.path.join(out_dir, filename)
        with open(path, "w", encoding="utf-8") as f:
            for w in sorted(words):
                f.write(w + "\n")
        print(f"  ✓ Saved {filename}  ({len(words):,} words)")

    print("── Saving word lists ─────────────────────────────────")
    save_words(shared,     "vocab_shared.txt")
    save_words(only_mauk,  "vocab_MAUK_only.txt")
    save_words(only_abaci, "vocab_ABACI_only.txt")
    print("\nDone.")


if __name__ == "__main__":
    main()
