import express from 'express';
import { createServer, getContext, getServerPort } from '@devvit/server';
import { getRedis } from '@devvit/redis';
import { userGet, userSet, userUpdate, userDelete, getActiveUsers } from './core/user';
import { UserDetails } from '../shared/types/user';
import { 
  sessionCreate, 
  sessionGet, 
  sessionJoin, 
  sessionLeave, 
  sessionStartCountdown,
  sessionStartGame,
  sessionComplete,
  getPublicSessions,
  getUserCurrentSession
} from './core/session';
import { findSessionByCode } from './core/roomCodeSearch';
import { createAIGameData, getAIGameData } from './core/aiService';
import { GetAIGameDataResponse } from '../shared/types/aiGame';
import { 
  CreateSessionResponse, 
  JoinSessionResponse, 
  GetPublicSessionsResponse,
  LeaveSessionResponse,
  StartCountdownResponse 
} from '../shared/types/session';

import { Devvit } from '@devvit/public-api';

const app = express();

// Middleware for JSON body parsing
app.use(express.json());
// Middleware for URL-encoded body parsing
app.use(express.urlencoded({ extended: true }));
// Middleware for plain text body parsing
app.use(express.text());

const router = express.Router();

router.get('/api/redis-data/sessions/all', async (req, res) => {
  const { userId } = getContext();
  const redis = getRedis();

  try {
    const publicSessions = await getPublicSessions({ redis });
    const userData = userId ? await userGet({ redis, userId }) : null;
    const currentSession = userId ? await getUserCurrentSession({ redis, userId }) : null;

    res.json({
      status: 'success',
      data: {
        publicSessions,
        currentSession,
        userData,
      },
    });
  } catch (error) {
    console.error('Error fetching sessions data:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ status: 'error', message });
  }
});
  
// User Management Endpoints
router.post('/api/users', async (req, res) => {
  const { userId, reddit } = getContext();
  const redis = getRedis();
  
  if (!userId) {
    res.status(401).json({ status: 'error', message: 'Must be logged in' });
    return;
  }

  try {
    const redditUser = await reddit.getCurrentUser();
    if (!redditUser) {
      throw new Error('Could not fetch Reddit user');
    }

    const userDetails: UserDetails = {
      userId,
      username: redditUser.username,
      lastActive: Date.now(),
      currentRoom: req.body.currentRoom,
      score: req.body.score || 0,
    };

    await userSet({ redis, userDetails });
    res.json({ status: 'success', data: userDetails });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ 
      status: 'error', 
      message: error instanceof Error ? error.message : 'Unknown error creating user'
    });
  }
});

router.get('/api/users/current', async (_req, res) => {
  const { userId } = getContext();
  const redis = getRedis();
  
  if (!userId) {
    res.status(401).json({ status: 'error', message: 'Must be logged in' });
    return;
  }

  try {
    const user = await userGet({ redis, userId });
    if (!user) {
      res.status(404).json({ status: 'error', message: 'User not found' });
      return;
    }
    res.json({ status: 'success', data: user });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ 
      status: 'error', 
      message: error instanceof Error ? error.message : 'Unknown error fetching user'
    });
  }
});

router.patch('/api/users/current', async (req, res) => {
  const { userId } = getContext();
  const redis = getRedis();
  
  if (!userId) {
    res.status(401).json({ status: 'error', message: 'Must be logged in' });
    return;
  }

  try {
    await userUpdate({ redis, userId, updates: req.body });
    const updatedUser = await userGet({ redis, userId });
    res.json({ status: 'success', data: updatedUser });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ 
      status: 'error', 
      message: error instanceof Error ? error.message : 'Unknown error updating user'
    });
  }
});

router.delete('/api/users/current', async (_req, res) => {
  const { userId } = getContext();
  const redis = getRedis();
  
  if (!userId) {
    res.status(401).json({ status: 'error', message: 'Must be logged in' });
    return;
  }

  try {
    await userDelete({ redis, userId });
    res.json({ status: 'success' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ 
      status: 'error', 
      message: error instanceof Error ? error.message : 'Unknown error deleting user'
    });
  }
});

