// The document title for a recipe, in ONE place. scripts/prerender.mjs writes it
// into every /r/<slug>/ file and RecipeView sets it at runtime, so the browser
// tab, history and bookmarks name the recipe whichever way it was reached - a
// crawler reading the file, a first visit, or a returning visitor whose service
// worker served the generic shell.
export const SITE_NAME = "Baker's Recipe List";

export function recipeDocumentTitle(name) {
  return `${name} — ${SITE_NAME}`;
}
