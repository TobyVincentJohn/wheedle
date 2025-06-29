import { RedisClient } from '@devvit/redis';
import { GameSession, SessionPlayer } from '../../shared/types/session';
import { registerRoomCode, unregisterRoomCode } from './roomCodeSearch';
import { createAIGameData, deleteAIGameData } from './aiService';
import { deleteSessionResponses } from './playerResponses';
import { incrementUserWins } from './user';

// Helper to clean up winner results
const getWinnerResultKey = (sessionId: string) => `winner_result:${sessionId}` as const;

// Helper functions
const getSessionKey = (sessionId: string) => `session:${sessionId}` as const;
const USER_SESSION_KEY = (userId: string) => `user_session:${userId}` as const;
const PUBLIC_SESSIONS_LIST_KEY = 'public_sessions_list' as const;
const PRIVATE_SESSIONS_LIST_KEY = 'private_sessions_list' as const;
const SESSION_DELETION_TIMER_KEY = (sessionId: string) => `session_deletion_timer:${sessionId}` as const;

function generateRandomSuffix(length: number) {
  const letters = 'abcdefghijklmnopqrstuvwxyz';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += letters.charAt(Math.floor(Math.random() * letters.length));
  }
  return result;
}

const generateSessionId = () => `session_${Date.now()}_${generateRandomSuffix(8)}`;

const generateSessionCode = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 5; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};


// Session core functions
export const sessionCreate = async ({
  redis,
  host,
  maxPlayers,
  isPrivate,
}: {
  redis: RedisClient;
  host: { userId: string; username: string };
  maxPlayers: number;
  isPrivate: boolean;
}): Promise<GameSession> => {
  const sessionId = generateSessionId();
  const sessionCode = generateSessionCode();

  const newSession: GameSession = {
    sessionId,
    sessionCode,
    maxPlayers,
    isPrivate,
    status: 'waiting',
    createdAt: Date.now(),
    players: [{
      userId: host.userId,
      username: host.username,
      isHost: true,
      joinedAt: Date.now(),
    }],
    previousPlayers: [],
    host,
    dealerId: Math.floor(Math.random() * 8) + 1,
  };

  await redis.set(getSessionKey(sessionId), JSON.stringify(newSession));
  await registerRoomCode({ redis, sessionCode, sessionId, isPrivate });
  await redis.set(USER_SESSION_KEY(host.userId), sessionId);
  
  const listKey = isPrivate ? PRIVATE_SESSIONS_LIST_KEY : PUBLIC_SESSIONS_LIST_KEY;
  const sessionsList = await redis.get(listKey);
  const sessions = sessionsList ? JSON.parse(sessionsList) as string[] : [];
  sessions.push(sessionId);
  await redis.set(listKey, JSON.stringify(sessions));

  return newSession;
};

export const sessionGet = async ({
  redis,
  sessionId,
}: {
  redis: RedisClient;
  sessionId: string;
}): Promise<GameSession | null> => {
  const data = await redis.get(getSessionKey(sessionId));
  return data ? JSON.parse(data) : null;
};

export const sessionJoin = async ({
  redis,
  sessionId,
  userId,
  username,
}: {
  redis: RedisClient;
  sessionId: string;
  userId: string;
  username: string;
}): Promise<GameSession> => {
  const session = await sessionGet({ redis, sessionId });

  if (!session) throw new Error('Session not found');
  if (session.status !== 'waiting') throw new Error('Session has already started');
  if (session.players.length >= session.maxPlayers) throw new Error('Session is full');
  if (session.players.some(p => p.userId === userId)) return session;

  const newPlayer: SessionPlayer = { userId, username, isHost: false, joinedAt: Date.now() };
  session.players.push(newPlayer);
  
  await redis.set(getSessionKey(sessionId), JSON.stringify(session));
  await redis.set(USER_SESSION_KEY(userId), sessionId);

  return session;
};

