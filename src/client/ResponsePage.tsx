import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { GameSession } from '../shared/types/session';
import { AIGameData } from '../shared/types/aiGame';
import { useSession } from './hooks/useSession';
import './ResponsePage.css';

const ResponsePage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentSession } = useSession();
  const [dealerId, setDealerId] = useState<number>(1);
  const [userInput, setUserInput] = useState<string>('');
  const [session, setSession] = useState<GameSession | null>(null);
  const [aiGameData, setAiGameData] = useState<AIGameData | null>(null);
  const [userPersona, setUserPersona] = useState<string>('');

  useEffect(() => {
    // Get session from location state or current session
    const sessionFromState = location.state?.session;
    const aiGameDataFromState = location.state?.aiGameData;
    const userPersonaFromState = location.state?.userPersona;
    
    if (sessionFromState) {
      setSession(sessionFromState);
      setAiGameData(aiGameDataFromState || null);
      setUserPersona(userPersonaFromState || '');
      // Set dealer ID from session
      if (sessionFromState.dealerId) {
        setDealerId(sessionFromState.dealerId);
      }
    } else if (currentSession) {
      setSession(currentSession);
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

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setUserInput(e.target.value);
  };

  const handleSubmitResponse = async () => {
    if (!userInput.trim() || !session || !aiGameData) return;

    try {
      // Here you would submit the user's response to the AI for evaluation
      // For now, just navigate back to game or show results
      console.log('User response:', userInput);
      console.log('AI Persona:', aiGameData.aiPersona);
      console.log('User Persona:', userPersona);
      
      // Navigate back to game or to results page
      navigate('/game', { state: { session } });
    } catch (error) {
      console.error('Error submitting response:', error);
    }
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
        <button 
          className="back-button" 
          onClick={() => navigate('/game', { state: { session, aiGameData } })}
        >
          Back to Clues
        </button>
        
        {userPersona && (
          <div style={{
            position: 'absolute',
            top: '80px',
            left: '50%',
            transform: 'translateX(-50%)',
            color: '#FFD700',
            fontFamily: 'VT323, monospace',
            fontSize: '18px',
            textAlign: 'center',
            maxWidth: '600px',
            zIndex: 10
          }}>
            You are: {userPersona}
          </div>
        )}
        
        <div className={`response-dealer response-dealer-${dealerId}`} />
        <div className="text-bubble">
          <textarea
            className="text-input"
            value={userInput}
            onChange={handleInputChange}
            placeholder="Who do you think the AI is? Make your guess..."
            maxLength={500}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && e.ctrlKey) {
                handleSubmitResponse();
              }
            }}
          />
        </div>
        
        <button
          onClick={handleSubmitResponse}
          disabled={!userInput.trim()}
          style={{
            position: 'absolute',
            bottom: '100px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: userInput.trim() ? '#4CAF50' : '#666',
            color: 'white',
            border: 'none',
            padding: '12px 24px',
            fontFamily: 'VT323, monospace',
            fontSize: '18px',
            cursor: userInput.trim() ? 'pointer' : 'not-allowed',
            borderRadius: '4px',
            transition: 'all 0.2s',
          }}
        >
          Submit Guess (Ctrl+Enter)
        </button>
      </div>
    </div>
  );
};

export default ResponsePage; 