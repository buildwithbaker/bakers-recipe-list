// Splits a recipe whose ingredients/instructions contain { type: "section" }
// markers into one recipe per version, so each version gets its own table row
// and View button. Recipes without version markers pass through unchanged.

function splitByVersion(arr, textField) {
  if (!arr || arr.length === 0) return [];
  const versions = [];
  let current = null;
  arr.forEach((item) => {
    if (item.type === 'section') {
      current = { label: item[textField], items: [] };
      versions.push(current);
    } else {
      if (!current) {
        current = { label: '', items: [] };
        versions.push(current);
      }
      current.items.push(item);
    }
  });
  return versions;
}

// Keeps the protein in the displayed base name (audit P2-13):
//   "X - Chicken Marinade"          -> "X Chicken Marinade" (same for Pork, Beef)
//   "X Marinade - Beef Marinade"    -> "X Beef Marinade" (no doubled "Marinade")
// Anything else displays as it is.
export function shortenName(name) {
  const doubled = /^(.*?)\s+Marinade\s*[-—–]\s*(\S+)\s+Marinade\s*$/i.exec(name);
  if (doubled) return `${doubled[1].trim()} ${doubled[2]} Marinade`;
  const suffixed = /^(.*?)\s*[-—–]\s*(\S+)\s+Marinade\s*$/i.exec(name);
  if (suffixed) return `${suffixed[1].trim()} ${suffixed[2]} Marinade`;
  return name.trim();
}

// The naming rule as it was until 2026-09-27 (main f628cef): it stripped the
// "- Chicken Marinade" suffix entirely. FROZEN. The names it produced are what
// old `?recipe=` links and pre-migration saved state carry, so recipeIndex.js
// and stateMigration.js keep them resolvable as aliases. Never edit this to
// match shortenName; it has to keep producing yesterday's names.
export function legacyShortenName(name) {
  return name.replace(/\s*[-—–]\s*\S+\s+Marinade\s*$/i, '').trim();
}

const rowName = (base, i, count) => (count > 1 ? `${base} (Version ${i + 1})` : base);

function versionLabels(recipe) {
  const ingHasSection = recipe.ingredients?.some((i) => i.type === 'section');
  const stepHasSection = recipe.instructions?.some((s) => s.type === 'section');
  if (!ingHasSection && !stepHasSection) return null;
  const ingVersions = splitByVersion(recipe.ingredients, 'text');
  const stepVersions = splitByVersion(recipe.instructions, 'step');
  const labels = (ingHasSection ? ingVersions : stepVersions).map((v) => v.label);
  return { labels, ingVersions, stepVersions };
}

// Old display name -> derived child id, for every row of this record whose
// display name changed with shortenName. Empty for a record that does not
// expand or whose name is unaffected.
export function legacyRowNames(recipe) {
  const v = versionLabels(recipe);
  if (!v) return [];
  const oldBase = legacyShortenName(recipe.name);
  const newBase = shortenName(recipe.name);
  const n = v.labels.length;
  return v.labels
    .map((_, i) => ({ name: rowName(oldBase, i, n), id: `${recipe.id}::v${i + 1}`, current: rowName(newBase, i, n) }))
    .filter((row) => row.name !== row.current)
    .map(({ name, id }) => ({ name, id }));
}

export function expandVersionedRecipe(recipe) {
  const v = versionLabels(recipe);
  if (!v) return [recipe];
  const { labels, ingVersions, stepVersions } = v;
  const baseName = shortenName(recipe.name);

  return labels.map((label, i) => {
    const sourceFromLabel = label.replace(/^Version\s*\d+\s*[-—–]\s*/i, '').trim();
    const displayName = rowName(baseName, i, labels.length);
    return {
      ...recipe,
      // Child id, DERIVED and never persisted: n is 1-based from marker order
      // within this record alone. Never from the global display list — that
      // would renumber every sibling whenever an unrelated record changed.
      id: `${recipe.id}::v${i + 1}`,
      name: displayName,
      source: sourceFromLabel || recipe.source,
      ingredients: ingVersions[i]?.items || [],
      instructions: stepVersions[i]?.items || [],
    };
  });
}
