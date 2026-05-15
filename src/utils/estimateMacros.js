// Orchestrates the per-serving macro estimation pipeline:
//   recipe + servings → parsed ingredients → grams → USDA macros (cached)
//   → summed totals → divided by servings → per-serving macros.

import { parseIngredient } from './parseIngredient.js';
import { convertToGrams } from './convertToGrams.js';
import { fetchNutrition, isRateLimited } from './fetchNutrition.js';

export async function estimateMacros(recipe, servings, signal) {
  if (!recipe || recipe.is_blank) return null;
  if (!servings || servings <= 0) return null;

  // Extract food-only ingredients (skip section headers).
  const candidates = (recipe.ingredients || [])
    .filter((ing) => ing && ing.type !== 'section' && typeof ing.text === 'string')
    .map((ing) => ing.text);

  if (candidates.length === 0) return null;

  // Parse + convert in a synchronous first pass; collect ingredients we
  // can actually look up (have a name and a gram weight).
  const lookups = [];
  for (const text of candidates) {
    const parsed = parseIngredient(text);
    if (!parsed) continue;
    const grams = convertToGrams(parsed);
    if (!grams || grams <= 0) continue;
    lookups.push({ name: parsed.name, grams });
  }

  if (lookups.length === 0) {
    return {
      calories: 0, protein: 0, fat: 0, carbs: 0, fiber: 0,
      matchedCount: 0,
      totalCount: candidates.length,
    };
  }

  // Fire all USDA fetches in parallel (most resolve from sessionStorage).
  const responses = await Promise.all(
    lookups.map((l) => fetchNutrition(l.name, signal).then((macros) => ({ ...l, macros })))
  );

  let totals = { calories: 0, protein: 0, fat: 0, carbs: 0, fiber: 0 };
  let matched = 0;
  for (const r of responses) {
    if (!r.macros) continue;
    matched++;
    const factor = r.grams / 100; // USDA values are per 100g
    totals.calories += r.macros.calories * factor;
    totals.protein += r.macros.protein * factor;
    totals.fat += r.macros.fat * factor;
    totals.carbs += r.macros.carbs * factor;
    totals.fiber += r.macros.fiber * factor;
  }

  return {
    calories: Math.round(totals.calories / servings),
    protein: Math.round(totals.protein / servings),
    fat: Math.round(totals.fat / servings),
    carbs: Math.round(totals.carbs / servings),
    fiber: Math.round(totals.fiber / servings),
    matchedCount: matched,
    totalCount: candidates.length,
    rateLimited: isRateLimited(),
  };
}
