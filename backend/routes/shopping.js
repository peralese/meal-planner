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

const CATEGORY_OVERRIDES = [
  ['pantry', /\b(beef|chicken|vegetable)?\s*(stock|broth)\b/],
  ['pantry', /\btomato\s+paste\b/],
  ['pantry', /\b(caesar|ceaser)?\s*salad\s+dressing\b|\bdressing\b/],
  ['pantry', /\bpaprika\b/],
  ['pantry', /\bgnocchi\b/],
  ['pantry', /\bwine\b/],
  ['meat', /\bpepperoni\b/],
  ['produce', /\b(mixed\s+)?veg(etables|tables)\b/],
];

function categorize(name) {
  const lower = name.toLowerCase();
  for (const [cat, pattern] of CATEGORY_OVERRIDES) {
    if (pattern.test(lower)) return cat;
  }
  for (const [cat, keywords] of Object.entries(CATEGORIES)) {
    if (keywords.some(k => lower.includes(k))) return cat;
  }
  return 'other';
}

function parseQuantity(qty) {
  if (!qty) return null;
  const s = String(qty).trim();
  // Mixed number, e.g. "1 1/2"
  const mixed = s.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) {
    const whole = parseInt(mixed[1], 10);
    const num = parseInt(mixed[2], 10);
    const den = parseInt(mixed[3], 10);
    if (den !== 0) return whole + num / den;
  }
  // Simple fraction, e.g. "1/2"
  const frac = s.match(/^(\d+)\/(\d+)$/);
  if (frac) {
    const num = parseInt(frac[1], 10);
    const den = parseInt(frac[2], 10);
    if (den !== 0) return num / den;
  }
  const n = parseFloat(s);
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
  'package': 'package', 'packages': 'package',
  'packet': 'packet', 'packets': 'packet',
  'stick': 'stick', 'sticks': 'stick',
  'piece': 'piece', 'pieces': 'piece',
  'clove': 'clove', 'cloves': 'clove',
  'breast': 'breast', 'breasts': 'breast',
};

const INGREDIENT_ALIASES = [
  ['beef stock', /\bbeef\s+(stock|broth)\b/],
  ['chicken stock', /\bchicken\s+(stock|broth)\b/],
  ['ground beef', /\bground\s+beef\b/],
  ['ground beef', /\bground\s+chuck\b/],
  ['ground turkey', /\bground\s+turkey\b/],
  ['chicken', /\bchicken\b/],
  ['mushroom', /\bmushrooms?\b/],
  ['onion', /\bonions?\b/],
  ['garlic', /\bgarlic\b/],
  ['mixed vegetable', /\b(mixed\s+)?veg(etables|tables)\b/],
];

const DISPLAY_NAMES = {
  'beef stock': 'Beef stock',
  'chicken stock': 'Chicken stock',
  'ground beef': 'Ground beef',
  'ground turkey': 'Ground turkey',
  chicken: 'Chicken',
  mushroom: 'Mushrooms',
  onion: 'Onion',
  garlic: 'Garlic',
  'mixed vegetable': 'Mixed vegetables',
};

function normalizeUnit(unit) {
  if (!unit) return null;
  const words = unit.toLowerCase().trim().split(/\s+/);
  const firstTwo = words.slice(0, 2).join(' ');
  return UNIT_NORMALIZE[firstTwo] || UNIT_NORMALIZE[words[0]] || null;
}

function ingredientText(ing) {
  return [ing.unit, ing.name].filter(Boolean).join(' ');
}

function normalizeIngredientName(text) {
  const lower = text
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/,.*$/, ' ')
    .replace(/\b(cooked|according|package|directions|minced|chopped|diced|sliced|grated|freshly|fresh|large|small)\b/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  for (const [key, pattern] of INGREDIENT_ALIASES) {
    if (pattern.test(lower)) return key;
  }

  return lower
    .split(' ')
    .map(word => {
      if (word.endsWith('ies') && word.length > 4) return `${word.slice(0, -3)}y`;
      if (word.endsWith('es') && word.length > 3) return word.slice(0, -2);
      if (word.endsWith('s') && word.length > 3) return word.slice(0, -1);
      return word;
    })
    .join(' ');
}

function displayNameFor(key, ing) {
  return DISPLAY_NAMES[key] || ing.name;
}

function formatAmount(quantity, unit) {
  return [quantity, unit].filter(Boolean).join(' ');
}

function amountUnitFor(ing, key) {
  const normUnit = normalizeUnit(ing.unit);
  if (normUnit) return normUnit;

  const firstNameWord = ing.name?.toLowerCase().match(/[a-z]+/)?.[0];
  if (DISPLAY_NAMES[key] && firstNameWord && UNIT_NORMALIZE[firstNameWord]) {
    return UNIT_NORMALIZE[firstNameWord];
  }

  return null;
}

function combineAmounts(existing, ing, amountUnit) {
  const addQty = parseQuantity(ing.quantity);
  const sameUnit = existing.unit && amountUnit && existing.unit === amountUnit;
  const neitherHasUnit = !existing.unit && !amountUnit;

  if ((sameUnit || neitherHasUnit) && addQty !== null && existing.parsedQty !== null) {
    existing.parsedQty += addQty;
    existing.quantity = String(existing.parsedQty);
    existing.amountText = formatAmount(existing.quantity, existing.unit);
    return;
  }

  const amounts = [existing.amountText, formatAmount(ing.quantity, amountUnit)].filter(Boolean);
  existing.amountText = amounts.join(' + ');
  existing.quantity = existing.amountText;
  existing.unit = null;
  existing.parsedQty = null;
}

router.get('/', (req, res) => {
  const { week_id } = req.query;
  if (!week_id) return res.status(400).json({ error: 'week_id query param is required' });

  const meals = db.prepare('SELECT id FROM meals WHERE week_id = ?').all(week_id);
  if (!meals.length) return res.json({ produce: [], dairy: [], meat: [], pantry: [], other: [] });

  const mealIds = meals.map(m => m.id);
  const placeholders = mealIds.map(() => '?').join(',');
  const ingredients = db
    .prepare(`SELECT * FROM ingredients WHERE meal_id IN (${placeholders})`)
    .all(...mealIds);

  // Aggregate by normalized grocery item so recipe-specific wording does not duplicate the list.
  const map = new Map();
  for (const ing of ingredients) {
    const fullText = ingredientText(ing);
    const key = normalizeIngredientName(fullText);
    if (!key) continue;
    const amountUnit = amountUnitFor(ing, key);

    if (map.has(key)) {
      const existing = map.get(key);
      combineAmounts(existing, ing, amountUnit);
    } else {
      map.set(key, {
        name: displayNameFor(key, ing),
        quantity: ing.quantity,
        parsedQty: parseQuantity(ing.quantity),
        unit: amountUnit,
        amountText: formatAmount(ing.quantity, amountUnit),
        category: categorize(fullText),
      });
    }
  }

  const grouped = { produce: [], dairy: [], meat: [], pantry: [], other: [] };
  for (const item of map.values()) {
    const { parsedQty, amountText, ...rest } = item;
    grouped[item.category].push(rest);
  }

  for (const cat of Object.keys(grouped)) {
    grouped[cat].sort((a, b) => a.name.localeCompare(b.name));
  }

  res.json(grouped);
});

export default router;
