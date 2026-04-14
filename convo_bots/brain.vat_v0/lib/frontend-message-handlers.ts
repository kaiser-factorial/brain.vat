/**
 * Frontend message handling utilities to work with the enhanced structured messaging system.
 * Optimized for barebones dialogue mode to restore bot stability.
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
  return `[${speaker}]: ${text}`;
}

/**
 * Format a bot message for storage.
 */
export function format_bot_message(speaker: string, text: string): string {
  return `[${speaker}]: ${text}`;
}

/**
 * Parse a structured message for frontend display.
 * Robustly strips [NAME]: or [NAME] SAYS: prefixes.
 */
export function parse_message_for_frontend_display(text: string): ParsedMessage {
  const trimmed = text.trim();
  
  // 1. Match [SPEAKER] SAYS: "text" | [I] SAY: "continuation"
  const structuredPattern = /^\[([A-Z]+)\]\s+SAYS:\s+"(.+?)"(?:\s*\|\s*\[I\]\s+SAY:\s+"(.+?)")?$/;
  const structuredMatch = trimmed.match(structuredPattern);
  if (structuredMatch) {
    return {
      speaker: structuredMatch[1],
      text: structuredMatch[2],
      continuation: structuredMatch[3] || undefined
    };
  }
  
  // 2. Match standard [SPEAKER]: Text (Barebones training format)
  const dialoguePattern = /^\[([A-Z0-9_-]+)\]:\s*(.+)$/i;
  const dialogueMatch = trimmed.match(dialoguePattern);
  if (dialogueMatch) {
    return {
      speaker: dialogueMatch[1],
      text: dialogueMatch[2]
    };
  }

  // 3. Fallback: If it's just raw text, return empty speaker to allow DB fallback
  return {
    speaker: '',
    text: trimmed
  };
}

/**
 * Check if a message text uses the structured format.
 */
export function is_structured_message(text: string): boolean {
  return /^\[[A-Z]+\]\s+SAYS:\s+"/.test(text.trim());
}
