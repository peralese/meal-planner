import axios from 'axios';
import * as cheerio from 'cheerio';

const UNICODE_FRACTIONS = '¼½¾⅐⅑⅒⅓⅔⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞';
const MEASUREMENT_UNITS = new Set([
  'cup', 'cups',
  'tablespoon', 'tablespoons', 'tbsp', 'tbsps', 'tbsp.',
  'teaspoon', 'teaspoons', 'tsp', 'tsps', 'tsp.',
  'pound', 'pounds', 'lb', 'lbs', 'lb.',
  'ounce', 'ounces', 'oz', 'oz.',
  'fluid ounce', 'fluid ounces', 'fl oz', 'fl. oz.',
  'gram', 'grams', 'g',
  'kilogram', 'kilograms', 'kg',
  'milligram', 'milligrams', 'mg',
  'milliliter', 'milliliters', 'millilitre', 'millilitres', 'ml',
  'liter', 'liters', 'litre', 'litres', 'l',
  'pinch', 'pinches', 'dash', 'dashes',
]);

function extractUnit(text) {
  // Check two-word measurements before their one-word variants.
  const words = text.split(/\s+/);
  for (const length of [2, 1]) {
    const candidate = words.slice(0, length).join(' ').toLowerCase();
    if (MEASUREMENT_UNITS.has(candidate)) {
      return {
        unit: words.slice(0, length).join(' '),
        name: words.slice(length).join(' ').trim(),
      };
    }
  }
  return { unit: null, name: text.trim() };
}

export function parseIngredientString(str) {
  // HTML ingredient rows often contain indentation and line breaks between
  // amount, unit, and name spans. Treat all runs of whitespace as one space.
  const text = String(str || '').trim().replace(/\s+/g, ' ');
  if (!text) return { quantity: null, unit: null, name: '' };

  // Match integers, decimals, ASCII fractions, Unicode fractions, and mixed
  // quantities such as "1 1/2" or "1½".
  const quantityPattern = new RegExp(
    `^(\\d+(?:\\.\\d+)?(?:\\s+\\d+\\/\\d+|\\s*[${UNICODE_FRACTIONS}])?|\\d+\\/\\d+|[${UNICODE_FRACTIONS}])\\s+(.+)$`,
  );
  const quantityMatch = text.match(quantityPattern);

  if (quantityMatch) {
    const { unit, name } = extractUnit(quantityMatch[2]);
    return {
      quantity: quantityMatch[1].trim(),
      unit,
      name: name || quantityMatch[2].trim(),
    };
  }

  // Natural recipe measures such as "a dash of cloves".
  const articleMeasure = text.match(/^(?:a|an)\s+(dash|pinch)\s+(?:of\s+)?(.+)$/i);
  if (articleMeasure) {
    return {
      quantity: '1',
      unit: articleMeasure[1],
      name: articleMeasure[2].trim(),
    };
  }

  return { quantity: null, unit: null, name: text };
}

export function extractWprmRecipe($) {
  const rows = $('li.wprm-recipe-ingredient').toArray();
  if (!rows.length) return null;

  const ingredients = rows.map((row) => {
    const $row = $(row);
    const quantity = $row.find('.wprm-recipe-ingredient-amount').first().text().trim();
    const unit = $row.find('.wprm-recipe-ingredient-unit').first().text().trim();
    const ingredientName = $row.find('.wprm-recipe-ingredient-name').first().text().trim();
    const notes = $row.find('.wprm-recipe-ingredient-notes').first().text().trim();

    return {
      quantity: quantity || null,
      unit: unit || null,
      name: notes ? `${ingredientName}, ${notes}` : ingredientName,
    };
  }).filter(ingredient => ingredient.name);

  const servingsText = $('span.wprm-recipe-servings').first().text().trim()
    || $('[data-servings]').first().attr('data-servings')
    || $('#wprm-print-servings').attr('value');

  return {
    ingredients,
    servings: parseServings(servingsText),
    referenceElement: rows[0],
  };
}

function findRecipeInLd(data) {
  if (!data) return null;
  if (Array.isArray(data)) {
    for (const item of data) {
      const found = findRecipeInLd(item);
      if (found) return found;
    }
    return null;
  }
  if (data['@type'] === 'Recipe') return data;
  if (data['@graph']) return findRecipeInLd(data['@graph']);
  return null;
}

export function getBestTitle($, refEl) {
  const metaOg = $('meta[property="og:title"]').attr('content') || $('meta[name="twitter:title"]').attr('content');

  if (refEl) {
    try {
      const $ref = $(refEl);
      const recipeContainers = $ref
        .parents('article,[class*="recipe"],[class*="post"],[id*="recipe"],[id*="post"]')
        .toArray();

      // A nested wrapper such as `.recipe-section` may be the ingredients
      // section itself. Skip its structural heading and keep walking outward
      // until we find a heading that can actually name the recipe.
      const sectionLabels = /^(ingredients|directions|instructions|method|remarks|yield|source|recipe info|categories|popular tags)\b/i;
      for (const container of recipeContainers) {
        const headings = $(container).find('h1,h2').toArray();
        const titleHeading = headings.find((heading) => {
          const text = $(heading).text().trim().replace(/^[^\p{L}\p{N}]+/u, '');
          return text && !sectionLabels.test(text);
        });
        if (titleHeading) return $(titleHeading).text().trim();
      }

      // Prefer the last H1 before the ingredients. A broad <main> often also
      // contains a site-wide hero H1 before the actual recipe title.
      const refIndex = $('*').index(refEl);
      const precedingH1 = $('h1').toArray()
        .filter(el => $('*').index(el) < refIndex)
        .at(-1);
      const precedingH1Text = precedingH1 ? $(precedingH1).text().trim() : '';
      if (precedingH1Text) return precedingH1Text;

      const prevHeading = $ref.prevAll('h1,h2,h3').first().text().trim();
      if (prevHeading) return prevHeading;

      let parent = $ref.parent();
      for (let i = 0; i < 6 && parent && parent.length; i += 1) {
        const h = parent.find('h1,h2').last().text().trim();
        if (h) return h;
        parent = parent.parent();
      }
    } catch (e) {
      // ignore and fall through to other heuristics
    }
  }

  const firstH1 = $('h1').first().text().trim();
  if (firstH1) return firstH1;
  if (metaOg) return metaOg.trim();
  const titleTag = $('title').text().trim();
  return titleTag || null;
}

