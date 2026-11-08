// The techniques (src/data/techniques.json) and their lookups, built once at
// module load. "Used in" reads the RAW catalog from recipeIndex.js (the same
// records findable by id and by name), never a display-renamed list.
import techniques from './techniques.json';
import { rawRecipes } from './recipeIndex.js';
import { recipesUsingTechnique } from '../utils/techniqueUsage.js';

export { techniques };

export const techniquesById = new Map(techniques.map((t) => [t.id, t]));

/** The recipes whose steps reference this technique id (drafts included). */
export const usedIn = (techniqueId) => recipesUsingTechnique(techniqueId, rawRecipes);
