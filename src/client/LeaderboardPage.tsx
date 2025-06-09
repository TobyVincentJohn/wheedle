import React from 'react';
import './LeaderboardPage.css';

const LeaderboardPage: React.FC = () => {
  return (
    <div className="leaderboard">
      <div className="leaderboard-content">
        <h1 className="leaderboard-title">HIGH ROLLERS</h1>
        <div className="leaderboard-headers">
          <div className="header rank-header">RANK</div>
          <div className="header name-header">NAME</div>
          <div className="header bankroll-header">BANKROLL</div>
        </div>
      </div>
    </div>
  );
};

export default LeaderboardPage; 