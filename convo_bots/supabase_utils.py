"""
Utility functions for interacting with Supabase database.
These help fetch memory concepts and workspace files for prompt building.
"""

import os
from typing import List, Dict, Optional
from datetime import datetime

# Supabase configuration from environment
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

def fetch_bot_with_retry(func):
    """Decorator for simple retry logic on Supabase calls."""
    def wrapper(*args, **kwargs):
        for i in range(3): # 3 attempts
            try:
                return func(*args, **kwargs)
            except Exception as e:
                if i == 2: raise e
                import time
                time.sleep(1)
        return None
    return wrapper

def get_supabase_client():
    """Initialize and return a Supabase client if configuration is available."""
    if not SUPABASE_URL or not SUPABASE_KEY:
        return None
    
    try:
        from supabase import create_client
        return create_client(SUPABASE_URL, SUPABASE_KEY)
    except ImportError:
        print("Supabase client not available (supabase package not installed)")
        return None

@fetch_bot_with_retry
def fetch_memory_concepts(sb_client, bot_id: str) -> List[Dict]:
    """
    Fetch memory concepts for a specific bot from Supabase.
    
    Returns list of concept dictionaries with keys: concept, weight, bot
    """
    if not sb_client:
        return []
        
    try:
        response = sb_client.table("memory_concepts").select("*").eq("bot", bot_id).execute()
        return response.data if response.data else []
    except Exception as e:
        print(f"Error fetching memory concepts: {e}")
        return []

@fetch_bot_with_retry
def fetch_workspace_files(sb_client, space: str) -> List[Dict]:
    """
    Fetch workspace files from a specific space.
    
    Returns list of file dictionaries with keys: name, content, space, modified
    """
    if not sb_client or not space:
        return []
        
    try:
        response = sb_client.table("workspace_files").select("*").eq("space", space).execute()
        return response.data if response.data else []
    except Exception as e:
        print(f"Error fetching workspace files: {e}")
        return []

def build_memory_concept_list(memory_data: List[Dict]) -> List[str]:
    """
    Convert memory concepts from database format to simple list of concepts.
    
    Args:
        memory_data: List of dictionaries from Supabase
        
    Returns:
        List of concept strings
    """
    concepts = []
    for item in memory_data:
        if "concept" in item:
            concepts.append(item["concept"])
    return concepts

def build_file_context_list(file_data: List[Dict]) -> List[Dict]:
    """
    Convert workspace file data into a format suitable for prompts.
    
    Args:
        file_data: List of file dictionaries from Supabase
        
    Returns:
        List of file dictionaries with content truncation
    """
    file_list = []
    for item in file_data:
        file_list.append({
            "name": item.get("name", "unknown"),
            "content": item.get("content", "")[:200] + "..." if len(item.get("content", "")) > 200 else item.get("content", ""),
            "space": item.get("space", "unknown")
        })
    return file_list

# Example usage function
def test_supabase_integration():
    """Test the Supabase integration functions."""
    print("Testing Supabase utilities...")
    print(f"Supabase URL: {SUPABASE_URL}")
    print(f"Supabase key available: {bool(SUPABASE_KEY)}")
    
    # Test data structure
    sample_memory = [
        {"bot": "a", "concept": "the void of the mind", "weight": 0.85},
        {"bot": "a", "concept": "moon without a surface", "weight": 0.72}
    ]
    
    concepts = build_memory_concept_list(sample_memory)
    print(f"Converted concepts: {concepts}")

def get_last_speaker(sb_client) -> Optional[str]:
    """Fetch the name of the speaker who posted the most recent message."""
    if not sb_client:
        return None
    try:
        response = sb_client.table("messages").select("speaker").order("created_at", desc=True).limit(1).execute()
        if response.data:
            return response.data[0].get("speaker")
    except Exception as e:
        print(f"Error fetching last speaker: {e}")
    return None

def update_bot_settings(sb_client, bot: str, settings: Dict) -> bool:
    """Update settings for a specific bot by archiving the old ones and inserting new ones."""
    if not sb_client:
        return False
    try:
        # Atomic-ish transition: 
        # 1. Prepare new payload first
        payload = {
            "bot": bot,
            **settings,
            "is_active": True,
            "updated_at": datetime.now().isoformat()
        }

        # 2. Deactivate current active settings ONLY after we are ready to insert
        # NOTE: This approach is slightly risky without a true transaction,
        # but combined with the frontend's 'Reconstruction' logic, it ensures stability.
        sb_client.table("bot_settings") \
            .update({"is_active": False}) \
            .eq("bot", bot) \
            .eq("is_active", True) \
            .execute()
            
        # 3. Insert new settings as active
        sb_client.table("bot_settings").insert(payload).execute()
        return True
    except Exception as e:
        # If deactivation failed to clear all active rows (race condition),
        # the Unique Index in SQL will stop the insert and throw an error here.
        logging.error(f"CRITICAL_SYNC_ERROR for {bot}: {e}")
        return False


@fetch_bot_with_retry
def fetch_system_settings(sb_client) -> Dict:
    """Fetch the single row of global system settings."""
    if not sb_client:
        return {"cycle_sleep": 120, "cycle_jitter": 30}
    try:
        response = sb_client.table("system_settings").select("*").eq("id", 1).execute()
        if response.data:
            return response.data[0]
    except Exception as e:
        print(f"Error fetching system settings: {e}")
    return {"cycle_sleep": 120, "cycle_jitter": 30}

def update_system_settings(sb_client, settings: Dict) -> bool:
    """Update the global system settings (id=1)."""
    if not sb_client:
        return False
    try:
        sb_client.table("system_settings").upsert({
            "id": 1,
            **settings,
            "updated_at": datetime.now().isoformat()
        }).execute()
        return True
    except Exception as e:
        print(f"Error updating system settings: {e}")
        return False
@fetch_bot_with_retry
def fetch_bot_settings(sb_client) -> List[Dict]:
    """Fetch all CURRENT ACTIVE bot settings from Supabase."""
    if not sb_client:
        return []
    try:
        # Fetch only the rows marked as active, most recent first
        response = sb_client.table("bot_settings") \
            .select("*") \
            .eq("is_active", True) \
            .order("updated_at", desc=True) \
            .execute()
        
        if not response.data:
            return []
            
        # Optional: In the unlikely event of multiple active rows per bot (race condition),
        # we filter here to ensure we only return one per bot type.
        unique_settings = {}
        for s in response.data:
            if s["bot"] not in unique_settings:
                unique_settings[s["bot"]] = s
        
        return list(unique_settings.values())
    except Exception as e:
        print(f"Error fetching bot settings: {e}")
        return []

if __name__ == "__main__":
    test_supabase_integration()