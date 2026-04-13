// Example JavaScript/TypeScript updates for enhanced messaging system
// This shows what changes you need to make to your frontend files

// === Message Formatting Utilities ===
// Add these to your frontend utility functions

// Format user messages with structured speaker tagging
function formatUserMessage(text, speaker = 'USER') {
  return `[${speaker}] SAYS: "${text}"`;
}

// Format bot responses with proper speaker tagging
function formatBotMessage(speaker, text) {
  return `[${speaker}] SAYS: "${text}"`;
}

// Handle message chains (when one bot continues another's thought)
function formatBotChainMessage(speaker, text, continuation = null) {
  if (continuation) {
    return `[${speaker}] SAYS: "${text}" | [I] SAY: "${continuation}"`;
  }
  return `[${speaker}] SAYS: "${text}"`;
}

// Parse structured messages for display
function parseStructuredMessage(text) {
  // Match the format: [SPEAKER] SAYS: "text"
  const match = text.match(/^\[([A-Z]+)\]\s+SAYS:\s+"(.+?)"(?:\s*\|\s*\[I\]\s+SAY:\s+"(.+?)")?$/);
  
  if (match) {
    return {
      speaker: match[1],
      text: match[2],
      continuation: match[3] || null
    };
  }
  
  // Fallback for non-structured messages
  return {
    speaker: 'UNKNOWN',
    text: text.trim(),
    continuation: null
  };
}

// Check if message is properly structured
function isStructuredMessage(text) {
  return /^\[([A-Z]+)\]\s+SAYS:\s+".+?"(?:\s*\|\s*\[I\]\s+SAY:\s+".+?")?$/.test(text.trim());
}

// === Example Message Feed Component Update ===

// Update your message-feed.tsx like this:
class MessageFeed extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      newMessage: ''
    };
  }

  // Enhanced message sending with structured formatting
  handleSendMessage = async (text) => {
    if (!text.trim() || !this.props.currentUser) return;
    
    // Use the new enhanced format
    const formattedText = formatUserMessage(text, this.props.currentUser.displayName || 'anon');
    
    // Send to backend (your existing function)
    await this.props.onSendMessage(formattedText);
    
    this.setState({ newMessage: '' });
  };

  // Parse messages for display
  renderMessage = (message, index) => {
    const isOwnMessage = message.speaker === (this.props.currentUser?.displayName || 'anon');
    
    // Parse the structured message
    const parsed = parseStructuredMessage(message.text);
    
    // Apply different styling based on speaker
    const speakerStyle = parsed.speaker === 'USER' 
      ? 'bg-blue-100 border-blue-500 text-blue-800' 
      : parsed.speaker === 'MAUK'
      ? 'bg-purple-100 border-purple-500 text-purple-800'
      : 'bg-green-100 border-green-500 text-green-800';
    
    return (
      <div key={message.id || index} className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'} mb-4`}>
        <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg border-l-4 ${speakerStyle} shadow-sm`}>
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

  render() {
    const { messages, currentUser } = this.props;
    const { newMessage } = this.state;
    
    return (
      <div className="flex flex-col h-full">
        <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
          {messages.map((message, index) => this.renderMessage(message, index))}
        </div>
        
        <form onSubmit={(e) => {
          e.preventDefault();
          this.handleSendMessage(newMessage);
        }} className="border-t p-4 bg-white">
          <div className="flex gap-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => this.setState({ newMessage: e.target.value })}
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
  }
}

// === Example Bot Response Processing ===

// When displaying bot responses in your React components:
function BotResponseDisplay({ botMessage, speaker }) {
  // Parse the structured message from server
  const parsed = parseStructuredMessage(botMessage);
  
  return (
    <div className="flex justify-start mb-4">
      <div className={`max-w-xs px-4 py-2 rounded-lg border-l-4 ${
        speaker === 'MAUK' 
          ? 'bg-purple-100 border-purple-500 text-purple-800'
          : 'bg-green-100 border-green-500 text-green-800'
      } shadow-sm`}>
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
}

// === Enhanced Testing ===

// Example test function to validate message formats:
function testMessageFormats() {
  const testMessages = [
    '[USER] SAYS: "Hello there!"',
    '[MAUK] SAYS: "I am philosophical!"', 
    '[ABACI] SAYS: "The void is mathematical" | [I] SAY: "But what of human emotion?"',
    'Just a plain message'
  ];

  console.log("Testing message parsing:");
  testMessages.forEach((msg, i) => {
    const parsed = parseStructuredMessage(msg);
    console.log(`${i+1}. "${msg}" ->`, parsed);
    console.log(`   Is structured: ${isStructuredMessage(msg)}`);
  });
}

// Run test
// testMessageFormats();

export { 
  formatUserMessage, 
  formatBotMessage, 
  formatBotChainMessage, 
  parseStructuredMessage, 
  isStructuredMessage 
};