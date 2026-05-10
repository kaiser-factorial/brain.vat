"""
word_count_mapreduce.py
-----------------------
PySpark MapReduce word count for MAUK and ABACI bot messages.

Reads two text files from HDFS (one per bot), applies a Map → Shuffle → Reduce
pipeline in the classic MapReduce style using PySpark's lower-level RDD API,
filters out stop words, then saves the top 100 words per bot to HDFS as CSV.

Run on Dataproc with:
    spark-submit bot_wordcount/word_count_mapreduce.py

Outputs (saved to HDFS):
    /user/crk9967_nyu_edu/bot-wordcount/output/MAUK/   – CSV with rank,word,count
    /user/crk9967_nyu_edu/bot-wordcount/output/ABACI/  – CSV with rank,word,count
"""

import re
import sys

from pyspark.sql import SparkSession
from pyspark.sql import functions as F
from pyspark.sql.types import IntegerType, LongType, StringType, StructField, StructType

# ── Configuration ─────────────────────────────────────────────────────────────
NETID   = "crk9967_nyu_edu"
HDFS_IN = f"hdfs:///user/{NETID}/bot-wordcount/input"
HDFS_OUT = f"hdfs:///user/{NETID}/bot-wordcount/output"
TOP_N   = 100
# ─────────────────────────────────────────────────────────────────────────────

# ── Stop word list ────────────────────────────────────────────────────────────
# General English stop words + common chat filler
STOP_WORDS = {
    # articles / determiners
    "a", "an", "the",
    # conjunctions
    "and", "but", "or", "nor", "for", "yet", "so",
    "although", "because", "since", "while", "though",
    # prepositions
    "of", "in", "to", "for", "with", "on", "at", "from", "by",
    "about", "as", "into", "through", "during", "before", "after",
    "above", "below", "between", "out", "off", "over", "under",
    "again", "then", "once", "here", "there", "up", "down",
    # pronouns
    "i", "me", "my", "myself", "we", "our", "ours", "ourselves",
    "you", "your", "yours", "yourself", "yourselves",
    "he", "him", "his", "himself", "she", "her", "hers", "herself",
    "it", "its", "itself", "they", "them", "their", "theirs", "themselves",
    "what", "which", "who", "whom", "this", "that", "these", "those",
    # common verbs / auxiliaries
    "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "having",
    "do", "does", "did", "doing",
    "will", "would", "shall", "should",
    "may", "might", "must", "can", "could",
    "am", "get", "got", "let", "put", "say", "said",
    # negation
    "not", "no", "never", "neither", "nor",
    # contractions (after stripping apostrophes)
    "dont", "doesnt", "didnt", "cant", "wont", "wouldnt", "shouldnt",
    "isnt", "arent", "wasnt", "werent", "havent", "hasnt", "hadnt",
    "im", "ive", "id", "ill", "youre", "youve", "youd", "youll",
    "hes", "shes", "its", "weve", "wed", "well", "theyre", "theyve",
    "thats", "theres",
    # common chat fillers
    "ok", "okay", "yeah", "yes", "yep", "nope", "oh", "ah", "um",
    "uh", "like", "just", "also", "even", "still", "already", "now",
    "really", "actually", "basically", "literally", "well", "so",
    "too", "very", "quite", "rather", "pretty", "much", "more",
    "most", "some", "any", "all", "both", "each", "few", "many",
    "other", "same", "such", "than", "then", "when", "where", "why",
    "how", "if", "only", "own", "new", "first", "last", "long",
    "great", "little", "right", "make", "look", "know", "think",
    "go", "come", "see", "use", "find", "give", "tell", "feel",
    "try", "ask", "seem", "leave", "call", "keep", "need", "want",
    "mean", "become", "show", "take", "help", "start",
    # punctuation fragments that sometimes survive splitting
    "", "s", "t", "re", "ve", "ll", "d",
}
# ─────────────────────────────────────────────────────────────────────────────


def tokenize(line: str) -> list[str]:
    """
    Lowercase, strip punctuation (but keep intra-word apostrophes first so
    contractions become single tokens after apostrophe removal), then split.
    """
    line = line.lower()
    # Remove apostrophes so "don't" → "dont" (matched in stop words above)
    line = line.replace("'", "").replace("\u2019", "")
    # Keep only letters, digits, and spaces
    line = re.sub(r"[^a-z0-9\s]", " ", line)
    return line.split()


