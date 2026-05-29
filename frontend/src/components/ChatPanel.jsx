import React, { useState, useRef, useEffect } from 'react';

export default function ChatPanel({ onSendMessage, isLoading }) {
  const [messages, setMessages] = useState([
    { role: 'bot', content: 'Hi! I\'m your AI assistant. How can I help you today? ☕' }
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
    
    const response = await onSendMessage(userMsg);
    if (response) {
      setMessages(prev => [...prev, { role: 'bot', content: response }]);
    }
  };
  
  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerIcon}>☕</div>
        <div style={styles.headerInfo}>
          <span style={styles.headerText}>AI Assistant</span>
          <span style={styles.headerStatus}>Online</span>
        </div>
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
    background: '#fff8f0',
    borderRadius: '16px',
    overflow: 'hidden',
    border: '2px solid #e8d5c0',
    boxShadow: '0 8px 32px rgba(74, 44, 23, 0.1)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '16px 20px',
    background: 'linear-gradient(135deg, #6f4e37 0%, #4a2c17 100%)',
    borderBottom: '2px solid #a67b5b',
  },
  headerIcon: {
    fontSize: '24px',
    width: '40px',
    height: '40px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(255, 255, 255, 0.2)',
    borderRadius: '12px',
  },
  headerInfo: {
    display: 'flex',
    flexDirection: 'column',
  },
  headerText: {
    color: '#fff8f0',
    fontSize: '16px',
    fontWeight: '600',
  },
  headerStatus: {
    color: 'rgba(255, 248, 240, 0.7)',
    fontSize: '11px',
  },
  messagesContainer: {
    flex: 1,
    overflowY: 'auto',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    background: 'linear-gradient(180deg, #faf3eb 0%, #fff8f0 100%)',
  },
  messageBubble: {
    maxWidth: '80%',
    padding: '12px 16px',
    borderRadius: '16px',
    fontSize: '14px',
    lineHeight: '1.5',
  },
  userBubble: {
    alignSelf: 'flex-end',
    background: 'linear-gradient(135deg, #6f4e37 0%, #4a2c17 100%)',
    color: '#fff8f0',
    borderBottomRightRadius: '4px',
    boxShadow: '0 4px 12px rgba(74, 44, 23, 0.2)',
  },
  botBubble: {
    alignSelf: 'flex-start',
    background: '#fff8f0',
    color: '#2c1810',
    borderBottomLeftRadius: '4px',
    border: '2px solid #e8d5c0',
    boxShadow: '0 4px 12px rgba(74, 44, 23, 0.05)',
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
    color: '#a67b5b',
    animation: 'pulse 1.4s infinite',
    fontSize: '8px',
  },
  inputContainer: {
    display: 'flex',
    gap: '10px',
    padding: '16px',
    background: '#fff8f0',
    borderTop: '2px solid #e8d5c0',
  },
  input: {
    flex: 1,
    padding: '12px 16px',
    borderRadius: '12px',
    border: '2px solid #e8d5c0',
    background: '#faf3eb',
    color: '#2c1810',
    fontSize: '14px',
    outline: 'none',
    transition: 'border-color 0.2s',
  },
  sendButton: {
    padding: '12px 20px',
    borderRadius: '12px',
    border: 'none',
    background: 'linear-gradient(135deg, #6f4e37 0%, #4a2c17 100%)',
    color: '#fff8f0',
    fontSize: '18px',
    cursor: 'pointer',
    transition: 'transform 0.2s, box-shadow 0.2s',
    boxShadow: '0 4px 12px rgba(74, 44, 23, 0.3)',
  },
};
