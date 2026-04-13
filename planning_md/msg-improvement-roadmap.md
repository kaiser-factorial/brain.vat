# Brain.vat Messaging Platform Improvement Roadmap

## Executive Summary

This document outlines a comprehensive approach to improve the conversational prompting system for brain.vat's NTP (Neural Text Processing) bots. The objective is to enhance bot responses to be more context-aware and structured, particularly for MAUK and ABACI personalities that are trained on GPT-2 with .txt formatted training data.

## Current System Status

### Message Handling Architecture
- **Frontend**: React/Next.js with Supabase database integration
- **Messaging Structure**: Simple unformatted messages stored in 'messages' table
- **Bot Personality**: MAUK and ABACI respond as distinct agents
- **Training Data**: GPT-2 models trained on .txt formatted prompts
- **Current Limitations**:
  - Messages lack clear context structure
  - Bots don't receive optimal formatting for proper conversational turns  
  - Limited contextual awareness with recent conversation history
  - Prompt structures not optimized for .txt-based model training

## Phase 1: Contextual Message Enhancement

### 1.1. Enhanced Message Formatting Framework
**Objective**: Create structured prompt formatting that works with .txt model training.

#### Current State:
Messages are stored as simple text with speaker tags. Example:
```
User: "What's your opinion on this?"
```

#### Proposed Enhanced Format:
Messages will be formatted with structured contexts for better model understanding:
```
[CONTEXT]
[USER] SAYS: "What's your opinion on this?"
[MAUK] SAYS: "I think this is interesting but..."
```

### 1.2. Recent Conversation History Integration
**Objective**: Provide optimal context without overwhelming the bot.

#### Implementation:
- Store and retrieve the last 5 messages per conversation
- Format according to the GPT-2 .txt training conventions
- Add clear speaker identification patterns

```typescript
// Format context for model input
interface MessageContext {
  recentMessages: {
    speaker: string,
    text: string,
    timestamp: string
  }[];
}
```

### 1.3. Speaker-Specific Prompt Templates
**Objective**: Ensure each bot receives appropriately formatted prompts based on their role.

#### Template Structure:
**For MAUK:**
```
INSTRUCTION: MAUK is a philosophical analyzer...
CONTEXT: [USER] SAYS: "..."
RESPONSE: [MAUK] SAYS: "..."
```

**For ABACI:**
```
INSTRUCTION: ABACI is a skeptical counter-analyzer...
CONTEXT: [USER] SAYS: "..."
RESPONSE: [ABACI] SAYS: "..."
```

## Phase 2: Turn-Based Prompt Engineering

### 2.1. Alternating Personality Response Logic
**Objective**: Create structured turn flow between MAUK and ABACI.

#### Implementation Strategy:
1. Track the last speaker in conversation context
2. Use appropriate template based on expected next speaker
3. Add "response flow" indicators to maintain conversation structure

#### Sample Implementation:
```typescript
// In bot processing logic
const nextExpectedSpeaker = context.lastSpeaker === 'MAUK' ? 'ABACI' : 'MAUK';
const template = buildPromptTemplate(nextExpectedSpeaker, context);
```

### 2.2. Response Chaining Enhancement
**Objective**: Enable bots to respond to specific parts of previous conversations.

#### Format:
```
[MAUK] SAYS: "That raises an interesting point about the implications."
| [I] SAY: "I agree, but let's consider the alternative."
```

This structure helps models understand:
- Response to prior statement
- Flow from previous to next speaker
- Clear conversational turn patterns

## Phase 3: Integration with Existing Memory System

### 3.1. Memory Concept Enhancement
**Objective**: Integrate current memory concepts with contextual prompting.

#### Current Memory Component:
- Stored in `memory_concepts` table
- Associated with bots ('a' for MAUK, 'b' for ABACI)
- Weighted with importance scores

#### Enhanced Integration:
```typescript
// In message context building
const memoryContext = memoryConcepts
  .filter(concept => concept.bot === botId)
  .sort((a, b) => b.weight - a.weight)
  .slice(0, 3) // Top 3 most weighted concepts
  .map(concept => `[MEMORY] ${concept.concept}`) // Format for .txt
  .join('\n');
```