def run_bot(sc, bot_name: str, input_path: str, output_path: str):
    """
    Classic MapReduce word count pipeline for a single bot's text file.

    Map:    line  → (word, 1) for each token
    Reduce: (word, [1,1,…]) → (word, total_count)
    Then filter stop words and take top-N.
    """
    print(f"\n{'='*60}")
    print(f"  Processing: {bot_name}")
    print(f"  Input:      {input_path}")
    print(f"{'='*60}")

    # ── MAP ──────────────────────────────────────────────────────────────────
    # Read the text file; each element of the RDD is one line (one message).
    lines = sc.textFile(input_path)

    word_pairs = (
        lines
        .flatMap(tokenize)                          # line → [word, word, ...]
        .filter(lambda w: w not in STOP_WORDS)      # drop stop words
        .filter(lambda w: len(w) > 1)               # drop single chars
        .map(lambda w: (w, 1))                      # (word, 1)
    )

    # ── SHUFFLE + REDUCE ─────────────────────────────────────────────────────
    word_counts = (
        word_pairs
        .reduceByKey(lambda a, b: a + b)            # sum counts per word
    )

    # ── TOP-N ────────────────────────────────────────────────────────────────
    # Collect top-N locally (the result is tiny) — avoids a second Spark job
    top_n = (
        word_counts
        .sortBy(lambda pair: pair[1], ascending=False)
        .take(TOP_N)
    )

    print(f"\n  Top {TOP_N} words for {bot_name}:")
    print(f"  {'Rank':<6} {'Word':<25} {'Count':>10}")
    print(f"  {'-'*44}")
    for rank, (word, count) in enumerate(top_n, start=1):
        print(f"  {rank:<6} {word:<25} {count:>10,}")

    # ── SAVE TO HDFS ─────────────────────────────────────────────────────────
    # Build a small DataFrame for a clean CSV output
    spark = SparkSession.builder.getOrCreate()
    schema = StructType([
        StructField("rank",  IntegerType(), nullable=False),
        StructField("word",  StringType(),  nullable=False),
        StructField("count", LongType(),    nullable=False),
    ])
    rows = [(rank, word, int(count)) for rank, (word, count) in enumerate(top_n, start=1)]
    df = spark.createDataFrame(rows, schema=schema)

    df.coalesce(1).write.mode("overwrite").csv(output_path, header=True)
    print(f"\n  ✓ Results saved to: {output_path}")

    return top_n


def main():
    spark = (
        SparkSession.builder
        .appName("BotWordCount-MapReduce")
        .getOrCreate()
    )
    spark.sparkContext.setLogLevel("WARN")
    sc = spark.sparkContext

    bots = [
        ("MAUK",  f"{HDFS_IN}/mauk_messages.txt",  f"{HDFS_OUT}/MAUK"),
        ("ABACI", f"{HDFS_IN}/abaci_messages.txt", f"{HDFS_OUT}/ABACI"),
    ]

    results = {}
    for bot_name, input_path, output_path in bots:
        try:
            top_n = run_bot(sc, bot_name, input_path, output_path)
            results[bot_name] = top_n
        except Exception as e:
            print(f"\n[ERROR] Failed to process {bot_name}: {e}", file=sys.stderr)
            raise

    # ── Summary comparison ────────────────────────────────────────────────────
    print("\n\n" + "="*70)
    print("  SUMMARY — Top 10 words per bot")
    print("="*70)
    col = 30
    print(f"  {'MAUK':<{col}}  {'ABACI'}")
    print(f"  {'-'*col}  {'-'*col}")
    mauk_top  = results.get("MAUK",  [])[:10]
    abaci_top = results.get("ABACI", [])[:10]
    for i in range(max(len(mauk_top), len(abaci_top))):
        m = f"{mauk_top[i][0]}  ({mauk_top[i][1]:,})"   if i < len(mauk_top)  else ""
        a = f"{abaci_top[i][0]}  ({abaci_top[i][1]:,})" if i < len(abaci_top) else ""
        print(f"  {m:<{col}}  {a}")

    print(f"\n  Full CSV results in HDFS:")
    for _, _, out in bots:
        print(f"    {out}/")
    print()

    spark.stop()


if __name__ == "__main__":
    main()
