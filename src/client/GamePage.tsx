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
  const [timeRemaining, setTimeRemaining] = useState(3000); // 3 seconds after text completes
  const [currentText, setCurrentText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [typingComplete, setTypingComplete] = useState(false);

  useEffect(() => {
    const sessionFromState = location.state?.session;
    
    if (sessionFromState) {
      setSession(sessionFromState);
      if (sessionFromState.dealerId) {
        setDealerId(sessionFromState.dealerId);
      }
    } else {
      console.error("Missing session data, redirecting home.");
      navigate('/');
    }
  }, [location.state, navigate]);

  // Poll for AI Game Data - should be ready immediately from loading screen
  useEffect(() => {
    if (!session) {
      return;
    }

    const fetchAIData = async () => {
      try {
        console.log('[AI DEBUG] About to fetch AI game data for sessionId:', session.sessionId);
        const response = await fetch(`/api/ai-game-data/${session.sessionId}`);
        console.log('[AI DEBUG] AI game data fetch status:', response.status);
        if (response.ok) {
          const data = await response.json();
          console.log('[AI DEBUG] AI game data response:', data);
          
          // 🎯 CONSOLIDATED CLIENT PERSONA LOGGING - Like user data format
          console.log('[CLIENT PERSONAS] ===== RECEIVED PERSONA DATA FROM SERVER =====');
          console.log('[CLIENT PERSONAS] Client Persona Response:');
          console.log('[CLIENT PERSONAS]', {
            status: data.status,
            data: {
              sessionId: data.data?.sessionId,
              currentUserId: user?.userId,
              currentUsername: user?.username,
              aiPersona: data.data?.aiPersona,
              totalPlayers: Object.keys(data.data?.playerPersonas || {}).length,
              playerPersonas: data.data?.playerPersonas,
              myAssignedPersona: data.data?.playerPersonas?.[user?.userId || ''] || 'Not assigned'
            }
          });
          console.log('[CLIENT PERSONAS] ===== END CLIENT PERSONA DATA =====');
          
          console.log('[CLIENT DEBUG] 🎭 Received player personas:', data.data?.playerPersonas);
          console.log('[CLIENT DEBUG] 👤 Current user would get persona for userId:', user?.userId);
          if (data.data?.playerPersonas && user?.userId) {
            console.log('[CLIENT DEBUG] 🎯 My assigned persona:', data.data.playerPersonas[user.userId]);
          }
          if (data.status === 'success' && data.data) {
            console.log('[AI DEBUG] ✅ AI game data loaded successfully.');
            setAiGameData(data.data);
          }
        } else {
          let errorBody;
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            errorBody = await response.json();
          } else {
            errorBody = await response.text();
          }
          console.error(
            `[AI DEBUG] Error fetching AI game data: status=${response.status}, body=`,
            errorBody,
            'sessionId:', session.sessionId
          );
        }
      } catch (error) {
        console.log('[AI DEBUG] 💥 Error fetching AI game data:', error);
      }
    };

    // Try to fetch immediately, then retry if needed
    fetchAIData();
    const interval = setInterval(fetchAIData, 1000);
    return () => clearInterval(interval);
  }, [session]);

  // Letter-by-letter typing animation
  useEffect(() => {
    if (!aiGameData || allCluesShown) return;
    
    // Reset states for new clue
    setIsTyping(false);
    setTypingComplete(false);
    setCurrentText('');
    setTimeRemaining(3000);

    const currentClue = aiGameData.clues[currentClueIndex];
    if (!currentClue) return;

    // Start typing after a brief delay
    const startDelay = setTimeout(() => {
      setIsTyping(true);
      
      let charIndex = 0;
      const typingInterval = setInterval(() => {
        if (charIndex < currentClue.length) {
          setCurrentText(currentClue.substring(0, charIndex + 1));
          charIndex++;
        } else {
          clearInterval(typingInterval);
          setIsTyping(false);
          setTypingComplete(true);
          setClueStartTime(Date.now()); // Start 3-second timer after typing completes
        }
      }, 100); // 100ms per character for slower, more readable typing

      return () => clearInterval(typingInterval);
    }, 500); // 500ms delay before starting to type

    return () => clearTimeout(startDelay);
  }, [aiGameData, currentClueIndex, allCluesShown]);

  // Timer for clue progression (3 seconds after typing completes)
  useEffect(() => {
    if (!typingComplete || allCluesShown) return;

    const interval = setInterval(() => {
      const elapsed = Date.now() - clueStartTime;
      const remaining = Math.max(0, 3000 - elapsed); // 3 seconds
      setTimeRemaining(remaining);

      if (remaining === 0) {
        if (currentClueIndex < 2) { // We have exactly 3 clues (0, 1, 2)
          // Move to next clue
          setCurrentClueIndex(prev => prev + 1);
        } else {
          // All clues shown
          setAllCluesShown(true);
        }
      }
    }, 100);

    return () => clearInterval(interval);
  }, [typingComplete, currentClueIndex, clueStartTime, allCluesShown]);

  // Auto-navigate to response page after all clues are shown
  useEffect(() => {
    if (allCluesShown && session && aiGameData) {
      // Get the user's assigned persona
      const userPersona = user && aiGameData.playerPersonas 
        ? aiGameData.playerPersonas[user.userId] 
        : aiGameData.userPersonas[Math.floor(Math.random() * 3)];
      
      navigate('/response', { 
        state: { 
          session, 
          aiGameData,
          userPersona
        } 
      });
    }
  }, [allCluesShown, session, aiGameData, navigate, user]);

  // Background polling for session changes
  useEffect(() => {
    if (!session) return;

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
  }, [session, user, dealerId]);

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
    return `${seconds}s remaining`;
  };

  const getCurrentClueText = () => {
    if (!aiGameData) return 'Preparing clues...';
    
    if (allCluesShown) {
      return 'All clues revealed! Time to make your guess.';
    }
    
    if (isTyping || !typingComplete) {
      return `Clue ${currentClueIndex + 1}: ${currentText}`;
    } else {
      return `Clue ${currentClueIndex + 1}: ${currentText} (Next in ${formatTime(timeRemaining)})`;
    }
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
            <span>Players: {session.players.length}</span>
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