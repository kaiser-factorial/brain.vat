/**
 * Frontend message handling utilities to work with the enhanced structured messaging system.
 * Ported from Python implementation for consistency with GPT-2 formatting.
 */

export interface ParsedMessage {
  speaker: string;
  text: string;
  continuation?: string;
}

/**
 * Format a user message for storage and processing.
 */
export function format_user_message(text: string, speaker: string = "USER"): string {
  return `[${speaker}] SAYS: "${text}"`;
}

/**
 * Format a bot message for storage.
 */
export function format_bot_message(speaker: string, text: string): string {
  return `[${speaker}] SAYS: "${text}"`;
}

/**
 * Parse a structured message for frontend display.
 */
export function parse_message_for_frontend_display(text: string): ParsedMessage {
  // Pattern to match [SPEAKER] SAYS: "text" | [I] SAY: "continuation"
  const pattern = /^\[([A-Z]+)\]\s+SAYS:\s+"(.+?)"(?:\s*\|\s*\[I\]\s+SAY:\s+"(.+?)")?$/;
  const match = text.trim().match(pattern);
  
  if (match) {
    return {
      speaker: match[1],
      text: match[2],
      continuation: match[3] || undefined
    };
  }
  
  // Pattern to match [SPEAKER]: "text" (older format or loose format)
  const legacyPattern = /^\[([A-Z]+)\]:\s+(.+)$/;
  const legacyMatch = text.trim().match(legacyPattern);
  if (legacyMatch) {
    return {
      speaker: legacyMatch[1],
      text: legacyMatch[2]
    };
  }
  
  // Fallback - return as-is  
  return {
    speaker: 'UNKNOWN',
    text: text.trim()
  };
}

/**
 * Check if a message text uses the structured format.
 */
export function is_structured_message(text: string): boolean {
  return /^\[[A-Z]+\]\s+SAYS:\s+"/.test(text.trim());
}
