import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { playHoverSound, playClickSound, toggleSound, getSoundState } from './utils/sound';
import { useUser } from './hooks/useUser';
import './HomePage.css';

const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const [isSoundOn, setIsSoundOn] = useState(getSoundState());
  const [testResult, setTestResult] = useState<string | null>(null);
  const [isTestingAI, setIsTestingAI] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [isTestingAI, setIsTestingAI] = useState(false);
  const { user, logout } = useUser();
  

  const handleButtonClick = (action: () => void) => {
    if (isSoundOn) {
      playClickSound();
    }
    action();
  };

  const handleSoundToggle = () => {
    const newSoundState = toggleSound();
    setIsSoundOn(newSoundState);
    if (newSoundState) {
      playClickSound(); // Only play sound when turning sound on
    }
  };

  const handleTestAI = async () => {
    setIsTestingAI(true);
    setTestResult(null);
    
    try {
      console.log('🧪 Testing AI endpoint...');
      const response = await fetch('/api/test-ai');
      const data = await response.json();
      
      if (data.status === 'success') {
        setTestResult(`✅ AI Test Success: ${data.data.summary}`);
        console.log('🎉 AI Test Result:', data.data);
      } else {
        setTestResult(`❌ AI Test Failed: ${data.message}`);
      }
    } catch (error) {
      console.error('💥 AI Test Error:', error);
      setTestResult(`💥 Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsTestingAI(false);
    }
  };

  const handleTestAI = async () => {
    setIsTestingAI(true);
    setTestResult(null);
    
    try {
      console.log('🧪 Testing AI endpoint...');
      const response = await fetch('/api/test-ai');
      const data = await response.json();
      
      if (data.status === 'success') {
        setTestResult(`✅ AI Test Success: ${data.data.summary}`);
        console.log('🎉 AI Test Result:', data.data);
      } else {
        setTestResult(`❌ AI Test Failed: ${data.message}`);
      }
    } catch (error) {
      console.error('💥 AI Test Error:', error);
      setTestResult(`💥 Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsTestingAI(false);
    }
  };
  return (
    <div className="homepage">
      <div className="homepage-content">
        <div className="logo-container">
          <div className="wheedle-logo"></div>
        </div>
        <div className="buttons-container">
          <div className="room-buttons">
            <div 
              className="public-room-button room-button" 
              onClick={() => handleButtonClick(() => navigate('/public-room'))}
              onMouseEnter={() => isSoundOn && playHoverSound()}
            ></div>
            <div 
              className="private-room-button room-button" 
              onClick={() => handleButtonClick(() => navigate('/private-room'))}
              onMouseEnter={() => isSoundOn && playHoverSound()}
            ></div>
          </div>
          <div 
            className="rules-button"
            onClick={() => handleButtonClick(() => {})}
            onMouseEnter={() => isSoundOn && playHoverSound()}
          ></div>
          
          {/* Test AI Button */}
          <button
            className="test-ai-button"
            onClick={() => handleButtonClick(handleTestAI)}
            onMouseEnter={() => isSoundOn && playHoverSound()}
            disabled={isTestingAI}
            style={{
              width: '275px',
              height: '60px',
              background: isTestingAI ? '#666' : '#4CAF50',
              color: 'white',
              border: '2px solid #FFD700',
              fontFamily: 'VT323, monospace',
              fontSize: '20px',
              cursor: isTestingAI ? 'not-allowed' : 'pointer',
              borderRadius: '8px',
              margin: '20px auto',
              display: 'block',
              transition: 'all 0.2s',
              opacity: isTestingAI ? 0.7 : 1
            }}
          >
            {isTestingAI ? '🔄 Testing AI...' : '🧪 Test AI'}
          </button>
          
          {/* Test Result Display */}
          {testResult && (
            <div style={{
              width: '500px',
              margin: '10px auto',
              padding: '15px',
              background: 'rgba(0, 0, 0, 0.8)',
              border: '2px solid #FFD700',
              borderRadius: '8px',
              color: '#FFD700',
              fontFamily: 'VT323, monospace',
              fontSize: '16px',
              textAlign: 'center',
              wordWrap: 'break-word'
            }}>
              {testResult}
            </div>
          )}
          
          {/* Test AI Button */}
          <button
            className="test-ai-button"
            onClick={() => handleButtonClick(handleTestAI)}
            onMouseEnter={() => isSoundOn && playHoverSound()}
            disabled={isTestingAI}
            style={{
              width: '275px',
              height: '60px',
              background: isTestingAI ? '#666' : '#4CAF50',
              color: 'white',
              border: '2px solid #FFD700',
              fontFamily: 'VT323, monospace',
              fontSize: '20px',
              cursor: isTestingAI ? 'not-allowed' : 'pointer',
              borderRadius: '8px',
              margin: '20px auto',
              display: 'block',
              transition: 'all 0.2s',
              opacity: isTestingAI ? 0.7 : 1
            }}
          >
            {isTestingAI ? '🔄 Testing AI...' : '🧪 Test AI'}
          </button>
          
          {/* Test Result Display */}
          {testResult && (
            <div style={{
              width: '500px',
              margin: '10px auto',
              padding: '15px',
              background: 'rgba(0, 0, 0, 0.8)',
              border: '2px solid #FFD700',
              borderRadius: '8px',
              color: '#FFD700',
              fontFamily: 'VT323, monospace',
              fontSize: '16px',
              textAlign: 'center',
              wordWrap: 'break-word'
            }}>
              {testResult}
            </div>
          )}
        </div>
        <div 
          className="leaderboard-button"
          onClick={() => handleButtonClick(() => navigate('/leaderboard'))}
          onMouseEnter={() => isSoundOn && playHoverSound()}
        ></div>
        <div 
          className={`sound-button ${isSoundOn ? 'sound-on' : 'sound-off'}`}
          onClick={handleSoundToggle}
          onMouseEnter={() => isSoundOn && playHoverSound()}
        ></div>
        {user && (
          <div className="user-greeting">
            Hi u/{user.username}
            {process.env.NODE_ENV === 'development' && (
              <span style={{ 
                color: '#ff6b6b', 
                fontSize: '14px',
                marginLeft: '10px'
              }}>
                [DEV]
              </span>
            )}
            <button className="logout-button" onClick={logout}>
              Reset User
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default HomePage; 