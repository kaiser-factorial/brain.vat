import os
from supabase import create_client
from dotenv import load_dotenv

load_dotenv("convo_bots/.env")
url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_KEY")
sb = create_client(url, key)

print("--- memory_archive occurrence counts ---")
res = sb.table("memory_archive").select("concept, occurrence_count").order("occurrence_count", desc=True).limit(5).execute()
print(res.data)

print("--- memory_concepts weights ---")
res2 = sb.table("memory_concepts").select("concept, weight").order("weight", desc=True).limit(5).execute()
print(res2.data)