function parseServings(yield_) {
  if (!yield_) return null;
  if (typeof yield_ === 'number') return yield_;
  if (Array.isArray(yield_)) return parseServings(yield_[0]);
  const match = String(yield_).match(/\d+/);
  return match ? parseInt(match[0]) : null;
}

export async function scrapeRecipe(url) {
  try {
    const { data: html } = await axios.get(url, {
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    const $ = cheerio.load(html);
    let recipe = null;

    // Try JSON-LD first
    $('script[type="application/ld+json"]').each((_, el) => {
      if (recipe) return;
      try {
        const parsed = JSON.parse($(el).html());
        recipe = findRecipeInLd(parsed);
      } catch { /* skip malformed */ }
    });

    if (recipe) {
      const ingredients = (recipe.recipeIngredient || []).map(parseIngredientString);
      let nutrition = null;
      if (recipe.nutrition) {
        nutrition = {
          calories: recipe.nutrition.calories ? parseFloat(recipe.nutrition.calories) : null,
          protein_g: recipe.nutrition.proteinContent ? parseFloat(recipe.nutrition.proteinContent) : null,
          carbs_g: recipe.nutrition.carbohydrateContent ? parseFloat(recipe.nutrition.carbohydrateContent) : null,
          fat_g: recipe.nutrition.fatContent ? parseFloat(recipe.nutrition.fatContent) : null,
        };
      }
      return {
        meal_name: recipe.name || null,
        ingredients,
        instructions: Array.isArray(recipe.recipeInstructions)
          ? recipe.recipeInstructions.map(s => (typeof s === 'string' ? s : s.text)).join('\n')
          : recipe.recipeInstructions || null,
        servings: parseServings(recipe.recipeYield),
        nutrition,
        source: 'scrape',
      };
    }

    // WordPress Recipe Maker exposes explicit amount, unit, name, and notes
    // fields. Use those instead of flattening the row into ambiguous text.
    const wprmRecipe = extractWprmRecipe($);
    if (wprmRecipe?.ingredients.length) {
      return {
        meal_name: getBestTitle($, wprmRecipe.referenceElement),
        ingredients: wprmRecipe.ingredients,
        instructions: null,
        servings: wprmRecipe.servings,
        nutrition: null,
        source: 'scrape',
      };
    }

    // Fallback 1: class name heuristics
    const ingredientEls = $('[class*="ingredient"] li, [class*="ingredient"] p').toArray();
    if (ingredientEls.length) {
      const ingredients = ingredientEls
        .map(el => $(el).text().trim())
        .filter(t => t.length > 0)
        .map(parseIngredientString);

        const mealName = getBestTitle($, ingredientEls[0]);
      return {
          meal_name: mealName || null,
        ingredients,
        instructions: null,
        servings: null,
        nutrition: null,
        source: 'scrape',
      };
    }

    // Fallback 2: find any element whose text contains "Ingredients" and grab the next list
    let headingIngredients = [];
    let firstHeadingLiEl = null;
    $('h1,h2,h3,h4,strong,b').each((_, el) => {
      if (headingIngredients.length) return;
      if (/ingredients/i.test($(el).text())) {
        // Try next sibling list, then parent's next sibling list
        const candidates = [
          $(el).nextAll('ul,ol').first(),
          $(el).parent().next('ul,ol'),
          $(el).parent().nextAll('ul,ol').first(),
        ];
        for (const list of candidates) {
          list.find('li').each((_, li) => {
            if (!firstHeadingLiEl) firstHeadingLiEl = li;
            const text = $(li).text().trim();
            if (text) headingIngredients.push(parseIngredientString(text));
          });
          if (headingIngredients.length) break;
        }
      }
    });

    if (headingIngredients.length) {
      const mealName = getBestTitle($, firstHeadingLiEl);
      return {
        meal_name: mealName || null,
        ingredients: headingIngredients,
        instructions: null,
        servings: null,
        nutrition: null,
        source: 'scrape',
      };
    }

    return { error: 'Could not extract recipe from this URL' };
  } catch (err) {
    if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
      return { error: 'Could not reach that URL. Check the address and try again.' };
    }
    if (err.response?.status === 403 || err.response?.status === 429) {
      return { error: 'This site blocked the request. Try copying the recipe manually.' };
    }
    if (err.response?.status === 404) {
      return { error: 'Recipe URL not found (404). Check the link and try again.' };
    }
    return { error: `Could not extract recipe from this URL: ${err.message}` };
  }
}
