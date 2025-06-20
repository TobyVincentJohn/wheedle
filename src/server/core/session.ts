import { RedisClient } from '@devvit/redis';
import { GameSession, SessionPlayer } from '../../shared/types/session';
import { registerRoomCode, unregisterRoomCode } from './roomCodeSearch';
import { deleteAIGameData, fetchGeminiReply } from './aiService';

const getSessionKey = (sessionId: string) => `session:${sessionId}` as const;
const PUBLIC_SESSIONS_LIST_KEY = 'public_sessions_list' as const;
const PRIVATE_SESSIONS_LIST_KEY = 'private_sessions_list' as const;
const USER_SESSION_KEY = (userId: string) => `user_session:${userId}` as const;

// Generate a random 5-character session code
const generateSessionCode = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 5; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// Generate a unique session ID
const generateSessionId = (): string => {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

export const sessionCreate = async ({
  redis,
  hostUserId,
  hostUsername,
  maxPlayers = 6,
  isPrivate = false,
}: {
  redis: RedisClient;
  hostUserId: string;
  hostUsername: string;
  maxPlayers?: number;
  isPrivate?: boolean;
}): Promise<GameSession> => {
  // Check if user is already in a session
  const existingSessionId = await redis.get(USER_SESSION_KEY(hostUserId));
  if (existingSessionId) {
    // Check if the existing session actually exists
    const existingSession = await sessionGet({ redis, sessionId: existingSessionId });
    if (existingSession) {
      // Force leave the existing session before creating a new one
      console.log(`User ${hostUserId} is already in session ${existingSessionId}, forcing leave...`);
      await sessionLeave({ redis, sessionId: existingSessionId, userId: hostUserId });
    } else {
      // Clean up stale user session mapping
      await redis.del(USER_SESSION_KEY(hostUserId));
    }
  }

  const sessionId = generateSessionId();
  const sessionCode = generateSessionCode();

  const hostPlayer: SessionPlayer = {
    userId: hostUserId,
    username: hostUsername,
    joinedAt: Date.now(),
    isHost: true,
  };

  const session: GameSession = {
    sessionId,
    sessionCode,
    hostUserId,
    hostUsername,
    players: [hostPlayer],
    previousPlayers: [],
    status: 'waiting',
    createdAt: Date.now(),
    maxPlayers,
    isPrivate,
  };

  // Store session
  await redis.set(getSessionKey(sessionId), JSON.stringify(session));
  
  // Register room code
  await registerRoomCode({
    redis,
    sessionCode,
    sessionId,
    isPrivate,
  });
  
  // Add to appropriate sessions list based on type
  if (isPrivate) {
    const privateSessionsList = await redis.get(PRIVATE_SESSIONS_LIST_KEY);
    const privateSessions = privateSessionsList ? JSON.parse(privateSessionsList) as string[] : [];
    privateSessions.push(sessionId);
    await redis.set(PRIVATE_SESSIONS_LIST_KEY, JSON.stringify(privateSessions));
  } else {
    const publicSessionsList = await redis.get(PUBLIC_SESSIONS_LIST_KEY);
    const publicSessions = publicSessionsList ? JSON.parse(publicSessionsList) as string[] : [];
    publicSessions.push(sessionId);
    await redis.set(PUBLIC_SESSIONS_LIST_KEY, JSON.stringify(publicSessions));
  }

  // Map user to session
  await redis.set(USER_SESSION_KEY(hostUserId), sessionId);

  return session;
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
  // Check if user is already in a session
  const existingSessionId = await redis.get(USER_SESSION_KEY(userId));
  if (existingSessionId) {
    // Check if the existing session actually exists
    const existingSession = await sessionGet({ redis, sessionId: existingSessionId });
    if (existingSession) {
      // Force leave the existing session before joining a new one
      console.log(`User ${userId} is already in session ${existingSessionId}, forcing leave...`);
      await sessionLeave({ redis, sessionId: existingSessionId, userId });
    } else {
      // Clean up stale user session mapping
      await redis.del(USER_SESSION_KEY(userId));
    }
  }

  const session = await sessionGet({ redis, sessionId });
  if (!session) {
    throw new Error('Session not found');
  }

  if (session.status !== 'waiting') {
    throw new Error('Session is not accepting new players');
  }

  if (session.players.length >= session.maxPlayers) {
    throw new Error('Session is full');
  }

  // Check if user was previously in this session
  const previousPlayerIndex = session.previousPlayers.findIndex(p => p.userId === userId);
  let wasHost = false;

  if (previousPlayerIndex !== -1) {
    // User was previously in this session
    const previousPlayer = session.previousPlayers[previousPlayerIndex];
    if (previousPlayer) {
      wasHost = previousPlayer.wasHost || false;
      
      // Remove from previousPlayers
      session.previousPlayers.splice(previousPlayerIndex, 1);
    }
  }

  // Add player to session
  const newPlayer: SessionPlayer = {
    userId,
    username,
    joinedAt: Date.now(),
    isHost: false,
    wasHost,
  };

  session.players.push(newPlayer);
  
  // Update session
  await redis.set(getSessionKey(sessionId), JSON.stringify(session));
  await redis.set(USER_SESSION_KEY(userId), sessionId);

  // Update session in appropriate list to ensure it's visible
  if (!session.isPrivate) {
    const publicSessionsList = await redis.get(PUBLIC_SESSIONS_LIST_KEY);
    const publicSessions = publicSessionsList ? JSON.parse(publicSessionsList) as string[] : [];
    if (!publicSessions.includes(sessionId)) {
      publicSessions.push(sessionId);
      await redis.set(PUBLIC_SESSIONS_LIST_KEY, JSON.stringify(publicSessions));
    }
  } else {
    const privateSessionsList = await redis.get(PRIVATE_SESSIONS_LIST_KEY);
    const privateSessions = privateSessionsList ? JSON.parse(privateSessionsList) as string[] : [];
    if (!privateSessions.includes(sessionId)) {
      privateSessions.push(sessionId);
      await redis.set(PRIVATE_SESSIONS_LIST_KEY, JSON.stringify(privateSessions));
    }
  }

  return session;
};

// Modified leave function
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
  if (!session) {
    return; // Session doesn't exist, nothing to do
  }

  // Get user data for username
  const userKey = `user:${userId}`;
  const userData = await redis.get(userKey);

  if (!userData) {
    throw new Error('User data not found');
  }

  interface UserData {
    username: string;
  }

  const user = JSON.parse(userData) as UserData;

  // Remove player from session and get the removed player if any
  const oldPlayers = [...session.players];
  session.players = oldPlayers.filter(player => player.userId !== userId);
  const removedPlayer = oldPlayers.find(player => player.userId === userId);

  // If game hasn't started, add player to previousPlayers
  if (session.status === 'waiting') {
    const playerToMove: SessionPlayer = {
      userId,
      username: user.username,
      joinedAt: Date.now(),
      isHost: false,
      wasHost: removedPlayer?.isHost || false,
    };
    session.previousPlayers.push(playerToMove);
  }

  // If there are still players and this was the host
  const wasHost = session.hostUserId === userId;
  if (session.players.length > 0 && wasHost) {
    // Find the player who was previously a host, if any
    const newHost = session.players.find(p => p.wasHost) || session.players[0];
    if (newHost) {
      session.hostUserId = newHost.userId;
      session.hostUsername = newHost.username;
      newHost.isHost = true;
      newHost.wasHost = false; // Clear wasHost as they're now the active host
    }
  }

  // Remove user session mapping
  await redis.del(USER_SESSION_KEY(userId));

  if (session.players.length === 0) {
    // Delete empty session
    await sessionDelete({ redis, sessionId });
  } else if (session.players.length === 1 && (session.status === 'in-game' || session.status === 'countdown')) {
    // Last player remaining - end the game
    await sessionDelete({ redis, sessionId });
  } else {
    // Update session
    await redis.set(getSessionKey(sessionId), JSON.stringify(session));
    
    // Update session in appropriate list to ensure it's visible
    if (!session.isPrivate) {
      const publicSessionsList = await redis.get(PUBLIC_SESSIONS_LIST_KEY);
      const publicSessions = publicSessionsList ? JSON.parse(publicSessionsList) as string[] : [];
      if (!publicSessions.includes(sessionId)) {
        publicSessions.push(sessionId);
        await redis.set(PUBLIC_SESSIONS_LIST_KEY, JSON.stringify(publicSessions));
      }
    } else {
      const privateSessionsList = await redis.get(PRIVATE_SESSIONS_LIST_KEY);
      const privateSessions = privateSessionsList ? JSON.parse(privateSessionsList) as string[] : [];
      if (!privateSessions.includes(sessionId)) {
        privateSessions.push(sessionId);
        await redis.set(PRIVATE_SESSIONS_LIST_KEY, JSON.stringify(privateSessions));
      }
    }
  }
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
    // Unregister room code first
    await unregisterRoomCode({ redis, sessionCode: session.sessionCode });
    
    // Then, delete AI game data
    await deleteAIGameData({ redis, sessionId });

    // Remove all user session mappings
    for (const player of session.players) {
      await redis.del(USER_SESSION_KEY(player.userId));
    }

    // Remove from appropriate sessions list based on type
    if (session.isPrivate) {
      const privateSessionsList = await redis.get(PRIVATE_SESSIONS_LIST_KEY);
      if (privateSessionsList) {
        const privateSessions = JSON.parse(privateSessionsList) as string[];
        const updatedSessions = privateSessions.filter(id => id !== sessionId);
        await redis.set(PRIVATE_SESSIONS_LIST_KEY, JSON.stringify(updatedSessions));
      }
    } else {
      const publicSessionsList = await redis.get(PUBLIC_SESSIONS_LIST_KEY);
      if (publicSessionsList) {
        const publicSessions = JSON.parse(publicSessionsList) as string[];
        const updatedSessions = publicSessions.filter(id => id !== sessionId);
        await redis.set(PUBLIC_SESSIONS_LIST_KEY, JSON.stringify(updatedSessions));
      }
    }
  }

  // Delete session
  await redis.del(getSessionKey(sessionId));
};

