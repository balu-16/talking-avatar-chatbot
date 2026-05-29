import React, { useState, useRef, useEffect } from 'react';

export default function ChatPanel({ onSendMessage, isLoading }) {
  const [messages, setMessages] = useState([
    { role: 'bot', content: 'Hi! I\'m your AI assistant. How can I help you today? 😊' }
  ]);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  
  useEffect(() => {
    scrollToBottom();
  }, [messages]);
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    
    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    
    // Call parent handler
    const response = await onSendMessage(userMsg);
    if (response) {
      setMessages(prev => [...prev, { role: 'bot', content: response }]);
    }
  };
  
  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerDot} />
        <span style={styles.headerText}>AI Assistant</span>
      </div>
      
      {/* Messages */}
      <div style={styles.messagesContainer}>
        {messages.map((msg, i) => (
          <div 
            key={i} 
            style={{
              ...styles.messageBubble,
              ...(msg.role === 'user' ? styles.userBubble : styles.botBubble)
            }}
          >
            <div style={styles.messageRole}>
              {msg.role === 'user' ? '👤 You' : '🤖 AI'}
            </div>
            <div style={styles.messageContent}>{msg.content}</div>
          </div>
        ))}
        
        {isLoading && (
          <div style={{ ...styles.messageBubble, ...styles.botBubble }}>
            <div style={styles.messageRole}>🤖 AI</div>
            <div style={styles.typingIndicator}>
              <span style={styles.dot}>●</span>
              <span style={styles.dot}>●</span>
              <span style={styles.dot}>●</span>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>
      
      {/* Input */}
      <form onSubmit={handleSubmit} style={styles.inputContainer}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your message..."
          style={styles.input}
          disabled={isLoading}
        />
        <button type="submit" style={styles.sendButton} disabled={isLoading}>
          {isLoading ? '⏳' : '➤'}
        </button>
      </form>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    background: '#1a1a2e',
    borderRadius: '16px',
    overflow: 'hidden',
    border: '1px solid #16213e',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '16px 20px',
    background: '#16213e',
    borderBottom: '1px solid #0f3460',
  },
  headerDot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    background: '#00ff88',
    boxShadow: '0 0 8px #00ff88',
  },
  headerText: {
    color: '#e0e0e0',
    fontSize: '16px',
    fontWeight: '600',
  },
  messagesContainer: {
    flex: 1,
    overflowY: 'auto',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  messageBubble: {
    maxWidth: '80%',
    padding: '12px 16px',
    borderRadius: '12px',
    fontSize: '14px',
    lineHeight: '1.5',
  },
  userBubble: {
    alignSelf: 'flex-end',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
    borderBottomRightRadius: '4px',
  },
  botBubble: {
    alignSelf: 'flex-start',
    background: '#16213e',
    color: '#e0e0e0',
    borderBottomLeftRadius: '4px',
  },
  messageRole: {
    fontSize: '11px',
    opacity: 0.7,
    marginBottom: '4px',
  },
  messageContent: {
    wordBreak: 'break-word',
  },
  typingIndicator: {
    display: 'flex',
    gap: '4px',
    padding: '4px 0',
  },
  dot: {
    color: '#667eea',
    animation: 'pulse 1.4s infinite',
    fontSize: '8px',
  },
  inputContainer: {
    display: 'flex',
    gap: '10px',
    padding: '16px',
    background: '#16213e',
    borderTop: '1px solid #0f3460',
  },
  input: {
    flex: 1,
    padding: '12px 16px',
    borderRadius: '8px',
    border: '1px solid #0f3460',
    background: '#1a1a2e',
    color: 'white',
    fontSize: '14px',
    outline: 'none',
  },
  sendButton: {
    padding: '12px 20px',
    borderRadius: '8px',
    border: 'none',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
    fontSize: '18px',
    cursor: 'pointer',
    transition: 'transform 0.2s',
  },
};
