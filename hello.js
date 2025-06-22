import { GoogleGenAI } from '@google/genai';
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

  // Optional: validate it
  // const validationResult = GeminiSchema.safeParse(parsed);
  // console.log(validationResult.success ? '✅ Valid schema' : validationResult.error);

} catch (err) {
  console.error("💥 JSON parsing failed:", err);
}