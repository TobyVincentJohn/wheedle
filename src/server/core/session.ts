import { RedisClient } from '@devvit/redis';
import { GameSession, SessionPlayer } from '../../shared/types/session';
import { registerRoomCode, unregisterRoomCode } from './roomCodeSearch';

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
    throw new Error('User is already in a session');
  }

  // Check user's money before creating session
  const userKey = `user:${hostUserId}`;
  const userData = await redis.get(userKey);
  if (!userData) {
    throw new Error('User not found');
  }
  
  const user = JSON.parse(userData);
  if (user.money < 100) {
    throw new Error('Insufficient funds. You need at least $100 to create a game.');
  }
  
  // Deduct entry fee from user's total money and set money in hand
  user.money -= 100;
  user.moneyInHand = 100;
  await redis.set(userKey, JSON.stringify(user));
  
  const sessionId = generateSessionId();
  const sessionCode = generateSessionCode();

  const hostPlayer: SessionPlayer = {
    userId: hostUserId,
    username: hostUsername,
    joinedAt: Date.now(),
    isHost: true,
    moneyCommitted: 100,
    hasPlacedMinimumBet: false,
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
    isPrivate,
    prizePool: 0,
    entryFee: 100,
    minimumBet: 10,
  };

  // Store session
  await redis.set(getSessionKey(sessionId), JSON.stringify(session));
  
  // Initialize previous players list with host
  await redis.set(`previous_players:${sessionId}`, JSON.stringify([hostUserId]));
  
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
    throw new Error('User is already in a session');
  }

  // Check user's money before joining
  const userKey = `user:${userId}`;
  const userData = await redis.get(userKey);
  if (!userData) {
    throw new Error('User not found');
  }
  
  const user = JSON.parse(userData);
  if (user.money < 100) {
    throw new Error('Insufficient funds. You need at least $100 to join a game.');
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
  if (session.players.some(p => p.userId === userId)) {
    throw new Error('User is already in this session');
  }
  // Deduct entry fee from user's total money and set money in hand
  user.money -= 100;
  user.moneyInHand = 100;
  await redis.set(userKey, JSON.stringify(user));

  const newPlayer: SessionPlayer = {
    userId,
    username,
    joinedAt: Date.now(),
    isHost: false,
    moneyCommitted: 100,
    hasPlacedMinimumBet: false,
  };

  session.players.push(newPlayer);

  // Add to previous players list
  const previousPlayers = await redis.get(`previous_players:${sessionId}`);
  const playerIds = previousPlayers ? JSON.parse(previousPlayers) as string[] : [];
  if (!playerIds.includes(userId)) {
    playerIds.push(userId);
    await redis.set(`previous_players:${sessionId}`, JSON.stringify(playerIds));
  }

  // Update session
  await redis.set(getSessionKey(sessionId), JSON.stringify(session));

  // Map user to session
  await redis.set(USER_SESSION_KEY(userId), sessionId);

  return session;
};

// New function to handle money transactions when joining a game
export const sessionJoinWithMoney = async ({
  redis,
  sessionId,
  userId,
  username,
}: {
  redis: RedisClient;
  sessionId: string;
  userId: string;
  username: string;
}): Promise<{ session: GameSession; userMoney: number }> => {
  // Get user's current money
  const userKey = `user:${userId}`;
  const userData = await redis.get(userKey);
  if (!userData) {
    throw new Error('User not found');
  }
  
  const user = JSON.parse(userData);
  if (user.money < 100) {
    throw new Error('Insufficient funds. You need at least $100 to join a game.');
  }
  
  // Join the session first
  const session = await sessionJoin({ redis, sessionId, userId, username });
  
  // Deduct entry fee from user's money
  user.money -= 100;
  user.moneyInHand = 100;
  await redis.set(userKey, JSON.stringify(user));
  
  // Update player's committed money in session
  const playerIndex = session.players.findIndex(p => p.userId === userId);
  if (playerIndex !== -1) {
    session.players[playerIndex].moneyCommitted = 100;
  }
  
  // Update session
  await redis.set(`session:${sessionId}`, JSON.stringify(session));
  
  return { session, userMoney: user.money };
};

