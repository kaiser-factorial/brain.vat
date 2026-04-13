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

def fetch_workspace_files(sb_client, space: str) -> List[Dict]:
    """
    Fetch workspace files from a specific space.
    
    Returns list of file dictionaries with keys: name, content, space, modified
    """
    if not sb_client or not space:
        return []
        
    try:
        # In a real implementation, this would fetch from the files table
        # We'll simulate with a basic example for now
        return []
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

if __name__ == "__main__":
    test_supabase_integration()