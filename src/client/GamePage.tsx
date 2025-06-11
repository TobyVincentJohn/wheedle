import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { GameSession } from '../shared/types/session';
import { useSession } from './hooks/useSession';
import './GamePage.css';

const GamePage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { leaveSession, currentSession } = useSession();
  const [dealerId, setDealerId] = useState<number>(1);
  const [userInput, setUserInput] = useState<string>('');
  const [session, setSession] = useState<GameSession | null>(null);

  useEffect(() => {
    // Get session from location state or current session
    const sessionFromState = location.state?.session;
    
    if (sessionFromState) {
      setSession(sessionFromState);
    } else if (currentSession) {
      setSession(currentSession);
    } else {
      // No session found, redirect to home
      navigate('/');
      return;
    }

    // Generate random dealer
    const randomDealer = Math.floor(Math.random() * 8) + 1;
    setDealerId(randomDealer);
  }, [location.state, currentSession, navigate]);

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
    </div>
  );
};

export default GamePage;