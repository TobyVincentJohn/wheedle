import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { GameSession } from '../shared/types/session';
import { useSession } from './hooks/useSession';
import { useUser } from './hooks/useUser';
import { playHoverSound, playClickSound, getSoundState } from './utils/sound';
import './WaitingRoom.css';

const WaitingRoom: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { leaveSession, startCountdown, currentSession, refreshSession } = useSession();
  const { user, refreshUser } = useUser();
  const [session, setSession] = useState<GameSession | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [isCountingDown, setIsCountingDown] = useState(false);

  const handleButtonClick = (action: () => void) => {
    if (getSoundState()) {
      playClickSound();
    }
    action();
  };

  useEffect(() => {
    // Get session from location state or current session
    const sessionFromState = location.state?.session;
    const hostFromState = location.state?.isHost;
    
    if (sessionFromState) {
      setSession(sessionFromState);
      setIsHost(hostFromState || false);
      // Refresh user data when entering waiting room
      refreshUser();
    } else if (currentSession) {
      setSession(currentSession);
      refreshUser();
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
    }, 1000); // Check every second for real-time updates

    return () => clearInterval(interval);
  }, [session, refreshSession]);

  // Update session when currentSession changes
  useEffect(() => {
    if (currentSession && currentSession.sessionId === session?.sessionId) {
      setSession(currentSession);
      
      // Check if current user is host
      if (user) {
        const currentUserPlayer = currentSession.players.find(p => p.userId === user.userId);
        setIsHost(currentUserPlayer?.isHost || false);
      }
      
      // Check if countdown has started
      if (currentSession.status === 'countdown' && currentSession.countdownStartedAt) {
        const elapsed = Math.floor((Date.now() - currentSession.countdownStartedAt) / 1000);
        const remaining = Math.max(0, 10 - elapsed);
        
        if (remaining > 0) {
          setCountdown(remaining);
          setIsCountingDown(true);
        } else {
          // Countdown finished, navigate to the loading screen
          setIsCountingDown(false);
          navigate('/loading', { state: { session: currentSession } });
        }
      } else if (currentSession.status === 'in-game') {
        // Game has already started, navigate to loading screen to fetch data
        navigate('/loading', { state: { session: currentSession } });
      } else {
        setIsCountingDown(false);
        setCountdown(0);
      }
    }
  }, [currentSession, session, navigate, user]);

  // Countdown timer
  useEffect(() => {
    if (isCountingDown && countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (isCountingDown && countdown === 0) {
      // Countdown finished, start the actual game
      setIsCountingDown(false);
      if (session && isHost) {
        // Host starts the game when countdown reaches 0
        handleStartGame();
      }
    }
  }, [countdown, isCountingDown, session, navigate, isHost]);

  const handleStartGame = async () => {
    if (session && isHost) {
      try {
        await fetch(`/api/sessions/${session.sessionId}/start`, {
          method: 'POST',
        });
        // The session update will trigger navigation to game page
      } catch (error) {
        console.error('Failed to start game:', error);
      }
    }
  };

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
    if (session && isHost && session.players.length >= 2) {
      try {
        await startCountdown(session.sessionId);
        // The countdown will start automatically when the session updates
      } catch (error) {
        console.error('Failed to start countdown:', error);
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

  const canStart = isHost && session.players.length >= 2 && session.status === 'waiting';
  const showWaitingForPlayers = isHost && session.players.length < 2 && session.status === 'waiting';

  return (
    <div className="waiting-room">
      <div className="waiting-content">
        <div className="waiting-logo" />
        
        {isCountingDown ? (
          <div className="waiting-timer">
            <div className="waiting-timer-text countdown-mode">GAME STARTS IN</div>
            <div className="waiting-timer-count">{formatTime(countdown)}</div>
          </div>
        ) : (
          <div className="waiting-timer">
            <div className="waiting-timer-text">&nbsp;</div>
          </div>
        )}
        
        <div className="waiting-name-tags-container">
          {playerSlots.map((playerName, index) => (
            <div key={index} className="waiting-name-tag">
              {playerName}
            </div>
          ))}
        </div>
        
        {/* Only show bottom container when not counting down */}
        {!isCountingDown && (
          <div className="waiting-bottom-container">
            <button 
              className="waiting-quit-button" 
              onClick={() => handleButtonClick(handleQuit)}
              onMouseEnter={() => getSoundState() && playHoverSound()}
            />
            <div className="waiting-room-code">
              <div className="waiting-room-code-text">ROOM CODE</div>
              <div className="waiting-room-code-value">{session.sessionCode}</div>
            </div>
            {showWaitingForPlayers ? (
              <div className="waiting-for-host">
                <div className="waiting-for-host-text">WAITING FOR MORE PLAYERS...</div>
              </div>
            ) : canStart ? (
              <button 
                className="waiting-start-button" 
                onClick={() => handleButtonClick(handleStart)}
                onMouseEnter={() => getSoundState() && playHoverSound()}
              />
            ) : !isHost && session.status === 'waiting' ? (
              <div className="waiting-for-host">
                <div className="waiting-for-host-text">WAITING FOR HOST</div>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
};

export default WaitingRoom;