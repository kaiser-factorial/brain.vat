"""
word_count_distribution.py
--------------------------
Computes the FULL word frequency list (not just top-100) for MAUK and ABACI,
plus a bucketed histogram showing how counts are distributed across the vocab.

Run on Dataproc with:
    spark-submit bot_wordcount/word_count_distribution.py

Outputs (HDFS):
    /user/crk9967_nyu_edu/bot-wordcount/output/MAUK_full_vocab/
        – CSV: word, count  (all unique words, sorted by count desc)
    /user/crk9967_nyu_edu/bot-wordcount/output/MAUK_distribution/
        – CSV: bucket, unique_words, total_occurrences
    (same for ABACI)
"""

import re
import sys

from pyspark.sql import SparkSession
from pyspark.sql import functions as F
from pyspark.sql.types import LongType, StringType, StructField, StructType

# ── Configuration ─────────────────────────────────────────────────────────────
NETID    = "crk9967_nyu_edu"
HDFS_IN  = f"hdfs:///user/{NETID}/bot-wordcount/input"
HDFS_OUT = f"hdfs:///user/{NETID}/bot-wordcount/output"
# ─────────────────────────────────────────────────────────────────────────────

# ── Same stop words as the main script ────────────────────────────────────────
STOP_WORDS = {
    "", "s", "t", "re", "ve", "ll", "d",
}


def tokenize(line: str) -> list:
    line = line.lower()
    line = line.replace("'", "").replace("\u2019", "")
    line = re.sub(r"[^a-z0-9\s]", " ", line)
    return line.split()


def run_bot(sc, spark, bot_name: str):
    input_path   = f"{HDFS_IN}/{bot_name.lower()}_messages.txt"
    vocab_out    = f"{HDFS_OUT}/{bot_name}_full_vocab_NOSTOP"
    dist_out     = f"{HDFS_OUT}/{bot_name}_distribution_NOSTOP"

    print(f"\n{'='*60}")
    print(f"  {bot_name} — full vocabulary + distribution-- no stop words")
    print(f"{'='*60}")

    # ── Full word count (no top-N limit) ──────────────────────────────────────
    lines = sc.textFile(input_path)

    word_counts_rdd = (
        lines
        .flatMap(tokenize)
        .filter(lambda w: w not in STOP_WORDS)
        .filter(lambda w: len(w) > 1)
        .map(lambda w: (w, 1))
        .reduceByKey(lambda a, b: a + b)
    )

    # Convert to DataFrame for easier bucketing and saving
    schema = StructType([
        StructField("word",  StringType(), nullable=False),
        StructField("count", LongType(),   nullable=False),
    ])
    vocab_df = (
        spark.createDataFrame(word_counts_rdd, schema=schema)
        .orderBy(F.col("count").desc())
    )

    # Save full vocab
    vocab_df.coalesce(1).write.mode("overwrite").csv(vocab_out, header=True)

    total_unique = vocab_df.count()
    total_tokens = vocab_df.agg(F.sum("count").alias("total")).collect()[0]["total"]
    print(f"\n  Unique words (after stop-word filter): {total_unique:,}")
    print(f"  Total word occurrences:                {total_tokens:,}")
    print(f"  Mean count per unique word:            {total_tokens / total_unique:,.1f}")

    # ── Distribution histogram ────────────────────────────────────────────────
    # How many unique words have count in each bucket?
    bucket_expr = (
        F.when(F.col("count") == 1,      "01_exactly_1")
         .when(F.col("count") <= 2,      "02_exactly_2")
         .when(F.col("count") <= 5,      "03_3-5")
         .when(F.col("count") <= 10,     "04_6-10")
         .when(F.col("count") <= 25,     "05_11-25")
         .when(F.col("count") <= 50,     "06_26-50")
         .when(F.col("count") <= 100,    "07_51-100")
         .when(F.col("count") <= 250,    "08_101-250")
         .when(F.col("count") <= 500,    "09_251-500")
         .when(F.col("count") <= 1000,   "10_501-1000")
         .when(F.col("count") <= 5000,   "11_1001-5000")
         .otherwise(                     "12_5000+")
    )

    dist_df = (
        vocab_df
        .withColumn("bucket", bucket_expr)
        .groupBy("bucket")
        .agg(
            F.count("*").alias("unique_words"),
            F.sum("count").alias("total_occurrences"),
        )
        .orderBy("bucket")
    )

    dist_df.show(truncate=False)
    dist_df.coalesce(1).write.mode("overwrite").csv(dist_out, header=True)

    print(f"\n  Full vocab CSV → {vocab_out}")
    print(f"  Distribution CSV → {dist_out}")


def main():
    spark = (
        SparkSession.builder
        .appName("BotWordCount-Distribution")
        .getOrCreate()
    )
    spark.sparkContext.setLogLevel("WARN")
    sc = spark.sparkContext

    for bot in ["MAUK", "ABACI"]:
        try:
            run_bot(sc, spark, bot)
        except Exception as e:
            print(f"\n[ERROR] {bot}: {e}", file=sys.stderr)
            raise

    spark.stop()


if __name__ == "__main__":
    main()
