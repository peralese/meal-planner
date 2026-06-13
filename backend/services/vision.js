import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const VISION_PROVIDER = (process.env.VISION_PROVIDER || 'ollama').toLowerCase();
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const VISION_MODEL = process.env.VISION_MODEL || 'llava:13b';
const OPENAI_API_BASE = process.env.OPENAI_API_BASE || 'https://api.openai.com/v1';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_VISION_MODEL = process.env.OPENAI_VISION_MODEL || 'gpt-4o-mini';

const PROMPT = `You are a recipe extraction assistant. Extract the recipe from this image and return ONLY valid JSON with no markdown or explanation. The JSON must match this exact schema: { "meal_name": string or null, "ingredients": [{ "name": string, "quantity": string or null, "unit": string or null }], "servings": number or null, "instructions": string or null }. If a field is not visible in the image, use null.`;

const RECIPE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['meal_name', 'ingredients', 'servings', 'instructions'],
  properties: {
    meal_name: { type: ['string', 'null'] },
    ingredients: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'quantity', 'unit'],
        properties: {
          name: { type: 'string' },
          quantity: { type: ['string', 'null'] },
          unit: { type: ['string', 'null'] },
        },
      },
    },
    servings: { type: ['number', 'null'] },
    instructions: { type: ['string', 'null'] },
  },
};

function normalizeRecipe(parsed, source) {
  return {
    meal_name: parsed.meal_name || null,
    ingredients: Array.isArray(parsed.ingredients) ? parsed.ingredients : [],
    instructions: parsed.instructions || null,
    servings: parsed.servings || null,
    source,
  };
}

function extractOpenAIText(data) {
  if (data.output_text) return data.output_text;
  for (const item of data.output || []) {
    for (const content of item.content || []) {
      if (content.type === 'output_text' && content.text) return content.text;
    }
  }
  return null;
}

async function extractWithOpenAI(imageBuffer, mimeType = 'image/png') {
  if (!OPENAI_API_KEY) {
    return { error: 'OpenAI API key missing. Add OPENAI_API_KEY to backend/.env.' };
  }

  try {
    const base64 = imageBuffer.toString('base64');
    const response = await axios.post(
      `${OPENAI_API_BASE}/responses`,
      {
        model: OPENAI_VISION_MODEL,
        input: [
          {
            role: 'user',
            content: [
              { type: 'input_text', text: PROMPT },
              {
                type: 'input_image',
                image_url: `data:${mimeType};base64,${base64}`,
              },
            ],
          },
        ],
        text: {
          format: {
            type: 'json_schema',
            name: 'recipe_extraction',
            strict: true,
            schema: RECIPE_SCHEMA,
          },
        },
      },
      {
        timeout: 120000,
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const raw = extractOpenAIText(response.data);
    if (!raw) return { error: 'OpenAI returned an unexpected response. Try again or enter ingredients manually.' };
    return normalizeRecipe(JSON.parse(raw), 'openai');
  } catch (err) {
    if (err instanceof SyntaxError) {
      return { error: 'OpenAI returned invalid JSON. Try again or enter ingredients manually.' };
    }
    const status = err.response?.status;
    const message = err.response?.data?.error?.message || err.message;
    if (status === 401) return { error: 'OpenAI authentication failed. Check OPENAI_API_KEY in backend/.env.' };
    if (status === 429) return { error: 'OpenAI rate limit reached. Try again later.' };
    return { error: `OpenAI extraction failed: ${message}` };
  }
}

async function extractWithOllama(imageBuffer) {
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

    return normalizeRecipe(parsed, 'ollama');
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

export async function extractFromImage(imageBuffer, mimeType) {
  if (VISION_PROVIDER === 'openai') {
    return extractWithOpenAI(imageBuffer, mimeType);
  }
  return extractWithOllama(imageBuffer);
}
