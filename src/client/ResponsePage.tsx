import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { GameSession } from '../shared/types/session';
import { AIGameData } from '../shared/types/aiGame';
import { useSession } from './hooks/useSession';
import { playHoverSound, playClickSound, getSoundState } from './utils/sound';
import './ResponsePage.css';

const RESPONSE_TIME_LIMIT = 30000; // 30 seconds in milliseconds

type PageState = 'responding' | 'waiting' | 'revealing';

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
  const [hasSubmitted, setHasSubmitted] = useState<boolean>(false);
  const [allResponses, setAllResponses] = useState<any[]>([]);
  const [winner, setWinner] = useState<string>('');
  const [winnerReason, setWinnerReason] = useState<string>('');
  const [geminiEvaluation, setGeminiEvaluation] = useState<any>(null);

  useEffect(() => {
    const sessionFromState = location.state?.session;
    const aiGameDataFromState = location.state?.aiGameData;
    const userPersonaFromState = location.state?.userPersona;
    
    if (sessionFromState) {
      setSession(sessionFromState);
      setAiGameData(aiGameDataFromState || null);
      
      // If no persona provided in state, try to get it from AI game data
      if (userPersonaFromState) {
        setUserPersona(userPersonaFromState);
      } else if (aiGameDataFromState && aiGameDataFromState.playerPersonas && currentSession?.players) {
        // Find current user's persona from the AI game data
        const currentPlayer = currentSession.players.find(p => p.userId === currentSession?.players[0]?.userId);
        if (currentPlayer && aiGameDataFromState.playerPersonas[currentPlayer.userId]) {
          setUserPersona(aiGameDataFromState.playerPersonas[currentPlayer.userId]);
        } else {
          // Fallback to a random persona
          setUserPersona(aiGameDataFromState.userPersonas[Math.floor(Math.random() * 3)]);
        }
      } else {
        setUserPersona('');
      }
      
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
        // If user hasn't submitted yet, auto-submit
        if (!hasSubmitted) {
          handleSubmitResponse(true);
        } else {
          // If user already submitted, move to waiting phase
          setPageState('waiting');
          fetchAllResponses();
        }
      }
    }, 100);

    return () => clearInterval(interval);
  }, [responseStartTime, isTimeUp, pageState, hasSubmitted]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setUserInput(e.target.value);
  };

  const handleSubmitResponse = async (timeUp: boolean = false) => {
    if (hasSubmitted) return; // Prevent double submission
    if ((!userInput.trim() && !timeUp) || !session || !aiGameData) return;

    try {
      const responseText = timeUp ? '(Time up - no response)' : userInput;
      
      console.log('[CLIENT RESPONSE] ===== SUBMITTING PLAYER RESPONSE =====');
      console.log('[CLIENT RESPONSE] User response:', responseText);
      console.log('[CLIENT RESPONSE] AI Persona:', aiGameData.aiPersona);
      console.log('[CLIENT RESPONSE] User Persona:', userPersona);
      console.log('[CLIENT RESPONSE] Session ID:', session.sessionId);
      console.log('[CLIENT RESPONSE] Time up:', timeUp);
      
      // Submit response to server (optional - for logging/storage)
      try {
        const response = await fetch(`/api/sessions/${session.sessionId}/submit-response`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            response: responseText,
            persona: userPersona,
            aiPersona: aiGameData.aiPersona,
            isTimeUp: timeUp,
          }),
        });
        
        const data = await response.json();
        
        if (data.status === 'success') {
          console.log('[CLIENT RESPONSE] ✅ Response submitted successfully');
          console.log('[CLIENT RESPONSE] Server returned session responses:', data.data);
          setHasSubmitted(true);
          
          // If time is up, move to waiting phase immediately
          if (timeUp || isTimeUp) {
            console.log('[CLIENT RESPONSE] ⏰ Time is up, moving to waiting phase...');
            setPageState('waiting');
            console.log('[CLIENT TIMER] ⏰ Timer expired, auto-submitting...');
            fetchAllResponses();
          } else {
            // If submitted early, wait for timer to finish
            console.log('[CLIENT RESPONSE] 🕐 Response submitted early, waiting for timer...');
          }
        } else {
          console.error('[CLIENT RESPONSE] ❌ Failed to submit response:', data.message);
          // Even if submission failed, continue with the flow
          setHasSubmitted(true);
          if (timeUp || isTimeUp) {
            console.log('[CLIENT TIMER] ⏰ Timer expired, user already submitted, moving to waiting...');
            setPageState('waiting');
            fetchAllResponses();
          }
        }
      } catch (error) {
        console.error('[CLIENT RESPONSE] ❌ Error submitting response to server:', error);
        // Continue with the flow even if there's an error
        setHasSubmitted(true);
        console.log('[CLIENT RESPONSE] ⚠️ Error occurred but continuing to waiting phase...');
        setPageState('waiting');
        fetchAllResponses();
      }
      
    } catch (error) {
      console.error('Error submitting response:', error);
    }
  };

  const fetchAllResponses = async () => {
    if (!session) return;
    
    try {
      console.log('[CLIENT RESPONSES] 📊 Fetching all responses for session...');
      const response = await fetch(`/api/sessions/${session.sessionId}/responses`);
      const data = await response.json();
      
      if (data.status === 'success' && data.data) {
        console.log('[CLIENT RESPONSES] ===== ALL PLAYER RESPONSES RECEIVED =====');
        console.log('[CLIENT RESPONSES] All Responses Data:');
        
        // 🎯 DETAILED RESPONSE LOGGING - Like user data format
        console.log('[CLIENT RESPONSES] Response Summary:', {
          status: 'success',
          data: {
            sessionId: data.data.sessionId,
            aiPersona: data.data.aiPersona,
            totalResponses: data.data.playerResponses.length,
            timestamp: new Date().toISOString()
          }
        });
        
        // 🎯 INDIVIDUAL RESPONSE LOGGING - Each response separately
        console.log('[CLIENT RESPONSES] ===== INDIVIDUAL PLAYER RESPONSES =====');
        data.data.playerResponses.forEach((response: any, index: number) => {
          console.log(`[CLIENT RESPONSES] Player ${index + 1} Response:`, {
            status: 'success',
            data: {
              userId: response.userId,
              username: response.username,
              persona: response.persona,
              response: response.response,
              submittedAt: new Date(response.submittedAt).toISOString(),
              isTimeUp: response.isTimeUp,
              responseLength: response.response.length
            }
          });
        });
        
        // 🎯 COMPLETE DATA DUMP - Raw format
        console.log('[CLIENT RESPONSES] ===== RAW RESPONSE DATA =====');
        console.log('[CLIENT RESPONSES] Raw Server Response:', JSON.stringify(data.data, null, 2));
        console.log('[CLIENT RESPONSES] ===== END ALL RESPONSES DATA =====');
        
        setAllResponses(data.data.playerResponses);
        console.log('i reached after setting all the responses');
        // Fetch and log the redis dump for debugging
        try {
          const redisDumpResponse = await fetch('/api/redis-data/dump');
          const redisDump = await redisDumpResponse.json();
          console.log('[REDIS DUMP] Browser-side:', redisDump);
        } catch (err) {
          console.error('[REDIS DUMP] Failed to fetch redis dump:', err);
        }
        // Wait 3 seconds to show responses, then evaluate winner
        setTimeout(() => {
          evaluateResponsesAndDetermineWinner();
        }, 3000); // Show responses for 3 seconds before winner reveal
      } else {
        console.log('[CLIENT RESPONSES] No responses found, proceeding with winner evaluation');
        setTimeout(() => {
          evaluateResponsesAndDetermineWinner();
        }, 1000);
      }
    } catch (error) {
      console.error('[CLIENT RESPONSES] Error fetching responses:', error);
      setTimeout(() => {
        evaluateResponsesAndDetermineWinner();
      }, 1000);
    }
  };

  const evaluateResponsesAndDetermineWinner = async () => {
    console.log('[CLIENT WINNER] ===== STARTING WINNER EVALUATION =====');
    console.log('[CLIENT WINNER] Fetching winner from server...');
    
    // Fetch winner evaluation from server (which handles Gemini API and fallback)
    let geminiResult = null;
    try {
      const response = await fetch(`/api/sessions/${session?.sessionId}/gemini-analysis`);
      const data = await response.json();
      
      if (data.status === 'success' && data.data) {
        geminiResult = data.data;
        console.log('[CLIENT WINNER] ===== GEMINI EVALUATION RECEIVED =====');
        console.log('[CLIENT WINNER] Gemini Winner:', geminiResult.winner);
        console.log('[CLIENT WINNER] Gemini Reason:', geminiResult.reason);
        console.log('[CLIENT WINNER] Full Evaluation:', geminiResult.evaluation);
        console.log('[CLIENT WINNER] ===== END GEMINI EVALUATION =====');
        
        // Log to browser console for debugging
        console.log('🤖 GEMINI GAME EVALUATION RESULT:', {
          winner: geminiResult.winner,
          reason: geminiResult.reason,
          fullEvaluation: geminiResult.evaluation,
          timestamp: new Date().toISOString()
        });
      }
    } catch (err) {
      console.error('[CLIENT WINNER] Failed to fetch Gemini analysis:', err);
      console.error('🤖 GEMINI EVALUATION ERROR:', err);
      
      // Log more detailed error information
      if (err instanceof Error) {
        console.error('🤖 GEMINI ERROR DETAILS:', {
          name: err.name,
          message: err.message,
          stack: err.stack
        });
      }
    }
    
    // Simulate evaluation delay
    console.log('[CLIENT WINNER] Simulating AI evaluation delay...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Use server result (which includes Gemini evaluation or server-side fallback)
    let finalWinner, finalReason, finalWinnerId;
    
    if (geminiResult && geminiResult.winner) {
      // Find the player object for the server-selected winner
      const players = session?.players || [];
      const geminiWinnerPlayer = players.find(p => p.username === geminiResult.winner);
      
      if (geminiWinnerPlayer) {
        finalWinner = geminiResult.winner;
        finalReason = geminiResult.reason;
        finalWinnerId = geminiWinnerPlayer.userId;
        setGeminiEvaluation(geminiResult.evaluation);
        console.log('[CLIENT WINNER] Using server-selected winner:', finalWinner);
      } else {
        console.warn('[CLIENT WINNER] Server winner not found in player list, this should not happen');
        const randomWinner = players[Math.floor(Math.random() * players.length)];
        finalWinner = randomWinner?.username || 'Unknown';
        finalWinnerId = randomWinner?.userId || '';
        finalReason = `Server selected ${geminiResult.winner} but they were not found in the game. ${finalWinner} wins by default.`;
      }
    } else {
      // This should not happen since server always returns a winner
      console.error('[CLIENT WINNER] No server result, this should not happen');
      const players = session?.players || [];
      const randomWinner = players[Math.floor(Math.random() * players.length)];
      finalWinner = randomWinner?.username || 'Unknown';
      finalWinnerId = randomWinner?.userId || '';
      finalReason = `Server evaluation failed. ${finalWinner} wins by emergency client-side selection.`;
    }
    
    setWinner(finalWinner);
    setWinnerReason(finalReason);
    setPageState('revealing');
    console.log('[CLIENT WINNER] Winner page should now be visible');
    
    // Mark session as completed with winner
    if (session && finalWinnerId) {
      try {
        console.log('[CLIENT WINNER] Marking session as completed...');
        await fetch(`/api/sessions/${session.sessionId}/complete`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            winnerId: finalWinnerId,
            winnerUsername: finalWinner,
          }),
        });
        console.log('✅ Session marked as completed with winner');
      } catch (error) {
        console.error('❌ Failed to mark session as completed:', error);
      }
    }
    console.log('[CLIENT WINNER] ===== WINNER EVALUATION COMPLETE =====');
  };

  const handleReturnToHome = () => {
    // Leave the session when returning to home
    if (session) {
      fetch(`/api/sessions/${session.sessionId}/leave`, {
        method: 'POST',
      }).catch(error => {
        console.error('Failed to leave session:', error);
      });
    }
    navigate('/');
  };

  const formatTime = (ms: number) => {
    const seconds = Math.ceil(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const handleButtonClick = (action: () => void) => {
    if (getSoundState()) {
      playClickSound();
    }
    action();
  };

  // Waiting state - show all responses
  if (pageState === 'waiting') {
    return (
      <div className="response-page">
        <div className="response-content">
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            color: '#FFD700',
            fontFamily: 'VT323, monospace',
            fontSize: '24px',
            textAlign: 'center',
            maxWidth: '600px',
            zIndex: 10,
            background: 'rgba(0, 0, 0, 0.9)',
            padding: '30px',
            borderRadius: '12px',
            border: '3px solid #FFD700',
            maxHeight: '80vh',
            overflowY: 'auto'
          }}>
            <div style={{ fontSize: '32px', marginBottom: '20px', color: '#4CAF50' }}>
              📊 All Player Responses
            </div>
            
            {allResponses.length > 0 ? (
              <div style={{ textAlign: 'left', fontSize: '18px' }}>
                {allResponses.map((response, index) => (
                  <div key={response.userId} style={{ 
                    marginBottom: '20px', 
                    padding: '15px', 
                    background: 'rgba(255, 255, 255, 0.1)', 
                    borderRadius: '8px',
                    border: '1px solid #FFD700'
                  }}>
                    <div style={{ color: '#4CAF50', fontWeight: 'bold', marginBottom: '5px' }}>
                      u/{response.username}
                    </div>
                    <div style={{ color: '#ffffff', marginBottom: '5px', fontSize: '16px' }}>
                      Role: {response.persona}
                    </div>
                    <div style={{ color: '#ffffff', fontSize: '16px' }}>
                      Response: "{response.response}"
                    </div>
                    {response.isTimeUp && (
                      <div style={{ color: '#ff6b6b', fontSize: '14px', marginTop: '5px' }}>
                        (Time expired)
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: '20px', color: '#ffffff' }}>
                Collecting responses...
              </div>
            )}
            
            <div style={{ fontSize: '18px', marginTop: '20px', color: '#ffffff' }}>
              Evaluating responses...
            </div>
          </div>
          
          <div className={`response-dealer response-dealer-${dealerId}`} />
        </div>
      </div>
    );
  }

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
                {geminiEvaluation && (
                  <details style={{ 
                    fontSize: '14px', 
                    color: '#cccccc', 
                    marginBottom: '20px',
                    cursor: 'pointer'
                  }}>
                    <summary style={{ color: '#FFD700', marginBottom: '10px' }}>
                      View Detailed AI Evaluation
                    </summary>
                    <div style={{ 
                      background: 'rgba(0, 0, 0, 0.5)', 
                      padding: '15px', 
                      borderRadius: '8px',
                      textAlign: 'left',
                      maxHeight: '200px',
                      overflowY: 'auto'
                    }}>
                      <pre style={{ 
                        whiteSpace: 'pre-wrap', 
                        fontSize: '12px',
                        margin: 0,
                        fontFamily: 'VT323, monospace'
                      }}>
                        {JSON.stringify(geminiEvaluation, null, 2)}
                      </pre>
                    </div>
                  </details>
                )}
                <div style={{ fontSize: '20px', marginBottom: '20px', color: '#4CAF50' }}>
                  Congratulations!
                </div>
                <button
                  onClick={() => handleButtonClick(() => navigate('/'))}
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
        <div className="response-content">
          {/* Fixed User Persona at top */}
          {userPersona && (
            <div className="user-persona-display">
              Your Role: {userPersona}
            </div>
          )}
          
          {/* Timer text */}
          <div className={`timer-text ${timeRemaining < 10000 ? 'time-low' : ''}`}>
            Time Remaining: {formatTime(timeRemaining)}
            {isTimeUp && <div>Time's Up!</div>}
          </div>
          
          {/* Fixed Dealer Position */}
          <div className={`response-dealer response-dealer-${dealerId}`} />
          
          {pageState === 'waiting' && (
            <div className="loading-screen">
              <div className="loading-text">Evaluating</div>
            </div>
          )}
          
          {pageState === 'revealing' && (
            <div className="winner-modal">
              <div className="winner-content">
                <div className="winner-text">{winner}</div>
                <div 
                  className="return-home-text"
                  onClick={() => handleButtonClick(handleReturnToHome)}
                  onMouseEnter={() => getSoundState() && playHoverSound()}
                >
                  Return Home
                </div>
              </div>
            </div>
          )}
          
          <div style={{marginBottom: '10px',marginTop: '10px'}}></div>
          <div className="text-input-container">
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
            
            {/* Submit Button */}
            <button
              onClick={() => handleButtonClick(() => handleSubmitResponse())}
              disabled={(!userInput.trim() && !isTimeUp) || hasSubmitted}
              className="submit-button"
            >
              {hasSubmitted ? '✅ Submitted' : isTimeUp ? 'Time Up' : 'Submit Guess (Ctrl+Enter)'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResponsePage;