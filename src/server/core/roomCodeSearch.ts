import { RedisClient } from '@devvit/redis';
import { GameSession } from '../../shared/types/session';

// Separate Redis keys for room code mapping
const ROOM_CODE_TO_SESSION_KEY = (code: string) => `room_code:${code}` as const;

export const registerRoomCode = async ({
  redis,
  sessionCode,
  sessionId,
  isPrivate,
}: {
  redis: RedisClient;
  sessionCode: string;
  sessionId: string;
  isPrivate: boolean;
}): Promise<void> => {
  const codeData = {
    sessionId,
    isPrivate,
    createdAt: Date.now(),
  };
  
  await redis.set(ROOM_CODE_TO_SESSION_KEY(sessionCode), JSON.stringify(codeData));
};

export const unregisterRoomCode = async ({
  redis,
  sessionCode,
}: {
  redis: RedisClient;
  sessionCode: string;
}): Promise<void> => {
  await redis.del(ROOM_CODE_TO_SESSION_KEY(sessionCode));
};

export const findSessionByCode = async ({
  redis,
  sessionCode,
  requestedType, // 'public' or 'private'
}: {
  redis: RedisClient;
  sessionCode: string;
  requestedType: 'public' | 'private';
}): Promise<{ session: GameSession | null; error?: string }> => {
  try {
    const codeData = await redis.get(ROOM_CODE_TO_SESSION_KEY(sessionCode));
    
    if (!codeData) {
      return { 
        session: null, 
        error: `${requestedType === 'public' ? 'Public' : 'Private'} session not found` 
      };
    }

    const { sessionId, isPrivate } = JSON.parse(codeData);
    
    // Check if the session type matches the request
    if (requestedType === 'public' && isPrivate) {
      return { 
        session: null, 
        error: 'This code belongs to a private session. Use Private Room to join.' 
      };
    }
    
    if (requestedType === 'private' && !isPrivate) {
      return { 
        session: null, 
        error: 'This code belongs to a public session. Use Public Room to join.' 
      };
    }

    // Get the actual session data
    const sessionData = await redis.get(`session:${sessionId}`);
    if (!sessionData) {
      // Clean up orphaned room code
      await unregisterRoomCode({ redis, sessionCode });
      return { 
        session: null, 
        error: `${requestedType === 'public' ? 'Public' : 'Private'} session not found` 
      };
    }

    const session = JSON.parse(sessionData) as GameSession;
    
    // Verify session is still waiting
    if (session.status !== 'waiting') {
      return { 
        session: null, 
        error: 'Session is no longer accepting players' 
      };
    }

    return { session };
  } catch (error) {
    console.error('Error finding session by code:', error);
    return { 
      session: null, 
      error: 'Failed to search for session' 
    };
  }
};