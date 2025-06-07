import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './WaitingRoom.css';

const WaitingRoom: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const roomType = location.state?.roomType || 'Unknown';

  return (
    <div className="waiting-room">
      <div className="waiting-content">
        <h1>Waiting Room</h1>
        <p>Waiting for other players to join the {roomType} room...</p>
        
        <div className="loading-animation">
          <div className="dot"></div>
          <div className="dot"></div>
          <div className="dot"></div>
        </div>

        <div className="player-count">
          <p>Players in room: 1/4</p>
        </div>

        <div className="button-container">
          <button 
            onClick={() => navigate('/game')} 
            className="start-button"
          >
            Start Game
          </button>
          <button 
            onClick={() => navigate('/')} 
            className="leave-button"
          >
            Leave Room
          </button>
        </div>
      </div>
    </div>
  );
};

export default WaitingRoom; 