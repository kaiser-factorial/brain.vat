# Brain.vat Prompt Enhancement Implementation Plan

## Objective
Implement structured conversational prompting for your NTP bots to improve their response quality and turn-based conversation flow. The solution will work with your GPT-2 .txt training data while maintaining proper message flow.

## Key Implementation Steps

### Step 1: Modify User Message Format (in message-feed.tsx)

Update your message sending logic to include structured speaker tags:

```typescript
// In message-feed.tsx, update the handleSendMessage function:
const handleSendMessage = async (text: string) => {
  if (!user) return

  // NEW: Format user message with clear speaker identifier
  const formattedText = `[USER] SAYS: "${text}"`

  const { error } = await supabase.from('messages').insert({
    speaker: displayName || 'anon',
    text: formattedText,  // Use formatted version instead of raw text
    role: 'user',
    user_id: user.id
  })

  if (error) {
    console.error('Failed to send message:', error)
    toast.error('Failed to send message: ' + error.message)
    throw error
  }
}
```

### Step 2: Create Message Utility Functions

Create a new file `lib/message-utils.ts`:

```typescript
// lib/message-utils.ts
export function formatUserMessage(text: string): string {
  return `[USER] SAYS: "${text}"`
}

export function formatBotMessage(speaker: 'MAUK' | 'ABACI', text: string): string {
  return `[${speaker}] SAYS: "${text}"`
}

export function formatBotResponseChain(speaker: 'MAUK' | 'ABACI', text: string, continuation?: string): string {
  if (continuation) {
    return `[${speaker}] SAYS: "${text}" | [I] SAY: "${continuation}"`
  }
  return `[${speaker}] SAYS: "${text}"`
}

export function isStructuredMessage(text: string): boolean {
  return text.includes('[USER] SAYS:') || 
         text.includes('[MAUK] SAYS:') || 
         text.includes('[ABACI] SAYS:') ||
         text.includes('[MEMORY]') ||
         text.includes('[FILE]')
}

// Extract speaker from a structured message
export function extractSpeaker(text: string): string | null {
  const userMatch = text.match(/\[USER\]\s+SAYS:/i)
  const maukMatch = text.match(/\[MAUK\]\s+SAYS:/i)
  const abaciMatch = text.match(/\[ABACI\]\s+SAYS:/i)
  
  if (userMatch) return 'USER'
  if (maukMatch) return 'MAUK'  
  if (abaciMatch) return 'ABACI'
  return null
}
```

### Step 3: Update Message Bubble to Handle Enhanced Display (optional)

For better visual representation, you can modify `components/message-bubble.tsx` to handle the structured messages better:

```typescript
// This is an optional enhancement to make messages display better
// But the core improvement works via message formatting

// You could add this helper function
function getSpeakerClass(speaker: string) {
  switch (speaker.toLowerCase()) {
    case 'mauk': return 'text-mauk'
    case 'abaci': return 'text-abaci'  
    case 'user': return 'text-user'
    default: return 'text-foreground'
  }
}
```

### Step 4: Message Context Building (Backend Integration)

This needs to be handled by your NTP processing system, but we can prepare for it:

The message format you're creating will help your NTP system understand:

- Who is speaking in each message (`[USER]`, `[MAUK]`, `[ABACI]`)
- Better conversation structure for turn-based responses 
- Clear context separation for .txt model processing

### Step 5: Recommended Backend Integration (for your existing system)

Your NTP systems should process messages with the new format:

**Example: Processing Incoming Context for a Bot**
```
INSTRUCTION: [Bot personality description]
CONTEXT: 
[USER] SAYS: "What do you think about this?"
[MAUK] SAYS: "I find the concept intriguing but..."
[ABACI] SAYS: "That's a valid perspective, however..."
RESPONSE: [ABACI] SAYS: "Based on my analysis..."

When building prompts, ensure they match .txt training patterns:
- Clear sections: INSTRUCTION, CONTEXT, RESPONSE  
- Predictable speaker tagging
- Consistent formatting 
```

## Implementation Order (Recommended)

1. **First**: Implement the user message formatting change in message-feed.tsx
2. **Second**: Create the message utility functions
3. **Third**: Test that messages are being saved properly with the new format
4. **Fourth**: If you have a way to test bot responses, validate they understand the new structure

## Expected Behavior After Implementation

1. User messages will appear as: `[USER] SAYS: "your message"`
2. Bot responses will use the structure you implement in your NTP system 
3. The conversation will have clearer speaker identification and context 
4. Better alignment with .txt training patterns your models were built on

## Testing Approach

After implementing:
1. Send a test message through your UI
2. Check database to see if it's stored as: `[USER] SAYS: "test message"`
3. Observe if bot responses use more contextually aware language
4. Monitor conversation flow quality

## Files You Should Create/Modify

1. `./lib/message-utils.ts` - Message formatting utilities
2. Update `./components/message-feed.tsx` - Enhanced user message logic

## Important Note About Your .txt Trained Systems

Since your NTP bots are specifically trained on .txt formatted data:
- The structured message format helps preserve training patterns
- When your bots process messages, they will see familiar structures
- The `[USER]`, `[MAUK]`, `[ABACI]` tags should be preserved in prompts to match training data

This approach ensures that your existing .txt training system can work well with the improved prompting flow while maintaining the distinct personalities of both bots.