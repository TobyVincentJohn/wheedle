import { RedisClient } from '@devvit/redis';

export interface AIGameData {
  aiPersona: string;
  clues: [string, string, string];
  userPersonas: [string, string, string];
  sessionId: string;
  createdAt: number;
}

const getAIGameDataKey = (sessionId: string) => `ai_game_data:${sessionId}` as const;

const generateAIGameData = async (): Promise<Omit<AIGameData, 'sessionId' | 'createdAt'>> => {
  const apiKey = await Devvit.secret.get('GEMINI_API_KEY');
  if (!apiKey) throw new Error('Missing GEMINI_API_KEY in Devvit secrets');

  const prompt = `
Respond only with valid JSON:
{
  "aiPersona": string,
  "clues": [string, string, string],
  "userPersonas": [string, string, string]
}
Clues should get progressively more revealing.
`;

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }]
        }
      ]
    })
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Gemini API Error ${res.status}: ${errorText}`);
  }

  const json = await res.json();
  const rawText = json?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) throw new Error('Gemini returned no text');

  let data;
  try {
    data = JSON.parse(rawText);
  } catch (err) {
    throw new Error(`Invalid JSON from Gemini:\n${rawText}`);
  }

  // Manual validation
  if (
    typeof data.aiPersona !== 'string' ||
    !Array.isArray(data.clues) || data.clues.length !== 3 || !data.clues.every(c => typeof c === 'string') ||
    !Array.isArray(data.userPersonas) || data.userPersonas.length !== 3 || !data.userPersonas.every(p => typeof p === 'string')
  ) {
    throw new Error(`Invalid structure from Gemini:\n${JSON.stringify(data)}`);
  }

  return data;
};

export const createAIGameData = async ({
  redis,
  sessionId,
}: {
  redis: RedisClient;
  sessionId: string;
}): Promise<AIGameData> => {
  const existing = await getAIGameData({ redis, sessionId });
  if (existing) return existing;

  const gameData = await generateAIGameData();

  const fullData: AIGameData = {
    ...gameData,
    sessionId,
    createdAt: Date.now()
  };

  await redis.set(getAIGameDataKey(sessionId), JSON.stringify(fullData));
  return fullData;
};

export const getAIGameData = async ({
  redis,
  sessionId,
}: {
  redis: RedisClient;
  sessionId: string;
}): Promise<AIGameData | null> => {
  const data = await redis.get(getAIGameDataKey(sessionId));
  return data ? JSON.parse(data) : null;
};

export const deleteAIGameData = async ({
  redis,
  sessionId,
}: {
  redis: RedisClient;
  sessionId: string;
}): Promise<void> => {
  await redis.del(getAIGameDataKey(sessionId));
};
