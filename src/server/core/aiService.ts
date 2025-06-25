import { RedisClient } from '@devvit/redis';
import { AIGameData } from '../../shared/types/aiGame';
import { GameSession } from '../../shared/types/session';
import { AI_PERSONAS } from '../../shared/data/aiPersonas';
import { USER_PERSONAS } from '../../shared/data/userPersonas';
import { sessionGet } from './session';
import { getSessionResponses } from './playerResponses';

// Gemini API integration
import { GoogleGenAI } from '@google/genai';

const getAIGameDataKey = (sessionId: string) => `ai_game_data:${sessionId}` as const;

// Helper to ensure clues is exactly 3 strings
function toThreeClues(arr: any): [string, string, string] {
  if (!Array.isArray(arr)) return ['Unknown', 'Unknown', 'Unknown'];
  const safeArr = arr.map((v: any) => (typeof v === 'string' && v !== undefined) ? v : 'Unknown');
  while (safeArr.length < 3) safeArr.push('Unknown');
  return [safeArr[0] ?? 'Unknown', safeArr[1] ?? 'Unknown', safeArr[2] ?? 'Unknown'];
}

export const generateAIGameData = async (session: GameSession): Promise<Omit<AIGameData, 'sessionId' | 'createdAt'>> => {
  console.log('[AI DEBUG] Generating hardcoded AI game data');
  console.log('[AI DEBUG] 👥 Session has', session.players.length, 'players');
  const start = Date.now();
  
  try {
    // Select a random AI persona
    const randomAIIndex = Math.floor(Math.random() * AI_PERSONAS.length);
    const selectedAIPersona = (AI_PERSONAS[randomAIIndex] && typeof AI_PERSONAS[randomAIIndex] === 'object') ? AI_PERSONAS[randomAIIndex] : (AI_PERSONAS[0] && typeof AI_PERSONAS[0] === 'object' ? AI_PERSONAS[0] : { aiPersona: 'Unknown AI Persona', clues: ['Unknown', 'Unknown', 'Unknown'] });
    console.log('[AI DEBUG] 🎲 Selected AI persona index:', randomAIIndex, 'out of', AI_PERSONAS.length);
    console.log('[AI DEBUG] 🤖 Selected AI persona:', selectedAIPersona?.aiPersona);
    
    // Select corresponding user personas (same index to keep them thematically related)
    const selectedUserPersonas = Array.isArray(USER_PERSONAS[randomAIIndex]) ? USER_PERSONAS[randomAIIndex] : (Array.isArray(USER_PERSONAS[0]) ? USER_PERSONAS[0] : ['Unknown', 'Unknown', 'Unknown']);
    console.log('[AI DEBUG] 👥 Available user personas for this theme:', selectedUserPersonas);
    
    // Assign unique personas to each player
    const playerPersonas: { [userId: string]: string } = {};
    const availablePersonas = Array.isArray(selectedUserPersonas) ? [...selectedUserPersonas] : [];
    console.log('[AI DEBUG] 🔀 Original persona order:', availablePersonas);
    
    // Shuffle the available personas to randomize assignment
    for (let i = availablePersonas.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [availablePersonas[i], availablePersonas[j]] = [availablePersonas[j], availablePersonas[i]];
    }
    console.log('[AI DEBUG] 🎲 Shuffled persona order:', availablePersonas);
    
    // Assign personas to players, cycling through if more players than personas
    session.players.forEach((player, index) => {
      const personaIndex = availablePersonas.length > 0 ? index % availablePersonas.length : 0;
      const persona = availablePersonas[personaIndex];
      playerPersonas[player.userId] = typeof persona === 'string' ? persona || 'Unknown Persona' : 'Unknown Persona';
      console.log('[AI DEBUG] 🎭 Assigned to player', player.username, '(', player.userId, '):', typeof persona === 'string' ? persona || 'Unknown Persona' : 'Unknown Persona');
    });
    
    // clues must always be 3 strings, userPersonas can be any length
    const cluesArray = toThreeClues(selectedAIPersona.clues);
    const userPersonasArray = Array.isArray(selectedUserPersonas) && selectedUserPersonas.every((c: any) => typeof c === 'string') ? selectedUserPersonas : [];
    const gameData = {
      aiPersona: typeof selectedAIPersona.aiPersona === 'string' && selectedAIPersona.aiPersona ? selectedAIPersona.aiPersona : 'Unknown AI Persona',
      clues: cluesArray,
      userPersonas: userPersonasArray,
      playerPersonas
    };
    
    console.log('[AI DEBUG] ✅ Generated hardcoded game data:', gameData);
    console.log('[AI DEBUG] 📊 Final assignment summary:');
    console.log('[AI DEBUG]   🤖 AI to guess:', gameData.aiPersona);
    console.log('[AI DEBUG]   🔍 Clues to reveal:', gameData.clues.length);
    console.log('[AI DEBUG]   🎭 Players with personas:', Object.keys(gameData.playerPersonas).length);
    console.log('[AI DEBUG] Generation completed, duration:', Date.now() - start, 'ms');
    
    return gameData;
  } catch (err) {
    console.error('[AI DEBUG] Error in generateAIGameData:', err);
    console.log('[AI DEBUG] Using fallback data due to error. Duration:', Date.now() - start, 'ms');
    
    // Fallback persona assignment
    const fallbackPlayerPersonas: { [userId: string]: string } = {};
    const fallbackPersonas = Array.isArray(USER_PERSONAS[0]) ? USER_PERSONAS[0] : ['Unknown', 'Unknown', 'Unknown'];
    console.log('[AI DEBUG] 🔄 Using fallback personas:', fallbackPersonas);
    
    session.players.forEach((player, index) => {
      const personaIndex = Array.isArray(fallbackPersonas) && fallbackPersonas.length > 0 ? index % fallbackPersonas.length : 0;
      const persona = Array.isArray(fallbackPersonas) && typeof fallbackPersonas[personaIndex] === 'string' ? fallbackPersonas[personaIndex] : 'Unknown Persona';
      fallbackPlayerPersonas[player.userId] = persona;
      console.log('[AI DEBUG] 🔄 Fallback assigned to', player.username, ':', persona);
    });
    
    // Fallback to the first persona set if something goes wrong
    const fallbackAIPersona = (AI_PERSONAS[0] && typeof AI_PERSONAS[0].aiPersona === 'string') ? AI_PERSONAS[0].aiPersona : 'Unknown AI Persona';
    const fallbackClues = toThreeClues(AI_PERSONAS[0]?.clues);
    const fallbackUserPersonas = Array.isArray(USER_PERSONAS[0]) ? USER_PERSONAS[0] : [];
    return {
      aiPersona: fallbackAIPersona,
      clues: fallbackClues,
      userPersonas: fallbackUserPersonas,
      playerPersonas: fallbackPlayerPersonas
    };
  }
};

