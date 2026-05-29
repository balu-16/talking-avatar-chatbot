import React, { useState, useCallback, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import ChatPanel from './components/ChatPanel';
import Avatar3D from './components/Avatar3D';
import './App.css';

const API_URL = import.meta.env.VITE_API_URL !== undefined ? import.meta.env.VITE_API_URL : '';

function App() {
  const [visemes, setVisemes] = useState([]);
  const [sentiment, setSentiment] = useState('neutral');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const audioRef = useRef(null);
  
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
      
      // Set visemes and sentiment
      setVisemes(data.visemes || []);
      setSentiment(data.sentiment || 'neutral');
      setIsSpeaking(true);
      
      // Play audio
      if (data.audio) {
        const audio = new Audio(`data:audio/mp3;base64,${data.audio}`);
        audioRef.current = audio;
        
        audio.onended = () => {
          setIsSpeaking(false);
          setVisemes([]);
        };
        
        audio.onerror = () => {
          setIsSpeaking(false);
          setVisemes([]);
        };
        
        await audio.play();
      }
      
      setIsLoading(false);
      return data.response;
      
    } catch (error) {
      console.error('Error:', error);
      setIsLoading(false);
      setIsSpeaking(false);
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
          <Canvas
            camera={{ position: [0, 0, 3], fov: 50 }}
            style={{ background: 'transparent' }}
          >
            {/* Lighting */}
            <ambientLight intensity={0.5} />
            <directionalLight position={[5, 5, 5]} intensity={0.8} castShadow />
            <pointLight position={[-3, 3, 3]} intensity={0.4} />
            
            {/* Avatar */}
            <Avatar3D
              visemes={visemes}
              sentiment={sentiment}
              isSpeaking={isSpeaking}
            />
            
            {/* Controls */}
            <OrbitControls
              enableZoom={false}
              enablePan={false}
              minPolarAngle={Math.PI / 3}
              maxPolarAngle={Math.PI / 1.5}
            />
            
            {/* Environment for reflections */}
            <Environment preset="studio" />
          </Canvas>
          
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
