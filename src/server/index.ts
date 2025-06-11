import express from 'express';
import { createServer, getContext, getServerPort } from '@devvit/server';
import { CheckResponse, InitResponse, LetterState } from '../shared/types/game';
import { postConfigGet, postConfigNew, postConfigMaybeGet } from './core/post';
import { allWords } from './core/words';
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
  getPublicSessions,
  getUserCurrentSession 
} from './core/session';
import { 
  CreateSessionResponse, 
  JoinSessionResponse, 
  GetPublicSessionsResponse,
  LeaveSessionResponse,
  StartCountdownResponse 
} from '../shared/types/session';

const app = express();

// Middleware for JSON body parsing
app.use(express.json());
// Middleware for URL-encoded body parsing
app.use(express.urlencoded({ extended: true }));
// Middleware for plain text body parsing
app.use(express.text());

const router = express.Router();

router.get<{ postId: string }, InitResponse | { status: string; message: string }>(
  '/api/init',
  async (_req, res): Promise<void> => {
    const { postId } = getContext();
    const redis = getRedis();

    if (!postId) {
      console.error('API Init Error: postId not found in devvit context');
      res.status(400).json({
        status: 'error',
        message: 'postId is required but missing from context',
      });
      return;
    }

    try {
      let config = await postConfigMaybeGet({ redis, postId });
      if (!config || !config.wordOfTheDay) {
        console.log(`No valid config found for post ${postId}, creating new one.`);
        await postConfigNew({ redis: getRedis(), postId });
        config = await postConfigGet({ redis, postId });
      }

      if (!config.wordOfTheDay) {
        console.error(
          `API Init Error: wordOfTheDay still not found for post ${postId} after attempting creation.`
        );
        throw new Error('Failed to initialize game configuration.');
      }

      res.json({
        status: 'success',
        postId: postId,
      });
    } catch (error) {
      console.error(`API Init Error for post ${postId}:`, error);
      const message =
        error instanceof Error ? error.message : 'Unknown error during initialization';
      res.status(500).json({ status: 'error', message });
    }
  }
);

router.post<{ postId: string }, CheckResponse, { guess: string }>(
  '/api/check',
  async (req, res): Promise<void> => {
    const { guess } = req.body;
    const { postId, userId } = getContext();
    const redis = getRedis();

    if (!postId) {
      res.status(400).json({ status: 'error', message: 'postId is required' });
      return;
    }
    if (!userId) {
      res.status(400).json({ status: 'error', message: 'Must be logged in' });
      return;
    }
    if (!guess) {
      res.status(400).json({ status: 'error', message: 'Guess is required' });
      return;
    }

    const config = await postConfigGet({ redis, postId });
    const { wordOfTheDay } = config;

    const normalizedGuess = guess.toLowerCase();

    if (normalizedGuess.length !== 5) {
      res.status(400).json({ status: 'error', message: 'Guess must be 5 letters long' });
      return;
    }

    const wordExists = allWords.includes(normalizedGuess);

    if (!wordExists) {
      res.json({
        status: 'success',
        exists: false,
        solved: false,
        correct: Array(5).fill('initial') as [
          LetterState,
          LetterState,
          LetterState,
          LetterState,
          LetterState,
        ],
      });
      return;
    }

    const answerLetters = wordOfTheDay.split('');
    const resultCorrect: LetterState[] = Array(5).fill('initial');
    let solved = true;
    const guessLetters = normalizedGuess.split('');

    for (let i = 0; i < 5; i++) {
      if (guessLetters[i] === answerLetters[i]) {
        resultCorrect[i] = 'correct';
        answerLetters[i] = '';
      } else {
        solved = false;
      }
    }

    for (let i = 0; i < 5; i++) {
      if (resultCorrect[i] === 'initial') {
        const guessedLetter = guessLetters[i]!;
        const presentIndex = answerLetters.indexOf(guessedLetter);
        if (presentIndex !== -1) {
          resultCorrect[i] = 'present';
          answerLetters[presentIndex] = '';
        }
      }
    }

    for (let i = 0; i < 5; i++) {
      if (resultCorrect[i] === 'initial') {
        resultCorrect[i] = 'absent';
      }
    }

    res.json({
      status: 'success',
      exists: true,
      solved,
      correct: resultCorrect as [LetterState, LetterState, LetterState, LetterState, LetterState],
    });
  }
);

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
      score: req.body.score || 0
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
    res.json({ status: 'success' } as LeaveSessionResponse);
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

// Use router middleware
app.use(router);

// Get port from environment variable with fallback
const port = getServerPort();

const server = createServer(app);
server.on('error', (err) => console.error(`server error; ${err.stack}`));
server.listen(port, () => console.log(`http://localhost:${port}`));