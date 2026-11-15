// The app's binding of the pure nutrition math to the two pinned data files.
// Plain-Node callers (scripts/validate-recipes.mjs) use src/utils/nutrition.js
// directly and read the JSON with fs.
import FOODS from './foods.json';
import LINES from './lines.json';
import { computeMacros, validateNutrition } from '../../utils/nutrition.js';

export function computeRecipeMacros(recipe, servings) {
  return computeMacros(recipe, servings, FOODS.foods, LINES.recipes);
}

export function validateRecipeNutrition(recipes) {
  return validateNutrition(recipes, FOODS.foods, LINES.recipes);
}
