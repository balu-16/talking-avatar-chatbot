import React, { useState, useCallback, useRef, useEffect } from 'react';
import ChatPanel from './components/ChatPanel';
import AvatarScene from './components/AvatarScene';
import './App.css';

const API_URL = import.meta.env.VITE_API_URL !== undefined ? import.meta.env.VITE_API_URL : '';

function App() {
  const [sentiment, setSentiment] = useState('neutral');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const audioRef = useRef(null);
  const avatarContainerRef = useRef(null);
  const avatarSceneRef = useRef(null);

  // Initialize vanilla Three.js avatar
  useEffect(() => {
    if (!avatarContainerRef.current) return;
    const scene = new AvatarScene(avatarContainerRef.current);
    avatarSceneRef.current = scene;

    return () => {
      scene.dispose();
      avatarSceneRef.current = null;
    };
  }, []);

  // Sync state to avatar scene
  useEffect(() => {
    if (avatarSceneRef.current) {
      avatarSceneRef.current.setSentiment(sentiment);
    }
  }, [sentiment]);

  useEffect(() => {
    if (avatarSceneRef.current) {
      avatarSceneRef.current.setSpeaking(isSpeaking);
    }
  }, [isSpeaking]);

  const handleSendMessage = useCallback(async (message) => {
    setIsLoading(true);

    try {
      const response = await fetch(`${API_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      // Update avatar
      setSentiment(data.sentiment || 'neutral');
      setIsSpeaking(true);

      if (avatarSceneRef.current) {
        avatarSceneRef.current.setVisemes(data.visemes || []);
        avatarSceneRef.current.setSentiment(data.sentiment || 'neutral');
        avatarSceneRef.current.setSpeaking(true);
      }

      // Play audio
      if (data.audio) {
        const audio = new Audio(`data:audio/mp3;base64,${data.audio}`);
        audioRef.current = audio;

        audio.onended = () => {
          setIsSpeaking(false);
          if (avatarSceneRef.current) {
            avatarSceneRef.current.setVisemes([]);
            avatarSceneRef.current.setSpeaking(false);
          }
        };

        audio.onerror = () => {
          setIsSpeaking(false);
          if (avatarSceneRef.current) {
            avatarSceneRef.current.setVisemes([]);
            avatarSceneRef.current.setSpeaking(false);
          }
        };

        await audio.play();
      }

      setIsLoading(false);
      return data.response;

    } catch (error) {
      console.error('Error:', error);
      setIsLoading(false);
      setIsSpeaking(false);
      if (avatarSceneRef.current) {
        avatarSceneRef.current.setSpeaking(false);
      }
      return 'Sorry, I encountered an error. Please try again.';
    }
  }, []);

  return (
    <div className="app-container">
      {/* Chat Panel - Left Side */}
      <div className="chat-section">
        <ChatPanel onSendMessage={handleSendMessage} isLoading={isLoading} />
      </div>

      {/* Avatar - Top Right */}
      <div className="avatar-section">
        <div className="avatar-container">
          {/* Vanilla Three.js renders into this div */}
          <div
            ref={avatarContainerRef}
            style={{
              width: '100%',
              height: '100%',
              background: 'linear-gradient(180deg, #f5e6d3 0%, #e8d5c0 100%)',
              borderRadius: '17px',
            }}
          />

          {/* Speaking Indicator */}
          {isSpeaking && (
            <div className="speaking-indicator">
              <div className="pulse-ring"></div>
              <span>🗣️ Speaking...</span>
            </div>
          )}

          {/* Sentiment Badge */}
          <div className={`sentiment-badge sentiment-${sentiment}`}>
            {sentiment === 'happy' ? '😊' :
             sentiment === 'sad' ? '😢' :
             sentiment === 'thinking' ? '🤔' : '😐'}
          </div>
        </div>

        {/* Status Bar */}
        <div className="status-bar">
          <div className="status-item">
            <div className="status-dot active"></div>
            <span>Connected</span>
          </div>
          <div className="status-item">
            <span>Model: MiMo</span>
          </div>
        </div>
      </div>

      {/* Background Gradient */}
      <div className="background-gradient"></div>
    </div>
  );
}

export default App;
