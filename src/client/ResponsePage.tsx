import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { GameSession } from '../shared/types/session';
import { useSession } from './hooks/useSession';
import './ResponsePage.css';

const ResponsePage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentSession } = useSession();
  const [dealerId, setDealerId] = useState<number>(1);
  const [userInput, setUserInput] = useState<string>('');
  const [session, setSession] = useState<GameSession | null>(null);

  useEffect(() => {
    // Get session from location state or current session
    const sessionFromState = location.state?.session;
    
    if (sessionFromState) {
      setSession(sessionFromState);
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
          onClick={() => navigate('/game', { state: { session } })}
        >
          Back to Game
        </button>
        <div className={`response-dealer response-dealer-${dealerId}`} />
        <div className="text-bubble">
          <textarea
            className="text-input"
            value={userInput}
            onChange={handleInputChange}
            placeholder="Type your response..."
            maxLength={500}
          />
        </div>
      </div>
    </div>
  );
};

export default ResponsePage; 