export const sessionLeave = async ({
  redis,
  sessionId,
  userId,
}: {
  redis: RedisClient;
  sessionId: string;
  userId: string;
}): Promise<void> => {
  const session = await sessionGet({ redis, sessionId });
  if (!session) return;

  const playerIndex = session.players.findIndex(p => p.userId === userId);
  if (playerIndex === -1) return;

  const leavingPlayer = session.players[playerIndex];
  if (!leavingPlayer) return;

  session.players.splice(playerIndex, 1);
  session.previousPlayers.push(leavingPlayer);

  if (session.players.length === 0) {
    await sessionDelete({ redis, sessionId });
    return;
  }

  if (leavingPlayer.isHost && session.players[0]) {
    session.players[0].isHost = true;
    session.host = { userId: session.players[0].userId, username: session.players[0].username };
  }

  await redis.set(getSessionKey(sessionId), JSON.stringify(session));
  await redis.del(USER_SESSION_KEY(userId));
};

export const sessionStartCountdown = async ({
  redis,
  sessionId,
}: {
  redis: RedisClient;
  sessionId: string;
}): Promise<{ session: GameSession; aiGameData: any }> => {
  const session = await sessionGet({ redis, sessionId });
  if (!session) throw new Error('Session not found');
  if (session.status !== 'waiting') throw new Error('Session is not in a waiting state');

  console.log('[SESSION DEBUG] 🚀 Starting countdown for session:', sessionId);
  console.log('[SESSION DEBUG] 👥 Players in session:', session.players.map(p => `${p.username} (${p.userId})`));

  session.status = 'countdown';
  session.countdownStartedAt = Date.now();
  await redis.set(getSessionKey(sessionId), JSON.stringify(session));

  // Generate AI game data synchronously
  console.log('[SESSION DEBUG] 🎲 About to generate AI game data...');
  const aiGameData = await createAIGameData({ redis, sessionId });
  console.log('[SESSION DEBUG] ✅ AI game data generation completed');
  console.log('[SESSION DEBUG] 🎭 Generated personas for players:', Object.keys(aiGameData.playerPersonas || {}));
  
  // 🎯 CONSOLIDATED SESSION PERSONA LOGGING - Like user data format
  console.log('[SESSION PERSONAS] ===== SESSION COUNTDOWN PERSONA ASSIGNMENT =====');
  console.log('[SESSION PERSONAS] Session Persona Data:');
  console.log('[SESSION PERSONAS]', {
    status: 'success',
    data: {
      sessionId: sessionId,
      sessionStatus: session.status,
      totalPlayers: session.players.length,
      playerList: session.players.map(p => ({ userId: p.userId, username: p.username })),
      aiPersona: aiGameData.aiPersona,
      playerPersonas: aiGameData.playerPersonas,
      countdownStartedAt: session.countdownStartedAt
    }
  });
  console.log('[SESSION PERSONAS] ===== END SESSION PERSONA DATA =====');

  (async () => {
    try {
      await new Promise(resolve => setTimeout(resolve, 10000));
      await sessionStartGame({ redis, sessionId });
    } catch (error) {
      console.error(`Failed to auto-start game for session ${sessionId}:`, error);
      try {
        const currentSession = await sessionGet({ redis, sessionId });
        if (currentSession?.status === 'countdown') {
          currentSession.status = 'waiting';
          delete currentSession.countdownStartedAt;
          await redis.set(getSessionKey(sessionId), JSON.stringify(currentSession));
        }
      } catch (cleanupError) {
        console.error(`Failed to cleanup session ${sessionId}:`, cleanupError);
      }
    }
  })().catch(console.error);

  return { session, aiGameData };
};

export const sessionStartGame = async ({
  redis,
  sessionId,
}: {
  redis: RedisClient;
  sessionId: string;
}): Promise<{ session: GameSession; aiGameData: any }> => {
  const session = await sessionGet({ redis, sessionId });
  if (!session) throw new Error('Session not found');
  if (session.status !== 'countdown') throw new Error('Session is not in countdown state');

  console.log('[SESSION DEBUG] 🎮 Starting game for session:', sessionId);
  console.log('[SESSION DEBUG] 👥 Players in game:', session.players.map(p => `${p.username} (${p.userId})`));

  session.status = 'in-game';
  session.gameStartedAt = Date.now();
  await redis.set(getSessionKey(sessionId), JSON.stringify(session));

  // Generate AI game data synchronously
  console.log('[SESSION DEBUG] 🎲 About to generate/retrieve AI game data...');
  const aiGameData = await createAIGameData({ redis, sessionId });
  console.log('[SESSION DEBUG] ✅ AI game data ready for game');
  console.log('[SESSION DEBUG] 🎭 Player personas ready:', Object.keys(aiGameData.playerPersonas || {}));

  return { session, aiGameData };
};

