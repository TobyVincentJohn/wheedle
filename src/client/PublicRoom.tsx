import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { GameSession } from '../shared/types/session';
import { useSession } from './hooks/useSession';
import { useUser } from './hooks/useUser';
import './PublicRoom.css';

const PublicRoom: React.FC = () => {
  const navigate = useNavigate();
  const [publicSessions, setPublicSessions] = useState<GameSession[]>([]);
  const [searchCode, setSearchCode] = useState('');
  const [searchedSession, setSearchedSession] = useState<GameSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { createSession, joinSession, currentSession, clearCurrentSession } = useSession();
  const { refreshUser } = useUser();

  const fetchPublicSessions = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/sessions/public');
      const data = await response.json();
      
      if (data.status === 'success') {
        setPublicSessions(data.data || []);
      } else {
        setError(data.message || 'Failed to fetch sessions');
      }
    } catch (err) {
      setError('Failed to fetch public sessions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPublicSessions();
    
    // Refresh sessions every 3 seconds
    const interval = setInterval(fetchPublicSessions, 3000);
    return () => clearInterval(interval);
  }, []);

  // Clear any existing session when entering public room
  useEffect(() => {
    // Clear any existing session when user enters public room
    clearCurrentSession();
  }, [clearCurrentSession]);

  const handleCreateSession = async () => {
    try {
      const session = await createSession(6, false); // Max 6 players, public session
      await refreshUser(); // Refresh user data after creating session
      navigate('/waiting-room', { 
        state: { 
          roomType: 'public', 
          session,
          isHost: true 
        } 
      });
    } catch (err) {
      console.error('Failed to create session:', err);
    }
  };

  const handleJoinSession = async (sessionId: string) => {
    try {
      const session = await joinSession(sessionId);
      await refreshUser(); // Refresh user data after joining session
      navigate('/waiting-room', { 
        state: { 
          roomType: 'public', 
          session 
        } 
      });
    } catch (err) {
      console.error('Failed to join session:', err);
    }
  };

  const formatTimeAgo = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) return 'Just now';
    if (minutes === 1) return '1 minute ago';
    return `${minutes} minutes ago`;
  };

  const handleSearchCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase();
    if (value.length <= 5) {
      setSearchCode(value);
      if (value.length === 0) {
        setSearchedSession(null);
      }
    }
  };

  const handleSearchSession = async () => {
    if (searchCode.length !== 5) return;
    
    try {
      console.log(`Searching for public session with code: ${searchCode}`);
      
      const response = await fetch(`/api/sessions/by-code/${searchCode}/public`);
      
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
        setSearchedSession(data.data);
        setError(null);
      } else {
        setError(data.message || 'Public session not found');
        setSearchedSession(null);
        setTimeout(() => setError(null), 4000);
      }
    } catch (err) {
      console.error('Failed to search for session:', err);
      if (err instanceof Error && err.message.includes('non-JSON')) {
        setError('Server error. Please try again later.');
      } else {
        setError('Failed to search for session');
      }
      setSearchedSession(null);
      setTimeout(() => setError(null), 3000);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearchSession();
    }
  };

  return (
    <div className="public-room">
      <div className="public-room-content">
        <button 
          className="back-button" 
          onClick={() => navigate('/')}
        >
          Back to Home
        </button>
        <div className="room-code-search">
          <div className="room-code-search-label">ENTER CODE</div>
          <div className="room-code-search-container">
            <input
              type="text"
              className="room-code-search-input"
              value={searchCode}
              onChange={handleSearchCodeChange}
              onKeyPress={handleKeyPress}
              maxLength={5}
              placeholder="XXXXX"
            />
            <button 
              className="room-code-search-btn"
              onClick={handleSearchSession}
              disabled={searchCode.length !== 5}
            >
              🔍
            </button>
          </div>
        </div>
        
        {loading ? (
          <div className="loading-message">Loading sessions...</div>
        ) : error ? (
          <div className="error-message">{error}</div>
        ) : (
          <>
            <div className="sessions-header">
              <h2>Public Sessions</h2>
              <button className="create-session-btn" onClick={handleCreateSession}>
                Create New Session
              </button>
            </div>
            
            {publicSessions.length === 0 && !searchedSession ? (
              <div className="no-sessions">
                <p>No public sessions available</p>
                <button className="create-first-session-btn" onClick={handleCreateSession}>
                  Create the First Session
                </button>
              </div>
            ) : (
              <div className="sessions-list">
                {searchedSession && (
                  <div key={searchedSession.sessionId} className="session-tile searched-session">
                    <div className="session-info">
                      <div className="session-host">
                        Host: u/{searchedSession.hostUsername} (Found!)
                      </div>
                      <div className="session-players">
                        {searchedSession.players.length}/{searchedSession.maxPlayers} players
                      </div>
                      <div className="session-time">
                        Created {formatTimeAgo(searchedSession.createdAt)}
                      </div>
                      <div className="session-code">
                        Code: {searchedSession.sessionCode}
                      </div>
                    </div>
                    <button 
                      className="join-session-btn"
                      onClick={() => handleJoinSession(searchedSession.sessionId)}
                      disabled={searchedSession.players.length >= searchedSession.maxPlayers}
                    >
                      {searchedSession.players.length >= searchedSession.maxPlayers ? 'Full' : 'Join'}
                    </button>
                  </div>
                )}
                {publicSessions.map((session) => (
                  <div key={session.sessionId} className="session-tile">
                    <div className="session-info">
                      <div className="session-host">
                        Host: u/{session.hostUsername}
                      </div>
                      <div className="session-players">
                        {session.players.length}/{session.maxPlayers} players
                      </div>
                      <div className="session-time">
                        Created {formatTimeAgo(session.createdAt)}
                      </div>
                      <div className="session-code">
                        Code: {session.sessionCode}
                      </div>
                    </div>
                    <button 
                      className="join-session-btn"
                      onClick={() => handleJoinSession(session.sessionId)}
                      disabled={session.players.length >= session.maxPlayers}
                    >
                      {session.players.length >= session.maxPlayers ? 'Full' : 'Join'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default PublicRoom;