import express from 'express';
import { createServer, getContext, getServerPort } from '@devvit/server';
import { getRedis } from '@devvit/redis';
import { userGet, userSet, userUpdate, userDelete, getActiveUsers } from './core/user';
import { getLeaderboard } from './core/user';
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
import { getAIGameData, sendSessionDataToGemini } from './core/aiService';
import { GetAIGameDataResponse } from '../shared/types/aiGame';
import { 
  CreateSessionResponse, 
  JoinSessionResponse, 
  GetPublicSessionsResponse,
  LeaveSessionResponse,
  StartCountdownResponse 
} from '../shared/types/session';
import { storePlayerResponse, getSessionResponses } from './core/playerResponses';


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

router.get('/api/redis-data/dump', async (req, res) => {
  const redis = getRedis();
  try {
    const allData: { [key: string]: any } = {};

    const fetchAndParse = async (key: string) => {
      const data = await redis.get(key);
      if (data) {
        try {
          allData[key] = JSON.parse(data);
        } catch (e) {
          allData[key] = data; // Not JSON, store as raw string
        }
        return allData[key];
      }
      return null;
    };

    const publicSessionsList = await fetchAndParse('public_sessions_list') || [];
    const privateSessionsList = await fetchAndParse('private_sessions_list') || [];
    const activeUsersList = await fetchAndParse('active_users_list') || [];

    const allSessionIds = [...new Set([...publicSessionsList, ...privateSessionsList])];

    for (const sessionId of allSessionIds) {
      await fetchAndParse(`session:${sessionId}`);
      await fetchAndParse(`ai_game_data:${sessionId}`);
      await fetchAndParse(`session_responses:${sessionId}`);
    }

    for (const userId of activeUsersList) {
      await fetchAndParse(`user:${userId}`);
      await fetchAndParse(`user_session:${userId}`);
    }

    // 🎯 CONSOLIDATED REDIS DUMP LOGGING - Like user data format
    console.log('[REDIS DUMP] ===== COMPLETE REDIS DATA DUMP =====');
    console.log('[REDIS DUMP] Redis Data Summary:');
    console.log('[REDIS DUMP]', {
      status: 'success',
      data: {
        totalKeys: Object.keys(allData).length,
        publicSessions: publicSessionsList.length,
        privateSessions: privateSessionsList.length,
        activeUsers: activeUsersList.length,
        sessionData: allSessionIds.map(sessionId => ({
          sessionId,
          hasSession: !!allData[`session:${sessionId}`],
          hasAIData: !!allData[`ai_game_data:${sessionId}`],
          hasResponses: !!allData[`session_responses:${sessionId}`],
          playerCount: allData[`session:${sessionId}`]?.players?.length || 0,
          responseCount: allData[`session_responses:${sessionId}`]?.playerResponses?.length || 0
        })),
        allKeys: Object.keys(allData)
      }
    });
    console.log('[REDIS DUMP] ===== END REDIS DATA DUMP =====');
    res.json({
      status: 'success',
      data: allData,
    });
  } catch (error) {
    console.error('Error fetching all redis data:', error);
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
      wins: 0, // Initialize wins to 0 for new users
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

// Get leaderboard endpoint
router.get('/api/leaderboard', async (_req, res) => {
  const redis = getRedis();
  
  console.log('[LEADERBOARD API] Received leaderboard request');
  
  try {
    // Get all users first, then limit to top performers
    const leaderboard = await getLeaderboard({ redis, limit: 50 }); // Get more users initially
    
    console.log('[LEADERBOARD API] Fetched', leaderboard.length, 'users');
    
    // If we have more than 10 users, take top 10. Otherwise, return all users.
    const finalLeaderboard = leaderboard.slice(0, 10);
    
    console.log('[LEADERBOARD API] Returning', finalLeaderboard.length, 'users to client');
    res.json({ status: 'success', data: leaderboard });
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    console.error('[LEADERBOARD API] Full error details:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : 'No stack trace'
    });
    res.status(500).json({ 
      status: 'error', 
      message: error instanceof Error ? error.message : 'Unknown error fetching leaderboard'
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
      host: {
        userId: userId,
        username: redditUser.username,
      },
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

router.post('/api/sessions/:sessionId/start-countdown', async (req, res) => {
  const { sessionId } = req.params;
  const { userId } = getContext();
  const redis = getRedis();
  
  if (!userId) {
    res.status(401).json({ status: 'error', message: 'Must be logged in' });
    return;
  }

  try {
    const { session, aiGameData } = await sessionStartCountdown({ redis, sessionId });
    res.json({ status: 'success', data: { session, aiGameData } });
  } catch (error) {
    console.error('Error starting countdown:', error);
    res.status(500).json({ 
      status: 'error', 
      message: error instanceof Error ? error.message : 'Unknown error starting countdown'
    });
  }
});

router.post('/api/sessions/:sessionId/start', async (req, res) => {
  const { sessionId } = req.params;
  const { userId } = getContext();
  const redis = getRedis();
  
  if (!userId) {
    res.status(401).json({ status: 'error', message: 'Must be logged in' });
    return;
  }

  try {
    const { session, aiGameData } = await sessionStartGame({ redis, sessionId });
    res.json({ status: 'success', data: { session, aiGameData } });
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
    
    // If user has a session but it's completed, clear their session reference
    if (session && session.status === 'complete') {
      await redis.del(`user_session:${userId}`);
      res.json({ status: 'success', data: null });
      return;
    }
    
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
  const { userId } = getContext();
  const redis = getRedis();
  console.log('[AI DEBUG] Received request for sessionId:', sessionId);
  console.log('[AI DEBUG] 🌐 API request from client for AI game data');
  console.log('[AI DEBUG] 👤 Request from userId:', userId);

  if (!sessionId || typeof sessionId !== 'string') {
    console.log('[AI DEBUG] Invalid sessionId:', sessionId);
    return res.status(400).json({ status: 'error', message: 'Invalid sessionId' });
  }

  const key = `ai_game_data:${sessionId}`;
  console.log('[AI DEBUG] Looking up Redis key:', key);

  try {
    const aiGameData = await getAIGameData({ redis, sessionId });
    console.log('[AI DEBUG] getAIGameData result:', aiGameData);
    
    if (aiGameData) {
      // 🎯 CONSOLIDATED PERSONA LOGGING - Like user data format
      console.log('[PERSONA DEBUG] ===== ALL PLAYER PERSONAS FOR SESSION =====');
      console.log('[PERSONA DEBUG] Session ID:', sessionId);
      console.log('[PERSONA DEBUG] Player Personas Response:');
      console.log('[PERSONA DEBUG]', {
        status: 'success',
        data: {
          sessionId: sessionId,
          aiPersona: aiGameData.aiPersona,
          totalPlayers: Object.keys(aiGameData.playerPersonas || {}).length,
          playerPersonas: aiGameData.playerPersonas,
          createdAt: aiGameData.createdAt,
          timestamp: new Date(aiGameData.createdAt).toISOString()
        }
      });
      console.log('[PERSONA DEBUG] ===== END PERSONA DATA =====');
      
      console.log('[AI DEBUG] ✅ Successfully returning AI game data to client');
      console.log('[AI DEBUG] 📤 Response includes player personas for', Object.keys(aiGameData.playerPersonas || {}).length, 'players');
      console.log('[AI DEBUG] 🎭 PERSONA ASSIGNMENTS FOR SESSION', sessionId, ':');
      if (aiGameData.playerPersonas) {
        Object.entries(aiGameData.playerPersonas).forEach(([playerId, persona]) => {
          console.log('[AI DEBUG]   👤', playerId, '→', persona);
        });
      }
      if (userId && aiGameData.playerPersonas && aiGameData.playerPersonas[userId]) {
        console.log('[AI DEBUG] 🎯 REQUESTING USER', userId, 'GETS PERSONA:', aiGameData.playerPersonas[userId]);
      }
      res.json({ status: 'success', data: aiGameData });
    } else {
      console.log('[AI DEBUG] AI game data not found for key:', key);
      console.log('[AI DEBUG] ❌ Returning 404 to client - no AI game data found');
      res.status(404).json({ status: 'error', message: 'AI game data not found' });
    }
  } catch (error) {
    console.error('[AI DEBUG] Error fetching AI game data:', error);
    console.error('[AI DEBUG] 💥 Returning 500 error to client');
    res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error fetching AI game data'
    });
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

// Submit player response endpoint
router.post('/api/sessions/:sessionId/submit-response', async (req, res): Promise<void> => {
  const { sessionId } = req.params;
  const { response, persona, aiPersona, isTimeUp } = req.body;
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

    console.log('[SUBMIT RESPONSE] ===== NEW PLAYER RESPONSE SUBMISSION =====');
    console.log('[SUBMIT RESPONSE] Session ID:', sessionId);
    console.log('[SUBMIT RESPONSE] User:', redditUser.username, '(', userId, ')');
    console.log('[SUBMIT RESPONSE] Response:', response);
    console.log('[SUBMIT RESPONSE] User Persona:', persona);
    console.log('[SUBMIT RESPONSE] AI Persona:', aiPersona);
    console.log('[SUBMIT RESPONSE] Time Up:', isTimeUp);

    const sessionResponses = await storePlayerResponse({
      redis,
      sessionId,
      userId,
      username: redditUser.username,
      response,
      persona,
      aiPersona,
      isTimeUp: Boolean(isTimeUp),
    });

    res.json({ status: 'success', data: sessionResponses });
  } catch (error) {
    console.error('[SUBMIT RESPONSE] Error storing player response:', error);
    res.status(500).json({ 
      status: 'error', 
      message: error instanceof Error ? error.message : 'Unknown error storing response'
    });
  }
});

// Get all responses for a session
router.get('/api/sessions/:sessionId/responses', async (req, res): Promise<void> => {
  const { sessionId } = req.params;
  const redis = getRedis();
  
  try {
    const sessionResponses = await getSessionResponses({ redis, sessionId });
    
    if (!sessionResponses) {
      res.status(404).json({ status: 'error', message: 'No responses found for this session' });
      return;
    }

    res.json({ status: 'success', data: sessionResponses });
  } catch (error) {
    console.error('Error fetching session responses:', error);
    res.status(500).json({ 
      status: 'error', 
      message: error instanceof Error ? error.message : 'Unknown error fetching responses'
    });
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
    console.log(`[SESSION COMPLETE] User ${userId} attempting to complete session ${sessionId} with winner ${winnerUsername}`);
    const session = await sessionComplete({ redis, sessionId, winnerId, winnerUsername });
    console.log(`[SESSION COMPLETE] Session completion result: status=${session.status}, winner=${session.winnerUsername}`);
    res.json({ status: 'success', data: session });
  } catch (error) {
    console.error('Error completing session:', error);
    res.status(500).json({ 
      status: 'error', 
      message: error instanceof Error ? error.message : 'Unknown error completing session'
    });
  }
});

// Add after other session endpoints
router.get('/api/sessions/:sessionId/gemini-analysis', async (req, res) => {
  const { sessionId } = req.params;
  const redis = getRedis();
  
  console.log('[GEMINI ENDPOINT] Received request for Gemini analysis, session:', sessionId);
  
  if (!sessionId || typeof sessionId !== 'string') {
    console.error('[GEMINI ENDPOINT] Invalid sessionId provided');
    return res.status(400).json({ status: 'error', message: 'Invalid sessionId' });
  }
  
  try {
    console.log('[GEMINI ENDPOINT] Calling sendSessionDataToGemini...');
    const geminiResult = await sendSessionDataToGemini({ redis, sessionId });
    
    if (geminiResult) {
      console.log('[GEMINI ENDPOINT] ===== GEMINI EVALUATION RESULT =====');
      console.log('[GEMINI ENDPOINT] Winner:', geminiResult.winner);
      console.log('[GEMINI ENDPOINT] Reason:', geminiResult.reason);
      console.log('[GEMINI ENDPOINT] Full Evaluation:', JSON.stringify(geminiResult.evaluation, null, 2));
      console.log('[GEMINI ENDPOINT] ===== END EVALUATION RESULT =====');
      
      res.json({ 
        status: 'success', 
        data: { 
          winner: geminiResult.winner,
          reason: geminiResult.reason,
          evaluation: geminiResult.evaluation,
          geminiText: geminiResult.reason // For backward compatibility
        } 
      });
    } else {
      console.error('[GEMINI ENDPOINT] No result returned from Gemini');
      res.status(404).json({ status: 'error', message: 'No Gemini response available' });
    }
  } catch (error) {
    console.error('Error fetching Gemini analysis:', error);
    res.status(500).json({ status: 'error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// Test AI endpoint
router.get('/api/test-ai', async (req, res) => {
  console.log('[TEST AI] ===== STARTING AI TEST ENDPOINT =====');
  
  try {
    // Test external API call to Gemini
    const apiKey = 'AIzaSyBXU-jpevHk5-pdMrloXfmnGbNhSk6wAf0';
    
    if (!apiKey) {
      throw new Error('Missing Gemini API key');
    }
    
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${apiKey}`;
    
    const requestBody = {
      contents: [
        {
          parts: [
            {
              text: "Generate a creative AI persona for a guessing game. Respond with just the persona description in one sentence."
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.8,
        maxOutputTokens: 100,
        topP: 0.8,
        topK: 40
      }
    };

    console.log('[TEST AI] Making external API call to Gemini...');
    console.log('[TEST AI] URL:', url.split('?')[0] + '?key=***');
    
    const startTime = Date.now();
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Wheedle-Game-Test/1.0'
      },
      body: JSON.stringify(requestBody),
    });

    const duration = Date.now() - startTime;
    console.log('[TEST AI] API response received in', duration, 'ms');
    console.log('[TEST AI] Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[TEST AI] API error response:', errorText);
      throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
    }

    const responseData = await response.json();
    console.log('[TEST AI] API response structure:', {
      hasCandidates: !!responseData.candidates,
      candidatesLength: responseData.candidates?.length || 0,
    });

    // Extract the generated text
    const generatedText = responseData.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!generatedText) {
      console.error('[TEST AI] No generated text in response:', responseData);
      throw new Error('No generated text in Gemini response');
    }

    console.log('[TEST AI] Generated text:', generatedText);
    console.log('[TEST AI] ===== AI TEST COMPLETED SUCCESSFULLY =====');

    res.json({
      status: 'success',
      data: {
        summary: 'External AI API call successful',
        generatedText: generatedText.trim(),
        responseTime: `${duration}ms`,
        apiUsed: 'Google Gemini 1.5 Pro',
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('[TEST AI] Error in test endpoint:', error);
    console.error('[TEST AI] Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    
    res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error in AI test',
      details: {
        timestamp: new Date().toISOString(),
        errorType: error.constructor.name
      }
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