// Example React component updates for enhanced messaging system
// This shows what changes you need to make to your message-feed.tsx and related components

import React, { useState, useEffect } from 'react';
import { format_user_message, format_bot_message, parse_message_for_frontend_display } from './lib/frontend_message_handlers';

// Example message bubble component
const MessageBubble: React.FC<{ 
  message: any; 
  isOwnMessage: boolean;
  onMessageClick?: (message: any) => void;
}> = ({ message, isOwnMessage, onMessageClick }) => {
  // Parse structured message for display
  const parsed = parse_message_for_frontend_display(message.text);
  
  // Determine styling based on speaker
  const speakerClass = parsed.speaker === 'USER' 
    ? 'bg-blue-100 border-blue-500 text-blue-800' 
    : parsed.speaker === 'MAUK'
    ? 'bg-purple-100 border-purple-500 text-purple-800'
    : 'bg-green-100 border-green-500 text-green-800';

  return (
    <div 
      className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'} mb-4`}
      onClick={() => onMessageClick && onMessageClick(message)}
    >
      <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg border-l-4 ${speakerClass} shadow-sm`}>
        <div className="font-semibold text-sm mb-1">
          [{parsed.speaker}]
        </div>
        <div className="text-sm">
          {parsed.text}
        </div>
        {parsed.continuation && (
          <div className="mt-2 text-xs italic text-gray-600">
            [I] SAY: {parsed.continuation}
          </div>
        )}
      </div>
    </div>
  );
};

// Example message feed component (message-feed.tsx)
const MessageFeed: React.FC<{ 
  messages: any[];
  currentUser: any;
  onSendMessage: (text: string) => void;
  onMessageClick?: (message: any) => void;
}> = ({ messages, currentUser, onSendMessage, onMessageClick }) => {
  const [newMessage, setNewMessage] = useState('');

  const handleSendMessage = async (text: string) => {
    if (!text.trim() || !currentUser) return;
    
    // Enhanced structured formatting (this is now our new standard)
    const formattedText = format_user_message(text, currentUser.displayName || 'anon');
    
    // Call your existing send function with the new format
    await onSendMessage(formattedText);
    setNewMessage('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSendMessage(newMessage);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
        {messages.map((message, index) => {
          const isOwnMessage = message.speaker === (currentUser?.displayName || 'anon');
          return (
            <MessageBubble
              key={message.id || index}
              message={message}
              isOwnMessage={isOwnMessage}
              onMessageClick={onMessageClick}
            />
          );
        })}
      </div>
      
      <form onSubmit={handleSubmit} className="border-t p-4 bg-white">
        <div className="flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type your message..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
};

// Example utility functions you'll want to add to your frontend
export const frontendUtils = {
  // Format user messages with the new structured approach
  formatUserMessage: (text: string, speaker: string = 'USER'): string => {
    return `[${speaker}] SAYS: "${text}"`;
  },

  // Format bot responses using proper speaker tagging
  formatBotMessage: (speaker: string, text: string): string => {
    return `[${speaker}] SAYS: "${text}"`;
  },

  // Format message chains (when a bot continues another's thought)
  formatBotChainMessage: (speaker: string, text: string, continuation?: string): string => {
    if (continuation) {
      return `[${speaker}] SAYS: "${text}" | [I] SAY: "${continuation}"`;
    }
    return `[${speaker}] SAYS: "${text}"`;
  },

  // Parse messages for display (handles all formats)
  parseMessage: (text: string): { speaker: string; text: string; continuation?: string } => {
    // This uses the backend utility functions for consistency
    // In real implementation, you'd import from the frontend utils
    return {
      speaker: 'UNKNOWN',
      text: text,
      continuation: undefined
    };
  },

  // Check if message follows structured format
  isStructuredMessage: (text: string): boolean => {
    return /^(\[USER\]|\[MAUK\]|\[ABACI\])\s+SAYS:\s+"[^"]*"$/.test(text);
  }
};

export default MessageFeed;