import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
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

  // Fixed 3-second timer to navigate to the game page
  useEffect(() => {
    if (!session) {
      console.error('No session data found, redirecting to home.');
      navigate('/');
      return;
    }

    const timer = setTimeout(() => {
      console.log('🚀 3-second loading time complete, navigating to game...');
      navigate('/game', { state: { session } });
    }, 3000);

    return () => clearTimeout(timer);
  }, [session, navigate]);

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
      <div className="loading-text">
        {'Preparing Game...'}
      </div>
    </div>
  );
};

export default LoadingScreen; 