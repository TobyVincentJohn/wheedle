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
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [backgroundError, setBackgroundError] = useState<string | null>(null);
  const { createSession, joinSession, currentSession } = useSession();
  const { refreshUser } = useUser();

  const fetchPublicSessions = async () => {
    try {
      console.log('🔍 Fetching public sessions...');
      const response = await fetch('/api/sessions/public');
      const data = await response.json();
      console.log('📊 Public sessions response:', data);
      
      if (data.status === 'success') {
        console.log(`✅ Found ${data.data?.length || 0} public sessions`);
        setPublicSessions(data.data || []);
        setError(null);
        setBackgroundError(null);
        
        // Mark as loaded successfully
        if (!hasLoadedOnce) {
          setHasLoadedOnce(true);
        }
      } else {
        console.log('❌ Failed to fetch sessions:', data.message);
        if (isInitialLoad) {
          setError(data.message || 'Failed to fetch sessions');
        } else {
          setBackgroundError(data.message || 'Failed to fetch sessions');
        }
      }
    } catch (err) {
      console.error('💥 Error fetching public sessions:', err);
      if (isInitialLoad) {
        setError('Failed to fetch public sessions');
      } else {
        setBackgroundError('Failed to fetch public sessions');
      }
    } finally {
      if (isInitialLoad) {
        setIsInitialLoad(false);
      }
    }
  };

  useEffect(() => {
    fetchPublicSessions();
    
    // Refresh sessions every 3 seconds
    const interval = setInterval(fetchPublicSessions, 3000);
    return () => clearInterval(interval);
  }, []);

  // If user is already in a session, redirect to waiting room
  useEffect(() => {
    if (currentSession) {
      navigate('/waiting-room', { 
        state: { 
          roomType: 'public', 
          session: currentSession 
        } 
      });
    }
  }, [currentSession, navigate]);

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
        <div className="top-bar">
          <div 
            className="back-text" 
            onClick={() => navigate('/')}
          >
            BACK
          </div>
          <div className="top-bar-center">
            <button 
              className="create-room-button" 
              onClick={handleCreateSession}
            />
          </div>
          <div className="top-bar-right">
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
        </div>
        
        {!hasLoadedOnce && error ? (
          <div className="error-message">{error}</div>
        ) : !hasLoadedOnce ? (
          <div className="loading-message">Loading sessions...</div>
        ) : (
          <div className="sessions-content">
            {backgroundError && (
              <div style={{
                position: 'fixed',
                top: '10px',
                right: '10px',
                background: 'rgba(255, 68, 68, 0.9)',
                color: 'white',
                padding: '8px 12px',
                borderRadius: '4px',
                fontSize: '14px',
                fontFamily: 'VT323, monospace',
                zIndex: 1000
              }}>
                Connection issue
              </div>
            )}
            
            {(publicSessions.length === 0 && !searchedSession) ? (
              <div className="no-sessions-message">
                No public sessions found. Create one!
              </div>
            ) : (
              <div className="sessions-list">
                {searchedSession && (
                  <div key={searchedSession.sessionId} className="session-tile searched-session">
                    <div className="session-info">
                      <div className="session-host">
                        u/{searchedSession.host?.username || 'Unknown'}
                      </div>
                      <div className="session-details">
                        <div className="session-players">
                          {searchedSession.players.length}/{searchedSession.maxPlayers} Players
                        </div>
                        <div className="session-code">{searchedSession.sessionCode}</div>
                      </div>
                    </div>
                    <div 
                      className={`join-session-text ${searchedSession.players.length >= searchedSession.maxPlayers ? 'disabled' : ''}`}
                      onClick={() => {
                        if (searchedSession.players.length < searchedSession.maxPlayers) {
                          handleJoinSession(searchedSession.sessionId);
                        }
                      }}
                    >
                      {searchedSession.players.length >= searchedSession.maxPlayers ? 'FULL' : 'JOIN'}
                    </div>
                  </div>
                )}
                {publicSessions.map((session) => (
                  <div key={session.sessionId} className="session-tile">
                    <div className="session-info">
                      <div className="session-host">
                        u/{session.host?.username || 'Unknown'}
                      </div>
                      <div className="session-details">
                        <div className="session-players">
                          {session.players.length}/{session.maxPlayers} Players
                        </div>
                        <div className="session-code">{session.sessionCode}</div>
                      </div>
                    </div>
                    <div 
                      className={`join-session-text ${session.players.length >= session.maxPlayers ? 'disabled' : ''}`}
                      onClick={() => {
                        if (session.players.length < session.maxPlayers) {
                          handleJoinSession(session.sessionId);
                        }
                      }}
                    >
                      {session.players.length >= session.maxPlayers ? 'FULL' : 'JOIN'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default PublicRoom;