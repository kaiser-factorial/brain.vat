"""
Frontend message handling utilities to work with the enhanced structured messaging system.
"""

import re
from typing import Dict, List, Optional


def format_user_message_for_frontend(text: str, speaker: str = "USER") -> str:
    """
    Format a user message for display in the frontend.
    This matches the structure expected by the backend.
    """
    return f"[{speaker}] SAYS: \"{text}\""


def format_bot_message_for_frontend(speaker: str, text: str) -> str:
    """
    Format a bot message for display in the frontend.
    """
    return f"[{speaker}] SAYS: \"{text}\""


def format_bot_chain_for_frontend(speaker: str, text: str, continuation: Optional[str] = None) -> str:
    """
    Format a bot message chain for display.
    """
    if continuation:
        return f"[{speaker}] SAYS: \"{text}\" | [I] SAY: \"{continuation}\""
    return f"[{speaker}] SAYS: \"{text}\""


def parse_message_for_frontend_display(text: str) -> Dict[str, str]:
    """
    Parse a structured message for frontend display.
    
    Returns a dictionary with 'speaker' and 'text' keys.
    """
    # Pattern to match [SPEAKER] SAYS: "text"
    pattern = r'\[([A-Z]+)\]\s+SAYS:\s+"(.+?)"(?:\s*|\s*\|\s*\[I\]\s+SAY:\s+"(.+?)")?'
    match = re.search(pattern, text.strip())
    
    if match:
        speaker = match.group(1)
        text_content = match.group(2)
        # Handle the continuation part if it exists
        continuation = match.group(3) if match.group(3) else None
        return {
            'speaker': speaker,
            'text': text_content,
            'continuation': continuation
        }
    
    # Fallback - return as-is  
    return {
        'speaker': 'UNKNOWN',
        'text': text.strip(),
        'continuation': None
    }


def is_structured_message_frontend(text: str) -> bool:
    """
    Check if a message text uses the structured format in frontend.
    """
    return bool(re.search(r'^\[[A-Z]+\]\s+SAYS:\s+"', text))


def extract_speaker_from_message(text: str) -> str:
    """
    Extract the speaker from a structured message (frontend format).
    """
    pattern = r'\[([A-Z]+)\]\s+SAYS:'
    match = re.search(pattern, text)
    return match.group(1) if match else 'UNKNOWN'


def build_frontend_prompt_from_history(history: List[Dict], max_context: int = 5) -> str:
    """
    Build a prompt-like string from conversation history for front-end debugging.
    """
    recent = history[-max_context:] if history else []
    formatted_lines = []
    
    for msg in recent:
        speaker = msg.get("speaker", "UNKNOWN")
        text = msg.get("text", "").strip()
        formatted_lines.append(f"[{speaker}] SAYS: \"{text}\"")
    
    return "\n".join(formatted_lines)


def validate_message_structure(text: str) -> bool:
    """
    Validate that a message follows the required structure for the frontend.
    
    Supports both simple and chain formats:
    - [SPEAKER] SAYS: "text"
    - [SPEAKER] SAYS: "text" | [I] SAY: "continuation"
    """
    if not text:
        return False
    
    # Simple format
    simple_pattern = r'^\[[A-Z]+\]\s+SAYS:\s+"(.+)"$'
    # Chain format  
    chain_pattern = r'^\[[A-Z]+\]\s+SAYS:\s+"(.+)"\s*\|\s*\[I\]\s+SAY:\s+"(.+)"$'
    
    return bool(re.match(simple_pattern, text.strip())) or bool(re.match(chain_pattern, text.strip()))


# Example components for Next.js/React integration
def generate_message_component(message_data: Dict) -> str:
    """
    Generate a React component-like HTML fragment for displaying messages.
    This shows how you might structure your message display components.
    """
    speaker = message_data.get('speaker', 'UNKNOWN')
    text = message_data.get('text', '')
    continuation = message_data.get('continuation')
    
    header_classes = "font-bold"
    if speaker == "USER":
        header_classes += " text-blue-600"
    elif speaker == "MAUK":
        header_classes += " text-purple-600"
    elif speaker == "ABACI":
        header_classes += " text-green-600"
    
    content = f'<div class="mb-2"><span class="{header_classes}">[{speaker}]</span>: {text}</div>'
    
    if continuation:
        content += f'<div class="ml-4 text-sm italic">[I] SAY: {continuation}</div>'
    
    return content


# Test functions
def test_frontend_utilities():
    """Test the frontend message utilities."""
    print("Testing frontend message utilities...")
    
    test_messages = [
        "[USER] SAYS: \"What's your opinion on consciousness?\"",
        "[MAUK] SAYS: \"It's like a moon without a surface\"",
        "[ABACI] SAYS: \"The void is a mathematical construct\" | [I] SAY: \"But what of the emotional resonance?\""
    ]
    
    for msg in test_messages:
        parsed = parse_message_for_frontend_display(msg)
        print(f"Input:  {msg}")
        print(f"Parsed: {parsed}")
        print(f"Valid:  {validate_message_structure(msg)}")
        print(f"Speaker: {extract_speaker_from_message(msg)}")
        print()


if __name__ == "__main__":
    test_frontend_utilities()