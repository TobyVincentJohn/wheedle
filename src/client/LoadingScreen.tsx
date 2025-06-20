import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AIGameData } from '../shared/types/aiGame';
import './LoadingScreen.css';

interface Star {
  x: number;
  y: number;
  size: number;
  speedX: number;
  speedY: number;
}

const LoadingScreen: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const session = location.state?.session;
  const [stars, setStars] = useState<Star[]>([]);

  useEffect(() => {
    // Starfield animation
    const newStars = Array.from({ length: 50 }, () => ({
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 2 + 1,
      speedX: (Math.random() - 0.5) * 0.02,
      speedY: (Math.random() - 0.5) * 0.02
    }));
    setStars(newStars);
    const animationFrame = requestAnimationFrame(function animate() {
      setStars(prevStars => 
        prevStars.map(star => {
          let newX = star.x + star.speedX;
          let newY = star.y + star.speedY;
          if (newX < 0) newX = 100;
          if (newX > 100) newX = 0;
          if (newY < 0) newY = 100;
          if (newY > 100) newY = 0;
          return { ...star, x: newX, y: newY };
        })
      );
      requestAnimationFrame(animate);
    });
    return () => cancelAnimationFrame(animationFrame);
  }, []);

  useEffect(() => {
    if (!session) {
      console.error('No session data found, redirecting to home.');
      navigate('/');
      return;
    }

    const fetchAIGameData = async (sessionId: string) => {
      try {
        console.log('🎮 Fetching AI game data from loading screen...');
        const response = await fetch(`/api/ai-game-data/${sessionId}`);
        const data = await response.json();
        
        if (data.status === 'success' && data.data) {
          console.log('✅ AI game data loaded successfully.');
          navigate('/game', { state: { session, aiGameData: data.data } });
        } else {
          console.error('❌ Failed to fetch AI game data:', data.message);
          const fallbackData: AIGameData = {
            aiPersona: "A fallback detective AI",
            clues: ["Clue 1", "Clue 2", "Clue 3"],
            userPersonas: ["Persona 1", "Persona 2", "Persona 3"],
            sessionId,
            createdAt: Date.now()
          };
          navigate('/game', { state: { session, aiGameData: fallbackData } });
        }
      } catch (error) {
        console.error('💥 Error fetching AI game data:', error);
        navigate('/'); // Redirect home on critical error
      }
    };

    fetchAIGameData(session.sessionId);
  }, [session, navigate]);


  return (
    <div className="loading-screen">
      <div className="stars-container">
        {stars.map((star, index) => (
          <div
            key={index}
            className="star"
            style={{
              left: `${star.x}%`,
              top: `${star.y}%`,
              width: `${star.size}px`,
              height: `${star.size}px`
            }}
          />
        ))}
      </div>
      <div className="loading-text">Generating AI Clues...</div>
    </div>
  );
};

export default LoadingScreen; 