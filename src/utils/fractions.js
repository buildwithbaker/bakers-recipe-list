// Shared unicode fraction → decimal map.
// Imported by parseIngredient.js, estimateServings.js, and any other
// utility that needs to parse unicode fraction characters.
export const UNICODE_FRAC = {
  '½': 0.5,  '¼': 0.25, '¾': 0.75,
  '⅓': 1 / 3, '⅔': 2 / 3,
  '⅛': 0.125, '⅜': 0.375, '⅝': 0.625, '⅞': 0.875,
  '⅕': 0.2,  '⅖': 0.4,  '⅗': 0.6,  '⅘': 0.8,
};

// Unicode fraction characters as a single regex character class (for match patterns).
const UNI_FRAC_CHARS = '[½¼¾⅓⅔⅛⅜⅝⅞⅕⅖⅗⅘]';

// Parses a quantity string into a number.
// Handles all of:
//   "½"         → 0.5   (pure unicode fraction)
//   "3/4"       → 0.75  (ASCII fraction)
//   "1½"        → 1.5   (digit + unicode fraction, no space)
//   "1 1/2"     → 1.5   (mixed number with ASCII fraction)
//   "2"         → 2     (integer)
//   "1.5"       → 1.5   (decimal)
// Returns NaN if unparseable.
export function parseQuantityStr(s) {
  if (!s) return NaN;
  const t = s.trim();
  if (!t) return NaN;

  // Mixed number: digit immediately followed by unicode fraction ("1½")
  const mixUni = t.match(new RegExp(`^(\\d+)(${UNI_FRAC_CHARS})$`));
  if (mixUni) return parseInt(mixUni[1], 10) + UNICODE_FRAC[mixUni[2]];

  // Mixed number with ASCII fraction: "1 1/2"
  const mixAscii = t.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixAscii) return parseInt(mixAscii[1], 10) + parseInt(mixAscii[2], 10) / parseInt(mixAscii[3], 10);

  // Pure unicode fraction: "½"
  if (UNICODE_FRAC[t] !== undefined) return UNICODE_FRAC[t];

  // ASCII fraction: "3/4"
  const asciiFrac = t.match(/^(\d+)\/(\d+)$/);
  if (asciiFrac) return parseInt(asciiFrac[1], 10) / parseInt(asciiFrac[2], 10);

  // Decimal or integer
  const n = parseFloat(t);
  return isNaN(n) ? NaN : n;
}

// Formats a decimal quantity back into a human-readable string using unicode
// fractions where possible. Used by the serving-size scaler in RecipeModal.
//
// Examples:
//   0.25  → "¼"     1.5  → "1½"    2     → "2"
//   0.375 → "⅜"     2.75 → "2¾"    0.667 → "⅔"
//
// Fix vs. naive scan: we find the NEAREST fraction across all candidates,
// not the first one within tolerance. Naive order-scan would return ⅓ (0.333)
// for an input of 0.38 because it scans 0.333 before 0.375, even though ⅜
// is closer. Minimum-diff search always picks the best match.
export function formatQuantity(n) {
  if (!isFinite(n) || n <= 0) return '0';

  const whole = Math.floor(n);
  const frac = n - whole;

  if (frac < 0.04) return String(whole || 1);
  if (frac > 0.96) return String(whole + 1);

  const FRACS = [
    [0.125, '⅛'], [0.25, '¼'], [1 / 3, '⅓'], [0.375, '⅜'],
    [0.5, '½'],   [0.625, '⅝'], [2 / 3, '⅔'], [0.75, '¾'],
    [0.875, '⅞'],
  ];

  // Find the nearest fraction — scan all, keep minimum diff.
  let bestSym = null, bestDiff = Infinity;
  for (const [val, sym] of FRACS) {
    const d = Math.abs(frac - val);
    if (d < bestDiff) { bestDiff = d; bestSym = sym; }
  }

  if (bestDiff < 0.09) {
    return whole > 0 ? `${whole}${bestSym}` : bestSym;
  }

  // Fall back to a 1-decimal string for a fractional part that isn't near any
  // listed fraction. The table above is dense enough (max ~0.06 gap) that this
  // rarely fires, but it keeps formatting safe for unusual inputs.
  return n.toFixed(1).replace(/\.0$/, '');
}
