import React from 'react';
import { useSessionsRedisData } from '../hooks/useRedisData';
import './RedisDataViewer.css';

export const SessionsRedisViewer: React.FC = () => {
  const { publicSessions, currentSession, userData, loading, error } = useSessionsRedisData();

  if (loading) {
    return <div className="redis-data-viewer loading">Loading Redis data...</div>;
  }

  if (error) {
    return <div className="redis-data-viewer error">{error}</div>;
  }

  return (
    <div className="redis-data-viewer">
      <div className="redis-section">
        <h3>Public Sessions</h3>
        {publicSessions.length > 0 ? (
          <div className="redis-content">
            {publicSessions.map(session => (
              <div key={session.sessionId} style={{ marginBottom: '10px' }}>
                <div>Code: {session.sessionCode}</div>
                <div>Players: {session.players.length}/{session.maxPlayers}</div>
                <div>Status: {session.status}</div>
                <div>Prize Pool: ${session.prizePool}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="redis-empty">No public sessions</div>
        )}
      </div>

      <div className="redis-section">
        <h3>Current Session</h3>
        {currentSession ? (
          <div className="redis-content">
            <div>Code: {currentSession.sessionCode}</div>
            <div>Status: {currentSession.status}</div>
            <div>Players: {currentSession.players.length}/{currentSession.maxPlayers}</div>
            <div>Prize Pool: ${currentSession.prizePool}</div>
            <div>Entry Fee: ${currentSession.entryFee}</div>
            <div>Minimum Bet: ${currentSession.minimumBet}</div>
          </div>
        ) : (
          <div className="redis-empty">Not in a session</div>
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