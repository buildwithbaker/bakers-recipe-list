// Fetches per-100g nutrient values for a single ingredient name from the
// USDA FoodData Central API, with sessionStorage caching.
//
// Returns { calories, protein, fat, carbs, fiber } in grams (or kcal for energy),
// or null on miss/error. Failures are silent — callers should treat null as
// "skip this ingredient."
//
// === API KEY ===
// Pulled from env at build time (Vite replaces `import.meta.env.VITE_*`
// inline). Falls back to DEMO_KEY when no env var is set, which works for
// ~30 lookups before USDA starts returning 429.
//
// To configure:
//   - Local dev: create `.env.local` with `VITE_USDA_API_KEY=your_key`
//     (gitignored — never deployed; just makes your local dev server
//     hit the API at full rate)
//   - Production: set the GitHub repo secret `USDA_API_KEY` (the deploy
//     workflow injects it at build time as VITE_USDA_API_KEY)
//
// IMPORTANT: a key configured this way IS visible in the deployed JS bundle.
// USDA keys are free, rate-limited per IP, and can't be domain-restricted —
// the realistic blast radius of leakage is having to re-register a new key.
// Don't reuse this key for anything sensitive.
//
// === NUTRIENT IDs ===
// Verified against a live USDA response (chicken breast):
//   1008 Energy (KCAL) — NOTE: omitted in many Foundation Foods /search responses;
//        extractMacros falls back to Atwater (protein×4 + fat×9 + carbs×4) when 0.
//   1003 Protein (G)
//   1004 Total lipid / fat (G)
//   1005 Carbohydrate, by difference (G)
//   1079 Fiber, total dietary (G)

export const USDA_API_KEY =
  import.meta.env.VITE_USDA_API_KEY || 'DEMO_KEY';
const USDA_BASE = 'https://api.nal.usda.gov/fdc/v1';
const CACHE_PREFIX = 'usda_v8_';

// One-time migration: wipe v1 cache keys so stale data doesn't persist
// after scoring logic changes. Runs at module load, silent if nothing to remove.
try {
  const toRemove = [];
  for (let i = 0; i < sessionStorage.length; i++) {
    const k = sessionStorage.key(i);
    if (k && (k.startsWith('usda_v1_') || k.startsWith('usda_v4_') || k.startsWith('usda_v5_') || k.startsWith('usda_v6_') || k.startsWith('usda_v7_'))) toRemove.push(k);
  }
  toRemove.forEach((k) => sessionStorage.removeItem(k));
} catch { /* ignore */ }


// Track session-wide rate-limit state. Once 429d, skip further lookups for
// the rest of the session — they'd just keep failing.
let rateLimited = false;

function extractMacros(food) {
  const find = (id) => {
    const hit = food.foodNutrients?.find((n) => n.nutrientId === id);
    return hit ? hit.value : 0;
  };
  const macros = {
    calories: find(1008),
    protein: find(1003),
    fat: find(1004),
    carbs: find(1005),
    fiber: find(1079),
  };
  // Many Foundation Foods entries omit nutrientId 1008 from the /foods/search
  // response (energy is computed server-side via Atwater factors and not always
  // returned inline). Fall back to Atwater when calories are zero but other
  // macros are present: cal = protein×4 + fat×9 + carbs×4.
  if (macros.calories === 0 && (macros.protein > 0 || macros.fat > 0 || macros.carbs > 0)) {
    macros.calories = Math.round(macros.protein * 4 + macros.fat * 9 + macros.carbs * 4);
  }
  return macros;
}

// Score a USDA result. Lower is better. We prefer:
//   - Foundation > SR Legacy (Foundation entries are more carefully curated)
//   - shorter descriptions (simpler name = more generic = fewer wrong matches)
//   - raw/whole-food entries for ingredients listed at their raw/as-purchased weight
//   - descriptions that don't contain "breaded", "with sauce", "frozen", etc.
//
// NOTE on pasta/rice/grains: The KB (module-02) specifies using DRY weight with
// DRY FDC entries for these ingredients. Do NOT prefer cooked entries — recipes
// list raw/dry amounts and carbs don't change on cooking (only water is added).
//
// NOTE on potato: prefer "flesh and skin" raw entry; penalise starch/flour/chips
// which share the word "potato" but have 3-5× the carb density.

