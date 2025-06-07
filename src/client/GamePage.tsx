import React, { useEffect, useState } from 'react';
import './GamePage.css';

const GamePage: React.FC = () => {
  const [dealerId, setDealerId] = useState<number>(1);
  const [userInput, setUserInput] = useState<string>('');

  useEffect(() => {
    // Generate random number between 1 and 8 (inclusive)
    const randomDealer = Math.floor(Math.random() * 8) + 1;
    setDealerId(randomDealer);
  }, []); // Empty dependency array means this runs once on mount

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setUserInput(e.target.value);
  };

  return (
    <div className="game-page">
      <div className="game-content">
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