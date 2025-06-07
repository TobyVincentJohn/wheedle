import React from 'react';
import { useNavigate } from 'react-router-dom';
import './PublicRoom.css';

const PublicRoom: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="public-room">
      <h1>Public Room</h1>
      <p>Welcome to the Public Room! Ready to start playing?</p>
      <div className="button-container">
        <button 
          onClick={() => navigate('/waiting-room', { state: { roomType: 'Public' } })} 
          className="join-button"
        >
          Join Game
        </button>
        <button onClick={() => navigate('/')} className="back-button">
          Back to Home
        </button>
      </div>
    </div>
  );
};

export default PublicRoom; 