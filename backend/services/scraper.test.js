import test from 'node:test';
import assert from 'node:assert/strict';
import * as cheerio from 'cheerio';
import { extractWprmRecipe, getBestTitle, parseIngredientString } from './scraper.js';

test('parses only recognized measurement units', () => {
  const cases = [
    ['2 pounds lean beef sirloin, cut into cubes', {
      quantity: '2', unit: 'pounds', name: 'lean beef sirloin, cut into cubes',
    }],
    ['2 cups red wine', {
      quantity: '2', unit: 'cups', name: 'red wine',
    }],
    ['1 tablespoon balsamic vinegar', {
      quantity: '1', unit: 'tablespoon', name: 'balsamic vinegar',
    }],
    ['1 teaspoon Worcestershire sauce', {
      quantity: '1', unit: 'teaspoon', name: 'Worcestershire sauce',
    }],
    ['1 large garlic clove, whole', {
      quantity: '1', unit: null, name: 'large garlic clove, whole',
    }],
    ['2 large or 3 medium size bay leaves', {
      quantity: '2', unit: null, name: 'large or 3 medium size bay leaves',
    }],
    ['2 cups diced potatoes', {
      quantity: '2', unit: 'cups', name: 'diced potatoes',
    }],
  ];

  for (const [input, expected] of cases) {
    assert.deepEqual(parseIngredientString(input), expected);
  }
});

test('parses Unicode fractions and natural measures', () => {
  assert.deepEqual(parseIngredientString('½ teaspoon black pepper'), {
    quantity: '½',
    unit: 'teaspoon',
    name: 'black pepper',
  });
  assert.deepEqual(parseIngredientString('1 ½ cups cold water'), {
    quantity: '1 ½',
    unit: 'cups',
    name: 'cold water',
  });
  assert.deepEqual(parseIngredientString('A dash of cloves'), {
    quantity: '1',
    unit: 'dash',
    name: 'cloves',
  });
});

test('normalizes multiline ingredient text before generic parsing', () => {
  assert.deepEqual(parseIngredientString('2\n\t tbsp\n\t olive oil'), {
    quantity: '2',
    unit: 'tbsp',
    name: 'olive oil',
  });
});

test('extracts structured WordPress Recipe Maker fields and servings', () => {
  const $ = cheerio.load(`
    <div class="wprm-recipe">
      <h2 class="wprm-recipe-name">Sour Cream Chicken Enchiladas</h2>
      <span class="wprm-recipe-servings">8</span>
      <ul class="wprm-recipe-ingredients">
        <li class="wprm-recipe-ingredient">
          <span class="wprm-recipe-ingredient-amount">1</span>
          <span class="wprm-recipe-ingredient-unit">lb</span>
          <span class="wprm-recipe-ingredient-name">chicken breasts</span>
          <span class="wprm-recipe-ingredient-notes">boneless and skinless</span>
        </li>
        <li class="wprm-recipe-ingredient">
          <span class="wprm-recipe-ingredient-name">salt and pepper</span>
          <span class="wprm-recipe-ingredient-notes">to taste</span>
        </li>
      </ul>
    </div>
  `);

  const result = extractWprmRecipe($);
  assert.deepEqual(result.ingredients, [
    { quantity: '1', unit: 'lb', name: 'chicken breasts, boneless and skinless' },
    { quantity: null, unit: null, name: 'salt and pepper, to taste' },
  ]);
  assert.equal(result.servings, 8);
  assert.equal(getBestTitle($, result.referenceElement), 'Sour Cream Chicken Enchiladas');
});

test('prefers the recipe H1 preceding ingredients over a site-wide hero H1', () => {
  const $ = cheerio.load(`
    <main>
      <header><h1>Welcome to My Family Cookbook</h1></header>
      <section>
        <h1>My Personal Beef Stew Recipe (An Improvement over the Original)</h1>
        <h2>Ingredients</h2>
        <ul class="ingredients"><li>2 pounds beef</li></ul>
      </section>
    </main>
  `);

  assert.equal(
    getBestTitle($, $('.ingredients li')[0]),
    'My Personal Beef Stew Recipe (An Improvement over the Original)',
  );
});

test('still uses a recipe-specific container heading when present', () => {
  const $ = cheerio.load(`
    <h1>Cookbook Home</h1>
    <article class="recipe-card">
      <h2>Weeknight Chili</h2>
      <ul class="ingredients"><li>1 can beans</li></ul>
    </article>
  `);

  assert.equal(getBestTitle($, $('.ingredients li')[0]), 'Weeknight Chili');
});

test('skips an Ingredients heading in a nested recipe section', () => {
  const $ = cheerio.load(`
    <header><h1>Welcome to My Family Cookbook</h1></header>
    <div class="recipe-layout">
      <article class="recipe-content">
        <h1>My Personal Beef Stew Recipe (An Improvement over the Original)</h1>
        <section class="recipe-section">
          <h2><span aria-hidden="true">[]</span> Ingredients</h2>
          <ul><li>2 pounds beef</li></ul>
        </section>
      </article>
    </div>
  `);

  assert.equal(
    getBestTitle($, $('.recipe-section li')[0]),
    'My Personal Beef Stew Recipe (An Improvement over the Original)',
  );
});
