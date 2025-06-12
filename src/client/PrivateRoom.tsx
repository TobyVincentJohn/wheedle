import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './PrivateRoom.css';

const PrivateRoom: React.FC = () => {
  const [roomCode, setRoomCode] = useState('');
  const navigate = useNavigate();

  const handleRoomCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase();
    if (value.length <= 5) {
      setRoomCode(value);
    }
  };

  const handleCreateRoom = () => {
    navigate('/waiting-room', { state: { roomType: 'private', isHost: true } });
  };

  const handleJoinRoom = () => {
    if (roomCode.length === 5) {
      navigate('/waiting-room', { state: { roomType: 'private', roomCode } });
    }
  };

  return (
    <div className="private-room">
      <div className="private-room-content">
        {error && (
          <div style={{
            position: 'absolute',
            top: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(255, 68, 68, 0.9)',
            color: 'white',
            padding: '10px 20px',
            borderRadius: '8px',
            fontFamily: 'VT323, monospace',
            fontSize: '18px',
            zIndex: 10
          }}>
            {error}
          </div>
        )}
        <div className="join-section">
          <div className="join-text">ENTER ROOM CODE</div>
          <div className="room-code-container">
            <input
              type="text"
              className="room-code-input"
              value={roomCode}
              onChange={handleRoomCodeChange}
              maxLength={5}
              placeholder="XXXXX"
              disabled={isJoining}
            />
            <button 
              className="next-button"
              onClick={handleJoinRoom}
              disabled={roomCode.length !== 5 || isJoining}
              style={{ opacity: isJoining ? 0.5 : 1 }}
            />
          </div>
        </div>
        <div className="divider" />
        <button 
          className="create-room-button" 
          onClick={handleCreateRoom}
          disabled={isJoining}
          style={{ opacity: isJoining ? 0.5 : 1 }}
        />
      </div>
    </div>
  );
};

export default PrivateRoom; 