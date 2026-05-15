// Parses an ingredient text string into { quantity, unit, name }.
// Returns null for non-food lines (water, salt-and-pepper-to-taste, etc.)
// or section headers (callers should also skip type === 'section' upstream).
//
// Examples:
//   "1 lb ground pork"               → { quantity: 1, unit: 'lb', name: 'ground pork' }
//   "¼ cup breadcrumbs"              → { quantity: 0.25, unit: 'cup', name: 'breadcrumbs' }
//   "2 ½ tsp paprika"                → { quantity: 2.5, unit: 'tsp', name: 'paprika' }
//   "1 egg"                          → { quantity: 1, unit: 'each', name: 'egg' }
//   "Salt and pepper to taste"       → null
//   "Olive oil (1/4 cup)"            → { quantity: 0.25, unit: 'cup', name: 'olive oil' }

import { UNICODE_FRAC, parseQuantityStr } from './fractions.js';

// Canonical unit names. Keys here include all the spellings/aliases
// that may appear in recipe text; values are the normalized form
// that convertToGrams.js expects.
const UNIT_ALIASES = {
  cup: 'cup', cups: 'cup', c: 'cup',
  tbsp: 'tbsp', tablespoon: 'tbsp', tablespoons: 'tbsp', tbl: 'tbsp', tb: 'tbsp', t: 'tbsp',
  tsp: 'tsp', teaspoon: 'tsp', teaspoons: 'tsp',
  oz: 'oz', ounce: 'oz', ounces: 'oz',
  lb: 'lb', lbs: 'lb', pound: 'lb', pounds: 'lb',
  g: 'g', gram: 'g', grams: 'g',
  kg: 'kg', kilogram: 'kg', kilograms: 'kg',
  ml: 'ml', milliliter: 'ml', milliliters: 'ml',
  l: 'l', liter: 'l', liters: 'l',
  pinch: 'pinch', pinches: 'pinch',
  dash: 'dash', dashes: 'dash',
  clove: 'clove', cloves: 'clove',
  slice: 'slice', slices: 'slice',
  can: 'can', cans: 'can',
  jar: 'jar', jars: 'jar',
  package: 'package', packages: 'package', pkg: 'package',
  bunch: 'bunch', bunches: 'bunch',
  stalk: 'stalk', stalks: 'stalk',
  head: 'head', heads: 'head',
};

// Whole-line skips: anything that matches one of these returns null.
const SKIP_PATTERNS = [
  /^salt\s+and\s+pepper(\s+to\s+taste)?$/i,
  /^salt\s*&\s*pepper(\s+to\s+taste)?$/i,
  /^to\s+taste$/i,
  /^water\b/i,
  /^cooking\s+spray$/i,
  /^non-?stick\s+spray$/i,
  /^optional:\s*/i,
  /^for\s+(serving|garnish|topping)\b/i,
];

// Qualifier words to strip from the ingredient name once parsed.
// INTENTIONALLY excluded: ground, raw, cooked, uncooked, dried, boneless, skinless —
// these affect USDA lookup result selection so we preserve them in the name.
const QUALIFIER_RE = new RegExp(
  '\\b(' + [
    'finely diced', 'finely chopped', 'finely minced', 'roughly chopped', 'thinly sliced',
    'freshly grated', 'freshly ground', 'extra virgin', 'extra-virgin',
    'scant', 'heaping', 'packed', 'fresh',
    'minced', 'chopped', 'diced', 'sliced', 'grated', 'shredded', 'crushed',
    'cubed', 'whole', 'large', 'small', 'medium', 'organic',
    'unsalted', 'salted',
  ].join('|') + ')\\b',
  'gi'
);

// Single-token quantity parse — delegates to the shared parseQuantityStr.
// Called on individual tokens during progressive tokenization, so it never
// receives a mixed-number string with a space (those are accumulated externally).
function quantityToken(s) {
  return parseQuantityStr(s);
}

