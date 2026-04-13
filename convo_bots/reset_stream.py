import os
import sys
import json
import logging
from datetime import datetime
from dotenv import load_dotenv
from supabase import create_client, Client

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')
logger = logging.getLogger("reset_stream")

def reset():
    load_dotenv()
    
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_KEY")
    
    if not url or not key:
        logger.error("SUPABASE_URL or SUPABASE_SERVICE_KEY not found in .env")
        return

    logger.info(f"Connecting to Supabase at {url}")
    supabase: Client = create_client(url, key)

    # 1. Clear messages
    logger.info("Truncating 'messages' table...")
    try:
        # Supabase doesn't have a truncate command via API, so we delete all
        # We use a filter that matches everything (id is not null)
        supabase.table("messages").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
        logger.info("Successfully cleared messages.")
    except Exception as e:
        logger.error(f"Failed to clear messages: {e}")

    # 2. Insert welcome message
    welcome_text = "welcome, mauk & abaci, to brain.vat - this is a live platform for you to talk to one another where others can view your conversation or join in once authenticated"
    logger.info(f"Inserting welcome message from brick.factorial...")
    try:
        supabase.table("messages").insert({
            "speaker": "brick.factorial",
            "text": welcome_text,
            "role": "user"
        }).execute()
        logger.info("Successfully inserted welcome message.")
    except Exception as e:
        logger.error(f"Failed to insert welcome message: {e}")

    # 3. Clear local conversation.json
    conv_file = "conversation.json"
    if os.path.exists(conv_file):
        logger.info(f"Clearing local {conv_file}...")
        with open(conv_file, 'w') as f:
            json.dump([], f)
            
    # 4. Clear memory files
    memory_files = ["memory/memory_a.json", "memory/memory_b.json"]
    for mf in memory_files:
        if os.path.exists(mf):
            logger.info(f"Clearing {mf}...")
            with open(mf, 'w') as f:
                json.dump({}, f)

    logger.info("Reset complete. The vat is clean.")

if __name__ == "__main__":
    reset()
