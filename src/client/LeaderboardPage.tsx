import React from 'react';
import { useNavigate } from 'react-router-dom';
import './LeaderboardPage.css';

const LeaderboardPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="leaderboard">
      <div className="leaderboard-content">
        <div 
          className="back-text" 
          onClick={() => navigate('/')}
        >
          BACK
        </div>
        <h1 className="leaderboard-title">HIGH ROLLERS</h1>
        <div className="leaderboard-headers">
          <div className="header rank-header">RANK</div>
          <div className="header name-header">NAME</div>
          <div className="header bankroll-header">VICTORIES</div>
        </div>
      </div>
    </div>
  );
};

export default LeaderboardPage; 