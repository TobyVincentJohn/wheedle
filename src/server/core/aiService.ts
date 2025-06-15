import { z } from 'zod';

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

export const generateAIGameData = async (settings: any): Promise<Omit<AIGameData, 'sessionId' | 'createdAt'>> => {
  console.log('🤖 Starting AI game data generation...');
  
  const apiKey = await settings.get('GEMINI_API_KEY');
  if (!apiKey) {
    console.error('❌ GEMINI_API_KEY is not set');
    throw new Error('GEMINI_API_KEY is not set. Use `npx devvit settings set GEMINI_API_KEY` to set it.');
  }
  
  console.log('✅ API key found, length:', apiKey.length);

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

  console.log('📝 Sending prompt to Gemini API...');
  console.log('Prompt length:', prompt.length);

  try {
    const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.9,
          topK: 1,
          topP: 1,
          maxOutputTokens: 2048,
        },
      }),
    });

    console.log('📡 Gemini API response status:', res.status);
    console.log('📡 Gemini API response headers:', Object.fromEntries(res.headers.entries()));

    if (!res.ok) {
      const errorText = await res.text();
      console.error('❌ Gemini API error response:', errorText);
      throw new Error(`Gemini API error: ${res.status} - ${errorText}`);
    }

    const json = await res.json();
    console.log('📦 Full Gemini response:', JSON.stringify(json, null, 2));

    const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      console.error('❌ No text found in Gemini response');
      console.error('Response structure:', JSON.stringify(json, null, 2));
      throw new Error('Invalid Gemini response: missing text');
    }

    console.log('📄 Raw AI response text:', text);

    // Clean up the response text (remove markdown code blocks if present)
    let cleanedText = text.trim();
    
    // Extract JSON from first { to last } using regex
    const jsonMatch = cleanedText.match(/\{.*\}/s);
    if (jsonMatch) {
      cleanedText = jsonMatch[0];
    } else {
      // Fallback: remove markdown code blocks if present
      if (cleanedText.startsWith('```json')) {
        cleanedText = cleanedText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanedText.startsWith('```')) {
        cleanedText = cleanedText.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
    }

    console.log('🧹 Cleaned AI response text:', cleanedText);

    let parsed;
    try {
      parsed = JSON.parse(cleanedText);
      console.log('✅ Successfully parsed JSON:', parsed);
    } catch (err) {
      console.error('❌ Failed to parse JSON:', err);
      console.error('Text that failed to parse:', cleanedText);
      throw new Error(`Failed to parse Gemini JSON response: ${err}`);
    }

    const result = GeminiSchema.safeParse(parsed);
    if (!result.success) {
      console.error('❌ Schema validation failed:', result.error.message);
      console.error('Parsed data:', parsed);
      throw new Error(`Gemini response validation failed: ${result.error.message}`);
    }

    console.log('🎉 AI game data generated successfully:', result.data);
    return result.data;

  } catch (error) {
    console.error('💥 Error in generateAIGameData:', error);
    
    // Fallback data if AI fails
    console.log('🔄 Using fallback AI game data...');
    const fallbackData = {
      aiPersona: "A mysterious detective AI who specializes in supernatural cases and has a dry sense of humor",
      clues: [
        "I work in a profession that requires careful observation and logical thinking",
        "My cases often involve things that others might consider impossible or unexplained", 
        "I have a particular fondness for sarcastic remarks when dealing with the supernatural"
      ] as [string, string, string],
      userPersonas: [
        "A skeptical scientist who doesn't believe in the paranormal",
        "An enthusiastic paranormal investigator who believes everything",
        "A local police officer who just wants to solve cases practically"
      ] as [string, string, string]
    };
    
    console.log('📋 Fallback data:', fallbackData);
    return fallbackData;
  }
};

export const createAIGameData = async ({
  redis,
  settings,
  sessionId,
}: {
  redis: any;
  settings: any;
  sessionId: string;
}): Promise<AIGameData> => {
  console.log(`🎮 Creating AI game data for session: ${sessionId}`);
  
  const existing = await getAIGameData({ redis, sessionId });
  if (existing) {
    console.log('♻️ Found existing AI game data for session:', sessionId);
    return existing;
  }

  console.log('🆕 Generating new AI game data...');
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