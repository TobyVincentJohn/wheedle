import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from './hooks/useSession';
import './PrivateRoom.css';

const PrivateRoom: React.FC = () => {
  const [roomCode, setRoomCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const navigate = useNavigate();
  const { createSession, joinSession } = useSession();

  const handleRoomCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase();
    if (value.length <= 5) {
      setRoomCode(value);
      if (error) setError(null); // Clear error when user types
    }
  };

  const handleCreateRoom = async () => {
    if (isJoining) return;
    
    try {
      setIsJoining(true);
      const session = await createSession(6, true); // Max 6 players, private session
      navigate('/waiting-room', { 
        state: { 
          roomType: 'private', 
          session,
          isHost: true 
        } 
      });
    } catch (err) {
      console.error('Failed to create private session:', err);
      setError('Failed to create room. Please try again.');
      setIsJoining(false);
    }
  };

  const handleJoinRoom = async () => {
    if (roomCode.length !== 5 || isJoining) return;
    
    try {
      setIsJoining(true);
      setError(null);
      
      // First, search for the session by code
      const response = await fetch(`/api/sessions/by-code/${roomCode}`);
      const data = await response.json();
      
      if (data.status === 'success' && data.data) {
        // Check if the found session is private
        if (data.data.isPrivate) {
          // Join the found private session
          const session = await joinSession(data.data.sessionId);
          navigate('/waiting-room', { 
            state: { 
              roomType: 'private', 
              session 
            } 
          });
        } else {
          setError('This code belongs to a public session. Use Public Room to join.');
          setIsJoining(false);
        }
      } else {
        setError('Private room not found or not available');
        setIsJoining(false);
      }
    } catch (err) {
      console.error('Failed to join private session:', err);
      setError('Failed to join room. Please check the code and try again.');
      setIsJoining(false);
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