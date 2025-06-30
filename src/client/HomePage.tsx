import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { playHoverSound, playClickSound, toggleSound, getSoundState } from './utils/sound';
import { useUser } from './hooks/useUser';
import './HomePage.css';

const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const [isSoundOn, setIsSoundOn] = useState(getSoundState());
  const { user, logout } = useUser();
  const [showRules, setShowRules] = useState(false);
  

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

  return (
    <div className="homepage">
      <div className={`homepage-content ${showRules ? 'dimmed' : ''}`}>
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
            onClick={() => handleButtonClick(() => setShowRules(true))}
            onMouseEnter={() => isSoundOn && playHoverSound()}
          ></div>
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
            Welcome u/{user.username}
            {process.env.NODE_ENV === 'development' && (
              <span style={{ 
                color: '#ff6b6b', 
                fontSize: '14px',
                marginLeft: '10px'
              }}>
                [DEV]
              </span>
            )}
          </div>
        )}
      </div>
      {showRules && (
        <div className="rules-modal">
          <div className="rules-content">
            <div 
              className="rules-close"
              onClick={() => handleButtonClick(() => setShowRules(false))}
              onMouseEnter={() => isSoundOn && playHoverSound()}
            >
              X
            </div>
            <div className="rules-image">
              <div className="rules-text-content">
                <div className="rules-title">How to Play Wheedle</div>
                
                <div className="rules-section">
                  <div className="rules-section-title">Game Overview</div>
                  <p>Wheedle is a persuasion game where you try to convince an AI that you deserve to win more than other players. The AI has a secret personality, and your job is to figure out who they are and appeal to them!</p>
                </div>

                <div className="rules-section">
                  <div className="rules-section-title">How It Works</div>
                  <ul className="rules-list">
                    <li>Join a <span className="rules-highlight">Public Room</span> or create/join a <span className="rules-highlight">Private Room</span></li>
                    <li>Wait for 2-6 players to join, then the host starts the game</li>
                    <li>You'll be assigned a <span className="rules-highlight">secret role</span> to play during the game</li>
                    <li>The AI will reveal <span className="rules-highlight">3 clues</span> about their personality</li>
                    <li>You have <span className="rules-highlight">1 minute</span> to write your response</li>
                    <li>Convince the AI why you deserve to win while staying in character!</li>
                  </ul>
                </div>

                <div className="rules-section">
                  <div className="rules-section-title">Winning Strategy</div>
                  <ul className="rules-list">
                    <li><strong>Stay in character:</strong> Play your assigned role convincingly</li>
                    <li><strong>Read the clues:</strong> Figure out the AI's personality from their hints</li>
                    <li><strong>Be persuasive:</strong> Appeal to what the AI cares about</li>
                    <li><strong>Be creative:</strong> Unique approaches often win over generic ones</li>
                  </ul>
                </div>

                <div className="rules-section">
                  <div className="rules-section-title">Scoring</div>
                  <p>The AI judges based on how well you stay in character, understand their personality, and make a convincing argument. Winners earn points on the leaderboard!</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HomePage;