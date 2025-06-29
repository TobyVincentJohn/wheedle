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

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/leaderboard');
        const data = await response.json();
        
        if (data.status === 'success') {
          setLeaderboard(data.data);
        } else {
          setError(data.message || 'Failed to fetch leaderboard');
        }
      } catch (err) {
        setError('Failed to fetch leaderboard');
        console.error('Error fetching leaderboard:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, []);

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
          className="back-text" 
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
          {loading ? (
            <div className="loading-message">Loading leaderboard...</div>
          ) : error ? (
            <div className="error-message">{error}</div>
          ) : leaderboard.length === 0 ? (
            <div className="no-data-message">No players found. Play some games to appear on the leaderboard!</div>
          ) : (
            leaderboard.map((user, index) => (
              <div key={user.userId} className="leaderboard-entry">
                <div className="rank-cell">#{index + 1}</div>
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