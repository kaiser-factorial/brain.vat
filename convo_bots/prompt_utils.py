"""
Utility functions for building lean bot prompts that align with original .txt training data.
"""

import os
from typing import List, Dict

# Get configuration from environment
BOT_A_NAME = os.getenv("BOT_A_NAME", "MAUK")
BOT_B_NAME = os.getenv("BOT_B_NAME", "ABACI")
USER_NAME = os.getenv("USER_NAME", "brick.factorial")

def format_message(speaker: str, text: str) -> str:
    """Barebones dialogue format: [NAME]: TEXT"""
    return f"[{speaker}]: {text}"

def build_enhanced_dialogue_prompt(
    history: List[Dict], 
    generating_bot: str, 
    memory_concepts: List[Dict] = None,
    workspace_files: List[Dict] = None,
    context_turns: int = 4,
    bot_name_override: str = None,
) -> str:
    """
    Lean prompt builder that returns to the original dialogue format.
    Removed INSTRUCTION, MEMORY, and FILE blocks to stop model confusion.
    Supports bot keys a/b (MAUK/ABACI) and any additional bots via bot_name_override.
    """
    _name_map = {"a": BOT_A_NAME, "b": BOT_B_NAME}
    bot_name = bot_name_override or _name_map.get(generating_bot, generating_bot.upper())
    
    lines = []
    
    # Simple history only - this is what the models were trained on
    recent_history = history[-context_turns:] if history else []
    for msg in recent_history:
        speaker = msg["speaker"]
        text = msg["text"].strip().replace("\n", " ")
        lines.append(f"[{speaker}]: {text}")
    
    # Final prompt for completion
    lines.append(f"[{bot_name}]:")
    
    return "\n".join(lines)