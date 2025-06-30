import React from 'react';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserDetails } from '../shared/types/user';
import { playHoverSound, playClickSound, getSoundState } from './utils/sound';
import './LeaderboardPage.css';

const LeaderboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [leaderboard, setLeaderboard] = useState<UserDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [backgroundError, setBackgroundError] = useState<string | null>(null);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  const fetchLeaderboard = async (isInitialLoad = false) => {
    try {
      console.log('[LEADERBOARD CLIENT] Starting to fetch leaderboard...');
      if (isInitialLoad) {
        setLoading(true);
        setError(null);
      } else {
        setBackgroundError(null);
      }
        
      console.log('[LEADERBOARD CLIENT] Making API call to /api/leaderboard');
      const response = await fetch('/api/leaderboard');
        
      console.log('[LEADERBOARD CLIENT] Response status:', response.status);
      console.log('[LEADERBOARD CLIENT] Response ok:', response.ok);
        
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
        
      const data = await response.json();
      console.log('[LEADERBOARD CLIENT] Response data:', data);
        
      if (data.status === 'success') {
        console.log('[LEADERBOARD CLIENT] Successfully received', data.data.length, 'users');
        setLeaderboard(data.data);
        if (isInitialLoad) {
          setError(null);
        } else {
          setBackgroundError(null);
        }
        
        // Mark as loaded successfully
        if (!hasLoadedOnce) {
          setHasLoadedOnce(true);
        }
      } else {
        console.error('[LEADERBOARD CLIENT] API returned error:', data.message);
        if (isInitialLoad) {
          setError(data.message || 'Failed to fetch leaderboard');
        } else {
          setBackgroundError(data.message || 'Failed to fetch leaderboard');
        }
      }
    } catch (err) {
      console.error('[LEADERBOARD CLIENT] Fetch error:', err);
      if (isInitialLoad) {
        setError('Failed to fetch leaderboard');
      } else {
        setBackgroundError('Failed to fetch leaderboard');
      }
    } finally {
      if (isInitialLoad) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    // Initial fetch
    fetchLeaderboard(true);
    
    // Background refresh every 30 seconds
    const interval = setInterval(() => {
      if (hasLoadedOnce) {
        fetchLeaderboard(false);
      }
    }, 30000);
    
    return () => clearInterval(interval);
  }, [hasLoadedOnce]);

  // Remove the old useEffect that was causing constant refreshes
  /*
  useEffect(() => {
    fetchLeaderboard();
    
    // Refresh leaderboard every 30 seconds
    const interval = setInterval(fetchLeaderboard, 30000);
    return () => clearInterval(interval);
  }, []);
  */

  const handleButtonClick = (action: () => void) => {
    if (getSoundState()) {
      playClickSound();
    }
    action();
  };

  return (
    <div className="leaderboard">
      <div className="leaderboard-content">
        <div 
          className="leaderboard-back-text"
          onClick={() => handleButtonClick(() => navigate('/'))}
          onMouseEnter={() => getSoundState() && playHoverSound()}
        >
          BACK
        </div>
        <h1 className="leaderboard-title">HIGH ROLLERS</h1>
        <div className="leaderboard-headers">
          <div className="header rank-header">RANK</div>
          <div className="header name-header">NAME</div>
          <div className="header bankroll-header">WINS</div>
        </div>
        
        <div className="leaderboard-list">
          {/* Show background error if there is one */}
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
          
          {!hasLoadedOnce && loading ? (
            <div className="loading-message">Loading leaderboard...</div>
          ) : !hasLoadedOnce && error ? (
            <div className="error-message">{error}</div>
          ) : leaderboard.length === 0 ? (
            <div className="no-data-message">No players found. Play some games to appear on the leaderboard!</div>
          ) : (
            leaderboard.map((user, index) => (
              <div key={user.userId} className="leaderboard-entry">
                <div className="rank-cell">{index + 1}</div>
                <div className="name-cell">u/{user.username}</div>
                <div className="wins-cell">{user.wins || 0}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default LeaderboardPage; 