function scoreResult(food, queryName) {
  let score = (food.description || '').length;
  if (food.dataType === 'Foundation') score -= 15;
  const desc = (food.description || '').toLowerCase();
  const qLower = (queryName || '').toLowerCase();

  // Hard penalties — skip these wherever possible
  const penaltyWords = ['breaded', 'in oil', 'with sauce', 'with gravy', 'frozen',
    'flavored', 'sweetened', 'restaurant', 'commercial', 'fast food', 'snack',
    // Processed deli/lunchmeat entries share ingredient names (e.g. "Lunchmeat,
    // chicken breast") but have wildly different macros from raw whole-food cuts.
    'lunchmeat', 'lunch meat', 'deli'];
  for (const w of penaltyWords) {
    if (desc.includes(w)) score += 60;
  }

  // Skin-only cuts (e.g. "Chicken, skin (drumsticks and thighs)") have 40-50g fat/100g
  // vs. ~8g for boneless meat. Penalise hard when description identifies skin as the
  // primary ingredient component (", skin (") rather than a skin-on whole cut.
  if (/,\s*skin\s*\(/.test(desc)) score += 80;

  // Processed-form penalty: when the query is a plain whole food, penalise USDA
  // entries that are a heavily processed derivative (starch, flour, chips, flakes,
  // dehydrated, or extracted oil) which share the ingredient name but have wildly
  // different macros.
  const processedForms = ['starch', 'flour', 'chips', 'flakes', 'dehydrated', 'powder',
    'instant', 'mix', 'dried', 'granules', 'oil'];
  const isPlainQuery = !processedForms.some((p) => qLower.includes(p));
  if (isPlainQuery) {
    for (const p of processedForms) {
      if (desc.includes(p)) { score += 70; break; }
    }
  }

  // Word-boundary relevance check: if none of the meaningful query words appear
  // as whole words in the description, this result is probably a wrong match.
  // e.g. "salt" should not match "Butter, stick, salted"; "cumin" should not
  // match "Flaxseed, ground" just because both contain "ground" or are Foundation.
  const stopWords = new Set(['ground', 'raw', 'dried', 'fresh', 'boneless',
    'skinless', 'cooked', 'whole', 'with', 'and', 'or', 'the', 'a', 'an',
    'for', 'in', 'of', 'unenriched', 'enriched', 'regular', 'instant']);
  const qWords = qLower.split(/\s+/).filter((w) => w.length >= 3 && !stopWords.has(w));
  if (qWords.length > 0) {
    const hasWordMatch = qWords.some((w) => new RegExp(`\\b${w}\\b`).test(desc));
    if (!hasWordMatch) score += 100;
  }

  return score;
}

function readCache(key) {
  try {
    const raw = sessionStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return undefined;
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function writeCache(key, value) {
  try {
    sessionStorage.setItem(CACHE_PREFIX + key, JSON.stringify(value));
  } catch {
    /* quota exceeded — ignore */
  }
}

export function isRateLimited() {
  return rateLimited;
}

// Ingredient names that return wrong USDA results at face value.
// Values are the search query to substitute for the lookup.
// Keys are exact lowercased ingredient names as they appear after parsing.
const QUERY_ALIASES = {
  // ── Potatoes & starches ──────────────────────────────────────────────────
  'potato': 'potatoes raw flesh skin',
  'potatoes': 'potatoes raw flesh skin',
  'baby yellow potatoes': 'potatoes raw flesh skin',
  'russet potatoes': 'potatoes raw flesh skin',
  'sweet potato': 'sweet potato raw',
  'sweet potatoes': 'sweet potato raw',
  'yuca': 'cassava raw',
  'cornstarch': 'cornstarch',

  // ── Salt & basic seasonings ──────────────────────────────────────────────
  'salt': 'salt table',
  'kosher salt': 'salt table',
  'sea salt': 'salt table',

  // ── Spices (all aliased to "spices X" form for reliable USDA matching) ───
  'allspice': 'spices allspice ground',
  'ground allspice': 'spices allspice ground',
  'black pepper': 'black pepper',
  'ground black pepper': 'black pepper',
  'white pepper': 'white pepper',
  'red pepper flakes': 'red pepper cayenne',
  'chili flakes': 'red pepper cayenne',
  'cayenne': 'red pepper cayenne',
  'cayenne pepper': 'red pepper cayenne',
  'cumin': 'spices cumin seed',
  'ground cumin': 'spices cumin seed',
  'cumin seeds': 'spices cumin seed',
  'coriander': 'coriander seed',
  'ground coriander': 'coriander seed',
  'coriander powder': 'coriander seed',
  'paprika': 'spices paprika',
  'smoked paprika': 'spices paprika',
  'turmeric': 'spices turmeric ground',
  'ground turmeric': 'spices turmeric ground',
  'cinnamon': 'spices cinnamon ground',
  'ground cinnamon': 'spices cinnamon ground',
  'cardamom': 'spices cardamom',
  'ground cloves': 'spices cloves ground',
  'garam masala': 'spices garam masala',
  'chili powder': 'spices chili powder',
  'chipotle chili powder': 'spices chili powder',
  'garlic powder': 'spices garlic powder',
  'garlic salt': 'spices garlic salt',
  'onion powder': 'spices onion powder',
  'pumpkin pie spice': 'spices pumpkin pie spice',
  'italian seasoning': 'spices italian seasoning',
  'chinese five-spice powder': 'spices five spice powder',
  'five-spice powder': 'spices five spice powder',
  'celery seeds': 'spices celery seed',
  'mustard seeds': 'spices mustard seed yellow',
  'oregano': 'spices oregano dried',
  'dried oregano': 'spices oregano dried',
  'thyme': 'spices thyme dried',
  'dried thyme': 'spices thyme dried',
  'dried rosemary': 'spices rosemary dried',
  'rosemary': 'spices rosemary',
  'bay leaves': 'bay leaf dried',
  'bay leaf': 'bay leaf dried',
  'ground ginger': 'spices ginger ground',
  'ground mint': 'spices spearmint dried',
  'dried mint': 'spices spearmint dried',
  'dill weed': 'spices dill weed dried',
  'nutmeg': 'spices nutmeg ground',

  // ── Fresh herbs ──────────────────────────────────────────────────────────
  'basil': 'basil fresh',
  'cilantro': 'coriander cilantro raw',
  'parsley': 'parsley raw',
  'flat-leaf parsley': 'parsley raw',
  'dill': 'dill weed fresh',
  'chives': 'chives raw',
  'mint': 'spearmint raw',
  'lemongrass': 'lemon grass raw',

  // ── Garlic & ginger ──────────────────────────────────────────────────────
  'garlic cloves': 'garlic raw',
  'garlic paste': 'garlic raw',
  'ginger paste': 'ginger raw',
  'ginger-garlic paste': 'garlic raw',

  // ── Oils & fats ──────────────────────────────────────────────────────────
  'olive oil': 'oil olive salad cooking',
  'vegetable oil': 'oil vegetable salad cooking',
  'canola oil': 'oil canola',
  'sesame oil': 'oil sesame salad dressing',
  'toasted sesame oil': 'oil sesame salad dressing',
  'coconut oil': 'oil coconut',

  // ── Sauces & condiments ──────────────────────────────────────────────────
  'soy sauce': 'soy sauce',
  'dark soy sauce': 'soy sauce',
  'light soy sauce': 'soy sauce',
  'low-sodium soy sauce': 'soy sauce low sodium',
  'fish sauce': 'fish sauce ready-to-serve',
  'worcestershire sauce': 'worcestershire sauce',
  'hot sauce': 'hot sauce tabasco',
  'sriracha': 'hot sauce tabasco',
  'sriracha sauce': 'hot sauce tabasco',
  'hoisin sauce': 'sauce hoisin',
  'oyster sauce': 'oyster sauce',
  'bbq sauce': 'sauce barbeque ready-to-serve',
  'ketchup': 'ketchup',
  'dijon mustard': 'mustard prepared yellow',
  'yellow mustard': 'mustard prepared yellow',

  // ── Tomato products ──────────────────────────────────────────────────────
  'tomato paste': 'tomato paste canned',
  'tomato sauce': 'tomato sauce canned',
  'tomato puree': 'tomato puree canned',
  'canned tomatoes': 'tomatoes red ripe canned',
  'peeled tomatoes': 'tomatoes red ripe canned',
  'rotel tomatoes with green chilies': 'tomatoes red ripe canned',
  'tomatoes with green chilies': 'tomatoes red ripe canned',
  'sun-dried tomatoes': 'tomatoes sun dried',

  // ── Vinegars ─────────────────────────────────────────────────────────────
  'apple cider vinegar': 'vinegar cider',
  'balsamic vinegar': 'vinegar balsamic',
  'red wine vinegar': 'vinegar red wine',
  'rice wine vinegar': 'vinegar rice',
  'rice vinegar': 'vinegar rice',
  'seasoned rice vinegar': 'vinegar rice',
  'white wine vinegar': 'vinegar distilled',
  'white vinegar': 'vinegar distilled',

  // ── Wines & alcohol ──────────────────────────────────────────────────────
  'dry white wine': 'wine table white',
  'cooking wine': 'wine table white',
  'rice wine': 'wine sake',
  'sake': 'wine sake',

  // ── Broths & stocks ──────────────────────────────────────────────────────
  'beef broth': 'beef broth ready-to-serve',
  'chicken broth': 'chicken broth ready-to-serve',
  'chicken stock': 'chicken broth ready-to-serve',
  'hot chicken stock': 'chicken broth ready-to-serve',
  'vegetable broth': 'vegetable broth',
  'vegetable stock': 'vegetable broth',

  // ── Dairy & eggs ────────────────────────────────────────────────────────
  'heavy cream': 'cream fluid heavy whipping',
  'heavy whipping cream': 'cream fluid heavy whipping',
  'sour cream': 'sour cream regular',
  'cream cheese': 'cream cheese regular',
  'parmesan': 'cheese parmesan hard',
  'parmesan cheese': 'cheese parmesan hard',
  'greek yogurt': 'yogurt greek plain nonfat',
  'plain greek yogurt': 'yogurt greek plain nonfat',
  'high-protein greek yogurt': 'yogurt greek plain nonfat',
  'plain yogurt': 'yogurt plain whole milk',
  'plain natural yogurt': 'yogurt plain whole milk',
  'low-fat cottage cheese': 'cottage cheese lowfat',
  'paneer': 'cheese paneer',

  // ── Nuts, seeds & nut butters ────────────────────────────────────────────
  'creamy peanut butter': 'peanut butter smooth',
  'creamy natural peanut butter': 'peanut butter smooth',
  'almond butter': 'butter almond',
  'toasted sesame seeds': 'seeds sesame whole dried',
  'walnuts': 'walnuts english',
  'pine nuts': 'pine nuts dried',

  // ── Sweeteners ───────────────────────────────────────────────────────────
  'liquid honey': 'honey',
  'raw honey': 'honey',
  'pure maple syrup': 'maple syrup',
  'coconut sugar': 'sugar coconut palm',
  'brown rice syrup': 'syrups malt',

  // ── Chocolate & baking ───────────────────────────────────────────────────
  'chocolate chips': 'chocolate chips semisweet',
  'mini chocolate chips': 'chocolate chips semisweet',
  'cocoa powder': 'cocoa dry powder unsweetened',
  'oat flour': 'flour oat',
  'panko breadcrumbs': 'bread crumbs dry grated plain',

  // ── Grains, pasta & legumes ──────────────────────────────────────────────
  'barley': 'barley pearled raw',
  'wild rice': 'wild rice raw',
  'wild rice blend': 'wild rice raw',
  'steel-cut oats': 'oats rolled',
  'old-fashioned rolled oats': 'oats rolled',
  'brown rice noodles': 'rice noodles dry',
  'egg noodles': 'noodles egg cooked',
  'pasta shells': 'pasta dry unenriched',
  'acini di pepe pasta': 'pasta dry unenriched',
  'lentils': 'lentils raw',
  'red lentils': 'lentils red raw',
  'chickpeas': 'chickpeas raw',
  'canned chickpeas': 'chickpeas canned',
  'black beans': 'beans black raw',
  'kidney beans': 'beans kidney red raw',
  'cannellini beans': 'beans white raw',

  // ── Vegetables ───────────────────────────────────────────────────────────
  'butternut squash': 'squash butternut raw',
  'zucchini': 'squash zucchini raw',
  'kale': 'kale raw',
  'spinach': 'spinach raw',
  'bamboo shoots': 'bamboo shoots canned',
  'avocado': 'avocado raw all varieties',
  'green plantain': 'plantains raw',
  'radishes': 'radishes raw',
  'corn on the cob': 'corn sweet yellow raw',
  'frozen peas': 'peas green frozen',
  'frozen fruit': 'fruit mixed frozen',
  'mixed vegetables': 'vegetables mixed frozen',
  'hominy': 'hominy canned yellow',
  'tamarind paste': 'tamarind raw',
  'dried cranberries': 'cranberries dried sweetened',

  // ── Peppers & chiles ────────────────────────────────────────────────────
  'green bell pepper': 'peppers sweet green raw',
  'red bell pepper': 'peppers sweet red raw',
  'jalapeño': 'peppers jalapeno raw',
  'green chili': 'peppers hot chili green raw',
  'green chilies': 'peppers hot chili green raw',
  'red chilies': 'peppers hot chili red raw',
  'red chili peppers': 'peppers hot chili red raw',
  'habanero': 'peppers hot chili raw',
  'scotch bonnet': 'peppers hot chili raw',
  'scotch bonnet pepper': 'peppers hot chili raw',
  'scotch bonnet peppers': 'peppers hot chili raw',

  // ── Alliums ──────────────────────────────────────────────────────────────
  'onion': 'onions raw',
  'yellow onion': 'onions raw',
  'white onion': 'onions raw',
  'red onion': 'onions red raw',
  'green onion': 'onions spring raw',
  'green onions': 'onions spring raw',
  'green onion whites': 'onions spring raw',
  'spring onions': 'onions spring raw',
  'scallions': 'onions spring raw',
  'shallot': 'shallots raw',

  // ── Juices & citrus ──────────────────────────────────────────────────────
  'lemon juice': 'juice lemon raw',
  'lime juice': 'juice lime raw',
  'orange juice': 'juice orange raw',
  'pineapple juice': 'juice pineapple canned',

  // ── Other sauces, pastes & specialty ────────────────────────────────────
  'orange marmalade': 'marmalades citrus peel',
  'white miso paste': 'miso paste fermented',
  'pumpkin puree': 'pumpkin canned',
  'tofu': 'tofu raw firm',
  'velveeta': 'cheese product pasteurized',
  'asian pear': 'pear asian raw',

  // ── Beverages used in cooking ────────────────────────────────────────────
  'espresso': 'coffee brewed prepared',
  'strong brewed coffee': 'coffee brewed prepared',
};

export async function fetchNutrition(ingredientName, signal) {
  if (!ingredientName) return null;
  const key = ingredientName.trim().toLowerCase();
  if (!key) return null;

  // Cache: undefined = never seen, null = USDA returned no foods (real miss)
  const cached = readCache(key);
  if (cached !== undefined) return cached;

  // Once we've been 429d this session, stop hammering — every call will fail
  if (rateLimited) return null;

  // Apply alias substitution for ingredients that produce wrong USDA matches
  const searchQuery = QUERY_ALIASES[key] || key;

  try {
    const url =
      `${USDA_BASE}/foods/search?query=${encodeURIComponent(searchQuery)}` +
      `&dataType=SR%20Legacy,Foundation&pageSize=5&api_key=${USDA_API_KEY}`;
    const res = await fetch(url, signal ? { signal } : undefined);
    if (res.status === 429 || res.status === 403) {
      // Rate-limited or auth error — DON'T cache (transient), but stop further lookups
      rateLimited = true;
      return null;
    }
    if (!res.ok) {
      // Other transient errors — don't cache, just return null this time
      return null;
    }
    const data = await res.json();
    const foods = data.foods || [];
    if (foods.length === 0) {
      writeCache(key, null);  // genuine miss — cache so we don't retry
      return null;
    }
    const best = foods.slice().sort((a, b) => scoreResult(a, key) - scoreResult(b, key))[0];
    const macros = extractMacros(best);
    writeCache(key, macros);
    return macros;
  } catch {
    // Network error — don't cache
    return null;
  }
}
