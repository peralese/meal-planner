import { Router } from 'express';
import db from '../db.js';
import { lookupNutrition } from '../services/usda.js';

const router = Router();

router.post('/lookup', async (req, res) => {
  const { ingredients } = req.body;
  if (!Array.isArray(ingredients) || ingredients.length === 0) {
    return res.status(400).json({ error: 'ingredients array is required' });
  }
  const results = await lookupNutrition(ingredients);
  res.json(results);
});

router.get('/meal/:meal_id', (req, res) => {
  const ingredients = db.prepare('SELECT * FROM ingredients WHERE meal_id = ?').all(req.params.meal_id);
  if (!ingredients.length) return res.json({ calories: null, protein_g: null, carbs_g: null, fat_g: null });

  const sum = ingredients.reduce(
    (acc, ing) => ({
      calories: acc.calories + (ing.calories_per_serving || 0),
      protein_g: acc.protein_g + (ing.protein_g || 0),
      carbs_g: acc.carbs_g + (ing.carbs_g || 0),
      fat_g: acc.fat_g + (ing.fat_g || 0),
    }),
    { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
  );

  const hasData = ingredients.some(i => i.calories_per_serving !== null);
  res.json(hasData ? sum : { calories: null, protein_g: null, carbs_g: null, fat_g: null });
});

export default router;
