import { RedisClient } from '@devvit/redis';
import { GameSession, SessionPlayer } from '../../shared/types/session';
import { registerRoomCode, unregisterRoomCode } from './roomCodeSearch';
import { deleteAIGameData } from './aiService';

const getSessionKey = (sessionId: string) => `session:${sessionId}` as const;
const PUBLIC_SESSIONS_HASH_KEY = 'public_sessions_hash' as const;
const PRIVATE_SESSIONS_HASH_KEY = 'private_sessions_hash' as const;
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
    previousPlayers: [],
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
  
  // Register room code
  await registerRoomCode({
    redis,
    sessionCode,
    sessionId,
    isPrivate,
  });
  
  // Add session to appropriate hash using hSet
  if (isPrivate) {
    await redis.hSet(PRIVATE_SESSIONS_HASH_KEY, sessionId, JSON.stringify(session));
  } else {
    await redis.hSet(PUBLIC_SESSIONS_HASH_KEY, sessionId, JSON.stringify(session));
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

  // Check user's money before joining
  const userKey = `user:${userId}`;
  const userData = await redis.get(userKey);
  if (!userData) {
    throw new Error('User not found');
  }
  
  const user = JSON.parse(userData);
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
  let moneyAlreadyCommitted = 0;

  if (previousPlayerIndex !== -1) {
    // User was previously in this session
    const previousPlayer = session.previousPlayers[previousPlayerIndex];
    if (previousPlayer) {
      wasHost = previousPlayer.wasHost || false;
      moneyAlreadyCommitted = previousPlayer.moneyCommitted;
      
      // Remove from previousPlayers
      session.previousPlayers.splice(previousPlayerIndex, 1);
    }
  } else {
    // New player joining - check money
    if (user.money < 100) {
      throw new Error('Insufficient funds. You need at least $100 to join a game.');
    }
    // Deduct entry fee from user's total money and set money in hand
    user.money -= 100;
    user.moneyInHand = 100;
    await redis.set(userKey, JSON.stringify(user));
  }

  // Add player to session
  const newPlayer: SessionPlayer = {
    userId,
    username,
    joinedAt: Date.now(),
    isHost: false,
    wasHost,
    moneyCommitted: moneyAlreadyCommitted || 100,
    hasPlacedMinimumBet: false,
  };

  session.players.push(newPlayer);
  
  // Update session
  await redis.set(getSessionKey(sessionId), JSON.stringify(session));
  await redis.set(USER_SESSION_KEY(userId), sessionId);

  // Update session in appropriate hash
  if (session.isPrivate) {
    await redis.hSet(PRIVATE_SESSIONS_HASH_KEY, sessionId, JSON.stringify(session));
  } else {
    await redis.hSet(PUBLIC_SESSIONS_HASH_KEY, sessionId, JSON.stringify(session));
  }

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
}): Promise<{ moneyReturned: number }> => {
  const session = await sessionGet({ redis, sessionId });
  if (!session) {
    return { moneyReturned: 0 }; // Session doesn't exist, nothing to do
  }

  // Get user's current money in hand
  const userKey = `user:${userId}`;
  const userData = await redis.get(userKey);
  let moneyToReturn = 0;

  if (!userData) {
    throw new Error('User data not found');
  }

  interface UserData {
    money: number;
    moneyInHand: number;
    username: string;
  }

  const user = JSON.parse(userData) as UserData;
  
  // Return whatever money they have in hand
  moneyToReturn = user.moneyInHand || 0;
  
  // Add money in hand back to total balance
  user.money += moneyToReturn;
  user.moneyInHand = 0;

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
      moneyCommitted: 100,
      hasPlacedMinimumBet: false
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
    // Last player remaining - they get the entire prize pool
    const [lastPlayer] = session.players;
    if (lastPlayer) {
      const lastPlayerKey = `user:${lastPlayer.userId}`;
      const lastPlayerData = await redis.get(lastPlayerKey);
      if (lastPlayerData) {
        const lastPlayerUser = JSON.parse(lastPlayerData) as UserData;
        // Add their money in hand plus the entire prize pool to total balance
        lastPlayerUser.money += (lastPlayerUser.moneyInHand || 0) + session.prizePool;
        lastPlayerUser.moneyInHand = 0;
        await redis.set(lastPlayerKey, JSON.stringify(lastPlayerUser));
      }
    }
    // Delete the session since only one player remains
    await sessionDelete({ redis, sessionId });
  } else {
    // Update session
    await redis.set(getSessionKey(sessionId), JSON.stringify(session));
    
    // Update session in appropriate hash
    if (session.isPrivate) {
      await redis.hSet(PRIVATE_SESSIONS_HASH_KEY, sessionId, JSON.stringify(session));
    } else {
      await redis.hSet(PUBLIC_SESSIONS_HASH_KEY, sessionId, JSON.stringify(session));
    }
  }

  // Update leaving user's money
  await redis.set(userKey, JSON.stringify(user));

  return { moneyReturned: moneyToReturn };
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
    // Delete AI game data
    await deleteAIGameData({ redis, sessionId });
    
    // Unregister room code
    await unregisterRoomCode({ redis, sessionCode: session.sessionCode });
    
    // Remove all user session mappings
    for (const player of session.players) {
      await redis.del(USER_SESSION_KEY(player.userId));
    }
    
    // Remove from appropriate sessions hash
    if (session.isPrivate) {
      await redis.hDel(PRIVATE_SESSIONS_HASH_KEY, sessionId);
    } else {
      await redis.hDel(PUBLIC_SESSIONS_HASH_KEY, sessionId);
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
  
  // Update session in appropriate hash
  if (session.isPrivate) {
    await redis.hSet(PRIVATE_SESSIONS_HASH_KEY, sessionId, JSON.stringify(session));
  } else {
    await redis.hSet(PUBLIC_SESSIONS_HASH_KEY, sessionId, JSON.stringify(session));
  }

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
  
  // Remove from sessions hash since game is no longer joinable
  if (session.isPrivate) {
    await redis.hDel(PRIVATE_SESSIONS_HASH_KEY, sessionId);
  } else {
    await redis.hDel(PUBLIC_SESSIONS_HASH_KEY, sessionId);
  }

  return session;
};

