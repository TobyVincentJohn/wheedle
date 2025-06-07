import React from 'react';
import { useNavigate } from 'react-router-dom';
import './PrivateRoom.css';

const PrivateRoom: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="private-room">
      <h1>Private Room</h1>
      <p>Welcome to the Private Room! Ready to start playing?</p>
      <div className="button-container">
        <button 
          onClick={() => navigate('/waiting-room', { state: { roomType: 'Private' } })} 
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

export default PrivateRoom; 