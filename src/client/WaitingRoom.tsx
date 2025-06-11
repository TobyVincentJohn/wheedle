import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { GameSession } from '../shared/types/session';
import { useSession } from './hooks/useSession';
import './WaitingRoom.css';

const WaitingRoom: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { leaveSession, startGame, currentSession, refreshSession } = useSession();
  const [session, setSession] = useState<GameSession | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [countdown, setCountdown] = useState(60);

  useEffect(() => {
    // Get session from location state or current session
    const sessionFromState = location.state?.session;
    const hostFromState = location.state?.isHost;
    
    if (sessionFromState) {
      setSession(sessionFromState);
      setIsHost(hostFromState || false);
    } else if (currentSession) {
      setSession(currentSession);
      // Check if current user is host
      setIsHost(currentSession.players.some(p => p.isHost && p.userId === currentSession.hostUserId));
    } else {
      // No session found, redirect to home
      navigate('/');
      return;
    }
  }, [location.state, currentSession, navigate]);

  // Refresh session data periodically
  useEffect(() => {
    if (!session) return;

    const interval = setInterval(async () => {
      await refreshSession();
    }, 2000);

    return () => clearInterval(interval);
  }, [session, refreshSession]);

  // Update session when currentSession changes
  useEffect(() => {
    if (currentSession && currentSession.sessionId === session?.sessionId) {
      setSession(currentSession);
      
      // If game has started, navigate to game page
      if (currentSession.status === 'in-game') {
        navigate('/game', { state: { session: currentSession } });
      }
    }
  }, [currentSession, session, navigate]);

  // Countdown timer
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleQuit = async () => {
    if (session) {
      try {
        await leaveSession(session.sessionId);
        navigate('/');
      } catch (error) {
        console.error('Failed to leave session:', error);
        navigate('/'); // Navigate anyway
      }
    } else {
      navigate('/');
    }
  };

  const handleStart = async () => {
    if (session && isHost) {
      try {
        await startGame(session.sessionId);
        // Navigation will happen automatically when session status changes
      } catch (error) {
        console.error('Failed to start game:', error);
      }
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (!session) {
    return (
      <div className="waiting-room">
        <div className="waiting-content">
          <div className="loading-message">Loading session...</div>
        </div>
      </div>
    );
  }

  // Create array of 6 slots for name tags
  const playerSlots = Array(6).fill(null).map((_, index) => {
    const player = session.players[index];
    return player ? `u/${player.username}` : 'waiting...';
  });

  return (
    <div className="waiting-room">
      <div className="waiting-content">
        <div className="waiting-logo" />
        <div className="waiting-timer">
          <div className="waiting-timer-text">GAME STARTS IN</div>
          <div className="waiting-timer-count">{formatTime(countdown)}</div>
        </div>
        <div className="waiting-name-tags-container">
          {playerSlots.map((playerName, index) => (
            <div key={index} className="waiting-name-tag">
              {playerName}
            </div>
          ))}
        </div>
        <div className="waiting-bottom-container">
          <button className="waiting-quit-button" onClick={handleQuit} />
          <div className="waiting-room-code">
            <div className="waiting-room-code-text">ROOM CODE</div>
            <div className="waiting-room-code-value">{session.sessionCode}</div>
          </div>
          {isHost ? (
            <button 
              className="waiting-start-button" 
              onClick={handleStart}
              disabled={session.players.length < 2}
            />
          ) : (
            <div className="waiting-for-host">
              <div className="waiting-for-host-text">WAITING FOR HOST</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WaitingRoom;