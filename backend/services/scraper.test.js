import test from 'node:test';
import assert from 'node:assert/strict';
import * as cheerio from 'cheerio';
import { getBestTitle } from './scraper.js';

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
