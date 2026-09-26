// Where a recipe's photo lives, if it has one.
//
// Every caller (card thumbnail, recipe header, prerendered og:image) asks here
// and nowhere else, so the photo source can change in one place.
import { BASE_PATH } from './recipeRoute.js';

/** @returns {{ thumb: string, large: string } | null} */
export function recipePhoto(recipe) {
  if (!recipe?.image) return null;
  const url = `${BASE_PATH}${String(recipe.image).replace(/^\/+/, '')}`;
  return { thumb: url, large: url };
}

// The letter shown in an empty photo slot: the first A-Z character of the name.
export function photoInitial(name) {
  return (String(name ?? '').match(/[A-Za-z]/) || ['·'])[0].toUpperCase();
}