// New function to handle money when placing minimum bet
export const sessionPlaceMinimumBet = async ({
  redis,
  sessionId,
  userId,
}: {
  redis: RedisClient;
  sessionId: string;
  userId: string;
}): Promise<GameSession> => {
  const session = await sessionGet({ redis, sessionId });
  if (!session) {
    throw new Error('Session not found');
  }
  
  const playerIndex = session.players.findIndex(p => p.userId === userId);
  if (playerIndex === -1) {
    throw new Error('Player not found in session');
  }
  
  const player = session.players[playerIndex];
  if (player.hasPlacedMinimumBet) {
    throw new Error('Minimum bet already placed');
  }
  
  if (player.moneyCommitted < session.minimumBet) {
    throw new Error('Insufficient money committed to place minimum bet');
  }
  
  // Place minimum bet
  player.hasPlacedMinimumBet = true;
  session.prizePool += session.minimumBet;
  
  // Update session
  await redis.set(`session:${sessionId}`, JSON.stringify(session));
  
  return session;
};

// Modified leave function to handle money returns
export const sessionLeave = async ({
  redis,
  sessionId,
  userId,
}: {
  redis: RedisClient;
  sessionId: string;
  userId: string;
}): Promise<GameSession> => {
  const session = await sessionGet({ redis, sessionId });
  if (!session) {
    throw new Error('Session not found');
  }

  // Only allow leaving if the game hasn't started
  if (session.status !== 'waiting') {
    throw new Error('Cannot leave session after game has started');
  }

  // Remove player from session
  session.players = session.players.filter(p => p.userId !== userId);

  // If this was the last player, delete the session
  if (session.players.length === 0) {
    await sessionDelete({ redis, sessionId });
    await redis.del(USER_SESSION_KEY(userId));
    return session;
  }

  // If the host left, assign a new host
  if (userId === session.hostUserId && session.players.length > 0) {
    const newHost = session.players[0];
    if (newHost) {
      session.hostUserId = newHost.userId;
      session.hostUsername = newHost.username;
      newHost.isHost = true;
    }
  }

  // Update session
  await redis.set(getSessionKey(sessionId), JSON.stringify(session));

  // Remove user's session mapping
  await redis.del(USER_SESSION_KEY(userId));

  // Return money to the user
  const userKey = `user:${userId}`;
  const userData = await redis.get(userKey);
  if (userData) {
    const user = JSON.parse(userData);
    if (user && typeof user.money === 'number') {
      user.money += 100; // Return the entry fee
      await redis.set(userKey, JSON.stringify(user));
    }
  }

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
    // Unregister room code
    await unregisterRoomCode({ redis, sessionCode: session.sessionCode });
    
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
  
  // All players must place minimum bet when countdown starts
  for (const player of session.players) {
    if (!player.hasPlacedMinimumBet) {
      player.hasPlacedMinimumBet = true;
      session.prizePool += session.minimumBet;
      
      // Update user's money in hand
      const userKey = `user:${player.userId}`;
      const userData = await redis.get(userKey);
      if (userData) {
        const user = JSON.parse(userData);
        user.moneyInHand = 90; // 100 - 10 minimum bet
        await redis.set(userKey, JSON.stringify(user));
      }
    }
  }
  
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

  // Only keep session mappings for active players
  const currentPlayerIds = new Set(session.players.map((p: SessionPlayer) => p.userId));
  
  // For each player that was in the session but is not anymore, remove their mapping
  const previousPlayers = await redis.get(`previous_players:${sessionId}`);
  if (previousPlayers) {
    const playerIds = JSON.parse(previousPlayers) as string[];
    for (const playerId of playerIds) {
      if (!currentPlayerIds.has(playerId)) {
        await redis.del(USER_SESSION_KEY(playerId));
      }
    }
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
    // Only show sessions that are waiting and explicitly NOT private
    if (session && session.status === 'waiting' && !session.isPrivate) {
      sessions.push(session);
    }
  }

  return sessions;
};

export const getPrivateSessions = async ({
  redis,
}: {
  redis: RedisClient;
}): Promise<GameSession[]> => {
  const privateSessionsList = await redis.get(PRIVATE_SESSIONS_LIST_KEY);
  if (!privateSessionsList) {
    return [];
  }

  const sessionIds = JSON.parse(privateSessionsList) as string[];
  const sessions: GameSession[] = [];

  for (const sessionId of sessionIds) {
    const session = await sessionGet({ redis, sessionId });
    // Only show sessions that are waiting and explicitly private
    if (session && session.status === 'waiting' && session.isPrivate) {
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