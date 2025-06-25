import React from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import HomePage from './HomePage';
import PublicRoom from './PublicRoom';
import PrivateRoom from './PrivateRoom';
import WaitingRoom from './WaitingRoom';
import LoadingScreen from './LoadingScreen';
import GamePage from './GamePage';
import LeaderboardPage from './LeaderboardPage';
import ResponsePage from './ResponsePage';
import { useSessionsRedisData } from './hooks/useRedisData';
import { useEffect } from 'react';

const RedisDataLogger: React.FC = () => {
  const sessionsData = useSessionsRedisData();
  return null;
}

export const App: React.FC = () => {
  return (
    <Router>
      <RedisDataLogger />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/public-room" element={<PublicRoom />} />
        <Route path="/private-room" element={<PrivateRoom />} />
        <Route path="/waiting-room" element={<WaitingRoom />} />
        <Route path="/loading" element={<LoadingScreen />} />
        <Route path="/game" element={<GamePage />} />
        <Route path="/response" element={<ResponsePage />} />
        <Route path="/leaderboard" element={<LeaderboardPage />} />
      </Routes>
    </Router>
  );
};

export default App;
