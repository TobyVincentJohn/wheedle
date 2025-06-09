import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { playHoverSound, playClickSound, toggleSound, disableSound } from './utils/sound';
import { useUser } from './hooks/useUser';
import './HomePage.css';

const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const [isSoundOn, setIsSoundOn] = useState(false);
  const { user, logout } = useUser();
  

  // Initialize with sound disabled
  useEffect(() => {
    disableSound();
    setIsSoundOn(false);
  }, []);

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