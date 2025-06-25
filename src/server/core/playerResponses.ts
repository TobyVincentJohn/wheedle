import { RedisClient } from '@devvit/redis';

export interface PlayerResponse {
  userId: string;
  username: string;
  response: string;
  persona: string;
  submittedAt: number;
  isTimeUp: boolean;
}

export interface SessionResponses {
  sessionId: string;
  aiPersona: string;
  playerResponses: PlayerResponse[];
  createdAt: number;
  updatedAt: number;
}

const getSessionResponsesKey = (sessionId: string) => `session_responses:${sessionId}` as const;

export const storePlayerResponse = async ({
  redis,
  sessionId,
  userId,
  username,
  response,
  persona,
  aiPersona,
  isTimeUp = false,
}: {
  redis: RedisClient;
  sessionId: string;
  userId: string;
  username: string;
  response: string;
  persona: string;
  aiPersona: string;
  isTimeUp?: boolean;
}): Promise<SessionResponses> => {
  console.log('[RESPONSE STORAGE] ===== STORING PLAYER RESPONSE =====');
  console.log('[RESPONSE STORAGE] Session ID:', sessionId);
  console.log('[RESPONSE STORAGE] Player:', username, '(', userId, ')');
  console.log('[RESPONSE STORAGE] Response:', response);
  console.log('[RESPONSE STORAGE] Persona:', persona);
  console.log('[RESPONSE STORAGE] Time up:', isTimeUp);

  const key = getSessionResponsesKey(sessionId);
  
  // Get existing session responses or create new
  let sessionResponses: SessionResponses;
  const existingData = await redis.get(key);
  
  if (existingData) {
    sessionResponses = JSON.parse(existingData);
    console.log('[RESPONSE STORAGE] Found existing responses for', sessionResponses.playerResponses.length, 'players');
  } else {
    sessionResponses = {
      sessionId,
      aiPersona,
      playerResponses: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    console.log('[RESPONSE STORAGE] Creating new session responses storage');
  }

  // Remove existing response from this user (if any) and add new one
  sessionResponses.playerResponses = sessionResponses.playerResponses.filter(r => r.userId !== userId);
  
  const playerResponse: PlayerResponse = {
    userId,
    username,
    response,
    persona,
    submittedAt: Date.now(),
    isTimeUp,
  };
  
  sessionResponses.playerResponses.push(playerResponse);
  sessionResponses.updatedAt = Date.now();

  // Store back to Redis
  await redis.set(key, JSON.stringify(sessionResponses));
  
  console.log('[RESPONSE STORAGE] ===== ALL PLAYER RESPONSES FOR SESSION =====');
  console.log('[RESPONSE STORAGE] Session Responses Data:');
  
  // 🎯 SESSION SUMMARY
  console.log('[RESPONSE STORAGE] Session Summary:', {
    status: 'success',
    data: {
      sessionId: sessionResponses.sessionId,
      aiPersona: sessionResponses.aiPersona,
      totalResponses: sessionResponses.playerResponses.length,
      createdAt: new Date(sessionResponses.createdAt).toISOString(),
      updatedAt: new Date(sessionResponses.updatedAt).toISOString()
    }
  });
  
  // 🎯 INDIVIDUAL RESPONSES - Each response logged separately
  console.log('[RESPONSE STORAGE] ===== INDIVIDUAL STORED RESPONSES =====');
  sessionResponses.playerResponses.forEach((response, index) => {
    console.log(`[RESPONSE STORAGE] Response ${index + 1}:`, {
      status: 'success',
      data: {
        userId: response.userId,
        username: response.username,
        persona: response.persona,
        response: response.response,
        submittedAt: new Date(response.submittedAt).toISOString(),
        isTimeUp: response.isTimeUp,
        responseLength: response.response.length
      }
    });
  });
  
  // 🎯 COMPLETE DATA STRUCTURE
  console.log('[RESPONSE STORAGE] ===== COMPLETE SESSION RESPONSES =====');
  console.log('[RESPONSE STORAGE] Full Data Structure:', JSON.stringify(sessionResponses, null, 2));
  console.log('[RESPONSE STORAGE] ===== END SESSION RESPONSES DATA =====');

  return sessionResponses;
};

export const getSessionResponses = async ({
  redis,
  sessionId,
}: {
  redis: RedisClient;
  sessionId: string;
}): Promise<SessionResponses | null> => {
  console.log('[RESPONSE RETRIEVAL] Getting all responses for session:', sessionId);
  
  const key = getSessionResponsesKey(sessionId);
  const data = await redis.get(key);
  
  if (!data) {
    console.log('[RESPONSE RETRIEVAL] No responses found for session:', sessionId);
    return null;
  }

  const sessionResponses = JSON.parse(data) as SessionResponses;
  
  console.log('[RESPONSE RETRIEVAL] ===== RETRIEVED ALL PLAYER RESPONSES =====');
  console.log('[RESPONSE RETRIEVAL] Session Responses Data:');
  
  // 🎯 RETRIEVAL SUMMARY
  console.log('[RESPONSE RETRIEVAL] Retrieval Summary:', {
    status: 'success',
    data: {
      sessionId: sessionResponses.sessionId,
      aiPersona: sessionResponses.aiPersona,
      totalResponses: sessionResponses.playerResponses.length,
      createdAt: new Date(sessionResponses.createdAt).toISOString(),
      updatedAt: new Date(sessionResponses.updatedAt).toISOString()
    }
  });
  
  // 🎯 INDIVIDUAL RETRIEVED RESPONSES
  console.log('[RESPONSE RETRIEVAL] ===== INDIVIDUAL RETRIEVED RESPONSES =====');
  sessionResponses.playerResponses.forEach((response, index) => {
    console.log(`[RESPONSE RETRIEVAL] Retrieved Response ${index + 1}:`, {
      status: 'success',
      data: {
        userId: response.userId,
        username: response.username,
        persona: response.persona,
        response: response.response,
        submittedAt: new Date(response.submittedAt).toISOString(),
        isTimeUp: response.isTimeUp,
        responseLength: response.response.length
      }
    });
  });
  
  // 🎯 RAW RETRIEVED DATA
  console.log('[RESPONSE RETRIEVAL] ===== RAW RETRIEVED DATA =====');
  console.log('[RESPONSE RETRIEVAL] Raw Data:', JSON.stringify(sessionResponses, null, 2));
  console.log('[RESPONSE RETRIEVAL] ===== END RETRIEVED RESPONSES DATA =====');

  return sessionResponses;
};

export const deleteSessionResponses = async ({
  redis,
  sessionId,
}: {
  redis: RedisClient;
  sessionId: string;
}): Promise<void> => {
  console.log('[RESPONSE CLEANUP] Deleting all responses for session:', sessionId);
  
  const key = getSessionResponsesKey(sessionId);
  
  // Log what we're about to delete
  const existingData = await redis.get(key);
  if (existingData) {
    const sessionResponses = JSON.parse(existingData) as SessionResponses;
    console.log('[RESPONSE CLEANUP] About to delete responses from', sessionResponses.playerResponses.length, 'players');
    sessionResponses.playerResponses.forEach(r => {
      console.log('[RESPONSE CLEANUP]   - User:', r.username, 'Response:', r.response.substring(0, 50) + '...');
    });
  }
  
  await redis.del(key);
  console.log('[RESPONSE CLEANUP] Successfully deleted session responses');
};