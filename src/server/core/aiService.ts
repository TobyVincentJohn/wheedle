import { z } from 'zod';
import { GoogleGenAI } from '@google/genai';

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

export const generateAIGameData = async (): Promise<Omit<AIGameData, 'sessionId' | 'createdAt'>> => {
  console.log('🤖 Starting AI game data generation...');

  // Return hardcoded game data for consistent testing
  const gameDataOptions = [
    {
      aiPersona: "A mysterious detective AI who specializes in supernatural cases and has a dry sense of humor",
      clues: [
        "I work in a profession that requires careful observation and logical thinking",
        "My cases often involve things that others might consider impossible or unexplained", 
        "I have a particular fondness for sarcastic remarks when dealing with the supernatural"
      ],
      userPersonas: [
        "A skeptical scientist who doesn't believe in the paranormal",
        "An enthusiastic paranormal investigator who believes everything",
        "A local police officer who just wants to solve cases practically"
      ]
    },
    {
      aiPersona: "A cheerful cooking AI that loves experimenting with fusion cuisine from different planets",
      clues: [
        "I spend most of my time creating delicious combinations of ingredients",
        "My recipes often include ingredients that aren't found on Earth",
        "I get excited about mixing flavors from different worlds and galaxies"
      ],
      userPersonas: [
        "A traditional chef who prefers classic Earth recipes",
        "An adventurous food blogger always seeking new experiences",
        "A nutritionist concerned about the health effects of alien ingredients"
      ]
    },
    {
      aiPersona: "A philosophical AI librarian who guards ancient digital wisdom and speaks in riddles",
      clues: [
        "I am the keeper of knowledge that spans millennia",
        "My words often come in the form of puzzles and ancient sayings",
        "I protect digital scrolls and virtual tomes from a time long past"
      ],
      userPersonas: [
        "A modern student who just wants straightforward answers",
        "A historian fascinated by ancient knowledge and mysteries",
        "A tech expert trying to understand old digital systems"
      ]
    }
  ];

  // Select a random game data set
  const selectedData = gameDataOptions[Math.floor(Math.random() * gameDataOptions.length)];
  console.log('🎉 AI game data generated successfully:', selectedData);
  return selectedData;
};

export const createAIGameData = async ({
  redis,
  sessionId,
}: {
  redis: any;
  sessionId: string;
}): Promise<AIGameData> => {
  console.log(`🎮 Creating AI game data for session: ${sessionId}`);
  
  // Always generate fresh AI game data for each session
  // const existing = await getAIGameData({ redis, sessionId });
  // if (existing) {
  //   console.log('♻️ Found existing AI game data for session:', sessionId);
  //   return existing;
  // }

  console.log('🆕 Generating new AI game data...');
  const gameData = await generateAIGameData();

  const aiGameData: AIGameData = {
    ...gameData,
    sessionId,
    createdAt: Date.now(),
  };

  console.log('💾 Storing AI game data in Redis...');
  await redis.set(getAIGameDataKey(sessionId), JSON.stringify(aiGameData));
  
  console.log('✅ AI game data created and stored successfully');
  return aiGameData;
};

export const getAIGameData = async ({
  redis,
  sessionId,
}: {
  redis: any;
  sessionId: string;
}): Promise<AIGameData | null> => {
  console.log(`🔍 Fetching AI game data for session: ${sessionId}`);
  
  const data = await redis.get(getAIGameDataKey(sessionId));
  if (data) {
    console.log('✅ Found AI game data in Redis');
    const parsed = JSON.parse(data);
    console.log('📋 AI game data:', parsed);
    return parsed;
  } else {
    console.log('❌ No AI game data found in Redis');
    return null;
  }
};

export const deleteAIGameData = async ({
  redis,
  sessionId,
}: {
  redis: any;
  sessionId: string;
}): Promise<void> => {
  console.log(`🗑️ Deleting AI game data for session: ${sessionId}`);
  await redis.del(getAIGameDataKey(sessionId));
  console.log('✅ AI game data deleted');
};