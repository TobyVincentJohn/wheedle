import { RedisClient } from '@devvit/redis';
import { GameSession, SessionPlayer } from '../../shared/types/session';

const getSessionKey = (sessionId: string) => `session:${sessionId}` as const;
const PUBLIC_SESSIONS_LIST_KEY = 'public_sessions_list' as const;
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
}: {
  redis: RedisClient;
  hostUserId: string;
  hostUsername: string;
  maxPlayers?: number;
}): Promise<GameSession> => {
  // Check if user is already in a session
  const existingSessionId = await redis.get(USER_SESSION_KEY(hostUserId));
  if (existingSessionId) {
    throw new Error('User is already in a session');
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
    status: 'waiting',
    createdAt: Date.now(),
    maxPlayers,
  };

  // Store session
  await redis.set(getSessionKey(sessionId), JSON.stringify(session));
  
  // Add to public sessions list
  const publicSessionsList = await redis.get(PUBLIC_SESSIONS_LIST_KEY);
  const publicSessions = publicSessionsList ? JSON.parse(publicSessionsList) as string[] : [];
  publicSessions.push(sessionId);
  await redis.set(PUBLIC_SESSIONS_LIST_KEY, JSON.stringify(publicSessions));

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
    throw new Error('User is already in a session');
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

  // Check if user is already in the session
  if (session.players.some(player => player.userId === userId)) {
    throw new Error('User is already in this session');
  }

  const newPlayer: SessionPlayer = {
    userId,
    username,
    joinedAt: Date.now(),
    isHost: false,
  };

  session.players.push(newPlayer);

  // If session is now full (6 players), automatically start countdown
  if (session.players.length === session.maxPlayers) {
    session.status = 'countdown';
    session.countdownStartedAt = Date.now();
  }

  // Update session
  await redis.set(getSessionKey(sessionId), JSON.stringify(session));
  
  // Map user to session
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
  if (!session) {
    return; // Session doesn't exist, nothing to do
  }

  // Remove player from session
  session.players = session.players.filter(player => player.userId !== userId);

  // Remove user session mapping
  await redis.del(USER_SESSION_KEY(userId));

  if (session.players.length === 0) {
    // Delete empty session
    await sessionDelete({ redis, sessionId });
  } else if (session.hostUserId === userId) {
    // Transfer host to another player
    const newHost = session.players[0];
    session.hostUserId = newHost.userId;
    session.hostUsername = newHost.username;
    newHost.isHost = true;
    
    // Update session
    await redis.set(getSessionKey(sessionId), JSON.stringify(session));
  } else if (session.players.length === 1) {
    // If only one player remains, end the session after a short delay
    // This gives time for the remaining player to see the notification
    setTimeout(async () => {
      const updatedSession = await sessionGet({ redis, sessionId });
      if (updatedSession && updatedSession.players.length === 1) {
        // Remove the last player's session mapping
        await redis.del(USER_SESSION_KEY(updatedSession.players[0].userId));
        // Delete the session
        await sessionDelete({ redis, sessionId });
      }
    }, 5000); // 5 second delay
    
    // Update session for now
    await redis.set(getSessionKey(sessionId), JSON.stringify(session));
  } else {
    // Update session
    await redis.set(getSessionKey(sessionId), JSON.stringify(session));
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
    // Remove all user session mappings
    for (const player of session.players) {
      await redis.del(USER_SESSION_KEY(player.userId));
    }
  }

  // Delete session
  await redis.del(getSessionKey(sessionId));

  // Remove from public sessions list
  const publicSessionsList = await redis.get(PUBLIC_SESSIONS_LIST_KEY);
  if (publicSessionsList) {
    const publicSessions = JSON.parse(publicSessionsList) as string[];
    const updatedSessions = publicSessions.filter(id => id !== sessionId);
    await redis.set(PUBLIC_SESSIONS_LIST_KEY, JSON.stringify(updatedSessions));
  }
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

  // Update session
  await redis.set(getSessionKey(sessionId), JSON.stringify(session));

  return session;
};

export const sessionStartGame = async ({
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

  if (session.status !== 'countdown') {
    throw new Error('Session is not in countdown state');
  }

  session.status = 'in-game';
  session.gameStartedAt = Date.now();

  // Update session
  await redis.set(getSessionKey(sessionId), JSON.stringify(session));

  // Remove from public sessions list (so new players can't join)
  const publicSessionsList = await redis.get(PUBLIC_SESSIONS_LIST_KEY);
  if (publicSessionsList) {
    const publicSessions = JSON.parse(publicSessionsList) as string[];
    const updatedSessions = publicSessions.filter(id => id !== sessionId);
    await redis.set(PUBLIC_SESSIONS_LIST_KEY, JSON.stringify(updatedSessions));
  }

  return session;
};

export const getPublicSessions = async ({
  redis,
}: {
  redis: RedisClient;
}): Promise<GameSession[]> => {
  const publicSessionsList = await redis.get(PUBLIC_SESSIONS_LIST_KEY);
  if (!publicSessionsList) {
    return [];
  }

  const sessionIds = JSON.parse(publicSessionsList) as string[];
  const sessions: GameSession[] = [];

  for (const sessionId of sessionIds) {
    const session = await sessionGet({ redis, sessionId });
    // Only show sessions that are waiting (not in countdown or in-game)
    if (session && session.status === 'waiting') {
      sessions.push(session);
    }
  }

  return sessions;
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