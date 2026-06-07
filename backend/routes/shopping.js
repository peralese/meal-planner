import { Router } from 'express';
import db from '../db.js';

const router = Router();

const CATEGORIES = {
  produce: ['lettuce', 'spinach', 'kale', 'broccoli', 'cauliflower', 'carrot', 'celery', 'onion', 'garlic',
    'tomato', 'pepper', 'zucchini', 'squash', 'potato', 'sweet potato', 'mushroom', 'cucumber',
    'avocado', 'lemon', 'lime', 'orange', 'apple', 'banana', 'berry', 'fruit', 'vegetable',
    'herb', 'cilantro', 'parsley', 'basil', 'mint', 'thyme', 'rosemary', 'ginger', 'scallion',
    'green onion', 'leek', 'asparagus', 'green bean', 'corn', 'pea', 'cabbage', 'bok choy'],
  dairy: ['milk', 'cream', 'butter', 'cheese', 'yogurt', 'sour cream', 'half and half',
    'cheddar', 'mozzarella', 'parmesan', 'ricotta', 'feta', 'brie', 'gouda', 'egg'],
  meat: ['chicken', 'beef', 'pork', 'turkey', 'lamb', 'fish', 'salmon', 'tuna', 'shrimp',
    'lobster', 'crab', 'scallop', 'tilapia', 'cod', 'halibut', 'sausage', 'bacon',
    'ham', 'steak', 'ground beef', 'ground turkey', 'brisket', 'tenderloin'],
  pantry: ['flour', 'sugar', 'salt', 'pepper', 'oil', 'vinegar', 'soy sauce', 'sauce',
    'stock', 'broth', 'tomato', 'can', 'pasta', 'rice', 'bread', 'cracker', 'cereal',
    'oat', 'bean', 'lentil', 'chickpea', 'nut', 'seed', 'spice', 'seasoning',
    'baking powder', 'baking soda', 'yeast', 'honey', 'maple syrup', 'jam', 'peanut butter',
    'mayonnaise', 'mustard', 'ketchup', 'hot sauce', 'worcestershire', 'coconut milk',
    'dried', 'powder', 'flake', 'extract'],
};

function categorize(name) {
  const lower = name.toLowerCase();
  for (const [cat, keywords] of Object.entries(CATEGORIES)) {
    if (keywords.some(k => lower.includes(k))) return cat;
  }
  return 'other';
}

function parseQuantity(qty) {
  if (!qty) return null;
  const n = parseFloat(qty);
  return isNaN(n) ? null : n;
}

const UNIT_NORMALIZE = {
  'tsp': 'tsp', 'teaspoon': 'tsp', 'teaspoons': 'tsp',
  'tbsp': 'tbsp', 'tablespoon': 'tbsp', 'tablespoons': 'tbsp',
  'cup': 'cup', 'cups': 'cup',
  'oz': 'oz', 'ounce': 'oz', 'ounces': 'oz',
  'lb': 'lb', 'lbs': 'lb', 'pound': 'lb', 'pounds': 'lb',
  'g': 'g', 'gram': 'g', 'grams': 'g',
  'kg': 'kg', 'kilogram': 'kg',
  'ml': 'ml', 'milliliter': 'ml',
  'l': 'l', 'liter': 'l', 'liters': 'l',
};

function normalizeUnit(unit) {
  if (!unit) return null;
  return UNIT_NORMALIZE[unit.toLowerCase().trim()] || unit.toLowerCase().trim();
}

router.get('/', (req, res) => {
  const { week_id } = req.query;
  if (!week_id) return res.status(400).json({ error: 'week_id query param is required' });

  const meals = db.prepare('SELECT id FROM meals WHERE week_id = ?').all(week_id);
  if (!meals.length) return res.json({ produce: [], dairy: [], meat: [], pantry: [], other: [] });

  const mealIds = meals.map(m => m.id);
  const placeholders = mealIds.map(() => '?').join(',');
  const ingredients = db
    .prepare(`SELECT i.*, m.meal_name FROM ingredients i JOIN meals m ON i.meal_id = m.id WHERE i.meal_id IN (${placeholders})`)
    .all(...mealIds);

  // Aggregate by name + normalized unit
  const map = new Map();
  for (const ing of ingredients) {
    const normUnit = normalizeUnit(ing.unit);
    const key = `${ing.name.toLowerCase()}__${normUnit || ''}`;
    if (map.has(key)) {
      const existing = map.get(key);
      const addQty = parseQuantity(ing.quantity);
      if (addQty !== null && existing.parsedQty !== null) {
        existing.parsedQty += addQty;
        existing.quantity = String(existing.parsedQty);
      } else {
        existing.quantity = [existing.quantity, ing.quantity].filter(Boolean).join(' + ');
        existing.parsedQty = null;
      }
      existing.meals.push(ing.meal_name);
    } else {
      map.set(key, {
        name: ing.name,
        quantity: ing.quantity,
        parsedQty: parseQuantity(ing.quantity),
        unit: normUnit,
        category: categorize(ing.name),
        meals: [ing.meal_name],
      });
    }
  }

  const grouped = { produce: [], dairy: [], meat: [], pantry: [], other: [] };
  for (const item of map.values()) {
    const { parsedQty, ...rest } = item;
    grouped[item.category].push(rest);
  }

  for (const cat of Object.keys(grouped)) {
    grouped[cat].sort((a, b) => a.name.localeCompare(b.name));
  }

  res.json(grouped);
});

export default router;
