import { z } from 'zod';
import { GoogleGenAI } from '@google/genai';
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

export const generateAIGameData = async (): Promise<Omit<AIGameData, 'sessionId' | 'createdAt'>> => {
  console.log('🤖 Starting AI game data generation...');

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
  // const ai = new GoogleGenAI({ apiKey: "AIzaSyCJobF0XKy-KCeCwRkx8AyygPJmukEUw-o" });
  // const result = await ai.models.generateContent({
  //   model: 'gemini-2.0-flash',
  //   contents: [{ parts: [{ text: prompt }] }],
  // });
  // const text = result.text ?? '';
  // console.log('Raw AI response:', text);
  try {
    const ai = new GoogleGenAI({ apiKey: "AIzaSyCJobF0XKy-KCeCwRkx8AyygPJmukEUw-o" });
    const result = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [{ parts: [{ text: prompt }] }],
    });
    const text = result.text ?? '';
    console.log('Raw AI response:', text);
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      console.error("❌ Failed to extract JSON from AI response.");
    }
    const jsonString = match[0];
    
    try {
      const parsed = JSON.parse(jsonString);
      console.log("✅ Parsed JSON:", parsed);
      return parsed;
      // Optional: validate it
      // const validationResult = GeminiSchema.safeParse(parsed);
      // console.log(validationResult.success ? '✅ Valid schema' : validationResult.error);
    
    }
    // const parsed = JSON.parse(text);
    // const validationResult = GeminiSchema.safeParse(parsed);

    // if (!validationResult.success) {
    //   console.error('❌ Schema validation failed:', validationResult.error.message);
    //   throw new Error(`Gemini response validation failed: ${validationResult.error.message}`);
    // }

    // console.log('🎉 AI game data generated successfully:', validationResult.data);
    // return validationResult.data;

  catch (error) {
    console.log('💥 Error in generateAIGameData (SDK):', error);
    // Fallback data
    return {
      aiPersona: "A fallback AI persona",
      clues: ["fallback clue 1", "fallback clue 2", "fallback clue 3"],
      userPersonas: ["fallback user 1", "fallback user 2", "fallback user 3"]
    };
  }
}
catch (err) {
  console.log('💥 Error in generateAIGameData (SDK):', err);
  throw err;
}
};

export const createAIGameData = async ({
  redis,
  sessionId,
}: {
  redis: any;
  sessionId: string;
}): Promise<AIGameData> => {
  console.log(`🎮 Creating AI game data for session: ${sessionId}`);
  
// const existing = await getAIGameData({ redis, sessionId });
//   if (existing) {
//     console.log('♻️ Found existing AI game data for session:', sessionId);
//     return existing;
//   }

  console.log('🆕 Generating new AI game data...');
  const gameData = await generateAIGameData();

  if (!gameData) {
    console.error('❌ AI game data generation returned null or undefined.');
    throw new Error('Failed to generate AI game data.');
  }
  console.log('📊 Generated game data:', gameData);

  const aiGameData: AIGameData = {
    ...gameData,
    sessionId,
    createdAt: Date.now(),
  };

  try {
    console.log('💾 Storing AI game data in Redis...');
    await redis.set(getAIGameDataKey(sessionId), JSON.stringify(aiGameData));
    console.log('✅ AI game data created and stored successfully');
  } catch (error) {
    console.error('❌ Failed to store AI game data in Redis:', error);
    throw error; // Re-throw the error to be caught by the caller
  }
  
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
  try{
  if (data) {
    console.log('✅ Found AI game data in Redis');
    const parsed = JSON.parse(data);
    console.log('📋 AI game data:', parsed);
    const aiGameData: AIGameData = {
      ...data,
      sessionId,
      createdAt: Date.now(),
   };
    return aiGameData;
  }
  }catch (err) {
    console.log('❌ Failed to get AI game data from Redis:', err);
    console.error(err.stack)
    return null;
    //throw err; // Re-throw the error to be caught by the caller
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