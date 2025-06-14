import { RedisClient } from '@devvit/redis';

export interface AIGameData {
  aiPersona: string;
  clues: [string, string, string];
  userPersonas: [string, string, string];
  sessionId: string;
  createdAt: number;
}

const getAIGameDataKey = (sessionId: string) => `ai_game_data:${sessionId}` as const;

// Mock Gemini API call - replace with actual Gemini integration
const generateAIGameData = async (): Promise<Omit<AIGameData, 'sessionId' | 'createdAt'>> => {
  // This is a mock implementation. Replace with actual Gemini API call
  // The prompt should ask Gemini to generate:
  // 1. An AI persona (character the AI will play)
  // 2. Three progressive clues about this persona
  // 3. Three different user personas for variety
  
  const mockResponse = {
    aiPersona: "I am a mysterious detective from the 1940s who specializes in solving supernatural cases. I wear a fedora and carry an old leather notebook filled with cryptic symbols.",
    clues: [
      "I work in the shadows when others sleep, seeking truth in the darkness.",
      "My tools are not conventional - I rely on intuition and ancient symbols to solve mysteries.",
      "The cases I handle involve things that science cannot easily explain, and I've been doing this since the jazz age."
    ] as [string, string, string],
    userPersonas: [
      "A curious journalist investigating strange occurrences",
      "A skeptical scientist trying to debunk supernatural claims", 
      "An enthusiastic paranormal investigator seeking proof"
    ] as [string, string, string]
  };

  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  return mockResponse;
};

export const createAIGameData = async ({
  redis,
  sessionId,
}: {
  redis: RedisClient;
  sessionId: string;
}): Promise<AIGameData> => {
  // Check if data already exists
  const existingData = await getAIGameData({ redis, sessionId });
  if (existingData) {
    return existingData;
  }

  // Generate new AI game data
  const gameData = await generateAIGameData();
  
  const aiGameData: AIGameData = {
    ...gameData,
    sessionId,
    createdAt: Date.now(),
  };

  // Store in Redis
  await redis.set(getAIGameDataKey(sessionId), JSON.stringify(aiGameData));
  
  return aiGameData;
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