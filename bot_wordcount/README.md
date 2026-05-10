# Bot Word Count — MapReduce Pipeline

Counts the top 100 words spoken by **MAUK** and **ABACI**, excluding English
stop words, using a PySpark MapReduce pipeline on the course Dataproc cluster.

---

## Files

| File | Where it runs | Purpose |
|---|---|---|
| `fetch_bot_messages.py` | **local** | Pulls messages from Supabase → `.txt` files |
| `word_count_mapreduce.py` | **Dataproc** | PySpark MapReduce → top-100 CSVs in HDFS |
| `.env.example` | — | Credential template (copy to `.env`) |

---

## Step 1 — Set up credentials (local)

```bash
cd bot_wordcount/
cp .env.example .env
# open .env and fill in SUPABASE_URL and SUPABASE_KEY
```

> **Use the `service_role` key** from Supabase → Project Settings → API.
> This bypasses Row Level Security so you get all rows regardless of `user_id`.

---

## Step 2 — Install local dependencies

```bash
pip install supabase python-dotenv
```

---

## Step 3 — Fetch messages from Supabase (local)

```bash
python bot_wordcount/fetch_bot_messages.py
```

This produces two files in `bot_wordcount/`:
- `mauk_messages.txt`
- `abaci_messages.txt`

One message per line. Typically small (a few MB at most).

---

## Step 4 — Push the text files to your repo and clone on Dataproc

```bash
# From the repo root — add only the txt files (not .env!)
git add bot_wordcount/mauk_messages.txt bot_wordcount/abaci_messages.txt
git add bot_wordcount/word_count_mapreduce.py bot_wordcount/fetch_bot_messages.py
git commit -m "feat: add bot word count pipeline + message text files"
git push 
```

Then on the Dataproc cluster:

```bash
cd ~/capstone-cap_51
git pull origin kaiser-sol
```

---

## Step 5 — Upload text files to HDFS

```bash
# Create the input directory
hdfs dfs -mkdir -p /user/crk9967_nyu_edu/bot-wordcount/input

# Upload both text files
hdfs dfs -put -f bot_wordcount/mauk_messages.txt  /user/crk9967_nyu_edu/bot-wordcount/input/
hdfs dfs -put -f bot_wordcount/abaci_messages.txt /user/crk9967_nyu_edu/bot-wordcount/input/

# Confirm
hdfs dfs -ls /user/crk9967_nyu_edu/bot-wordcount/input/
```

---

## Step 6 — Run the MapReduce job

```bash
spark-submit bot_wordcount/word_count_mapreduce.py
```

The job will print the top 100 words per bot to stdout as it runs,
then print a side-by-side top-10 summary at the end.

Monitor with:

```bash
yarn application -list
yarn logs -applicationId <app_id> -log_files stdout
```

---

## Step 7 — Download the results

Output CSVs land in HDFS at:
- `/user/crk9967_nyu_edu/bot-wordcount/output/MAUK/`
- `/user/crk9967_nyu_edu/bot-wordcount/output/ABACI/`

Download locally:

```bash
# The actual CSV has a Spark-generated name like part-00000-....csv
hdfs dfs -get /user/crk9967_nyu_edu/bot-wordcount/output/MAUK/  ./bot_wordcount/results/MAUK/
hdfs dfs -get /user/crk9967_nyu_edu/bot-wordcount/output/ABACI/ ./bot_wordcount/results/ABACI/
```

---

## MapReduce Design

The pipeline uses PySpark's **RDD API** — the closest abstraction to raw
Hadoop MapReduce that Spark exposes:

```
textFile()       — read HDFS text file (one line = one message)
  │
  ▼
flatMap(tokenize) — MAP: each message → list of lowercase tokens
  │
  ▼
filter(stop words) — drop stop words + single characters
  │
  ▼
map(w → (w, 1))    — emit key-value pairs
  │
  ▼
reduceByKey(+)     — REDUCE: sum counts per word (shuffle happens here)
  │
  ▼
sortBy(count desc) — sort by frequency
  │
  ▼
take(100)          — top-100 per bot
  │
  ▼
write CSV to HDFS  — one coalesced file per bot
```
