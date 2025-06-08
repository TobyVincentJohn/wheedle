import React from 'react';
import { useNavigate } from 'react-router-dom';
import './WaitingRoom.css';

const WaitingRoom: React.FC = () => {
  const navigate = useNavigate();

  const handleQuit = () => {
    navigate('/');
  };

  const handleStart = () => {
    navigate('/game');
  };

  return (
    <div className="waiting-room">
      <div className="waiting-content">
        <div className="waiting-logo" />
        <div className="waiting-timer">
          <div className="waiting-timer-text">GAME STARTS IN</div>
          <div className="waiting-timer-count">00:49</div>
        </div>
        <div className="waiting-name-tags-container">
          <div className="waiting-name-tag">u/morpheusbtw</div>
          <div className="waiting-name-tag">u/akshayanataraj</div>
          <div className="waiting-name-tag">u/tobyvincent</div>
          <div className="waiting-name-tag">waiting...</div>
          <div className="waiting-name-tag">waiting...</div>
          <div className="waiting-name-tag">waiting...</div>
        </div>
        <div className="waiting-bottom-container">
          <button className="waiting-quit-button" onClick={handleQuit} />
          <div className="waiting-room-code">
            <div className="waiting-room-code-text">ROOM CODE</div>
            <div className="waiting-room-code-value">XCJVA</div>
          </div>
          <button className="waiting-start-button" onClick={handleStart} />
        </div>
      </div>
    </div>
  );
};

export default WaitingRoom; 