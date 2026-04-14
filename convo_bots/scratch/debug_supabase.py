import os
from supabase import create_client
from dotenv import load_dotenv

load_dotenv("convo_bots/.env")
url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_SERVICE_KEY")
sb = create_client(url, key)

res = sb.table("messages").select("*").order("created_at", desc=True).limit(5).execute()
print(f"Latest Messages in {url}:")
for m in res.data:
    print(f"[{m['created_at']}] {m['speaker']}: {m['text'][:50]}...")
