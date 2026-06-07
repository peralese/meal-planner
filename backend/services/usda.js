import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const USDA_BASE = process.env.USDA_API_BASE || 'https://api.nal.usda.gov/fdc/v1';

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
  try {
    const { data } = await axios.get(`${USDA_BASE}/foods/search`, {
      params: { query: ingredientName, pageSize: 1 },
      timeout: 10000,
    });

    const food = data.foods?.[0];
    if (!food) return { name: ingredientName, usda_fdc_id: null, calories_per_serving: null, protein_g: null, carbs_g: null, fat_g: null };

    const nutrients = {};
    for (const [key, id] of Object.entries(NUTRIENT_IDS)) {
      const n = food.foodNutrients?.find(fn => fn.nutrientId === id);
      nutrients[key] = n ? n.value : null;
    }

    return {
      name: ingredientName,
      usda_fdc_id: food.fdcId,
      calories_per_serving: nutrients.calories,
      protein_g: nutrients.protein_g,
      carbs_g: nutrients.carbs_g,
      fat_g: nutrients.fat_g,
    };
  } catch {
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
