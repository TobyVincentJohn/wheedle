import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './InitialLoadingScreen.css';

interface Star {
  x: number;
  y: number;
  size: number;
  speedX: number;
  speedY: number;
}

const InitialLoadingScreen: React.FC = () => {
  const navigate = useNavigate();
  const [stars, setStars] = useState<Star[]>([]);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [assetsLoaded, setAssetsLoaded] = useState(false);

  // Quirky loading phrases
  const loadingPhrases = [
    "Summoning digital wizardry...",
    "Herding pixels into formation...",
    "Teaching robots to be charming...",
    "Calibrating chaos generators...",
    "Downloading more cowbell...",
    "Convincing electrons to cooperate...",
    "Bribing the internet gods...",
    "Assembling quantum shenanigans...",
    "Polishing virtual reality...",
    "Debugging the matrix..."
  ];

  const [currentPhrase] = useState(() => 
    loadingPhrases[Math.floor(Math.random() * loadingPhrases.length)]
  );

  // Asset URLs to preload for main pages
  const mainPageAssets = [
    // Homepage assets
    new URL('../../assets/landing_backdrop.png', import.meta.url).href,
    new URL('../../assets/wheedle_logo.png', import.meta.url).href,
    new URL('../../assets/buttons/public_room.png', import.meta.url).href,
    new URL('../../assets/buttons/private_room.png', import.meta.url).href,
    new URL('../../assets/buttons/rules_button.png', import.meta.url).href,
    new URL('../../assets/buttons/leaderboard_icon.png', import.meta.url).href,
    new URL('../../assets/buttons/sound_on.png', import.meta.url).href,
    new URL('../../assets/buttons/sound_off.png', import.meta.url).href,
    
    // Public/Private room assets
    new URL('../../assets/waiting_room/waiting_room.png', import.meta.url).href,
    new URL('../../assets/waiting_room/name_tag.png', import.meta.url).href,
    new URL('../../assets/session_page/create_room.png', import.meta.url).href,
    new URL('../../assets/session_page/next_button.png', import.meta.url).href,
    new URL('../../assets/session_page/room_tile.png', import.meta.url).href,
    
    // Waiting room assets
    new URL('../../assets/waiting_room/waiting_room_label.png', import.meta.url).href,
    new URL('../../assets/waiting_room/quit_button.png', import.meta.url).href,
    new URL('../../assets/waiting_room/start_button.png', import.meta.url).href,
    
    // Font file
    new URL('../../assets/fonts/VT323-Regular.ttf', import.meta.url).href,
    
    // Sound files
    new URL('../../assets/sounds/hover.mp3', import.meta.url).href,
    new URL('../../assets/sounds/click.mp3', import.meta.url).href,
  ];

  // Preload all main page assets
  useEffect(() => {
    console.log('🚀 Starting asset preloading for main pages...');
    
    const preloadAssets = async () => {
      const loadPromises = mainPageAssets.map((assetUrl, index) => {
        return new Promise<void>((resolve, reject) => {
          if (assetUrl.endsWith('.ttf')) {
            // Preload font
            const font = new FontFace('VT323', `url(${assetUrl})`);
            font.load().then(() => {
              document.fonts.add(font);
              console.log(`✅ Font loaded: VT323`);
              setLoadingProgress(prev => prev + (100 / mainPageAssets.length));
              resolve();
            }).catch(reject);
          } else if (assetUrl.endsWith('.mp3')) {
            // Preload audio
            const audio = new Audio();
            audio.oncanplaythrough = () => {
              console.log(`✅ Audio loaded: ${assetUrl.split('/').pop()}`);
              setLoadingProgress(prev => prev + (100 / mainPageAssets.length));
              resolve();
            };
            audio.onerror = () => {
              console.warn(`⚠️ Failed to load audio: ${assetUrl.split('/').pop()}`);
              setLoadingProgress(prev => prev + (100 / mainPageAssets.length));
              resolve(); // Continue even if some assets fail
            };
            audio.src = assetUrl;
          } else {
            // Preload image
            const img = new Image();
            img.onload = () => {
              console.log(`✅ Image loaded: ${assetUrl.split('/').pop()}`);
              setLoadingProgress(prev => prev + (100 / mainPageAssets.length));
              resolve();
            };
            img.onerror = () => {
              console.warn(`⚠️ Failed to load: ${assetUrl.split('/').pop()}`);
              setLoadingProgress(prev => prev + (100 / mainPageAssets.length));
              resolve(); // Continue even if some assets fail
            };
            img.src = assetUrl;
          }
        });
      });

      try {
        await Promise.all(loadPromises);
        console.log('🎉 All main page assets preloaded successfully!');
        setAssetsLoaded(true);
      } catch (error) {
        console.error('❌ Error preloading assets:', error);
        setAssetsLoaded(true); // Continue anyway
      }
    };

    preloadAssets();
  }, []);

  // Navigate to home page after assets are loaded and minimum time has passed
  useEffect(() => {
    if (!assetsLoaded) return;

    // Ensure minimum 3-second loading time for good UX
    const minLoadingTime = 3000;
    const startTime = Date.now();
    
    const navigateToHome = () => {
      const elapsed = Date.now() - startTime;
      const remainingTime = Math.max(0, minLoadingTime - elapsed);
      
      setTimeout(() => {
        console.log('🏠 Assets loaded, navigating to home...');
        navigate('/');
      }, remainingTime);
    };

    navigateToHome();
  }, [assetsLoaded, navigate]);

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
    <div className="initial-loading-screen">
      <div className="initial-stars-container">
        {stars.map((star, index) => (
          <div
            key={index}
            className="initial-star"
            style={{
              left: `${star.x}%`,
              top: `${star.y}%`,
              width: `${star.size}px`,
              height: `${star.size}px`
            }}
          />
        ))}
      </div>
      <div className="initial-loading-content">
        <div className="initial-loading-text">
          {currentPhrase}
        </div>
        <div className="initial-loading-progress">
          <div className="initial-progress-bar">
            <div 
              className="initial-progress-fill" 
              style={{ width: `${Math.round(loadingProgress)}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default InitialLoadingScreen;