export const sessionStartCountdown = async ({
  redis,
  sessionId,
}: {
  redis: RedisClient;
  sessionId: string;
}): Promise<GameSession> => {
  const session = await sessionGet({ redis, sessionId });
  if (!session) {
    throw new Error('Session not found');
  }

  if (session.status !== 'waiting') {
    throw new Error('Session is not in waiting state');
  }

  if (session.players.length < 2) {
    throw new Error('Need at least 2 players to start');
  }

  session.status = 'countdown';
  session.countdownStartedAt = Date.now();
  
  // Assign a random dealer for this session when countdown starts (1-8)
  if (!session.dealerId) {
    session.dealerId = Math.floor(Math.random() * 8) + 1;
  }

  // Update session
  await redis.set(getSessionKey(sessionId), JSON.stringify(session));

  return session;
};

export const sessionStartGame = async ({
  redis,
  sessionId,
  settings,
}: {
  redis: RedisClient;
  sessionId: string;
  settings: any;
}): Promise<GameSession> => {
  const session = await sessionGet({ redis, sessionId });
  if (!session) {
    throw new Error('Session not found');
  }

  if (session.status !== 'countdown') {
    throw new Error('Session is not in countdown state');
  }

  session.status = 'in-game';
  session.gameStartedAt = Date.now();
  
  // Assign a random dealer for this session if not already set
  if (!session.dealerId) {
    session.dealerId = Math.floor(Math.random() * 8) + 1;
  }

  // Update session
  await redis.set(getSessionKey(sessionId), JSON.stringify(session));

  // Remove from appropriate sessions list (so new players can't join)
  if (session.isPrivate) {
    const privateSessionsList = await redis.get(PRIVATE_SESSIONS_LIST_KEY);
    if (privateSessionsList) {
      const privateSessions = JSON.parse(privateSessionsList) as string[];
      const updatedSessions = privateSessions.filter(id => id !== sessionId);
      await redis.set(PRIVATE_SESSIONS_LIST_KEY, JSON.stringify(updatedSessions));
    }
  } else {
    const publicSessionsList = await redis.get(PUBLIC_SESSIONS_LIST_KEY);
    if (publicSessionsList) {
      const publicSessions = JSON.parse(publicSessionsList) as string[];
      const updatedSessions = publicSessions.filter(id => id !== sessionId);
      await redis.set(PUBLIC_SESSIONS_LIST_KEY, JSON.stringify(updatedSessions));
    }
  }

  return session;
};

