// The count in a recipe's authored `recipeYield`, when it has one.
//
// "4 servings", "4 servings, 2 drumsticks each", "8 servings (one 9x13)",
// "8 patties", "about 24 balls", "1 smoothie (about 16 oz)" all start with a
// count of something a person eats. That count is fact, written by the
// author, so it beats any estimate (Adam, 2026-10-11). Yields that do not
// start that way ("1 loaf (9x5)", "about 1 cup, ...", "enough for 1 lb
// chicken") return null and the estimate applies as before.

// unit (singular) -> plural, for the units an authored count may name.
const UNITS = {
  serving: 'servings',
  patty: 'patties',
  sandwich: 'sandwiches',
  square: 'squares',
  ball: 'balls',
  smoothie: 'smoothies',
};
const SINGULAR = Object.fromEntries(
  Object.entries(UNITS).flatMap(([one, many]) => [[one, one], [many, one]]),
);

const YIELD_RE = new RegExp(`^(about\\s+)?(\\d+)\\s+(${Object.keys(SINGULAR).join('|')})\\b`, 'i');

/**
 * @returns {{ count: number, unit: string, about: boolean } | null}
 *   unit is singular ("serving", "patty", ...)
 */
export function parseAuthoredYield(recipeYield) {
  if (typeof recipeYield !== 'string') return null;
  // Only the part before the first comma or parenthesis carries the count.
  const head = recipeYield.split(/[,(]/)[0].trim();
  const m = YIELD_RE.exec(head);
  if (!m) return null;
  const count = parseInt(m[2], 10);
  if (!(count > 0)) return null;
  return { count, unit: SINGULAR[m[3].toLowerCase()], about: Boolean(m[1]) };
}

export const pluralUnit = (unit, n) => (n === 1 ? unit : UNITS[unit] ?? `${unit}s`);

// "4 servings", "About 24 balls", "1 smoothie": the scaler's line.
export function yieldLabel({ count, unit, about }) {
  return `${about ? 'About ' : ''}${count} ${pluralUnit(unit, count)}`;
}
