import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { GameSession } from '../shared/types/session';
import { AIGameData } from '../shared/types/aiGame';
import { useSession } from './hooks/useSession';
import { useUser } from './hooks/useUser';
import './GamePage.css';

interface PlayerLeftNotification {
  id: string;
  username: string;
  timestamp: number;
}

const CLUE_DURATION = 10000; // 10 seconds per clue

const GamePage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { leaveSession } = useSession();
  const { user } = useUser();
  const [dealerId, setDealerId] = useState<number>(1);
  const [session, setSession] = useState<GameSession | null>(null);
  const [aiGameData, setAiGameData] = useState<AIGameData | null>(null);
  const [notifications, setNotifications] = useState<PlayerLeftNotification[]>([]);
  const [showAllPlayersLeftModal, setShowAllPlayersLeftModal] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  
  // Clue display state
  const [currentClueIndex, setCurrentClueIndex] = useState(0);
  const [clueStartTime, setClueStartTime] = useState(Date.now());
  const [allCluesShown, setAllCluesShown] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(CLUE_DURATION);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const sessionFromState = location.state?.session;
    const aiGameDataFromState = location.state?.aiGameData;

    if (sessionFromState && aiGameDataFromState) {
      setSession(sessionFromState);
      setAiGameData(aiGameDataFromState);
      setLoading(false);
      setIsInitialized(true);

      if (sessionFromState.dealerId) {
        setDealerId(sessionFromState.dealerId);
      }
    } else {
      console.error("Missing session or AI data, redirecting home.");
      navigate('/');
    }
  }, [location.state, navigate]);

  // Timer for clue progression
  useEffect(() => {
    if (!aiGameData || allCluesShown) return;

    const interval = setInterval(() => {
      const elapsed = Date.now() - clueStartTime;
      const remaining = Math.max(0, CLUE_DURATION - elapsed);
      setTimeRemaining(remaining);

      if (remaining === 0) {
        if (currentClueIndex < 2) {
          // Move to next clue
          setCurrentClueIndex(prev => prev + 1);
          setClueStartTime(Date.now());
        } else {
          // All clues shown
          setAllCluesShown(true);
        }
      }
    }, 100);

    return () => clearInterval(interval);
  }, [aiGameData, currentClueIndex, clueStartTime, allCluesShown]);

  // Auto-navigate to response page after all clues are shown
  useEffect(() => {
    if (allCluesShown && session && aiGameData) {
      // Navigate immediately after all clues are shown
      navigate('/response', { 
        state: { 
          session, 
          aiGameData,
          userPersona: aiGameData.userPersonas[Math.floor(Math.random() * 3)]
        } 
      });
    }
  }, [allCluesShown, session, aiGameData, navigate]);

  // Background polling for session changes
  useEffect(() => {
    if (!session || !isInitialized) return;

    let lastKnownSession = session;
    
    const interval = setInterval(async () => {
      try {
        const response = await fetch('/api/sessions/current');
        const data = await response.json();
        
        if (data.status === 'success' && data.data) {
          const updatedSession = data.data as GameSession;
          
          if (JSON.stringify(updatedSession) !== JSON.stringify(lastKnownSession)) {
            const newPlayerCount = updatedSession.players.length;
            
            if (newPlayerCount < lastKnownSession.players.length) {
              const currentPlayerIds = new Set(updatedSession.players.map(p => p.userId));
              const leftPlayers = lastKnownSession.players.filter(p => !currentPlayerIds.has(p.userId));
              
              leftPlayers.forEach(player => {
                const notification: PlayerLeftNotification = {
                  id: `${player.userId}-${Date.now()}`,
                  username: player.username,
                  timestamp: Date.now(),
                };
                
                setNotifications(prev => [...prev, notification]);
                
                setTimeout(() => {
                  setNotifications(prev => prev.filter(n => n.id !== notification.id));
                }, 4000);
              });
            }
            
            if (newPlayerCount <= 1 && user && updatedSession.players.some(p => p.userId === user.userId)) {
              setShowAllPlayersLeftModal(true);
            }
            
            setSession(updatedSession);
            
            if (updatedSession.dealerId && updatedSession.dealerId !== dealerId) {
              setDealerId(updatedSession.dealerId);
            }
            
            lastKnownSession = updatedSession;
          }
        } else if (data.status === 'success' && !data.data) {
          setShowAllPlayersLeftModal(true);
        }
      } catch (error) {
        console.error('Error polling session:', error);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [session, isInitialized, user, dealerId]);

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

  const handleLeaveGame = async () => {
    if (session) {
      try {
        const response = await fetch(`/api/sessions/${session.sessionId}/leave`, {
          method: 'POST',
        });
        const data = await response.json();
        
        if (data.status === 'success' && data.moneyReturned !== undefined) {
          // Show money returned message if any
          if (data.moneyReturned > 0) {
            console.log(`Money returned: $${data.moneyReturned}`);
          }
        }
        
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
    if (session) {
      leaveSession(session.sessionId).then(() => {
        navigate('/');
      }).catch((error) => {
        console.error('Failed to leave session:', error);
        navigate('/');
      });
    } else {
      navigate('/');
    }
  };

  const formatTime = (ms: number) => {
    const seconds = Math.ceil(ms / 1000);
    return `${seconds}s`;
  };

  const getCurrentClueText = () => {
    if (!aiGameData) return 'Loading clues...';
    
    if (allCluesShown) {
      return 'All clues revealed! Click "Respond" to make your guess.';
    }
    
    return `Clue ${currentClueIndex + 1}: ${aiGameData.clues[currentClueIndex]} (Next in ${formatTime(timeRemaining)})`;
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

  if (loading) {
    return (
      <div className="game-page">
        <div className="game-content">
          <div className="loading-message">Loading AI clues...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="game-page">
      <div className="game-content">
        <div className="game-header">
          <div className="session-info">
            <span>Players: {session.players.length}</span>
            <span>Prize Pool: ${session.prizePool || 0}</span>
            {user && <span>Money in Hand: ${user.moneyInHand || 0}</span>}
          </div>
          <div className="header-buttons">
            <button className="leave-game-btn" onClick={handleLeaveGame}>
              Leave Game
            </button>
          </div>
        </div>
        
        <div className="game-notifications">
          {notifications.map((notification) => (
            <div key={notification.id} className="player-left-notification">
              u/{notification.username} left the game
            </div>
          ))}
        </div>
        
        <div className="dealer-text-bubble">
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            color: '#333',
            fontFamily: 'VT323, monospace',
            fontSize: '18px',
            textAlign: 'center',
            maxWidth: '400px',
            lineHeight: '1.4',
            padding: '20px'
          }}>
            {getCurrentClueText()}
          </div>
        </div>
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