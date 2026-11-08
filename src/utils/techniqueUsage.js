// The reverse of a recipe step's `technique` field, and the other direction.
// Pure over the data it is given (no JSON imports), so scripts/prerender.mjs
// can import it too: "Used in" is DERIVED from the steps and never stored.

/** The technique ids a recipe's steps reference: deduplicated, in step order. */
export function techniqueIdsOf(recipe) {
  const seen = new Set();
  for (const step of recipe?.instructions ?? []) {
    if (typeof step?.technique === 'string') seen.add(step.technique);
  }
  return [...seen];
}

/** The recipes with a step that references `techniqueId`, in the order given. */
export function recipesUsingTechnique(techniqueId, recipes) {
  return (recipes ?? []).filter((r) => (r?.instructions ?? []).some((s) => s?.technique === techniqueId));
}

/** The techniques a recipe teaches, as technique objects, in step order. */
export function techniquesOf(recipe, techniques) {
  const byId = new Map((techniques ?? []).map((t) => [t.id, t]));
  return techniqueIdsOf(recipe).map((id) => byId.get(id)).filter(Boolean);
}
