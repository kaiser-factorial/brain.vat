"""
Utility functions for message formatting and parsing in the frontend.
These complement the backend prompt utilities.
"""

import re
from typing import Dict, List, Optional

def format_user_message(text: str, speaker: str = "USER") -> str:
    """Format a user message with proper speaker tag."""
    return f"[{speaker}] SAYS: \"{text}\""

def format_bot_message(speaker: str, text: str) -> str:
    """Format a bot message with proper speaker tag."""
    return f"[{speaker}] SAYS: \"{text}\""

def format_bot_chain_message(speaker: str, text: str, continuation: str = None) -> str:
    """Format a bot message that chains to the next speaker."""
    if continuation:
        return f"[{speaker}] SAYS: \"{text}\" | [I] SAY: \"{continuation}\""
    return f"[{speaker}] SAYS: \"{text}\""

def parse_structured_message(text: str) -> Dict[str, str]:
    """
    Parse a structured message and return speaker and text.
    
    Returns a dict with 'speaker' and 'text' keys.
    """
    # Pattern to match [SPEAKER] SAYS: "text"
    pattern = r'\[([A-Z]+)\]\s+SAYS:\s+"(.+?)"'
    match = re.search(pattern, text.strip())
    
    if match:
        return {
            'speaker': match.group(1),
            'text': match.group(2)
        }
    
    # Fallback - return as-is  
    return {
        'speaker': 'UNKNOWN',
        'text': text.strip()
    }

def is_structured_message(text: str) -> bool:
    """Check if a message text uses the structured format."""
    return bool(re.search(r'\[([A-Z]+)\]\s+SAYS:\s+"', text))

def extract_message_speaker(text: str) -> str:
    """Extract the speaker from a structured message."""
    pattern = r'\[([A-Z]+)\]\s+SAYS:'
    match = re.search(pattern, text)
    return match.group(1) if match else 'UNKNOWN'

def extract_message_text(text: str) -> str:
    """Extract the text content from a structured message."""
    pattern = r'\[([A-Z]+)\]\s+SAYS:\s+"(.+?)"'
    match = re.search(pattern, text)
    return match.group(2) if match else text

def build_conversation_summary(history: List[Dict], max_messages: int = 10) -> str:
    """
    Build a simple text summary of conversation history.
    Useful for logging or debugging.
    """
    recent = history[-max_messages:] if history else []
    formatted = []
    
    for msg in recent:
        speaker = msg.get("speaker", "UNKNOWN")
        text = msg.get("text", "").strip()[:100]  # Truncate long text
        formatted.append(f"[{speaker}] SAYS: \"{text}\"")
    
    return "\n".join(formatted)

def validate_message_format(text: str) -> bool:
    """Validate that a message follows the required structure."""
    if not text:
        return False
    
    # Check for proper structure: [SPEAKER] SAYS: "text"
    pattern = r'^\[[A-Z]+\]\s+SAYS:\s+"(.+)"$'
    return bool(re.match(pattern, text.strip()))

# Testing function
def test_message_utils():
    """Test the utility functions."""
    test_messages = [
        "[USER] SAYS: \"What's your opinion on consciousness?\"",
        "[MAUK] SAYS: \"It's like a moon without a surface\""
    ]
    
    print("Testing message parsing:")
    for msg in test_messages:
        parsed = parse_structured_message(msg)
        print(f"Input:  {msg}")
        print(f"Parsed: {parsed}")
        print(f"Valid:  {validate_message_format(msg)}")
        print()

if __name__ == "__main__":
    test_message_utils()