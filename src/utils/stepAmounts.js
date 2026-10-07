// "Amounts in steps" off: the quantities a step repeats from the ingredient
// list, like "(1 tsp)", are taken out of the text on screen. A display
// transform only: recipes.json, the ingredients, the why notes and the
// JSON-LD never pass through here.

const FRACTIONS = '¼½¾⅓⅔⅛⅜⅝⅞';

// A parenthetical is an amount when it starts with a quantity: a digit, a
// Unicode fraction, or one of the words cooks write before one.
const QUANTITY_START = new RegExp(
  `^(?:[0-9${FRACTIONS}]|(?:about|scant|up to|a pinch|pinch|start with|from)\\b)`,
  'i',
);

// ...unless it is a duration, which starts with a number too but is an
// instruction, not an amount: "(5-6 hr Ahead)", "(4-5 min max)".
const DURATION = new RegExp(
  `^[0-9${FRACTIONS}][0-9${FRACTIONS}\\s.\\-–]*(?:hrs?|hours?|mins?|minutes?|secs?|seconds?)\\b`,
  'i',
);

export function isAmountParenthetical(content) {
  const c = content.trim();
  return QUANTITY_START.test(c) && !DURATION.test(c);
}

export function stripStepAmounts(text) {
  if (!text) return text;
  return text
    .replace(/\s*\(([^()]*)\)/g, (match, content) => (isAmountParenthetical(content) ? '' : match))
    .replace(/ {2,}/g, ' ')
    .replace(/ +([,.;:!?])/g, '$1')
    .trim();
}

// Whether turning "Amounts in steps" off would change anything on this recipe.
export const hasStepAmounts = (steps) =>
  (steps ?? []).some((s) => [s.step, s.detail].some((t) => t && stripStepAmounts(t) !== t));