router.get('/api/users/active', async (_req, res) => {
  const redis = getRedis();
  
  try {
    const activeUsers = await getActiveUsers({ redis });
    res.json({ status: 'success', data: activeUsers });
  } catch (error) {
    console.error('Error fetching active users:', error);
    res.status(500).json({ 
      status: 'error', 
      message: error instanceof Error ? error.message : 'Unknown error fetching active users'
    });
  }
});

// Session Management Endpoints
router.post('/api/sessions', async (req, res): Promise<void> => {
  const { userId, reddit } = getContext();
  const redis = getRedis();
  
  if (!userId) {
    res.status(401).json({ status: 'error', message: 'Must be logged in' } as CreateSessionResponse);
    return;
  }

  try {
    const redditUser = await reddit.getCurrentUser();
    if (!redditUser) {
      throw new Error('Could not fetch Reddit user');
    }

    const session = await sessionCreate({
      redis,
      hostUserId: userId,
      hostUsername: redditUser.username,
      maxPlayers: req.body.maxPlayers || 6,
      isPrivate: Boolean(req.body.isPrivate),
    });

    res.json({ status: 'success', data: session } as CreateSessionResponse);
  } catch (error) {
    console.error('Error creating session:', error);
    res.status(500).json({ 
      status: 'error', 
      message: error instanceof Error ? error.message : 'Unknown error creating session'
    } as CreateSessionResponse);
  }
});

router.get('/api/sessions/public', async (_req, res): Promise<void> => {
  const redis = getRedis();
  
  try {
    const sessions = await getPublicSessions({ redis });
    res.json({ status: 'success', data: sessions } as GetPublicSessionsResponse);
  } catch (error) {
    console.error('Error fetching public sessions:', error);
    res.status(500).json({ 
      status: 'error', 
      message: error instanceof Error ? error.message : 'Unknown error fetching sessions'
    } as GetPublicSessionsResponse);
  }
});

router.post('/api/sessions/:sessionId/join', async (req, res): Promise<void> => {
  const { sessionId } = req.params;
  const { userId, reddit } = getContext();
  const redis = getRedis();
  
  if (!userId) {
    res.status(401).json({ status: 'error', message: 'Must be logged in' } as JoinSessionResponse);
    return;
  }

  try {
    const redditUser = await reddit.getCurrentUser();
    if (!redditUser) {
      throw new Error('Could not fetch Reddit user');
    }

    const session = await sessionJoin({
      redis,
      sessionId,
      userId,
      username: redditUser.username,
    });

    res.json({ status: 'success', data: session } as JoinSessionResponse);
  } catch (error) {
    console.error('Error joining session:', error);
    res.status(500).json({ 
      status: 'error', 
      message: error instanceof Error ? error.message : 'Unknown error joining session'
    } as JoinSessionResponse);
  }
});

router.post('/api/sessions/:sessionId/leave', async (req, res): Promise<void> => {
  const { sessionId } = req.params;
  const { userId } = getContext();
  const redis = getRedis();
  
  if (!userId) {
    res.status(401).json({ status: 'error', message: 'Must be logged in' } as LeaveSessionResponse);
    return;
  }

  try {
    await sessionLeave({ redis, sessionId, userId });
    res.json({ 
      status: 'success'
    } as LeaveSessionResponse);
  } catch (error) {
    console.error('Error leaving session:', error);
    res.status(500).json({ 
      status: 'error', 
      message: error instanceof Error ? error.message : 'Unknown error leaving session'
    } as LeaveSessionResponse);
  }
});

router.post('/api/sessions/:sessionId/start-countdown', async (req, res): Promise<void> => {
  const { sessionId } = req.params;
  const { userId } = getContext();
  const redis = getRedis();
  
  if (!userId) {
    res.status(401).json({ status: 'error', message: 'Must be logged in' } as StartCountdownResponse);
    return;
  }

  try {
    const session = await sessionStartCountdown({ redis, sessionId });
    // Asynchronously create AI game data when countdown starts
    createAIGameData({ redis, sessionId }).catch(err => {
      console.error('Failed to create AI game data on countdown start:', err);
    });

    res.json({ status: 'success', data: session } as StartCountdownResponse);
  } catch (error) {
    console.error('Error starting countdown:', error);
    res.status(500).json({ 
      status: 'error', 
      message: error instanceof Error ? error.message : 'Unknown error starting countdown'
    } as StartCountdownResponse);
  }
});

