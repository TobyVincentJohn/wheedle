import React from 'react';
import { useRedisData } from '../hooks/useRedisData';
import './RedisDataViewer.css';

interface RedisDataViewerProps {
  sessionId: string | null;
  userId: string | null;
}

export const RedisDataViewer: React.FC<RedisDataViewerProps> = ({ sessionId, userId }) => {
  const { session, aiGameData, userData, loading, error } = useRedisData(sessionId, userId);

  if (loading) {
    return <div className="redis-data-viewer loading">Loading Redis data...</div>;
  }

  if (error) {
    return <div className="redis-data-viewer error">{error}</div>;
  }

  return (
    <div className="redis-data-viewer">
      <div className="redis-section">
        <h3>Session Data</h3>
        {session ? (
          <div className="redis-content">
            <div>Status: {session.status}</div>
            <div>Players: {session.players.length}/{session.maxPlayers}</div>
            <div>Prize Pool: ${session.prizePool}</div>
            <div>Entry Fee: ${session.entryFee}</div>
            <div>Minimum Bet: ${session.minimumBet}</div>
            {session.dealerId && <div>Dealer ID: {session.dealerId}</div>}
          </div>
        ) : (
          <div className="redis-empty">No session data</div>
        )}
      </div>

      <div className="redis-section">
        <h3>AI Game Data</h3>
        {aiGameData ? (
          <div className="redis-content">
            <div>Created: {new Date(aiGameData.createdAt).toLocaleString()}</div>
            {/* Add other AI game data fields here */}
          </div>
        ) : (
          <div className="redis-empty">No AI game data</div>
        )}
      </div>

      <div className="redis-section">
        <h3>User Data</h3>
        {userData ? (
          <div className="redis-content">
            <div>Username: {userData.username}</div>
            <div>Total Money: ${userData.money}</div>
            <div>Money In Hand: ${userData.moneyInHand || 0}</div>
          </div>
        ) : (
          <div className="redis-empty">No user data</div>
        )}
      </div>
    </div>
  );
}; 