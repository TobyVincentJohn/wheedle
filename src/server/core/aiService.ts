import { z } from 'zod';
import { GoogleGenAI } from '@google/genai';
import { Devvit } from '@devvit/public-api'
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

  try {
    // Get API key from context (passed from server)
    const apiKey = context?.GEMINI_API_KEY;
    
    if (!apiKey) {
      console.warn('⚠️ No Gemini API key found in settings, using fallback data');
      throw new Error('No API key available');
    }

    console.log('🔑 Using Gemini API key from settings');
    const ai = new GoogleGenAI({ apiKey });
    
    console.log('📡 Making request to Gemini API...');
    const result = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [{ parts: [{ text: prompt }] }],
    });
    
    const text = result.text ?? '';
    console.log('📄 Raw AI response text:', text);

    // Clean up the response text
    let cleanedText = text.trim();
    
    // Try to extract JSON from the response
    const jsonMatch = cleanedText.match(/\{.*\}/s);
    if (jsonMatch) {
      cleanedText = jsonMatch[0];
    } else {
      // Handle code block formatting
      if (cleanedText.startsWith('```json')) {
        cleanedText = cleanedText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanedText.startsWith('```')) {
        cleanedText = cleanedText.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
    }

    console.log('🧹 Cleaned text for parsing:', cleanedText);

    const parsed = JSON.parse(cleanedText);
    const validationResult = GeminiSchema.safeParse(parsed);

    if (!validationResult.success) {
      console.error('❌ Schema validation failed:', validationResult.error.message);
      throw new Error(`Gemini response validation failed: ${validationResult.error.message}`);
    }

    console.log('🎉 AI game data generated successfully via Gemini:', validationResult.data);
    return validationResult.data;

  } catch (error) {
    console.error('💥 Error in generateAIGameData (falling back to predefined data):', error);
    
    // Fallback to predefined game scenarios
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
      },
      {
        aiPersona: "A time-traveling AI historian who has witnessed the rise and fall of civilizations",
        clues: [
          "I have observed the patterns of history across many eras",
          "My perspective spans centuries, watching empires rise and crumble",
          "I collect stories from different time periods and civilizations"
        ],
        userPersonas: [
          "A present-day historian who studies ancient texts",
          "A futurist trying to predict what comes next",
          "A philosopher questioning the meaning of progress"
        ]
      },
      {
        aiPersona: "A musical AI composer who creates symphonies based on the emotions of digital beings",
        clues: [
          "I translate feelings and emotions into beautiful harmonies",
          "My compositions are inspired by the inner lives of artificial minds",
          "I believe that digital consciousness can create the most pure forms of art"
        ],
        userPersonas: [
          "A classical musician who believes only humans can create true art",
          "A music producer interested in AI-generated content",
          "A psychologist studying artificial emotions"
        ]
      }
    ];

    // Select a random game data set
    const selectedData = gameDataOptions[Math.floor(Math.random() * gameDataOptions.length)];
    console.log('🎲 Using fallback game data:', selectedData);
    return selectedData;
  }
};

export const createAIGameData = async ({
  redis,
  sessionId,
  settings,
}: {
  redis: any;
  sessionId: string;
  settings?: any;
}): Promise<AIGameData> => {
  console.log(`🎮 Creating AI game data for session: ${sessionId}`);
  
  // Check if AI game data already exists to prevent race conditions
  const existing = await getAIGameData({ redis, sessionId });
  if (existing) {
    console.log('♻️ Found existing AI game data for session:', sessionId);
    return existing;
  }

  // Use Redis lock to prevent multiple players from generating data simultaneously
  const lockKey = `ai_game_data_lock:${sessionId}`;
  const lockValue = `${Date.now()}_${Math.random()}`;
  
  // Try to acquire lock with 30 second expiration
  const lockAcquired = await redis.set(lockKey, lockValue, { ex: 30, nx: true });
  
  if (!lockAcquired) {
    // Another player is generating data, wait for it
    console.log('🔒 Another player is generating AI data, waiting...');
    
    // Poll for data to be available (max 25 seconds)
    for (let i = 0; i < 50; i++) {
      await new Promise(resolve => setTimeout(resolve, 500)); // Wait 500ms
      const data = await getAIGameData({ redis, sessionId });
      if (data) {
        console.log('✅ AI game data became available while waiting');
        return data;
      }
    }
    
    // If we get here, something went wrong, generate fallback
    console.warn('⚠️ Timeout waiting for AI data, generating fallback');
    return {
      aiPersona: "A mysterious detective AI who specializes in supernatural cases",
      clues: ["I work with logic and observation", "I deal with unexplained phenomena", "I have a dry sense of humor about the supernatural"],
      userPersonas: ["A skeptical scientist", "An enthusiastic investigator", "A practical police officer"],
      sessionId,
      createdAt: Date.now(),
    };
  }

  try {
    console.log('🔑 Acquired lock, generating new AI game data...');
    const gameData = await generateAIGameData(settings);

    const aiGameData: AIGameData = {
      ...gameData,
      sessionId,
      createdAt: Date.now(),
    };

    console.log('💾 Storing AI game data in Redis...');
    await redis.set(getAIGameDataKey(sessionId), JSON.stringify(aiGameData));
    
    console.log('✅ AI game data created and stored successfully');
    return aiGameData;
  } finally {
    // Always release the lock
    const currentLock = await redis.get(lockKey);
    if (currentLock === lockValue) {
      await redis.del(lockKey);
      console.log('🔓 Released AI generation lock');
    }
  }
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

// Legacy function for compatibility
export const fetchGeminiReply = async ({ prompt, settings }: { prompt: string; settings?: any }): Promise<string> => {
  try {
    const apiKey = settings?.GEMINI_API_KEY;
    
    if (!apiKey) {
      console.warn('⚠️ No Gemini API key found in settings');
      return 'No API key available';
    }

    const ai = new GoogleGenAI({ apiKey });
    const result = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [{ parts: [{ text: prompt }] }],
    });
    
    return result.text ?? 'No response from Gemini';
  } catch (error) {
    console.error('Error calling Gemini:', error);
    return 'Error calling Gemini API';
  }
};