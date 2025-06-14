import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { GameSession } from '../shared/types/session';
import { AIGameData } from '../shared/types/aiGame';
import { useSession } from './hooks/useSession';
import './ResponsePage.css';

const RESPONSE_TIME_LIMIT = 60000; // 1 minute in milliseconds

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

  useEffect(() => {
    // Get session from location state or current session
    const sessionFromState = location.state?.session;
    const aiGameDataFromState = location.state?.aiGameData;
    const userPersonaFromState = location.state?.userPersona;
    
    if (sessionFromState) {
      setSession(sessionFromState);
      setAiGameData(aiGameDataFromState || null);
      setUserPersona(userPersonaFromState || '');
      setResponseStartTime(Date.now());
      // Set dealer ID from session
      if (sessionFromState.dealerId) {
        setDealerId(sessionFromState.dealerId);
      }
    } else if (currentSession) {
      setSession(currentSession);
      setResponseStartTime(Date.now());
      // Set dealer ID from session
      if (currentSession.dealerId) {
        setDealerId(currentSession.dealerId);
      }
    } else {
      // No session found, redirect to home
      navigate('/');
      return;
    }
  }, [location.state, currentSession, navigate]);

  // Timer for response time limit
  useEffect(() => {
    const interval = setInterval(() => {
      const elapsed = Date.now() - responseStartTime;
      const remaining = Math.max(0, RESPONSE_TIME_LIMIT - elapsed);
      setTimeRemaining(remaining);

      if (remaining === 0 && !isTimeUp) {
        setIsTimeUp(true);
        // Auto-submit or handle time up
        handleSubmitResponse(true);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [responseStartTime, isTimeUp]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setUserInput(e.target.value);
  };

  const handleSubmitResponse = async (timeUp: boolean = false) => {
    if ((!userInput.trim() && !timeUp) || !session || !aiGameData) return;
    if (isTimeUp && !timeUp) return; // Prevent multiple submissions

    try {
      // Here you would submit the user's response to the AI for evaluation
      // For now, just navigate back to game or show results
      console.log('User response:', timeUp ? '(Time up - no response)' : userInput);
      console.log('AI Persona:', aiGameData.aiPersona);
      console.log('User Persona:', userPersona);
      
      // Navigate back to game or to results page
      navigate('/game', { state: { session } });
    } catch (error) {
      console.error('Error submitting response:', error);
    }
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

  return (
    <div className="response-page">
      <div className="response-content">
        {/* Timer display */}
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