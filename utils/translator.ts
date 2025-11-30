import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

export async function translateText(
  text: string, 
  sourceLanguage: string, 
  targetLanguage: string
): Promise<string> {
  if (!text || !text.trim()) return '';

  try {
    const prompt = `
      Translate the following text from ${sourceLanguage} to ${targetLanguage}.
      Do not add any explanations, notes, or quotes. Just provide the direct translation.
      
      Text: "${text}"
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text?.trim() || '';
  } catch (error) {
    console.error("Translation failed:", error);
    return text; // Fallback to original text on failure
  }
}