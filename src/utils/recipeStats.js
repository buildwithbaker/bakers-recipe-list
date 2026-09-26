// Counts shown on a recipe card and in the recipe's facts line.
//
// Ingredients: only `type: "item"` lines. Headers and version markers are
// structure, not things to buy. Steps: every instruction that is not a
// `section` or `header` marker, which covers both the classic and the grouped
// instruction shapes described in AGENTS.md.
export function ingredientCount(recipe) {
  return (recipe?.ingredients ?? []).filter((i) => i.type === 'item').length;
}

export function stepCount(recipe) {
  return (recipe?.instructions ?? []).filter((s) => s.type !== 'section' && s.type !== 'header').length;
}
