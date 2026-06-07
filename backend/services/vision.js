import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const VISION_MODEL = process.env.VISION_MODEL || 'llava:13b';

const PROMPT = `You are a recipe extraction assistant. Extract the recipe from this image and return ONLY valid JSON with no markdown or explanation. The JSON must match this exact schema: { "meal_name": string or null, "ingredients": [{ "name": string, "quantity": string or null, "unit": string or null }], "servings": number or null, "instructions": string or null }. If a field is not visible in the image, use null.`;

export async function extractFromImage(imageBuffer) {
  try {
    const base64 = imageBuffer.toString('base64');
    const response = await axios.post(
      `${OLLAMA_BASE_URL}/api/generate`,
      {
        model: VISION_MODEL,
        prompt: PROMPT,
        images: [base64],
        stream: false,
      },
      { timeout: 120000 }
    );

    const raw = response.data.response;
    // Strip any markdown code fences if present
    const jsonStr = raw.replace(/```(?:json)?\n?/g, '').trim();
    const parsed = JSON.parse(jsonStr);

    return {
      meal_name: parsed.meal_name || null,
      ingredients: Array.isArray(parsed.ingredients) ? parsed.ingredients : [],
      instructions: parsed.instructions || null,
      servings: parsed.servings || null,
      source: 'vision',
    };
  } catch (err) {
    if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND' || err.code === 'ETIMEDOUT') {
      return { error: 'Ollama not available. Is it running?' };
    }
    if (err instanceof SyntaxError) {
      return { error: 'Ollama returned an unexpected response. Try again or enter ingredients manually.' };
    }
    return { error: `Vision extraction failed: ${err.message}` };
  }
}
