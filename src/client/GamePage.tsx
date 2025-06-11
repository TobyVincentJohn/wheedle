import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { GameSession } from '../shared/types/session';
import { useSession } from './hooks/useSession';
import { useUser } from './hooks/useUser';
import './GamePage.css';

interface PlayerLeftNotification {
  id: string;
  username: string;
  timestamp: number;
}

const GamePage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { leaveSession, currentSession, refreshSession } = useSession();
  const { user } = useUser();
  const [dealerId, setDealerId] = useState<number>(1);
  const [userInput, setUserInput] = useState<string>('');
  const [session, setSession] = useState<GameSession | null>(null);
  const [notifications, setNotifications] = useState<PlayerLeftNotification[]>([]);
  const [showAllPlayersLeftModal, setShowAllPlayersLeftModal] = useState(false);
  const [previousPlayerCount, setPreviousPlayerCount] = useState<number>(0);

  useEffect(() => {
    // Get session from location state or current session
    const sessionFromState = location.state?.session;
    
    if (sessionFromState) {
      setSession(sessionFromState);
      setPreviousPlayerCount(sessionFromState.players.length);
    } else if (currentSession) {
      setSession(currentSession);
      setPreviousPlayerCount(currentSession.players.length);
    } else {
      // No session found, redirect to home
      navigate('/');
      return;
    }

    // Generate random dealer
    const randomDealer = Math.floor(Math.random() * 8) + 1;
    setDealerId(randomDealer);
  }, [location.state, currentSession, navigate]);

  // Refresh session data periodically to detect player changes
  useEffect(() => {
    if (!session) return;

    const interval = setInterval(async () => {
      await refreshSession();
    }, 1000); // Check every second for real-time updates

    return () => clearInterval(interval);
  }, [session, refreshSession]);

  // Monitor session changes and detect when players leave
  useEffect(() => {
    if (currentSession && currentSession.sessionId === session?.sessionId) {
      const newPlayerCount = currentSession.players.length;
      
      // Check if players left
      if (newPlayerCount < previousPlayerCount && session) {
        // Find which players left
        const currentPlayerIds = new Set(currentSession.players.map(p => p.userId));
        const leftPlayers = session.players.filter(p => !currentPlayerIds.has(p.userId));
        
        // Add notifications for players who left
        leftPlayers.forEach(player => {
          const notification: PlayerLeftNotification = {
            id: `${player.userId}-${Date.now()}`,
            username: player.username,
            timestamp: Date.now(),
          };
          
          setNotifications(prev => [...prev, notification]);
          
          // Remove notification after 4 seconds
          setTimeout(() => {
            setNotifications(prev => prev.filter(n => n.id !== notification.id));
          }, 4000);
        });
      }
      
      // Check if only one player remains (including current user)
      if (newPlayerCount === 1 && user && currentSession.players.some(p => p.userId === user.userId)) {
        setShowAllPlayersLeftModal(true);
      }
      
      setSession(currentSession);
      setPreviousPlayerCount(newPlayerCount);
    }
  }, [currentSession, session, previousPlayerCount, user]);

  // Handle browser back button or page refresh
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };

    const handlePopState = async () => {
      if (session) {
        try {
          await leaveSession(session.sessionId);
        } catch (error) {
          console.error('Failed to leave session:', error);
        }
      }
      navigate('/');
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [session, leaveSession, navigate]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setUserInput(e.target.value);
  };

  const handleLeaveGame = async () => {
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

  const handleAllPlayersLeftModalClose = () => {
    setShowAllPlayersLeftModal(false);
    navigate('/');
  };

  if (!session) {
    return (
      <div className="game-page">
        <div className="game-content">
          <div className="loading-message">Loading game...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="game-page">
      <div className="game-content">
        <div className="game-header">
          <div className="session-info">
            <span>Room: {session.sessionCode}</span>
            <span>Players: {session.players.length}</span>
          </div>
          <button className="leave-game-btn" onClick={handleLeaveGame}>
            Leave Game
          </button>
        </div>
        
        <div className="game-notifications">
          {notifications.map((notification) => (
            <div key={notification.id} className="player-left-notification">
              u/{notification.username} left the game
            </div>
          ))}
        </div>
        
        <div className="text-bubble">
          <textarea
            value={userInput}
            onChange={handleInputChange}
            className="text-input"
            placeholder="Type your reasons..."
          />
        </div>
        <div className="dealer-text-bubble" />
        <div className={`dealer dealer-${dealerId}`} />
      </div>
      
      {showAllPlayersLeftModal && (
        <div className="all-players-left-modal">
          <div className="modal-content">
            <div className="modal-title">Game Ended</div>
            <div className="modal-message">All party members have left.</div>
            <button className="modal-button" onClick={handleAllPlayersLeftModalClose}>
              Return to Home
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default GamePage;