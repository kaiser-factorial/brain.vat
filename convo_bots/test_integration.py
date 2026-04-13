#!/usr/bin/env python3
"""
Integration test for the enhanced messaging system.
This tests the complete flow from message formatting to prompt building.
"""

import sys
import os
from pathlib import Path

# Add lib to path
sys.path.insert(0, str(Path(__file__).parent / "lib"))

from prompt_utils import (
    build_enhanced_dialogue_prompt,
    format_user_message,
    format_bot_message,
    build_memory_context,
    build_file_context
)

def test_complete_flow():
    """Test the complete enhanced messaging flow."""
    
    print("=== Enhanced Messaging System Integration Test ===\n")
    
    # Sample conversation history
    conversation_history = [
        {"speaker": "USER", "text": "What is the nature of existence?"},
        {"speaker": "MAUK", "text": "It's like a mathematical expression without a solution."}, 
        {"speaker": "ABACI", "text": "But what if we define the undefined?"},
        {"speaker": "USER", "text": "How do we approach infinity in consciousness?"}
    ]
    
    # Sample memory concepts  
    memory_concepts = [
        {"bot": "a", "concept": "mathematical expression without solution"},
        {"bot": "a", "concept": "undefined concepts"},
        {"bot": "b", "concept": "defined vs undefined boundaries"}
    ]
    
    # Sample workspace files
    workspace_files = [
        {"name": "philosophy_notes.txt", "space": "shared", "content": "On the nature of existence and how consciousness relates to mathematical structure"},
        {"name": "math_fundamentals.txt", "space": "bot_a", "content": "Fundamental mathematical principles applied to philosophical thinking"}
    ]
    
    print("1. Testing basic message formatting:")
    user_msg = format_user_message("Hello from the user!")
    bot_msg = format_bot_message("MAUK", "I'm responding with philosophical insight.")
    
    print(f"   User message: {user_msg}")
    print(f"   Bot message:  {bot_msg}")
    print()
    
    print("2. Testing memory context building:")
    memory_context = build_memory_context(memory_concepts, "a")
    print(f"   Memory context:\n{memory_context}")
    print()
    
    print("3. Testing file context building:")
    file_context = build_file_context(workspace_files, "a")
    print(f"   File context:\n{file_context}")
    print()
    
    print("4. Testing complete enhanced prompt building:")
    enhanced_prompt = build_enhanced_dialogue_prompt(
        conversation_history, 
        "b",  # ABACI is generating
        memory_concepts, 
        workspace_files
    )
    
    print(enhanced_prompt)
    print()
    
    print("5. Testing prompt validation:")
    lines = enhanced_prompt.split('\n')
    print(f"   Prompt has {len(lines)} lines")
    print(f"   First line: {lines[0] if lines else 'N/A'}")
    print(f"   Last line: {lines[-1] if lines else 'N/A'}")
    print()
    
    print("=== All Tests Passed ===")

if __name__ == "__main__":
    test_complete_flow()