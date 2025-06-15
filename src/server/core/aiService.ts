import { z } from 'zod';
import { Devvit } from '@devvit/public-api';

export interface AIGameData {
  aiPersona: string;
  clues: [string, string, string];
  userPersonas: [string, string, string];
  sessionId: string;
  createdAt: number;
}

const GeminiSchema = z.object({
  aiPersona: z.string(),
  clues: z.tuple([z.string(), z.string(), z.string()]),
  userPersonas: z.tuple([z.string(), z.string(), z.string()])
});

const getAIGameDataKey = (sessionId: string) => `ai_game_data:${sessionId}` as const;

export const generateAIGameData = async (context: Devvit.Context): Promise<Omit<AIGameData, 'sessionId' | 'createdAt'>> => {
  const apiKey = await context.settings.get('GEMINI_API_KEY');
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set. Use `npx devvit settings set GEMINI_API_KEY` to set it.');
  }

  const prompt = `
You are an AI game master for a psychological guessing game.
Generate:
- A fictional AI persona with strong characteristics
- 3 progressively revealing clues about that AI persona
- 3 contrasting user personas (different roles or backgrounds)

Respond in JSON format with:
{
  "aiPersona": "...",
  "clues": ["...", "...", "..."],
  "userPersonas": ["...", "...", "..."]
}
  `.trim();

  const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
    }),
  });

  const json = await res.json();

  const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Invalid Gemini response: missing text');

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new Error(`Failed to parse Gemini JSON response: ${err}`);
  }

  const result = GeminiSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`Gemini response validation failed: ${result.error.message}`);
  }

  return result.data;
};

export const createAIGameData = async ({
  redis,
  context,
  sessionId,
}: {
  redis: Devvit.RedisClient;
  context: Devvit.Context;
  sessionId: string;
}): Promise<AIGameData> => {
  const existing = await getAIGameData({ redis, sessionId });
  if (existing) return existing;

  const gameData = await generateAIGameData(context);

  const aiGameData: AIGameData = {
    ...gameData,
    sessionId,
    createdAt: Date.now(),
  };

  await redis.set(getAIGameDataKey(sessionId), JSON.stringify(aiGameData));
  return aiGameData;
};

export const getAIGameData = async ({
  redis,
  sessionId,
}: {
  redis: Devvit.RedisClient;
  sessionId: string;
}): Promise<AIGameData | null> => {
  const data = await redis.get(getAIGameDataKey(sessionId));
  return data ? JSON.parse(data) : null;
};

export const deleteAIGameData = async ({
  redis,
  sessionId,
}: {
  redis: Devvit.RedisClient;
  sessionId: string;
}): Promise<void> => {
  await redis.del(getAIGameDataKey(sessionId));
};