export const getPublicSessions = async ({
  redis,
}: {
  redis: RedisClient;
}): Promise<GameSession[]> => {
  try {
    const publicSessionsList = await redis.get(PUBLIC_SESSIONS_LIST_KEY);
    if (!publicSessionsList) {
      return [];
    }

    const sessionIds = JSON.parse(publicSessionsList) as string[];
    const sessions: GameSession[] = [];
    const validSessionIds: string[] = [];

    for (const sessionId of sessionIds) {
      try {
        const session = await sessionGet({ redis, sessionId });
        // Only show sessions that are waiting and explicitly NOT private
        if (session && session.status === 'waiting' && !session.isPrivate) {
          sessions.push(session);
          validSessionIds.push(sessionId);
        }
      } catch (parseError) {
        console.error('Error parsing session data:', parseError);
        // Skip invalid sessions
      }
    }

    // Clean up the list if we found invalid sessions
    if (validSessionIds.length !== sessionIds.length) {
      await redis.set(PUBLIC_SESSIONS_LIST_KEY, JSON.stringify(validSessionIds));
    }

    // Sort by creation time (newest first)
    return sessions.sort((a, b) => b.createdAt - a.createdAt);
  } catch (error) {
    console.error('Error fetching public sessions:', error);
    return [];
  }
};

