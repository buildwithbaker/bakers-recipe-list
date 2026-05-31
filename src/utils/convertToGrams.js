// Converts a parsed ingredient { quantity, unit, name } to grams.
// Returns a number, or null if the unit isn't convertible (e.g. "each" for
// items where we don't have a per-piece weight estimate for the name).
//
// 1 cup defaults to 240g (water/liquid). For solid ingredients the cup
// weight varies wildly, so CUP_OVERRIDES handles common cases.

const BASE = {
  g: 1,
  kg: 1000,
  oz: 28.35,
  lb: 453.6,
  ml: 1,            // assume liquid density ~1
  l: 1000,
  cup: 240,
  tbsp: 15,
  tsp: 5,
  pinch: 0.5,
  dash: 0.5,
  clove: 5,         // garlic clove ~5g
  slice: 25,        // bread slice ~25g
  can: 400,         // 14oz can ~400g
  jar: 350,
  package: 200,
  bunch: 100,
  stalk: 40,        // celery stalk
  head: 500,        // head of lettuce/cabbage
};

// Per-cup weight overrides for solids (matched against ingredient name substring).
// The longest matching needle wins (see lookupOverride), so order is not
// load-bearing — but keep related entries grouped for readability.
// Vegetable/produce densities sourced from USDA cup-to-gram reference data.
const CUP_OVERRIDES = [
  // --- Vegetables & produce (were defaulting to 240g/cup = water = wrong) ---
  ['potato', 150],           // diced raw potato ~150g/cup
  ['sweet potato', 133],     // diced raw
  ['carrot', 128],           // sliced/diced raw
  ['bell pepper', 149],      // chopped raw
  ['onion', 160],            // diced/chopped raw
  ['celery', 100],           // diced raw
  ['zucchini', 124],         // sliced/diced
  ['mushroom', 70],          // sliced raw (very airy)
  ['spinach', 30],           // raw leaves (very light)
  ['kale', 67],              // chopped raw
  ['cabbage', 89],           // shredded raw
  ['corn', 154],             // kernels
  ['peas', 145],             // fresh/frozen
  ['green bean', 110],       // chopped
  ['broccoli', 91],          // chopped raw
  ['cauliflower', 107],      // chopped raw
  ['tomato', 180],           // chopped
  ['cucumber', 119],         // sliced
  ['apple', 125],            // diced
  ['strawberr', 152],        // sliced
  ['blueberr', 148],
  ['ground meat', 230],      // cooked crumbled ground beef/pork (denser)
  // --- Pantry staples ---
  ['brown sugar', 220],
  ['powdered sugar', 120],
  ['confectioners', 120],
  ['peanut butter', 258],
  ['almond butter', 258],
  ['breadcrumbs', 108],
  ['bread crumbs', 108],
  ['panko', 60],
  ['rolled oats', 90],
  ['oats', 90],
  ['cocoa', 85],
  ['flour', 125],
  ['sugar', 200],
  ['butter', 227],
  ['honey', 340],
  ['maple syrup', 320],
  ['rice', 185],
  ['cooked rice', 158],
  ['quinoa', 170],
  ['pasta', 100],
  ['cheese', 113],
  ['parmesan', 100],
  ['shredded cheese', 113],
  ['yogurt', 245],
  ['greek yogurt', 245],
  ['sour cream', 230],
  ['mayonnaise', 220],
  ['mayo', 220],
  ['nuts', 130],
  ['almonds', 144],
  ['walnuts', 117],
  ['pecans', 109],
  ['raisins', 145],
  ['cranberries', 100],
  ['chocolate chips', 175],
  ['cornmeal', 138],
  ['lentils', 200],
  ['beans', 180],
  ['chickpeas', 200],
  ['salsa', 240],
  ['tomato sauce', 245],
  ['tomato paste', 262],
  ['marinara', 245],
  ['broth', 240],
  ['stock', 240],
  ['milk', 240],
  ['cream', 240],
  ['olive oil', 216],
  ['vegetable oil', 216],
  ['oil', 216],
];

// Per-piece weight estimates for "each"-unit items (e.g. "1 egg").
// The longest matching needle wins (see lookupOverride), so a specific needle
// like 'chicken breast' beats 'chicken' and 'asian pear' beats 'pear'
// regardless of order — entries are grouped by item for readability only.
const EACH_OVERRIDES = [
  ['egg', 50],
  ['onion', 110],
  ['garlic clove', 5],
  ['lemon', 60],         // lemon juice ~3 tbsp = 45ml; whole lemon ~58g of usable
  ['lime', 44],
  ['orange', 130],
  // chicken cuts — specific before generic 'chicken'
  ['chicken breast', 150],
  ['chicken thigh', 100],
  ['chicken drumstick', 80],
  ['chicken wing', 90],
  ['chicken', 1500],     // whole chicken for soup/roast ~1.5 kg
  ['apple', 180],
  ['banana', 120],
  ['avocado', 150],
  // pears — specific before generic 'pear'
  ['asian pear', 200],
  ['pear', 180],
  ['tomato', 120],
  ['carrot', 60],
  ['celery stalk', 40],
  ['potato', 200],
  ['bell pepper', 120],
  ['jalapeño', 20],      // medium jalapeño ~20g deseeded
  ['jalapeno', 20],
  ['pepper', 30],        // catch-all for chiles, etc.
  ['bay leaf', 1],       // negligible weight; included for completeness
  ['cucumber', 300],
  ['zucchini', 200],
];

// Returns the value for the LONGEST needle that appears in `name`, so the most
// specific match wins regardless of table order — e.g. "sweet potato" resolves
// to 'sweet potato' (133), not the shorter 'potato' (150), and "cooked rice"
// resolves to 'cooked rice' (158), not 'rice' (185).
function lookupOverride(name, table) {
  const lower = name.toLowerCase();
  let bestVal = null;
  let bestLen = -1;
  for (const [needle, val] of table) {
    if (needle.length > bestLen && lower.includes(needle)) {
      bestVal = val;
      bestLen = needle.length;
    }
  }
  return bestVal;
}

export function convertToGrams({ quantity, unit, name }) {
  if (!quantity || quantity <= 0) return null;

  // Cup needs name-based override for accuracy
  if (unit === 'cup') {
    const override = lookupOverride(name, CUP_OVERRIDES);
    return quantity * (override ?? BASE.cup);
  }

  // "each" — only convert if we have a per-piece weight for this name
  if (unit === 'each') {
    const override = lookupOverride(name, EACH_OVERRIDES);
    if (override) return quantity * override;
    return null;
  }

  const base = BASE[unit];
  if (base == null) return null;
  return quantity * base;
}