### 3.2. File Context Integration
**Objective**: Incorporate file context from storage system when available.

#### File Context Structure:
```typescript
// Add to context building
const fileContext = workspaceFiles
  .filter(file => file.space === 'shared' || file.space === `bot_${botId}`)
  .map(file => `[FILE] ${file.name} CONTENTS: ${file.content.substring(0, 100)}`) // First 100 chars
  .join('\n');
```

## Phase 4: .txt Format Optimization for Training

### 4.1. Prompt Format Compatibility
**Objective**: Ensure all formatted inputs are compatible with your .txt training data format.

#### Format Specification:
```
INSTRUCTION: [Personality Description Here]
CONTEXT: [Previous conversation history with [SPEAKER] SAYS: "message"]
[USER] SAYS: "User question here"
OUTPUT: [RESPONDING BOT] SAYS: "Response"
```

### 4.2. Training Data Pattern Alignment
**Objective**: Align your real-time prompting with training data patterns.

#### Key Alignment Points:
1. Clear separation between instruction and context
2. Identical speaker tagging structure
3. Single-line statement per speaker 
4. Predicatable formatting to match training patterns

## Phase 5: Implementation Roadmap

### Phase 5.1: Immediate (Week 1-2)
1. Implement enhanced message formatting system
2. Create message context builder functions
3. Update message-feed.tsx to use structured formatting
4. Test basic turn flow between bots

### Phase 5.2: Medium-term (Week 3-4) 
1. Integrate memory concept context
2. Add file context integration
3. Implement turn tracking logic
4. Test with sample conversation flows

### Phase 5.3: Advanced (Week 5+)
1. Add conversation history management
2. Implement adaptive context length
3. Add logging and debugging for prompt structures
4. Performance optimization for larger contexts

## Technical Implementation Details

### Key Components to Update:

1. **Message Feed Component** (`message-feed.tsx`)
   - Add enhanced formatting to user messages
   - Store structured context in messages table

2. **Prompt Building Utilities** (`lib/prompt-utils.ts`)
   - Context builder functions with recent messages
   - Template building for different bots
   - File/memory integration helpers

3. **Message Display Component** (`message-bubble.tsx`)
   - Enhanced parsing of structured messages
   - Visual improvement for different speaker types

### Data Schema Adjustments:
While maintaining current schema, consider adding:
```sql
-- Optional addition for tracking conversation context
ALTER TABLE messages ADD COLUMN context_hash TEXT;
```

### Bot Interaction Model:
```typescript
interface BotPromptContext {
  userMessage: string;
  recentMessages: Message[];
  memoryConcepts: MemoryConcept[];
  fileContext: WorkspaceFile[];
  expectedNextSpeaker: 'MAUK' | 'ABACI';
  conversationHistory: string; // Formatted conversation
}
```

## Risk Mitigation and Success Metrics

### Potential Risks:
1. **Overloading context**: Too many messages may overwhelm .txt-trained models
2. **Format mismatch**: Structural changes might break existing training patterns
3. **Performance overhead**: Context building may slow real-time responses

### Success Metrics:
1. **Conversation coherence**: Evaluate the natural flow between personalities
2. **Turn structure adherence**: Measure how often bots respond in proper alternating fashion
3. **Context awareness**: Test ability to reference previous specific statements
4. **Performance**: Monitor response time with enhanced context

## Future Enhancements

### Advanced Features to Consider:
1. **Conversational topic tracking**: 
   - Automatically detect and maintain conversation themes
   - Use memory concepts to keep topic focus

2. **Bot personality adaptability**: 
   - Adjust response style based on conversation intensity
   - Contextual emotion modeling

3. **Multi-modal engagement**: 
   - Integrate file references as conversation starters
   - Use memory concepts to initiate new discussion angles

This roadmap ensures that your NTP bots will receive prompts that align with their .txt training while providing optimal conversational context that maintains the distinctive Mbash-3.2$ 
