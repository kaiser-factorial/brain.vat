"""
plot_distributions.py
---------------------
Generates distribution bar charts for MAUK and ABACI word count data.
Run locally after downloading results from HDFS.

    python bot_wordcount/plot_distributions.py
"""

import glob
import os
import csv
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.ticker as mticker
import numpy as np

# ── Paths ─────────────────────────────────────────────────────────────────────
BASE = os.path.dirname(os.path.abspath(__file__))
RESULTS = os.path.join(BASE, "results")
OUT = os.path.join(BASE, "results")

BOTS = {
    "MAUK":  {"color": "#03A6A1", "accent": "#027A77"},  # cool cyan  (--mauk in globals.css)
    "ABACI": {"color": "#FF9D23", "accent": "#CC6F00"},  # warm amber (--abaci in globals.css)
}

BUCKET_LABELS = [
    "1", "2", "3–5", "6–10", "11–25",
    "26–50", "51–100", "101–250", "251–500", "501–1k", "1k–5k", "5k+"
]
# ─────────────────────────────────────────────────────────────────────────────


def find_csv(bot, keyword, variant=None):
    """Search for a CSV containing `keyword` (and optionally `variant`) under results/{bot}/.

    Args:
        bot:     Bot name, e.g. "MAUK" or "ABACI".
        keyword: Required substring in the filename, e.g. "distribution".
        variant: Optional additional substring that must also appear, e.g. "NOSTOP".
                 When provided only files matching BOTH strings are returned.
    """
    folder = os.path.join(RESULTS, bot)
    # try subdirectory first (original Spark output structure)
    subdir = os.path.join(folder, f"{bot}_{keyword}")
    for pattern in [os.path.join(subdir, "part-*.csv"), os.path.join(subdir, "*.csv")]:
        for f in glob.glob(pattern):
            name = os.path.basename(f).lower()
            if variant is None or variant.lower() in name:
                return f
    # fall back: any csv in the flat folder whose name contains the keyword (and variant)
    for f in sorted(glob.glob(os.path.join(folder, "*.csv"))):
        name = os.path.basename(f).lower()
        if keyword.lower() in name and (variant is None or variant.lower() in name):
            return f
    variant_note = f" with variant '{variant}'" if variant else ""
    raise FileNotFoundError(f"No {keyword}{variant_note} CSV found for {bot} in {folder}")


def load_distribution(bot, variant="NOSTOP"):
    path = find_csv(bot, "distribution", variant=variant)
    rows = []
    with open(path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            rows.append({
                "bucket":            row["bucket"],
                "unique_words":      int(row["unique_words"]),
                "total_occurrences": int(row["total_occurrences"]),
            })
    rows.sort(key=lambda r: r["bucket"])
    return rows


def plot_bot(bot, rows, color, accent):
    labels    = [r["bucket"].split("_", 1)[1] for r in rows]  # strip leading "01_" etc.
    unique    = [r["unique_words"]      for r in rows]
    total     = [r["total_occurrences"] for r in rows]

    total_unique = sum(unique)
    total_n      = sum(total)

    x = np.arange(len(labels))
    bar_w = 0.4

    fig, ax1 = plt.subplots(figsize=(13, 7))
    fig.patch.set_facecolor("#0F1117")
    ax1.set_facecolor("#0F1117")

    # ── Bars: unique words (left y-axis) ─────────────────────────────────────
    bars1 = ax1.bar(x - bar_w / 2, unique, bar_w, color=color,
                    alpha=0.9, label="Unique words", zorder=3)

    # ── Bars: total occurrences (right y-axis) ────────────────────────────────
    ax2 = ax1.twinx()
    bars2 = ax2.bar(x + bar_w / 2, total, bar_w, color=accent,
                    alpha=0.85, label="Total occurrences", zorder=3)

    # ── Value labels on unique-words bars ─────────────────────────────────────
    for bar in bars1:
        h = bar.get_height()
        if h > 0:
            ax1.text(bar.get_x() + bar.get_width() / 2, h + total_unique * 0.005,
                     f"{h:,}", ha="center", va="bottom",
                     color=color, fontsize=7.5, fontweight="bold")

    # ── Styling ───────────────────────────────────────────────────────────────
    spine_color = "#2A2D3A"
    for ax in (ax1, ax2):
        ax.set_facecolor("#0F1117")
        for spine in ax.spines.values():
            spine.set_color(spine_color)
        ax.tick_params(colors="#C8CBD8", labelsize=9)
        ax.yaxis.set_major_formatter(mticker.FuncFormatter(lambda v, _: f"{int(v):,}"))
        ax.grid(axis="y", color="#1E2030", linewidth=0.7, zorder=0)

    ax1.set_xticks(x)
    ax1.set_xticklabels(labels, color="#C8CBD8", fontsize=9)
    ax1.tick_params(axis="x", colors="#C8CBD8")

    ax1.set_ylabel("Unique words", color=color, fontsize=11, labelpad=10)
    ax2.set_ylabel("Total occurrences", color=accent, fontsize=11, labelpad=10)
    ax1.yaxis.label.set_color(color)
    ax2.yaxis.label.set_color(accent)
    ax1.tick_params(axis="y", colors=color)
    ax2.tick_params(axis="y", colors=accent)

    ax1.set_xlabel("Word count bucket", color="#C8CBD8", fontsize=11, labelpad=10)

    # ── Title + stats ─────────────────────────────────────────────────────────
    fig.text(0.5, 0.97,
             f"{bot} — Word Count Distribution",
             ha="center", va="top",
             fontsize=16, fontweight="bold", color="white")

    fig.text(0.5, 0.925,
             f"Unique words (post-stopword filter): {total_unique:,}   |   "
             f"Total word occurrences: {total_n:,}   |   "
             f"Hapax legomena (count=1): {unique[0]:,} "
             f"({unique[0]/total_unique*100:.1f}%)",
             ha="center", va="top",
             fontsize=9.5, color="#8B90A8")

    # ── Legend ────────────────────────────────────────────────────────────────
    legend = fig.legend(
        handles=[bars1, bars2],
        labels=["Unique words", "Total occurrences"],
        loc="upper right", bbox_to_anchor=(0.97, 0.90),
        framealpha=0.15, edgecolor=spine_color,
        labelcolor="white", fontsize=9,
    )

    plt.tight_layout(rect=[0, 0, 1, 0.91])

    out_path = os.path.join(OUT, f"{bot}_distribution_NOSTOP.png")
    fig.savefig(out_path, dpi=160, bbox_inches="tight", facecolor=fig.get_facecolor())
    plt.close(fig)
    print(f"  ✓ Saved: {out_path}")
    return out_path


def main():
    print("\nGenerating distribution charts …\n")
    for bot, style in BOTS.items():
        try:
            rows = load_distribution(bot)
            plot_bot(bot, rows, style["color"], style["accent"])
        except FileNotFoundError as e:
            print(f"  [SKIP] {bot}: {e}")
    print("\nDone.")


if __name__ == "__main__":
    main()