router.post('/api/sessions/:sessionId/start', async (req, res): Promise<void> => {
  const { sessionId } = req.params;
  const { userId } = getContext();
  const redis = getRedis();
  
  if (!userId) {
    res.status(401).json({ status: 'error', message: 'Must be logged in' });
    return;
  }

  try {
    const session = await sessionStartGame({ redis, sessionId });
    res.json({ status: 'success', data: session });
  } catch (error) {
    console.error('Error starting game:', error);
    res.status(500).json({ 
      status: 'error', 
      message: error instanceof Error ? error.message : 'Unknown error starting game'
    });
  }
});

router.get('/api/sessions/current', async (_req, res): Promise<void> => {
  const { userId } = getContext();
  const redis = getRedis();
  
  if (!userId) {
    res.status(401).json({ status: 'error', message: 'Must be logged in' });
    return;
  }

  try {
    const session = await getUserCurrentSession({ redis, userId });
    res.json({ status: 'success', data: session });
  } catch (error) {
    console.error('Error fetching current session:', error);
    res.status(500).json({ 
      status: 'error', 
      message: error instanceof Error ? error.message : 'Unknown error fetching current session'
    });
  }
});

// AI Game Data Endpoints
router.get('/api/ai-game-data/:sessionId', async (req, res): Promise<void> => {
  const { sessionId } = req.params;
  const redis = getRedis();

  try {
    const aiGameData = await getAIGameData({ redis, sessionId });
    if (aiGameData) {
      res.json({ status: 'success', data: aiGameData } as GetAIGameDataResponse);
    } else {
      res.status(404).json({ status: 'error', message: 'AI game data not found yet.' });
    }
  } catch (error) {
    console.error('Error fetching AI game data:', error);
    res.status(500).json({ 
      status: 'error', 
      message: error instanceof Error ? error.message : 'Unknown error fetching AI game data'
    } as GetAIGameDataResponse);
  }
});

router.get('/api/sessions/by-code/:sessionCode/:type', async (req, res): Promise<void> => {
  const { sessionCode, type } = req.params;
  const redis = getRedis();
  
  console.log(`Searching for session with code: ${sessionCode}, type: ${type}`);
  
  if (type !== 'public' && type !== 'private') {
    res.status(400).json({ 
      status: 'error', 
      message: 'Invalid session type. Must be "public" or "private"' 
    });
    return;
  }
  
  try {
    const result = await findSessionByCode({ 
      redis, 
      sessionCode: sessionCode.toUpperCase(),
      requestedType: type as 'public' | 'private'
    });
    
    if (result.error) {
      res.status(404).json({ 
        status: 'error', 
        message: result.error 
      });
      return;
    } else {
      res.json({ status: 'success', data: result.session });
      return;
    }
  } catch (error) {
    console.error('Error fetching session by code:', error);
    res.status(500).json({ 
      status: 'error', 
      message: error instanceof Error ? error.message : 'Unknown error fetching session'
    });
    return;
  }
});

// New endpoint to complete a session and declare a winner
router.post('/api/sessions/:sessionId/complete', async (req, res): Promise<void> => {
  const { sessionId } = req.params;
  const { winnerId, winnerUsername } = req.body;
  const { userId } = getContext();
  const redis = getRedis();
  
  if (!userId) {
    res.status(401).json({ status: 'error', message: 'Must be logged in' });
    return;
  }

  if (!winnerId || !winnerUsername) {
    res.status(400).json({ status: 'error', message: 'Winner ID and username are required' });
    return;
  }

  try {
    const session = await sessionComplete({ redis, sessionId, winnerId, winnerUsername });
    res.json({ status: 'success', data: session });
  } catch (error) {
    console.error('Error completing session:', error);
    res.status(500).json({ 
      status: 'error', 
      message: error instanceof Error ? error.message : 'Unknown error completing session'
    });
  }
});

// Use router middleware
app.use(router);

// Get port from environment variable with fallback
const port = getServerPort();

const server = createServer(app);
server.on('error', (err) => console.error(`server error; ${err.stack}`));
server.listen(port, () => console.log(`http://localhost:${port}`));