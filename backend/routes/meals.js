import { Router } from 'express';
import db from '../db.js';

const router = Router();

router.get('/', (req, res) => {
  const { week_id } = req.query;
  if (!week_id) return res.status(400).json({ error: 'week_id query param is required' });
  const meals = db.prepare('SELECT * FROM meals WHERE week_id = ? ORDER BY day_of_week').all(week_id);
  const mealsWithIngredients = meals.map(meal => ({
    ...meal,
    ingredients: db.prepare('SELECT * FROM ingredients WHERE meal_id = ?').all(meal.id),
  }));
  res.json(mealsWithIngredients);
});

router.post('/', (req, res) => {
  const { week_id, day_of_week, meal_name, recipe_url, notes, servings } = req.body;
  if (!week_id || day_of_week === undefined || !meal_name) {
    return res.status(400).json({ error: 'week_id, day_of_week, and meal_name are required' });
  }
  const result = db.prepare(
    `INSERT INTO meals (week_id, day_of_week, meal_name, recipe_url, notes, servings)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(week_id, day_of_week, meal_name, recipe_url || null, notes || null, servings || 4);
  const meal = db.prepare('SELECT * FROM meals WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ ...meal, ingredients: [] });
});

router.put('/:id', (req, res) => {
  const { meal_name, recipe_url, notes, servings, ingredients } = req.body;
  const meal = db.prepare('SELECT * FROM meals WHERE id = ?').get(req.params.id);
  if (!meal) return res.status(404).json({ error: 'Meal not found' });

  db.prepare(
    `UPDATE meals SET meal_name = ?, recipe_url = ?, notes = ?, servings = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).run(
    meal_name ?? meal.meal_name,
    recipe_url !== undefined ? recipe_url : meal.recipe_url,
    notes !== undefined ? notes : meal.notes,
    servings ?? meal.servings,
    req.params.id
  );

  if (Array.isArray(ingredients)) {
    db.prepare('DELETE FROM ingredients WHERE meal_id = ?').run(req.params.id);
    const insertIngredient = db.prepare(
      `INSERT INTO ingredients (meal_id, name, quantity, unit, usda_fdc_id, calories_per_serving, protein_g, carbs_g, fat_g)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const ing of ingredients) {
      insertIngredient.run(
        req.params.id,
        ing.name,
        ing.quantity || null,
        ing.unit || null,
        ing.usda_fdc_id || null,
        ing.calories_per_serving || null,
        ing.protein_g || null,
        ing.carbs_g || null,
        ing.fat_g || null
      );
    }
  }

  const updated = db.prepare('SELECT * FROM meals WHERE id = ?').get(req.params.id);
  const updatedIngredients = db.prepare('SELECT * FROM ingredients WHERE meal_id = ?').all(req.params.id);
  res.json({ ...updated, ingredients: updatedIngredients });
});

router.delete('/:id', (req, res) => {
  const meal = db.prepare('SELECT * FROM meals WHERE id = ?').get(req.params.id);
  if (!meal) return res.status(404).json({ error: 'Meal not found' });
  db.prepare('DELETE FROM meals WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

export default router;