// Sum a sequence of quantity tokens like ["1", "½"] → 1.5.
function sumQuantityTokens(tokens) {
  let total = 0;
  for (const tok of tokens) {
    const n = quantityToken(tok);
    if (isNaN(n)) return NaN;
    total += n;
  }
  return total;
}

// Try to extract a "(quantity unit)" trailing parenthetical, e.g. "Olive oil (1/4 cup)".
// Guard: skip if nameBase itself starts with a quantity — that means the parens hold
// supplementary info (e.g. fat%, packaging, or notes), not the measurement.
function extractParenQuantity(text) {
  const m = text.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
  if (!m) return null;
  const nameBase = m[1].trim();
  // If nameBase starts with a number, the real measurement is already in the main text —
  // don't let a ratio like "(80/20)" or note like "(bone-in)" hijack the quantity.
  if (/^[\d½¼¾⅓⅔⅛⅜⅝⅞⅕⅖⅗⅘]/.test(nameBase)) return null;
  const inner = m[2].trim();
  const firstSeg = inner.split(',')[0].trim();
  const parsed = parseQuantityAndUnit(firstSeg);
  if (parsed) return { ...parsed, nameBase };
  return null;
}

// Parse a leading "QUANTITY UNIT" off a string. Returns { quantity, unit, rest } or null.
function parseQuantityAndUnit(s) {
  const tokens = [];
  let rest = s;
  while (true) {
    const m = rest.match(/^(\d+\/\d+|\d+\.\d+|\d+|[½¼¾⅓⅔⅛⅜⅝⅞⅕⅖⅗⅘])/);
    if (!m) break;
    tokens.push(m[1]);
    rest = rest.slice(m[0].length);
    // Also handle a unicode fraction directly appended to a digit ("1½")
    const tail = rest.match(/^([½¼¾⅓⅔⅛⅜⅝⅞⅕⅖⅗⅘])/);
    if (tail) {
      tokens.push(tail[1]);
      rest = rest.slice(tail[0].length);
    }
    rest = rest.replace(/^\s+/, '');
    if (!/^[\d½¼¾⅓⅔⅛⅜⅝⅞⅕⅖⅗⅘]/.test(rest)) break;
  }
  if (tokens.length === 0) return null;
  const quantity = sumQuantityTokens(tokens);
  if (isNaN(quantity)) return null;
  const unitMatch = rest.match(/^([a-zA-Z]+\.?)\s*/);
  let unit = 'each';
  let after = rest;
  if (unitMatch) {
    const candidate = unitMatch[1].toLowerCase().replace(/\.$/, '');
    if (UNIT_ALIASES[candidate]) {
      unit = UNIT_ALIASES[candidate];
      after = rest.slice(unitMatch[0].length);
    }
  }
  return { quantity, unit, rest: after.trim() };
}

function cleanName(s) {
  let out = s
    .replace(/\([^)]*\)/g, ' ')
    .replace(QUALIFIER_RE, ' ')
    .replace(/\bof\s+/gi, ' ')
    .replace(/[,;].*$/, '')
    .replace(/\s+or\s+.*$/i, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .toLowerCase();
  return out;
}

export function parseIngredient(text) {
  if (!text || typeof text !== 'string') return null;
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (SKIP_PATTERNS.some((re) => re.test(trimmed))) return null;

  // Form A: "Olive oil (1/4 cup)" — quantity in trailing parens
  const paren = extractParenQuantity(trimmed);
  if (paren && paren.quantity > 0) {
    const name = cleanName(paren.nameBase);
    if (!name) return null;
    return { quantity: paren.quantity, unit: paren.unit, name };
  }

  // Form B: "1/4 cup olive oil" — quantity at the start
  const lead = parseQuantityAndUnit(trimmed);
  if (lead && lead.quantity > 0) {
    const name = cleanName(lead.rest);
    if (!name) return null;
    return { quantity: lead.quantity, unit: lead.unit, name };
  }

  return null;
}
