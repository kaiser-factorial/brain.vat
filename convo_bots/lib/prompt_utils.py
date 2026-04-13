"""
Utility functions for building enhanced bot prompts that align with .txt training data.
"""

import os
from datetime import datetime
from typing import List, Dict, Optional

# Get configuration from environment
BOT_A_NAME = os.getenv("BOT_A_NAME", "MAUK")
BOT_B_NAME = os.getenv("BOT_B_NAME", "ABACI")
USER_NAME = os.getenv("USER_NAME", "CORINA")

def format_message(speaker: str, text: str) -> str:
    """Format a message with speaker tag as used in .txt training data."""
    return f"[{speaker}] SAYS: \"{text}\""

def format_user_message(text: str) -> str:
    """Format a user message with proper speaker tag."""
    return f"[{USER_NAME}] SAYS: \"{text}\""

def format_bot_message(speaker: str, text: str) -> str:
    """Format a bot message with proper speaker tag."""
    return f"[{speaker}] SAYS: \"{text}\""

def format_bot_chain_message(speaker: str, text: str, continuation: str = None) -> str:
    """Format a bot message that chains to the next speaker."""
    if continuation:
        return f"[{speaker}] SAYS: \"{text}\" | [I] SAY: \"{continuation}\""
    return f"[{speaker}] SAYS: \"{text}\""

def build_context_block(context_items: List[str], block_type: str = "CONTEXT") -> str:
    """Build a structured context block."""
    if not context_items:
        return ""
    return f"{block_type}:\n" + "\n".join(context_items)

def build_memory_context(memory_concepts: List[Dict], bot_id: str) -> str:
    """Build memory context for the specific bot."""
    if not memory_concepts:
        return ""
    
    # Filter concepts for the specific bot
    bot_memory = [concept["concept"] for concept in memory_concepts if concept.get("bot") == bot_id]
    if not bot_memory:
        return ""
    
    return build_context_block([f"[MEMORY] {concept}" for concept in bot_memory], "MEMORY")

def build_file_context(workspace_files: List[Dict], bot_id: str) -> str:
    """Build file context for the specific bot."""
    if not workspace_files:
        return ""
    
    # Filter files for this bot or shared space
    bot_files = [f for f in workspace_files if f.get("space") == f"bot_{bot_id}" or f.get("space") == "shared"]
    if not bot_files:
        return ""
    
    file_contents = []
    for file in bot_files:
        file_contents.append(f"[FILE] {file.get('name', 'unknown')}: {file.get('content', '')[:100]}...")
    
    return build_context_block(file_contents, "FILE_CONTEXT")

def build_enhanced_dialogue_prompt(
    history: List[Dict], 
    generating_bot: str, 
    memory_concepts: List[Dict] = None,
    workspace_files: List[Dict] = None,
    context_turns: int = 4  # Reduced to prevent overwhelm - GPT-2 models perform better with less context
) -> str:
    """
    Enhanced prompt building function that mirrors .txt training data patterns.
    
    This implementation includes intelligent context limiting to prevent 
    overwhelming the GPT-2 models with too much conversation history.
    
    The system caps conversation context to prevent model overload. By taking
    only the most recent N messages from history (where N = context_turns), 
    we naturally avoid including old user messages that are no longer relevant
    to the current conversation flow.
    
    Format follows:
    INSTRUCTION: Respond as X
    MEMORY: [concept]
    FILE_CONTEXT: [file content]
    [USER] SAYS: "..."
    [BOT1] SAYS: "..."
    [BOT2] SAYS: "..."
    RESPONSE: [BOT] SAYS:
    """
    bot_name = BOT_A_NAME if generating_bot == "a" else BOT_B_NAME
    
    lines = []
    
    # Add instructions
    lines.append(f"INSTRUCTION: Respond as {bot_name} in a philosophical, introspective style")
    
    # Add memory context (always include memory concepts for context)
    memory_context = build_memory_context(memory_concepts or [], generating_bot)
    if memory_context:
        lines.append(memory_context)
    
    # Add file context (limit to 1-2 most relevant files if any)
    file_context = build_file_context(workspace_files or [], generating_bot)
    if file_context:
        lines.append(file_context)
    
    # Add recent conversation history with intelligent limiting based on relevance
    # Only include messages that are actually relevant to the current response
    # This prevents scenarios where old user messages that aren't part of current 
    # conversation flow are unnecessarily included in the context
    if history:
        # Get recent context with the specified limit
        recent_history = history[-context_turns:] if history else []
        
        # Filter to only include messages that are within the recent conversation window
        # This prevents old user messages from appearing in prompts when they're 
        # no longer relevant to the current response
        for msg in recent_history:
            speaker = msg["speaker"]
            text = msg["text"].strip().replace("\n", " ")
            lines.append(f"[{speaker}] SAYS: \"{text}\"")
    
    # Add directive for bot to respond
    lines.append(f"RESPONSE: [{bot_name}] SAYS:")
    
    return "\n".join(lines)

def format_prompt_for_training(prompt_text: str) -> str:
    """Clean and format prompt to match exact .txt training data patterns."""
    # Remove extra whitespace
    lines = [line.strip() for line in prompt_text.split('\n') if line.strip()]
    return '\n'.join(lines)

def build_context_summary(history: List[Dict], context_turns: int = 6) -> str:
    """Build a simple summary of conversation context."""
    recent = history[-context_turns:] if history else []
    
    # Format for display or logging
    formatted = []
    for msg in recent:
        speaker = msg.get("speaker", "UNKNOWN")
        text = msg.get("text", "").strip()[:100]  # Truncate long text
        formatted.append(f"[{speaker}] SAYS: \"{text}\"")
    
    return "\n".join(formatted)

# Testing function to verify the output format
def test_prompt_formatting():
    """Test the prompt building with sample data."""
    sample_history = [
        {"speaker": "USER", "text": "What's your opinion on the nature of consciousness?"},
        {"speaker": "MAUK", "text": "It's like a moon without a surface, only the void of the mind."}
    ]
    
    sample_memory = [
        {"bot": "a", "concept": "the void of the mind"},
        {"bot": "a", "concept": "moon without a surface"}
    ]
    
    sample_files = [
        {"name": "philosophy_notes.txt", "space": "shared", "content": "The nature of existence and consciousness"},
        {"name": "mathematical_fundamentals.txt", "space": "bot_a", "content": "Fundamental principles of topology"}
    ]
    
    prompt = build_enhanced_dialogue_prompt(
        sample_history, 
        "b",
        sample_memory,
        sample_files
    )
    
    print("Generated Prompt:")
    print(prompt)
    return prompt

if __name__ == "__main__":
    test_prompt_formatting()