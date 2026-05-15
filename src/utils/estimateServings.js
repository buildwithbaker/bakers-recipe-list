// Auto-estimates the serving yield of a recipe from ingredient quantities,
// recipe name, and section. Returns { servings: number, basis: string } or null.
//
// Priority:
//   1. Explicit yield numbers parsed from instruction text
//      ("makes 8 patties", "yields 6", "serves 4")
//   2. Primary protein weight from ingredients
//      (1 lb → 4, 2 lb → 6-8, etc.)
//   3. Recipe section defaults
//
// Returns null for blank recipes, Seasonings, Doughs, or anything else
// where a serving estimate isn't meaningful.

import { parseQuantityStr } from './fractions.js';

const SECTIONS_NO_SERVINGS = new Set(['SEASONINGS', 'DOUGHS']);

const SECTION_DEFAULTS = {
  'BREAKFAST': 2,
  'SLOW COOKER': 7,
  'AMERICAN': 4,
  'MEXICAN': 4,
  'ASIAN': 4,
  'ITALIAN': 4,
  'MIDDLE EASTERN': 4,
  'SANDWICHES': 2,
  'SIDES': 5,
  'SNACKS': 12,
  'SOUPS': 5,
  'MARINADES': 4,
  'SMOOTHIES': 1,
  'BREAD': 12,
  'FOR REVIEW --- CURRY': 4,
  'FOR REVIEW --- SOUPS': 5,
  'FOR REVIEW - SOUPS': 5,
  'FOR REVIEW - MARINADES - CHICKEN': 4,
  'FOR REVIEW - MARINADES - BEEF': 4,
  'FOR REVIEW - MARINADES - PORK': 4,
};

const PROTEIN_KEYWORDS = [
  'pork', 'beef', 'chicken', 'turkey', 'lamb', 'fish', 'salmon',
  'tuna', 'shrimp', 'tofu', 'sausage', 'bacon', 'steak', 'ground',
];

const LIQUID_KEYWORDS = [
  'milk', 'water', 'broth', 'stock', 'juice', 'coconut milk',
  'cream', 'almond milk', 'oat milk', 'soy milk',
];

const GRAIN_KEYWORDS = [
  'oats', 'rice', 'quinoa', 'lentils', 'barley', 'bulgur', 'couscous',
  'pasta', 'noodles',
];

// Look for "makes/yields/serves N" in instruction text.
function findExplicitYield(recipe) {
  const all = (recipe.instructions || [])
    .map((s) => `${s?.step || ''} ${s?.detail || ''}`)
    .join(' ');
  const m = all.match(/\b(?:makes?|yields?|serves?)\s+(?:about\s+|approximately\s+|~)?(\d+)\b/i);
  if (m) {
    const n = parseInt(m[1], 10);
    if (n > 0 && n < 50) return n;
  }
  return null;
}

// Look at ingredient text for a primary-protein weight, return total grams (approx).
function findProteinWeight(recipe) {
  for (const ing of recipe.ingredients || []) {
    if (ing.type === 'section') continue;
    const text = (ing.text || '').toLowerCase();
    if (!PROTEIN_KEYWORDS.some((k) => text.includes(k))) continue;
    const lbMatch = text.match(/^([\d./\s½¼¾⅓⅔⅛⅜⅝⅞⅕⅖⅗⅘]+)\s*(?:lb|lbs|pound|pounds)\b/);
    if (lbMatch) {
      const q = parseQuantityStr(lbMatch[1].trim());
      if (!isNaN(q)) return q * 453.6;
    }
    const ozMatch = text.match(/^([\d./\s½¼¾⅓⅔⅛⅜⅝⅞⅕⅖⅗⅘]+)\s*(?:oz|ounce|ounces)\b/);
    if (ozMatch) {
      const q = parseQuantityStr(ozMatch[1].trim());
      if (!isNaN(q)) return q * 28.35;
    }
  }
  return null;
}

function gramsPerServingForRecipe(recipe) {
  const name = (recipe.name || '').toLowerCase();
  if (/\b(patties?|meatballs?|burgers?|muffins?|bites?|nuggets?|skewers?|wings?)\b/.test(name)) {
    return 55;
  }
  if (recipe.section === 'SLOW COOKER') {
    return 150;
  }
  return 115;
}