export const createAIGameData = async ({
  redis,
  sessionId,
}: {
  redis: RedisClient;
  sessionId: string;
}): Promise<AIGameData> => {
  console.log('[AI DEBUG] Entered createAIGameData with sessionId:', sessionId);
  console.log('[AI DEBUG] ⭐ ===== CREATING AI GAME DATA ===== ⭐');
  const start = Date.now();
  
  // Get the current session to access player information
  const session = await sessionGet({ redis, sessionId });
  if (!session) {
    console.error('[AI DEBUG] ❌ Session not found for sessionId:', sessionId);
    throw new Error('Session not found when creating AI game data');
  }
  
  console.log('[AI DEBUG] 📋 Session found with players:', session.players.map(p => ({ userId: p.userId, username: p.username })));
  console.log('[AI DEBUG] 🎯 TOTAL PLAYERS IN SESSION:', session.players.length);
  
  let gameData: Omit<AIGameData, 'sessionId' | 'createdAt'>;
  
  try {
    console.log('[AI DEBUG] About to call generateAIGameData');
    gameData = await generateAIGameData(session);
    console.log('[AI DEBUG] generateAIGameData finished, result:', gameData);
    console.log('[AI DEBUG] 🎭 Player persona assignments:', gameData.playerPersonas);
    console.log('[AI DEBUG] 🔥 FINAL PERSONA MAPPING:');
    if (gameData.playerPersonas) {
      Object.entries(gameData.playerPersonas).forEach(([userId, persona]) => {
        const player = session.players.find(p => p.userId === userId);
        console.log('[AI DEBUG] 🎭 USER:', player?.username || 'Unknown', '(ID:', userId, ') → PERSONA:', persona);
      });
    }
  } catch (error) {
    console.error('[AI DEBUG] Error in createAIGameData (generateAIGameData):', error);
    
    // Fallback persona assignment
    const fallbackPlayerPersonas: { [userId: string]: string } = {};
    const fallbackPersonas = Array.isArray(USER_PERSONAS[0]) ? USER_PERSONAS[0] : ['Unknown', 'Unknown', 'Unknown'];
    session.players.forEach((player, index) => {
      const personaIndex = Array.isArray(fallbackPersonas) && fallbackPersonas.length > 0 ? index % fallbackPersonas.length : 0;
      const persona = Array.isArray(fallbackPersonas) && typeof fallbackPersonas[personaIndex] === 'string' ? fallbackPersonas[personaIndex] : 'Unknown Persona';
      fallbackPlayerPersonas[player.userId] = persona;
      console.log('[AI DEBUG] 🔄 Fallback persona assigned - User:', player.username, 'Persona:', persona);
    });
    
    // Use fallback data
    gameData = {
      aiPersona: AI_PERSONAS[0].aiPersona,
      clues: AI_PERSONAS[0].clues as [string, string, string],
      userPersonas: USER_PERSONAS[0] as [string, string, string],
      playerPersonas: fallbackPlayerPersonas
    };
  }
  
  if (!gameData) {
    console.error('[AI DEBUG] gameData is null or undefined in createAIGameData');
    
    // Fallback persona assignment
    const fallbackPlayerPersonas: { [userId: string]: string } = {};
    const fallbackPersonas = Array.isArray(USER_PERSONAS[0]) ? USER_PERSONAS[0] : ['Unknown', 'Unknown', 'Unknown'];
    session.players.forEach((player, index) => {
      const personaIndex = Array.isArray(fallbackPersonas) && fallbackPersonas.length > 0 ? index % fallbackPersonas.length : 0;
      const persona = Array.isArray(fallbackPersonas) && typeof fallbackPersonas[personaIndex] === 'string' ? fallbackPersonas[personaIndex] : 'Unknown Persona';
      fallbackPlayerPersonas[player.userId] = persona;
      console.log('[AI DEBUG] 🔄 Emergency fallback persona assigned - User:', player.username, 'Persona:', persona);
    });
    
    gameData = {
      aiPersona: AI_PERSONAS[0].aiPersona,
      clues: AI_PERSONAS[0].clues as [string, string, string],
      userPersonas: USER_PERSONAS[0] as [string, string, string],
      playerPersonas: fallbackPlayerPersonas
    };
  }
  
  console.log('[AI DEBUG] Storing AI game data in Redis with key:', getAIGameDataKey(sessionId));
  
  const aiGameData: AIGameData = {
    ...gameData,
    sessionId,
    createdAt: Date.now(),
  };
  
  console.log('[AI DEBUG] 💾 Complete AI game data to be stored:');
  console.log('[AI DEBUG] 🤖 AI Persona:', aiGameData.aiPersona);
  console.log('[AI DEBUG] 🔍 Clues:', aiGameData.clues);
  console.log('[AI DEBUG] 👥 Available User Personas:', aiGameData.userPersonas);
  console.log('[AI DEBUG] 🎭 Player-Persona Mapping:', aiGameData.playerPersonas);
  console.log('[AI DEBUG] 📅 Created At:', new Date(aiGameData.createdAt).toISOString());
  
  try {
    console.log('[AI DEBUG] About to call redis.set for key:', getAIGameDataKey(sessionId));
    await redis.set(getAIGameDataKey(sessionId), JSON.stringify(aiGameData));
    console.log('[AI DEBUG] Successfully stored AI game data in Redis');
    console.log('[AI DEBUG] ✅ Redis storage confirmed for session:', sessionId);
    
    // 🎯 CONSOLIDATED STORAGE CONFIRMATION - Like user data format
    console.log('[PERSONA STORAGE] ===== REDIS STORAGE CONFIRMATION =====');
    console.log('[PERSONA STORAGE] Stored Player Personas:');
    console.log('[PERSONA STORAGE]', {
      status: 'success',
      data: {
        sessionId: sessionId,
        aiPersona: aiGameData.aiPersona,
        totalPlayers: Object.keys(aiGameData.playerPersonas || {}).length,
        playerPersonas: aiGameData.playerPersonas,
        redisKey: getAIGameDataKey(sessionId),
        storedAt: new Date().toISOString()
      }
    });
    console.log('[PERSONA STORAGE] ===== END STORAGE CONFIRMATION =====');
    
    // Verify the data was stored correctly by reading it back
    const verificationData = await redis.get(getAIGameDataKey(sessionId));
    if (verificationData) {
      const parsedVerification = JSON.parse(verificationData);
      console.log('[AI DEBUG] 🔍 Verification read from Redis successful');
      console.log('[AI DEBUG] 🎭 Verified player personas:', parsedVerification.playerPersonas);
    } else {
      console.error('[AI DEBUG] ❌ Verification read failed - no data found');
    }
  } catch (error) {
    console.error('[AI DEBUG] Error storing AI game data in Redis:', error);
    throw error;
  }
  
  console.log('[AI DEBUG] Exiting createAIGameData, duration:', Date.now() - start, 'ms');
  return aiGameData;
};

