import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from './hooks/useSession';
import { useUser } from './hooks/useUser';
import { useEffect } from 'react';
import './PrivateRoom.css';

const PrivateRoom: React.FC = () => {
  const [roomCode, setRoomCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const navigate = useNavigate();
  const { createSession, joinSession, currentSession } = useSession();
  const { refreshUser } = useUser();

  // Check if user is already in a session and redirect appropriately
  useEffect(() => {
    if (currentSession) {
      // Redirect based on session status
      if (currentSession.status === 'waiting' || currentSession.status === 'countdown') {
        navigate('/waiting-room', { 
          state: { 
            roomType: 'private', 
            session: currentSession 
          } 
        });
      } else if (currentSession.status === 'in-game') {
        navigate('/game', { 
          state: { 
            session: currentSession 
          } 
        });
      }
    }
  }, [currentSession, navigate]);

  const handleRoomCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase();
    if (value.length <= 5) {
      setRoomCode(value);
      if (error) setError(null);
    }
  };

  const handleCreateRoom = async () => {
    if (isJoining) return;
    
    try {
      setIsJoining(true);
      const session = await createSession(6, true); // Max 6 players, private session
      await refreshUser(); // Refresh user data after creating session
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
      
      console.log(`Searching for private session with code: ${roomCode}`);
      
      // First, search for the session by code
      const response = await fetch(`/api/sessions/by-code/${roomCode}/private`);
      
      console.log('Response status:', response.status);
      console.log('Response headers:', response.headers.get('content-type'));
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error('Non-JSON response:', text);
        throw new Error('Server returned non-JSON response');
      }
      
      const data = await response.json();
      console.log('API response:', data);
      
      if (data.status === 'success' && data.data) {
        // Join the found private session
        const session = await joinSession(data.data.sessionId);
        await refreshUser(); // Refresh user data after joining session
        navigate('/waiting-room', { 
          state: { 
            roomType: 'private', 
            session 
          } 
        });
      } else {
        setError(data.message || 'Private room not found or not available');
        setIsJoining(false);
      }
    } catch (err) {
      console.error('Failed to join private session:', err);
      if (err instanceof Error && err.message.includes('non-JSON')) {
        setError('Server error. Please try again later.');
      } else {
        setError('Failed to join room. Please check the code and try again.');
      }
      setIsJoining(false);
    }
  };

  return (
    <div className="private-room">
      <div className="private-room-content">
        <button 
          className="back-button" 
          onClick={() => navigate('/')}
        >
          Back to Home
        </button>
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