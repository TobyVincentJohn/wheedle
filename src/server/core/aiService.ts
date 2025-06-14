// src/generate.js

import 'dotenv/config';
import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const schema = z.object({
  aiPersona: z.string(),
  clues: z.tuple([z.string(), z.string(), z.string()]),
  userPersonas: z.tuple([z.string(), z.string(), z.string()]),
});

export const generateAIGameData = async () => {
  const prompt = `
Respond only with JSON matching:
{
  "aiPersona": string,
  "clues": [string, string, string],
  "userPersonas": [string, string, string]
}
Clues get progressively more revealing. No extra fields.
`;
  const res = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
  });

  const text = res.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new Error(`Invalid JSON:\n${text}`);
  }

  const safe = schema.safeParse(parsed);
  if (!safe.success) {
    throw new Error(`Schema error: ${JSON.stringify(safe.error.format())}`);
  }

  return safe.data; // { aiPersona, clues, userPersonas }
};

if (require.main === module) {
  generateAIGameData()
    .then(console.log)
    .catch(err => { console.error(err); process.exit(1); });
}