export const getPublicSessions = async ({
  redis,
}: {
  redis: RedisClient;
}): Promise<GameSession[]> => {
  try {
    // Get all public sessions from hash
    const sessionsData = await redis.hGetAll(PUBLIC_SESSIONS_HASH_KEY);
    const sessions: GameSession[] = [];

    for (const [sessionId, sessionData] of Object.entries(sessionsData)) {
      try {
        const session = JSON.parse(sessionData) as GameSession;
        
        // Verify session still exists and is valid
        const currentSession = await sessionGet({ redis, sessionId });
        if (currentSession && currentSession.status === 'waiting' && !currentSession.isPrivate) {
          sessions.push(currentSession);
        } else {
          // Clean up stale session from hash
          await redis.hDel(PUBLIC_SESSIONS_HASH_KEY, sessionId);
        }
      } catch (parseError) {
        console.error('Error parsing session data:', parseError);
        // Clean up invalid session data
        await redis.hDel(PUBLIC_SESSIONS_HASH_KEY, sessionId);
      }
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
    // Get all private sessions from hash
    const sessionsData = await redis.hGetAll(PRIVATE_SESSIONS_HASH_KEY);
    const sessions: GameSession[] = [];

    for (const [sessionId, sessionData] of Object.entries(sessionsData)) {
      try {
        const session = JSON.parse(sessionData) as GameSession;
        
        // Verify session still exists and is valid
        const currentSession = await sessionGet({ redis, sessionId });
        if (currentSession && currentSession.status === 'waiting' && currentSession.isPrivate) {
          sessions.push(currentSession);
        } else {
          // Clean up stale session from hash
          await redis.hDel(PRIVATE_SESSIONS_HASH_KEY, sessionId);
        }
      } catch (parseError) {
        console.error('Error parsing session data:', parseError);
        // Clean up invalid session data
        await redis.hDel(PRIVATE_SESSIONS_HASH_KEY, sessionId);
      }
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