export const getAIGameData = async ({
  redis,
  sessionId,
}: {
  redis: RedisClient;
  sessionId: string;
}): Promise<AIGameData | null> => {
  console.log('[AI DEBUG] Entered getAIGameData with sessionId:', sessionId);
  const start = Date.now();
  const key = getAIGameDataKey(sessionId);
  console.log('[AI DEBUG] Fetching from Redis with key:', key);
  
  let data;
  try {
    data = await redis.get(key);
    console.log('[AI DEBUG] redis.get finished, data:', data);
    
    if (data) {
      console.log('[AI DEBUG] 📖 Raw Redis data length:', data.length, 'characters');
    }
  } catch (error) {
    console.error('[AI DEBUG] Error in redis.get:', error);
    return null;
  }
  
  if (!data) {
    console.log('[AI DEBUG] No data found in Redis for key:', key);
    console.log('[AI DEBUG] Exiting getAIGameData, duration:', Date.now() - start, 'ms');
    return null;
  }
  
  try {
    const parsed = JSON.parse(data);
    console.log('[AI DEBUG] Successfully parsed AI game data:', parsed);
    console.log('[AI DEBUG] 📊 Retrieved AI game data summary:');
    console.log('[AI DEBUG] 🤖 AI Persona:', parsed.aiPersona);
    console.log('[AI DEBUG] 🔍 Number of clues:', parsed.clues?.length || 0);
    console.log('[AI DEBUG] 👥 Number of user personas:', parsed.userPersonas?.length || 0);
    console.log('[AI DEBUG] 🎭 Player persona assignments:');
    
    if (parsed.playerPersonas) {
      Object.entries(parsed.playerPersonas).forEach(([userId, persona]) => {
        console.log('[AI DEBUG]   👤 User ID:', userId, '→ Persona:', persona);
      });
    } else {
      console.log('[AI DEBUG] ⚠️ No player personas found in data');
    }
    
    console.log('[AI DEBUG] 📅 Data created at:', new Date(parsed.createdAt).toISOString());
    console.log('[AI DEBUG] Exiting getAIGameData, duration:', Date.now() - start, 'ms');
    return parsed;
  } catch (err) {
    console.error('[AI DEBUG] Error parsing AI game data from Redis:', err);
    console.error('[AI DEBUG] 💥 Raw data that failed to parse:', data);
    console.log('[AI DEBUG] Exiting getAIGameData, duration:', Date.now() - start, 'ms');
    return null;
  }
};

