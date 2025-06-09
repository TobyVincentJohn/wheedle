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
            />
            <button 
              className="next-button"
              onClick={handleJoinRoom}
              disabled={roomCode.length !== 5}
            />
          </div>
        </div>
        <div className="divider" />
        <button className="create-room-button" onClick={handleCreateRoom} />
      </div>
    </div>
  );
};

export default PrivateRoom; 