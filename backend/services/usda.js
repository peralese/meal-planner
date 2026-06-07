import axios from 'axios';
import dotenv from 'dotenv';
import db from '../db.js';

dotenv.config();

const USDA_BASE = process.env.USDA_API_BASE || 'https://api.nal.usda.gov/fdc/v1';
const USDA_API_KEY = process.env.USDA_API_KEY || 'DEMO_KEY';

const NUTRIENT_IDS = {
  calories: 1008,
  protein_g: 1003,
  carbs_g: 1005,
  fat_g: 1004,
};

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function lookupOne(ingredientName) {
  const cached = db.prepare('SELECT * FROM nutrition_cache WHERE name = ? COLLATE NOCASE').get(ingredientName);
  if (cached) return { name: ingredientName, usda_fdc_id: cached.usda_fdc_id, calories_per_serving: cached.calories_per_serving, protein_g: cached.protein_g, carbs_g: cached.carbs_g, fat_g: cached.fat_g };

  try {
    const { data } = await axios.get(`${USDA_BASE}/foods/search`, {
      params: { query: ingredientName, pageSize: 1, api_key: USDA_API_KEY },
      timeout: 10000,
    });

    if (data.error) {
      const msg = data.error.message || 'USDA API error';
      if (data.error.code === 'OVER_RATE_LIMIT' || data.error.code === 'API_KEY_MISSING') throw new Error(msg);
      return { name: ingredientName, usda_fdc_id: null, calories_per_serving: null, protein_g: null, carbs_g: null, fat_g: null };
    }

    const food = data.foods?.[0];
    if (!food) return { name: ingredientName, usda_fdc_id: null, calories_per_serving: null, protein_g: null, carbs_g: null, fat_g: null };

    const nutrients = {};
    for (const [key, id] of Object.entries(NUTRIENT_IDS)) {
      const n = food.foodNutrients?.find(fn => fn.nutrientId === id);
      nutrients[key] = n ? n.value : null;
    }

    const result = {
      name: ingredientName,
      usda_fdc_id: food.fdcId,
      calories_per_serving: nutrients.calories,
      protein_g: nutrients.protein_g,
      carbs_g: nutrients.carbs_g,
      fat_g: nutrients.fat_g,
    };

    if (result.calories_per_serving != null) {
      db.prepare(`INSERT OR REPLACE INTO nutrition_cache (name, usda_fdc_id, calories_per_serving, protein_g, carbs_g, fat_g)
        VALUES (?, ?, ?, ?, ?, ?)`).run(ingredientName, result.usda_fdc_id, result.calories_per_serving, result.protein_g, result.carbs_g, result.fat_g);
    }

    return result;
  } catch (err) {
    if (err.message?.includes('rate limit') || err.message?.includes('API_KEY')) throw err;
    return { name: ingredientName, usda_fdc_id: null, calories_per_serving: null, protein_g: null, carbs_g: null, fat_g: null };
  }
}

export async function lookupNutrition(ingredients) {
  const results = [];
  for (const ing of ingredients) {
    const name = typeof ing === 'string' ? ing : ing.name;
    const result = await lookupOne(name);
    results.push(result);
    await delay(200);
  }
  return results;
}
