import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { GameSession } from '../shared/types/session';
import { AIGameData, ClueDisplayState } from '../shared/types/aiGame';
import { useSession } from './hooks/useSession';
import { useUser } from './hooks/useUser';
import './CluesPage.css';

const CLUE_DURATION = 10000; // 10 seconds per clue

const CluesPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { leaveSession, currentSession } = useSession();
  const { user } = useUser();
  const [session, setSession] = useState<GameSession | null>(null);
  const [aiGameData, setAiGameData] = useState<AIGameData | null>(null);
  const [clueState, setClueState] = useState<ClueDisplayState>({
    currentClueIndex: 0,
    clueStartTime: Date.now(),
    isComplete: false,
  });
  const [timeRemaining, setTimeRemaining] = useState(CLUE_DURATION);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get session from location state or current session
    const sessionFromState = location.state?.session;
    
    if (sessionFromState) {
      setSession(sessionFromState);
      fetchAIGameData(sessionFromState.sessionId);
    } else if (currentSession) {
      setSession(currentSession);
      fetchAIGameData(currentSession.sessionId);
    } else {
      // No session found, redirect to home
      navigate('/');
      return;
    }
  }, [location.state, currentSession, navigate]);

  const fetchAIGameData = async (sessionId: string) => {
    try {
      const response = await fetch(`/api/ai-game-data/${sessionId}`);
      const data = await response.json();
      
      if (data.status === 'success' && data.data) {
        setAiGameData(data.data);
        setClueState({
          currentClueIndex: 0,
          clueStartTime: Date.now(),
          isComplete: false,
        });
      } else {
        console.error('Failed to fetch AI game data:', data.message);
      }
    } catch (error) {
      console.error('Error fetching AI game data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Timer for clue progression
  useEffect(() => {
    if (!aiGameData || clueState.isComplete) return;

    const interval = setInterval(() => {
      const elapsed = Date.now() - clueState.clueStartTime;
      const remaining = Math.max(0, CLUE_DURATION - elapsed);
      setTimeRemaining(remaining);

      if (remaining === 0) {
        if (clueState.currentClueIndex < 2) {
          // Move to next clue
          setClueState({
            currentClueIndex: clueState.currentClueIndex + 1,
            clueStartTime: Date.now(),
            isComplete: false,
          });
        } else {
          // All clues shown, mark as complete
          setClueState(prev => ({ ...prev, isComplete: true }));
        }
      }
    }, 100);

    return () => clearInterval(interval);
  }, [aiGameData, clueState]);

  const handleLeaveGame = async () => {
    if (session) {
      try {
        await leaveSession(session.sessionId);
        navigate('/');
      } catch (error) {
        console.error('Failed to leave session:', error);
        navigate('/');
      }
    } else {
      navigate('/');
    }
  };

  const handleProceedToResponse = () => {
    if (session && aiGameData) {
      navigate('/response', { 
        state: { 
          session, 
          aiGameData,
          userPersona: aiGameData.userPersonas[Math.floor(Math.random() * 3)]
        } 
      });
    }
  };

  if (loading) {
    return (
      <div className="clues-page">
        <div className="clues-content">
          <div className="loading-message">Loading AI clues...</div>
        </div>
      </div>
    );
  }

  if (!session || !aiGameData) {
    return (
      <div className="clues-page">
        <div className="clues-content">
          <div className="loading-message">Session not found</div>
        </div>
      </div>
    );
  }

  const formatTime = (ms: number) => {
    const seconds = Math.ceil(ms / 1000);
    return `${seconds}s`;
  };

  return (
    <div className="clues-page">
      <div className="clues-content">
        <div className="clues-header">
          <div className="session-info">
            <span>Players: {session.players.length}</span>
            <span>Prize Pool: ${session.prizePool || 0}</span>
            {user && <span>Money in Hand: ${user.moneyInHand || 0}</span>}
          </div>
          <button className="leave-game-btn" onClick={handleLeaveGame}>
            Leave Game
          </button>
        </div>

        <div className="ai-persona-section">
          <div className="ai-persona-title">Meet Your AI</div>
          <div className="ai-persona-text">{aiGameData.aiPersona}</div>
        </div>

        <div className="clue-section">
          <div className="clue-title">
            Clue {clueState.currentClueIndex + 1} of 3
          </div>
          
          <div className="clue-progress">
            {[0, 1, 2].map((index) => (
              <div
                key={index}
                className={`progress-dot ${
                  index === clueState.currentClueIndex
                    ? 'active'
                    : index < clueState.currentClueIndex
                    ? 'completed'
                    : ''
                }`}
              />
            ))}
          </div>

          <div className="clue-text">
            {aiGameData.clues[clueState.currentClueIndex]}
          </div>

          {!clueState.isComplete && (
            <div className="clue-timer">
              Next clue in: {formatTime(timeRemaining)}
            </div>
          )}

          {clueState.isComplete && (
            <button className="proceed-button" onClick={handleProceedToResponse}>
              Make Your Guess
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CluesPage;