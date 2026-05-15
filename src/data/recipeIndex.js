// Canonical name→recipe lookup Map, built once at module load time.
// Import this instead of re-filtering recipes.json in every component.
import recipes from './recipes.json';
export const recipesByName = new Map(recipes.map((r) => [r.name, r]));