export const deleteAIGameData = async ({
  redis,
  sessionId,
}: {
  redis: RedisClient;
  sessionId: string;
}): Promise<void> => {
  console.log('[AI DEBUG] Entered deleteAIGameData with sessionId:', sessionId);
  const start = Date.now();
  const key = getAIGameDataKey(sessionId);
  console.log('[AI DEBUG] Deleting from Redis with key:', key);
  
  // Log what we're about to delete
  try {
    const existingData = await redis.get(key);
    if (existingData) {
      const parsed = JSON.parse(existingData);
      console.log('[AI DEBUG] 🗑️ About to delete AI game data:');
      console.log('[AI DEBUG]   🤖 AI Persona:', parsed.aiPersona);
      console.log('[AI DEBUG]   🎭 Player personas for', Object.keys(parsed.playerPersonas || {}).length, 'players');
    } else {
      console.log('[AI DEBUG] ⚠️ No existing data found to delete for key:', key);
    }
  } catch (error) {
    console.error('[AI DEBUG] Error reading data before deletion:', error);
  }
  
  try {
    await redis.del(key);
    console.log('[AI DEBUG] Successfully deleted AI game data from Redis');
    console.log('[AI DEBUG] ✅ AI game data cleanup completed for session:', sessionId);
  } catch (error) {
    console.error('[AI DEBUG] Error deleting AI game data from Redis:', error);
  }
  
  console.log('[AI DEBUG] Exiting deleteAIGameData, duration:', Date.now() - start, 'ms');
};

