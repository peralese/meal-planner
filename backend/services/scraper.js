import axios from 'axios';
import * as cheerio from 'cheerio';

function parseIngredientString(str) {
  // Match patterns like "2 cups flour", "1/2 tsp salt", "3 large eggs"
  const match = str.match(/^([\d\s\/.]+)?\s*([a-zA-Z]+(?:\s+[a-zA-Z]+)?)?\s+(.+)$/);
  if (match) {
    return {
      quantity: match[1]?.trim() || null,
      unit: match[2]?.trim() || null,
      name: match[3]?.trim() || str.trim(),
    };
  }
  return { quantity: null, unit: null, name: str.trim() };
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
      const recipeContainer = $ref.closest('article,[class*="recipe"],[class*="post"],[id*="recipe"],[id*="post"]');
      const headingInContainer = recipeContainer.find('h1,h2').first().text().trim();
      if (headingInContainer) return headingInContainer;

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
