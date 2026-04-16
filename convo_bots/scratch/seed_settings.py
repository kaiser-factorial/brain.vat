import os
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print(f"Error: SUPABASE_URL ({SUPABASE_URL}) or SUPABASE_SERVICE_KEY ({SUPABASE_KEY}) not found in .env")
    exit(1)

# Clean quotes if any
SUPABASE_URL = SUPABASE_URL.strip('"')
SUPABASE_KEY = SUPABASE_KEY.strip('"')

sb = create_client(SUPABASE_URL, SUPABASE_KEY)

print("Checking if bot_settings table exists by attempting a fetch...")
try:
    res = sb.table("bot_settings").select("*").execute()
    print("Table exists.")
except Exception as e:
    print(f"Table might not exist: {e}")
    print("\n--- ACTION REQUIRED ---")
    print("Please run the following SQL in your Supabase SQL Editor:")
    print("""
CREATE TABLE IF NOT EXISTS bot_settings (
  bot TEXT PRIMARY KEY CHECK (bot IN ('a', 'b')),
  temperature FLOAT DEFAULT 0.9,
  top_p FLOAT DEFAULT 0.95,
  banned_words TEXT[] DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO bot_settings (bot, temperature, top_p, banned_words)
VALUES 
  ('a', 0.95, 0.95, '{"iced", " iced", "Iced", " Iced"}'),
  ('b', 1.25, 0.95, '{}')
ON CONFLICT (bot) DO NOTHING;

ALTER TABLE bot_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read" ON bot_settings FOR SELECT USING (true);
CREATE POLICY "Allow service_role updates" ON bot_settings FOR ALL USING (true);
    """)
    exit(1)

# If it exists, seed defaults if empty
if not res.data:
    print("Seeding default settings...")
    sb.table("bot_settings").upsert([
        {'bot': 'a', 'temperature': 0.95, 'top_p': 0.95, 'banned_words': ['iced', ' iced', 'Iced', ' Iced']},
        {'bot': 'b', 'temperature': 1.25, 'top_p': 0.95, 'banned_words': []}
    ]).execute()
    print("Seeding complete.")
else:
    print("Table already has data.")