export const sessionComplete = async ({
  redis,
  sessionId,
  winnerId,
  winnerUsername,
}: {
  redis: RedisClient;
  sessionId: string;
  winnerId: string;
  winnerUsername?: string;
}): Promise<GameSession> => {
  const session = await sessionGet({ redis, sessionId });
  if (!session) throw new Error('Session not found');

  const winner = session.players.find(p => p.userId === winnerId);
  if (!winner) throw new Error('Winner not found in session');

  session.status = 'complete';
  session.completedAt = Date.now();
  session.winnerId = winnerId;
  session.winnerUsername = winner.username;
  
  // Increment winner's wins count
  try {
    await incrementUserWins({ redis, userId: winnerId });
    console.log(`[SESSION] Incremented wins for winner: ${winner.username} (${winnerId})`);
  } catch (error) {
    console.error(`[SESSION] Failed to increment wins for winner: ${error}`);
  }
  
  await redis.set(getSessionKey(sessionId), JSON.stringify(session));
  return session;
};

export const sessionDelete = async ({
  redis,
  sessionId,
}: {
  redis: RedisClient;
  sessionId: string;
}): Promise<void> => {
  const session = await sessionGet({ redis, sessionId });
  if (session) {
    await unregisterRoomCode({ redis, sessionCode: session.sessionCode });
    await deleteAIGameData({ redis, sessionId });
    await deleteSessionResponses({ redis, sessionId });
    await redis.del(getWinnerResultKey(sessionId)); // Clean up winner results

    for (const player of session.players) {
      await redis.del(USER_SESSION_KEY(player.userId));
    }

    const listKey = session.isPrivate ? PRIVATE_SESSIONS_LIST_KEY : PUBLIC_SESSIONS_LIST_KEY;
    const sessionsList = await redis.get(listKey);
    if (sessionsList) {
      const sessions = JSON.parse(sessionsList) as string[];
      const updatedSessions = sessions.filter(id => id !== sessionId);
      await redis.set(listKey, JSON.stringify(updatedSessions));
    }
  }

  await redis.del(getSessionKey(sessionId));
  await redis.del(SESSION_DELETION_TIMER_KEY(sessionId));
};

export const getPublicSessions = async ({
  redis,
}: {
  redis: RedisClient;
}): Promise<GameSession[]> => {
  const publicSessionsList = await redis.get(PUBLIC_SESSIONS_LIST_KEY);
  if (!publicSessionsList) return [];

  const sessionIds = JSON.parse(publicSessionsList) as string[];
  const sessions: GameSession[] = [];
  const validSessionIds: string[] = [];

  for (const sessionId of sessionIds) {
    try {
      const session = await sessionGet({ redis, sessionId });
      if (session && !session.isPrivate && ['waiting', 'countdown', 'in-game'].includes(session.status)) {
        sessions.push(session);
        validSessionIds.push(sessionId);
      }
    } catch (error) {
      console.error('Error parsing session data:', error);
    }
  }

  if (validSessionIds.length !== sessionIds.length) {
    await redis.set(PUBLIC_SESSIONS_LIST_KEY, JSON.stringify(validSessionIds));
  }

  return sessions.sort((a, b) => b.createdAt - a.createdAt);
};

export const getUserCurrentSession = async ({
  redis,
  userId,
}: {
  redis: RedisClient;
  userId: string;
}): Promise<GameSession | null> => {
  const sessionId = await redis.get(USER_SESSION_KEY(userId));
  if (!sessionId) return null;
  return sessionGet({ redis, sessionId });
};