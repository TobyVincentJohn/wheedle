import { z } from 'zod';
import { GoogleGenAI } from '@google/genai';
import { RedisClient } from '@devvit/redis';
import { AIGameData } from '../../shared/types/aiGame';

const getAIGameDataKey = (sessionId: string) => `ai_game_data:${sessionId}` as const;

export const generateAIGameData = async (): Promise<Omit<AIGameData, 'sessionId' | 'createdAt'>> => {
  console.log('[AI DEBUG] Entered generateAIGameData');
  const start = Date.now();
  const prompt = `
You are an AI game master for a psychological guessing game.
Generate:
- A fictional AI persona with strong characteristics (be creative and interesting)
- 3 progressively revealing clues about that AI persona (start vague, get more specific)
- 3 contrasting user personas (different roles or backgrounds that players can roleplay)

Example format:
{
  "aiPersona": "A mysterious detective AI who specializes in supernatural cases and has a dry sense of humor",
  "clues": [
    "I work in a profession that requires careful observation and logical thinking",
    "My cases often involve things that others might consider impossible or unexplained", 
    "I have a particular fondness for sarcastic remarks when dealing with the supernatural"
  ],
  "userPersonas": [
    "A skeptical scientist who doesn't believe in the paranormal",
    "An enthusiastic paranormal investigator who believes everything",
    "A local police officer who just wants to solve cases practically"
  ]
}

Respond ONLY in valid JSON format:
  `.trim();

  try {
    if (!process.env.GOOGLE_API_KEY) {
      console.error('[AI DEBUG] Missing Google API key!');
      throw new Error('Missing Google API key');
    }
    console.log('[AI DEBUG] About to create GoogleGenAI client');
    const ai = new GoogleGenAI({ apiKey: "AIzaSyCJobF0XKy-KCeCwRkx8AyygPJmukEUw-o"});
    console.log('[AI DEBUG] GoogleGenAI client created. About to call generateContent...');
    const result = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        thinkingConfig: {
          thinkingBudget: 0,
        },
      }
    });
    console.log('[AI DEBUG] generateContent finished, result:', result);
    const text = result.text ?? '';
    console.log('[AI DEBUG] Raw AI response:', text);
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      console.error('[AI DEBUG] Failed to extract JSON from AI response. Raw text:', text);
      throw new Error('Malformed AI response: No JSON found');
    }
    const jsonString = match[0];
    let parsed;
    try {
      parsed = JSON.parse(jsonString);
    } catch (parseErr) {
      console.error('[AI DEBUG] JSON.parse error:', parseErr, 'Raw string:', jsonString);
      throw new Error('Malformed AI response: Invalid JSON');
    }
    console.log('[AI DEBUG] ✅ Parsed JSON:', parsed);
    console.log('[AI DEBUG] Exiting generateAIGameData, duration:', Date.now() - start, 'ms');
    return parsed;
  } catch (err) {
    console.error('[AI DEBUG] Error in generateAIGameData:', err);
    if (err instanceof Error) {
      if (err.message.includes('quota') || err.message.includes('billing')) {
        console.error('[AI DEBUG] Quota or billing error detected:', err.message);
      } else if (err.message.includes('network') || err.message.includes('ENOTFOUND') || err.message.includes('ECONN')) {
        console.error('[AI DEBUG] Network error detected:', err.message);
      } else if (err.message.includes('API key')) {
        console.error('[AI DEBUG] API key error detected:', err.message);
      } else if (err.message.includes('Malformed AI response')) {
        console.error('[AI DEBUG] Malformed AI response detected:', err.message);
      } else {
        console.error('[AI DEBUG] Unknown error type:', err.message);
      }
    } else {
      console.error('[AI DEBUG] Non-Error thrown:', err);
    }
    console.log('[AI DEBUG] Triggering fallback AI game data due to error. Exiting generateAIGameData, duration:', Date.now() - start, 'ms');
    return {
      aiPersona: "A mysterious AI who seems to be having a bad day",
      clues: ["My primary function is to generate content.", "Currently, I am unable to connect to my core programming.", "Everything is fine. Please proceed with the game."],
      userPersonas: ["A patient technician", "An anxious game show host", "A confused contestant"]
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
  const start = Date.now();
  let gameData: Omit<AIGameData, 'sessionId' | 'createdAt'>;
  try {
    console.log('[AI DEBUG] About to call generateAIGameData');
    gameData = await generateAIGameData();
    console.log('[AI DEBUG] generateAIGameData finished, result:', gameData);
  } catch (error) {
    console.error('[AI DEBUG] Error in createAIGameData (generateAIGameData):', error);
    gameData = {
      aiPersona: "A mysterious AI who seems to be having a bad day",
      clues: ["My primary function is to generate content.", "Currently, I am unable to connect to my core programming.", "Everything is fine. Please proceed with the game."],
      userPersonas: ["A patient technician", "An anxious game show host", "A confused contestant"]
    };
  }
  if (!gameData) {
    console.error('[AI DEBUG] gameData is null or undefined in createAIGameData');
    gameData = {
      aiPersona: "A very forgetful AI",
      clues: ["I was supposed to remember something...", "It was about... a game, I think?", "Oh well, I'm sure it wasn't important."],
      userPersonas: ["Someone who knows what's going on", "Someone equally confused", "A cat that wandered in"]
    };
  }
  console.log('[AI DEBUG] Storing AI game data in Redis with key:', getAIGameDataKey(sessionId));
  const aiGameData: AIGameData = {
    ...gameData,
    sessionId,
    createdAt: Date.now(),
  };
  try {
    console.log('[AI DEBUG] About to call redis.set for key:', getAIGameDataKey(sessionId));
    await redis.set(getAIGameDataKey(sessionId), JSON.stringify(aiGameData));
    console.log('[AI DEBUG] Successfully stored AI game data in Redis');
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
    console.log('[AI DEBUG] Exiting getAIGameData, duration:', Date.now() - start, 'ms');
    return parsed;
  } catch (err) {
    console.error('[AI DEBUG] Error parsing AI game data from Redis:', err);
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
  try {
    await redis.del(key);
    console.log('[AI DEBUG] Successfully deleted AI game data from Redis');
  } catch (error) {
    console.error('[AI DEBUG] Error deleting AI game data from Redis:', error);
  }
  console.log('[AI DEBUG] Exiting deleteAIGameData, duration:', Date.now() - start, 'ms');
};