# Enhanced Message Display for Brain.vat

## Objective
Implement structured conversational prompting format:
- [USER] SAYS: "message here"
- [MAUK] SAYS: "response here" | [I] SAY: "next response"

## Implementation Plan

### 1. Message Display Logic
Modify message-bubble.tsx to understand the structured format:

```typescript
// In message-bubble.tsx
export function MessageBubble({ message }: MessageBubbleProps) {
  // Enhanced parsing for structured messages
  const parseStructuredMessage = (text: string) => {
    // Look for pattern like [USER] SAYS: "message"
    const userMatch = text.match(/\[(USER|MAUK|ABACI)\]\s+SAYS:\s+(.*)/i);
    if (userMatch) {
      return {
        speaker: userMatch[1],
        message: userMatch[2].replace(/^"(.*)"$/, '$1')
      };
    }
    return { speaker: message.speaker, message: text };
  };

  const parsed = parseStructuredMessage(message.text);
  
  // ... rest of existing logic but with parsed data
}
```

### 2. Message Formatting Utility
Create a utility function for constructing messages:

```typescript
// In lib/message-utils.ts
export function formatUserMessage(text: string): string {
  return `[USER] SAYS: "${text}"`;
}

export function formatBotResponse(speaker: string, text: string): string {
  return `[${speaker}] SAYS: "${text}"`;
}

export function formatBotResponseChain(speaker: string, text: string, continuation?: string): string {
  if (continuation) {
    return `[${speaker}] SAYS: "${text}" | [I] SAY: "${continuation}"`;
  }
  return `[${speaker}] SAYS: "${text}"`;
}
```

### 3. Message Sending Enhancement
Update message sending to use structured format:

In message-feed.tsx:
```typescript
const handleSendMessage = async (text: string) => {
  if (!user) return;

  // Format the user message with speaker tag
  const formattedText = `[USER] SAYS: "${text}"`;
  
  const { error } = await supabase.from('messages').insert({
    speaker: displayName || 'anon',
    text: formattedText,  // Use formatted version
    role: 'user',
    user_id: user.id
  });

  // ... rest of existing logic
};
```

### 4. Bot System Integration
The bots themselves would need to be configured to understand and parse this format when they receive messages from the database. In their prompt templates:
```
Context: Previous conversation:
{formatted_messages}

Current input: [USER] SAYS: "{latest_user_message}"

Respond as {bot_name}:
