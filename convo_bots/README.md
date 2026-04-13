# Brain.vat Enhanced Messaging System

This document explains the enhanced messaging system for brain.vat, which improves conversation quality by structuring prompts to better align with your .txt trained GPT-2 models.

## System Architecture

The enhanced system consists of:

1. **Backend Utilities** (`lib/`):
   - `prompt_utils.py`: Core prompt building with memory and file integration
   - `message_utils.py`: Message formatting/parsing functions
   - `supabase_utils.py`: Database integration for memory and files

2. **Enhanced Prompt Format**:
```
INSTRUCTION: Respond as [BOT_NAME] in a philosophical, introspective style
MEMORY: [concept]
MEMORY: [concept]
FILE_CONTEXT: [file name]: [content preview]
[USER] SAYS: "user question"
[MAUK] SAYS: "previous response"  
[ABACI] SAYS: "previous response"
RESPONSE: [BOT] SAYS:
```

## Key Features

### 1. Enhanced Context Handling
- Automatic integration of memory concepts from bot memory graphs
- File context from workspace system  
- Recent conversation history (configurable number of turns)

### 2. Improved Message Formatting
- Structured speaker tags: `[USER]`, `[MAUK]`, `[ABACI]`
- Consistent format matching .txt training data
- Support for message chaining when needed

### 3. Backward Compatibility
- Maintains compatibility with existing message formats
- Gradual implementation possible
- Fallback mechanisms in place

## Implementation Status

### Backend Implementation Complete:
✓ Enhanced prompt building in `server.py`  
✓ Updated `build_dialogue_prompt` function  
✓ Integrated memory concepts into prompts  
✓ Added structured message formatting utilities

### Frontend Implementation (Next Steps):
✓ Message formatting functions available
✓ Parsing utilities for display components
✓ Need to update React components in `message-feed.tsx` and friends

## Usage Examples

### Building Enhanced Prompts
```python
from lib.prompt_utils import build_enhanced_dialogue_prompt

# Basic usage
prompt = build_enhanced_dialogue_prompt(
    history=conversation_history, 
    generating_bot='a',  # 'a' for MAUK, 'b' for ABACI
    memory_concepts=memory_data,
    workspace_files=file_data
)
```

### Formatting Messages
```python
from lib.message_utils import format_user_message, format_bot_message

user_msg = format_user_message("Hello there!")
bot_msg = format_bot_message("MAUK", "I'm philosophical!")
```

## Testing

Run the utility tests:
```bash
cd convo_bots
python -m pytest lib/  # if you have pytest
# Or run individual tests:
python lib/prompt_utils.py
python lib/frontend_message_handlers.py
```

## Next Steps

1. Update React components to use structured messaging format
2. Implement Supabase integration for memory and file fetching  
3. Test conversation flows between MAUK and ABACI
4. Validate that prompts align with .txt training patterns

The enhanced system should provide better context awareness, more natural conversation flow, and more effective utilization of your trained models' capabilities.