// Sum up "X cup(s)" amounts for ingredients matching a keyword set.
function sumCupsFor(recipe, keywords) {
  let total = 0;
  for (const ing of recipe.ingredients || []) {
    if (ing.type === 'section') continue;
    const text = (ing.text || '').toLowerCase();
    if (!keywords.some((k) => text.includes(k))) continue;
    const m = text.match(/^([\d./\s½¼¾⅓⅔⅛⅜⅝⅞⅕⅖⅗⅘]+)\s*cups?\b/);
    if (!m) continue;
    const q = parseQuantityStr(m[1].trim());
    if (!isNaN(q) && q > 0) total += q;
  }
  return total;
}

function servingsFromProteinGrams(grams, recipe) {
  const perServing = gramsPerServingForRecipe(recipe);
  const s = Math.round(grams / perServing);
  if (s < 1) return 1;
  if (s > 12) return 12;
  return s;
}

export function estimateServings(recipe) {
  if (!recipe || recipe.is_blank) return null;
  if (SECTIONS_NO_SERVINGS.has(recipe.section)) return null;

  const explicit = findExplicitYield(recipe);
  if (explicit) {
    return { servings: explicit, basis: 'Estimated from recipe text' };
  }

  const proteinGrams = findProteinWeight(recipe);
  if (proteinGrams && proteinGrams >= 100) {
    return {
      servings: servingsFromProteinGrams(proteinGrams, recipe),
      basis: 'Estimated from ingredients',
    };
  }

  const liquidCups = sumCupsFor(recipe, LIQUID_KEYWORDS);
  if (liquidCups >= 3) {
    const perServing = recipe.section?.includes('SOUP') ? 1.5 : 1.25;
    const s = Math.max(2, Math.min(12, Math.round(liquidCups / perServing)));
    return { servings: s, basis: 'Estimated from ingredients' };
  }

  // Grain cups check (covers "2 cups rice")
  const grainCups = sumCupsFor(recipe, GRAIN_KEYWORDS);
  if (grainCups >= 1) {
    const s = Math.max(2, Math.min(12, Math.round(grainCups * 4)));
    return { servings: s, basis: 'Estimated from ingredients' };
  }

  // Grain weight check — catches "8 oz pasta", "1 lb noodles" which are commonly
  // listed by weight. Dry pasta/noodles roughly double+ in cooked volume, so
  // 8 oz dry (~227g) yields ~4 generous servings as a main.
  for (const ing of recipe.ingredients || []) {
    if (ing.type === 'section') continue;
    const text = (ing.text || '').toLowerCase();
    if (!GRAIN_KEYWORDS.some((k) => text.includes(k))) continue;
    const lbMatch = text.match(/^([\d./\s½¼¾⅓⅔⅛⅜⅝⅞⅕⅖⅗⅘]+)\s*(?:lb|lbs|pound|pounds)\b/);
    if (lbMatch) {
      const q = parseQuantityStr(lbMatch[1].trim());
      if (!isNaN(q) && q > 0) {
        // 1 lb dry pasta/noodles ≈ 4 servings as a main
        const s = Math.max(2, Math.min(12, Math.round(q * 4)));
        return { servings: s, basis: 'Estimated from ingredients' };
      }
    }
    const ozMatch = text.match(/^([\d./\s½¼¾⅓⅔⅛⅜⅝⅞⅕⅖⅗⅘]+)\s*(?:oz|ounce|ounces)\b/);
    if (ozMatch) {
      const q = parseQuantityStr(ozMatch[1].trim());
      if (!isNaN(q) && q > 0) {
        // 8 oz dry pasta ≈ 2–3 servings; use q/2.5 rounding to nearest whole
        const s = Math.max(2, Math.min(12, Math.round(q / 2.5)));
        return { servings: s, basis: 'Estimated from ingredients' };
      }
    }
  }

  const def = SECTION_DEFAULTS[recipe.section];
  if (def) {
    return { servings: def, basis: 'Estimated from recipe type' };
  }

  return null;
}
