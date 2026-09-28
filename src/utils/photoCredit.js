// The credit for a recipe's photo, from src/data/photoCredits.json.
//
// Kept free of Vite-only APIs so both the app (through recipePhoto.js) and
// scripts/prerender.mjs read credits from this one place.
import PHOTO_CREDITS from '../data/photoCredits.json' with { type: 'json' };

/** @returns {{ ai: boolean, alt: string }} */
export function photoCredit(id) {
  const credit = Object.hasOwn(PHOTO_CREDITS, id) ? PHOTO_CREDITS[id] : null;
  return { ai: credit?.ai === true, alt: credit?.alt ?? '' };
}

// og:image:alt for a recipe page. An AI photo is described as one, so a link
// preview carries the label too; a real photo and the brand placeholder keep
// the recipe name. `hasPhoto` is false when the preview is the placeholder.
export function ogImageAlt(recipe, hasPhoto) {
  const { ai, alt } = photoCredit(recipe.id);
  return hasPhoto && ai ? alt : recipe.name;
}
