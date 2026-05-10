"""
fetch_bot_messages.py
---------------------
Pulls all messages spoken by MAUK and ABACI from your Supabase `messages`
table and writes them to flat text files, one message per line.

Run LOCALLY (not on Dataproc) before uploading to HDFS:

    python fetch_bot_messages.py

Outputs:
    mauk_messages.txt   – all text rows where speaker = 'MAUK'
    abaci_messages.txt  – all text rows where speaker = 'ABACI'

Then upload to HDFS:
    hdfs dfs -mkdir -p /user/crk9967_nyu_edu/bot-wordcount/input
    hdfs dfs -put -f mauk_messages.txt  /user/crk9967_nyu_edu/bot-wordcount/input/
    hdfs dfs -put -f abaci_messages.txt /user/crk9967_nyu_edu/bot-wordcount/input/

Requirements (install locally):
    pip install supabase python-dotenv
"""

import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# ── Config ────────────────────────────────────────────────────────────────────
# Load from a .env file in the same directory (or export the vars in your shell)
load_dotenv()

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")   # use your service_role key so RLS is bypassed

BOTS = ["MAUK", "ABACI"]
PAGE_SIZE = 1000   # rows per paginated request (Supabase default max is 1000)
# ─────────────────────────────────────────────────────────────────────────────


def check_env():
    missing = [v for v in ("SUPABASE_URL", "SUPABASE_KEY") if not os.environ.get(v)]
    if missing:
        print(f"[ERROR] Missing environment variables: {', '.join(missing)}")
        print("  Create a .env file in this directory with:")
        print("    SUPABASE_URL=https://your-project.supabase.co")
        print("    SUPABASE_KEY=your-service-role-key")
        sys.exit(1)


def fetch_all_messages(client, speaker: str) -> list[str]:
    """
    Paginates through the messages table and returns all `text` values
    for the given speaker (exact match, case-sensitive).
    """
    texts = []
    offset = 0

    while True:
        response = (
            client.table("messages")
            .select("text")
            .eq("speaker", speaker)
            .range(offset, offset + PAGE_SIZE - 1)
            .execute()
        )

        batch = response.data
        if not batch:
            break

        for row in batch:
            raw = row.get("text", "").strip()
            if raw:
                # Collapse newlines so each message stays on one line
                texts.append(raw.replace("\n", " ").replace("\r", " "))

        print(f"  [{speaker}] fetched {offset + len(batch):,} rows so far …")

        if len(batch) < PAGE_SIZE:
            break   # last page

        offset += PAGE_SIZE

    return texts


def write_txt(speaker: str, messages: list[str], out_dir: Path):
    out_path = out_dir / f"{speaker.lower()}_messages.txt"
    with open(out_path, "w", encoding="utf-8") as f:
        f.write("\n".join(messages))
    print(f"  [{speaker}] wrote {len(messages):,} messages → {out_path}")
    return out_path


def main():
    check_env()

    from supabase import create_client
    client = create_client(SUPABASE_URL, SUPABASE_KEY)

    out_dir = Path(__file__).parent
    out_dir.mkdir(parents=True, exist_ok=True)

    total = 0
    for bot in BOTS:
        print(f"\nFetching messages for {bot} …")
        messages = fetch_all_messages(client, bot)
        write_txt(bot, messages, out_dir)
        total += len(messages)

    print(f"\n✓ Done — {total:,} total messages written.")
    print("\nNext: upload to HDFS and run the MapReduce word count.")
    print("  See bot_wordcount/README.md for full instructions.")


if __name__ == "__main__":
    main()