/**
 * Send all user personas, AI persona, and user responses for a session to Gemini and return the result.
 * @param redis Redis client
 * @param sessionId Session ID
 * @returns Gemini API response (text)
 */
export const sendSessionDataToGemini = async ({
  redis,
  sessionId,
}: {
  redis: RedisClient;
  sessionId: string;
}): Promise<string | null> => {
  // Get all player responses for the session
  const sessionResponses = await getSessionResponses({ redis, sessionId });
  if (!sessionResponses) {
    console.error('[GEMINI] No session responses found for session:', sessionId);
    return null;
  }

  // Prepare the prompt for Gemini
//   const prompt = `
// Session AI Persona: ${sessionResponses.aiPersona}

// Player Personas and Responses:
// ${sessionResponses.playerResponses.map(r => `- ${r.username} (${r.persona}): ${r.response}`).join('\n')}

// Given the above, provide an analysis, summary, or next action for the game.`;

  // Call Gemini API
  // try {
    // const apiKey = 'AIzaSyCJobF0XKy-KCeCwRkx8AyygPJmukEUw-o';
    // if (!apiKey) throw new Error('Missing Google API key');
    // const ai = new GoogleGenAI({ apiKey:apiKey });
    // const result = await ai.models.generateContent({
    //   model: 'gemini-2.5-flash',
    //   contents: "hello",//[{ parts: [{ text: prompt }] }],
    //   config: {
    //     thinkingConfig: {
    //       thinkingBudget: 0,
    //     },
    //   }
    // });
    // console.log(result.text)
    const url='https://example.com';
    try{
    fetch(url).then(response => {
      if (response.ok) {
        return response;
      }
      throw new Error('Something went wrong');
    }).then(responseJson => {
      console.log(responseJson)
    }).catch(error => {
      console.log(error)
    });
    
  } catch (err) {
    console.error('[GEMINI] Error calling Gemini API:', err);
    return null;
  }
};
