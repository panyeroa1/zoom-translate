
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
      You are a professional translator.
      Source Language: ${sourceLanguage === 'Auto Detect' ? 'Detect language' : sourceLanguage}
      Target Language: ${targetLanguage}
      
      Task: Translate the following text accurately and naturally.
      - Maintain the original tone and intent.
      - Output ONLY the translation.
      - Do not include "Translation:" or any other labels.

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
