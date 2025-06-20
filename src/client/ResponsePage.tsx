import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { GameSession } from '../shared/types/session';
import { AIGameData } from '../shared/types/aiGame';
import { useSession } from './hooks/useSession';
import './ResponsePage.css';

const RESPONSE_TIME_LIMIT = 60000; // 1 minute in milliseconds

type PageState = 'responding' | 'revealing';

const ResponsePage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentSession } = useSession();
  const [dealerId, setDealerId] = useState<number>(1);
  const [userInput, setUserInput] = useState<string>('');
  const [session, setSession] = useState<GameSession | null>(null);
  const [aiGameData, setAiGameData] = useState<AIGameData | null>(null);
  const [userPersona, setUserPersona] = useState<string>('');
  const [timeRemaining, setTimeRemaining] = useState<number>(RESPONSE_TIME_LIMIT);
  const [responseStartTime, setResponseStartTime] = useState<number>(Date.now());
  const [isTimeUp, setIsTimeUp] = useState<boolean>(false);
  const [pageState, setPageState] = useState<PageState>('responding');
  const [winner, setWinner] = useState<string>('');
  const [winnerReason, setWinnerReason] = useState<string>('');

  useEffect(() => {
    const sessionFromState = location.state?.session;
    const aiGameDataFromState = location.state?.aiGameData;
    const userPersonaFromState = location.state?.userPersona;
    
    if (sessionFromState) {
      setSession(sessionFromState);
      setAiGameData(aiGameDataFromState || null);
      setUserPersona(userPersonaFromState || '');
      setResponseStartTime(Date.now());
      if (sessionFromState.dealerId) {
        setDealerId(sessionFromState.dealerId);
      }
    } else if (currentSession) {
      setSession(currentSession);
      setResponseStartTime(Date.now());
      if (currentSession.dealerId) {
        setDealerId(currentSession.dealerId);
      }
    } else {
      navigate('/');
      return;
    }
  }, [location.state, currentSession, navigate]);

  // Timer for response time limit (only during responding phase)
  useEffect(() => {
    if (pageState !== 'responding') return;
    
    const interval = setInterval(() => {
      const elapsed = Date.now() - responseStartTime;
      const remaining = Math.max(0, RESPONSE_TIME_LIMIT - elapsed);
      setTimeRemaining(remaining);

      if (remaining === 0 && !isTimeUp) {
        setIsTimeUp(true);
        handleSubmitResponse(true);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [responseStartTime, isTimeUp, pageState]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setUserInput(e.target.value);
  };

  const handleSubmitResponse = async (timeUp: boolean = false) => {
    if ((!userInput.trim() && !timeUp) || !session || !aiGameData) return;
    if (isTimeUp && !timeUp) return;

    try {
      console.log('User response:', timeUp ? '(Time up - no response)' : userInput);
      console.log('AI Persona:', aiGameData.aiPersona);
      console.log('User Persona:', userPersona);
      
      // Simulate AI evaluation and winner determination
      await evaluateResponsesAndDetermineWinner();
      
    } catch (error) {
      console.error('Error submitting response:', error);
    }
  };

  const evaluateResponsesAndDetermineWinner = async () => {
    // Simulate AI evaluation process
    setPageState('revealing');
    
    // Mock winner determination - in real implementation, this would be an AI call
    const players = session?.players || [];
    const randomWinner = players[Math.floor(Math.random() * players.length)];
    
    // Simulate evaluation delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    setWinner(randomWinner?.username || 'Unknown');
    setWinnerReason(`${randomWinner?.username} provided the most accurate guess about the AI's persona as a mysterious detective. Their response showed deep understanding of the supernatural investigation theme and correctly identified key elements from the clues.`);
  };

  const handleReturnToHome = () => {
    navigate('/');
  };

  const formatTime = (ms: number) => {
    const seconds = Math.ceil(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  if (!session) {
    return (
      <div className="response-page">
        <div className="response-content">
          <div className="loading-message">Loading...</div>
        </div>
      </div>
    );
  }

  // Winner reveal state
  if (pageState === 'revealing') {
    return (
      <div className="response-page">
        <div className="response-content">
          <div className={`response-dealer response-dealer-${dealerId}`} />
          
          {/* Winner announcement */}
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            color: '#FFD700',
            fontFamily: 'VT323, monospace',
            fontSize: '32px',
            textAlign: 'center',
            maxWidth: '600px',
            zIndex: 10,
            background: 'rgba(0, 0, 0, 0.9)',
            padding: '30px',
            borderRadius: '12px',
            border: '3px solid #FFD700'
          }}>
            {winner ? (
              <>
                <div style={{ fontSize: '40px', marginBottom: '20px', color: '#4CAF50' }}>
                  🏆 WINNER 🏆
                </div>
                <div style={{ fontSize: '28px', marginBottom: '20px' }}>
                  u/{winner}
                </div>
                <div style={{ fontSize: '18px', lineHeight: '1.4', color: '#ffffff', marginBottom: '30px' }}>
                  {winnerReason}
                </div>
                <div style={{ fontSize: '20px', marginBottom: '20px', color: '#4CAF50' }}>
                  Congratulations!
                </div>
                <button
                  onClick={handleReturnToHome}
                  style={{
                    background: '#4CAF50',
                    color: 'white',
                    border: 'none',
                    padding: '12px 24px',
                    fontFamily: 'VT323, monospace',
                    fontSize: '18px',
                    cursor: 'pointer',
                    borderRadius: '4px',
                    transition: 'all 0.2s'
                  }}
                >
                  Return to Home
                </button>
              </>
            ) : (
              <div style={{ fontSize: '24px' }}>
                Evaluating responses...
              </div>
            )}
          </div>
          
          {/* AI Persona reveal */}
          {aiGameData && (
            <div style={{
              position: 'absolute',
              bottom: '50px',
              left: '50%',
              transform: 'translateX(-50%)',
              color: '#FFD700',
              fontFamily: 'VT323, monospace',
              fontSize: '16px',
              textAlign: 'center',
              maxWidth: '600px',
              zIndex: 10,
              background: 'rgba(0, 0, 0, 0.8)',
              padding: '15px',
              borderRadius: '8px',
              border: '2px solid #FFD700'
            }}>
              <div style={{ fontSize: '18px', marginBottom: '10px', color: '#4CAF50' }}>
                The AI was:
              </div>
              {aiGameData.aiPersona}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Response input state
  return (
    <div className="response-page">
      <div className="response-content">
        <div style={{
          position: 'absolute',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          color: timeRemaining < 10000 ? '#ff4444' : '#FFD700',
          fontFamily: 'VT323, monospace',
          fontSize: '24px',
          textAlign: 'center',
          zIndex: 10,
          background: 'rgba(0, 0, 0, 0.8)',
          padding: '10px 20px',
          borderRadius: '8px',
          border: `2px solid ${timeRemaining < 10000 ? '#ff4444' : '#FFD700'}`
        }}>
          Time Remaining: {formatTime(timeRemaining)}
          {isTimeUp && <div style={{ fontSize: '18px', marginTop: '5px' }}>Time's Up!</div>}
        </div>
        
        {userPersona && (
          <div style={{
            position: 'absolute',
            bottom: '150px',
            left: '50%',
            transform: 'translateX(-50%)',
            color: '#FFD700',
            fontFamily: 'VT323, monospace',
            fontSize: '20px',
            textAlign: 'center',
            maxWidth: '600px',
            zIndex: 10,
            background: 'rgba(0, 0, 0, 0.8)',
            padding: '10px 20px',
            borderRadius: '8px',
            border: '2px solid #FFD700'
          }}>
            Your Role: {userPersona}
          </div>
        )}
        
        <div className={`response-dealer response-dealer-${dealerId}`} />
        <div className="text-bubble">
          <textarea
            className="text-input"
            value={userInput}
            onChange={handleInputChange}
            placeholder={isTimeUp ? "Time's up!" : "Who do you think the AI is? Make your guess..."}
            maxLength={500}
            disabled={isTimeUp}
            style={{ 
              opacity: isTimeUp ? 0.6 : 1,
              cursor: isTimeUp ? 'not-allowed' : 'text'
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && e.ctrlKey && !isTimeUp) {
                handleSubmitResponse();
              }
            }}
          />
        </div>
        
        <button
          onClick={() => handleSubmitResponse()}
          disabled={(!userInput.trim() && !isTimeUp) || (isTimeUp && userInput.trim())}
          style={{
            position: 'absolute',
            bottom: '100px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: (userInput.trim() && !isTimeUp) ? '#4CAF50' : '#666',
            color: 'white',
            border: 'none',
            padding: '12px 24px',
            fontFamily: 'VT323, monospace',
            fontSize: '18px',
            cursor: (userInput.trim() && !isTimeUp) ? 'pointer' : 'not-allowed',
            borderRadius: '4px',
            transition: 'all 0.2s',
            opacity: isTimeUp ? 0.6 : 1
          }}
        >
          {isTimeUp ? 'Time Up' : 'Submit Guess (Ctrl+Enter)'}
        </button>
      </div>
    </div>
  );
};

export default ResponsePage;