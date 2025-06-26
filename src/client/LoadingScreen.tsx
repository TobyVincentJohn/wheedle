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
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [assetsLoaded, setAssetsLoaded] = useState(false);

  // Asset URLs to preload
  const gameAssets = [
    // Casino backdrop
    new URL('../../assets/casino_backdrop.png', import.meta.url).href,
    // Dealer text bubble
    new URL('../../assets/dealer_text.png', import.meta.url).href,
    // Player text bubble
    new URL('../../assets/player_text.png', import.meta.url).href,
    // All dealer images
    new URL('../../assets/dealers/dealer1.png', import.meta.url).href,
    new URL('../../assets/dealers/dealer2.png', import.meta.url).href,
    new URL('../../assets/dealers/dealer3.png', import.meta.url).href,
    new URL('../../assets/dealers/dealer4.png', import.meta.url).href,
    new URL('../../assets/dealers/dealer5.png', import.meta.url).href,
    new URL('../../assets/dealers/dealer6.png', import.meta.url).href,
    new URL('../../assets/dealers/dealer7.png', import.meta.url).href,
    new URL('../../assets/dealers/dealer8.png', import.meta.url).href,
    // Font file
    new URL('../../assets/fonts/VT323-Regular.ttf', import.meta.url).href,
  ];

  // Preload all game assets
  useEffect(() => {
    if (!session) {
      console.error('No session data found, redirecting to home.');
      navigate('/');
      return;
    }

    console.log('🚀 Starting asset preloading for GamePage...');
    
    const preloadAssets = async () => {
      const loadPromises = gameAssets.map((assetUrl, index) => {
        return new Promise<void>((resolve, reject) => {
          if (assetUrl.endsWith('.ttf')) {
            // Preload font
            const font = new FontFace('VT323', `url(${assetUrl})`);
            font.load().then(() => {
              document.fonts.add(font);
              console.log(`✅ Font loaded: VT323`);
              setLoadingProgress(prev => prev + (100 / gameAssets.length));
              resolve();
            }).catch(reject);
          } else {
            // Preload image
            const img = new Image();
            img.onload = () => {
              console.log(`✅ Image loaded: ${assetUrl.split('/').pop()}`);
              setLoadingProgress(prev => prev + (100 / gameAssets.length));
              resolve();
            };
            img.onerror = () => {
              console.warn(`⚠️ Failed to load: ${assetUrl.split('/').pop()}`);
              setLoadingProgress(prev => prev + (100 / gameAssets.length));
              resolve(); // Continue even if some assets fail
            };
            img.src = assetUrl;
          }
        });
      });

      try {
        await Promise.all(loadPromises);
        console.log('🎉 All GamePage assets preloaded successfully!');
        setAssetsLoaded(true);
      } catch (error) {
        console.error('❌ Error preloading assets:', error);
        setAssetsLoaded(true); // Continue anyway
      }
    };

    preloadAssets();
  }, [session, navigate]);

  // Navigate to game page after assets are loaded and minimum time has passed
  useEffect(() => {
    if (!assetsLoaded || !session) return;

    // Ensure minimum 4-second loading time for good UX and AI data preparation
    const minLoadingTime = 4000;
    const startTime = Date.now();
    
    const navigateToGame = () => {
      const elapsed = Date.now() - startTime;
      const remainingTime = Math.max(0, minLoadingTime - elapsed);
      
      setTimeout(() => {
        console.log('🎮 Assets loaded, navigating to game...');
        
        // Pre-fetch AI game data to ensure it's ready
        fetch(`/api/ai-game-data/${session.sessionId}`)
          .then(response => response.json())
          .then(data => {
            if (data.status === 'success') {
              console.log('✅ AI game data pre-fetched successfully');
            }
          })
          .catch(error => {
            console.warn('⚠️ Failed to pre-fetch AI game data:', error);
          });
          
        navigate('/game', { state: { session } });
      }, remainingTime);
    };

    navigateToGame();
  }, [assetsLoaded, session, navigate]);

  // Starfield animation
  useEffect(() => {
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
      <div className="loading-content">
        <div className="loading-text">
          Preparing Game...
        </div>
        <div className="loading-progress">
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${Math.round(loadingProgress)}%` }}
            />
          </div>
          <div className="progress-text">
            {Math.round(loadingProgress)}% Assets Loaded
          </div>
        </div>
        <div className="loading-details">
          {loadingProgress < 100 ? 'Loading game assets...' : 'Ready to play!'}
        </div>
      </div>
    </div>
  );
};

export default LoadingScreen;