// Meal sets: hand-picked "goes with" groups (src/data/mealSets.json). The
// build validates the file (scripts/validate-recipes.mjs); this module only
// reads it. Membership is symmetric by construction: every recipe in a set
// links to every other member, and a recipe may sit in more than one set.
import mealSets from '../data/mealSets.json';
import { recipesById } from '../data/recipeIndex.js';

/** The sets a recipe belongs to, in file order. */
export function setsOf(recipeId, sets = mealSets) {
  return sets.filter((s) => s.recipes.includes(recipeId));
}

/**
 * One block per set the recipe is in: the set, and its other members as
 * recipe rows, in set order. A recipe in no set gives [].
 */
export function mealBlocksFor(recipeId, sets = mealSets, byId = recipesById) {
  return setsOf(recipeId, sets).map((set) => ({
    set,
    others: set.recipes.filter((id) => id !== recipeId).map((id) => byId.get(id)).filter(Boolean),
  }));
}

/** Other recipes in any of this recipe's sets, de-duplicated, longest name first. */
export function linkTargetsFor(recipeId, sets = mealSets, byId = recipesById) {
  const seen = new Map();
  for (const { others } of mealBlocksFor(recipeId, sets, byId)) {
    for (const r of others) seen.set(r.id, r);
  }
  return [...seen.values()].sort((a, b) => b.name.length - a.name.length);
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Splits an ingredient line into plain and linked parts. A part with `id` is
 * the exact (case-insensitive, whole-word) name of a target recipe. Display
 * only: the line's text is unchanged when the parts are joined.
 * @returns {{text: string, id?: string}[]}
 */
export function linkIngredientText(text, targets) {
  if (!targets?.length || typeof text !== 'string') return [{ text }];
  const byName = new Map(targets.map((t) => [t.name.toLowerCase(), t.id]));
  const names = targets.map((t) => escapeRe(t.name)).join('|');
  const re = new RegExp(String.raw`(?<![\p{L}\p{N}])(${names})(?![\p{L}\p{N}])`, 'giu');
  const parts = [];
  let last = 0;
  for (const m of text.matchAll(re)) {
    if (m.index > last) parts.push({ text: text.slice(last, m.index) });
    parts.push({ text: m[0], id: byName.get(m[0].toLowerCase()) });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts.length ? parts : [{ text }];
}