export const getPrivateSessions = async ({
  redis,
}: {
  redis: RedisClient;
}): Promise<GameSession[]> => {
  try {
    const privateSessionsList = await redis.get(PRIVATE_SESSIONS_LIST_KEY);
    if (!privateSessionsList) {
      return [];
    }

    const sessionIds = JSON.parse(privateSessionsList) as string[];
    const sessions: GameSession[] = [];
    const validSessionIds: string[] = [];

    for (const sessionId of sessionIds) {
      try {
        const session = await sessionGet({ redis, sessionId });
        // Only show sessions that are waiting and explicitly private
        if (session && session.status === 'waiting' && session.isPrivate) {
          sessions.push(session);
          validSessionIds.push(sessionId);
        }
      } catch (parseError) {
        console.error('Error parsing session data:', parseError);
        // Skip invalid sessions
      }
    }

    // Clean up the list if we found invalid sessions
    if (validSessionIds.length !== sessionIds.length) {
      await redis.set(PRIVATE_SESSIONS_LIST_KEY, JSON.stringify(validSessionIds));
    }

    // Sort by creation time (newest first)
    return sessions.sort((a, b) => b.createdAt - a.createdAt);
  } catch (error) {
    console.error('Error fetching private sessions:', error);
    return [];
  }
};

export const getUserCurrentSession = async ({
  redis,
  userId,
}: {
  redis: RedisClient;
  userId: string;
}): Promise<GameSession | null> => {
  const sessionId = await redis.get(USER_SESSION_KEY(userId));
  if (!sessionId) {
    return null;
  }

  return await sessionGet({ redis, sessionId });
};