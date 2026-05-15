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
//   1008 Energy (KCAL)
//   1003 Protein (G)
//   1004 Total lipid / fat (G)
//   1005 Carbohydrate, by difference (G)
//   1079 Fiber, total dietary (G)

export const USDA_API_KEY =
  import.meta.env.VITE_USDA_API_KEY || 'DEMO_KEY';
const USDA_BASE = 'https://api.nal.usda.gov/fdc/v1';
const CACHE_PREFIX = 'usda_v3_';

// One-time migration: wipe v1 cache keys so stale data doesn't persist
// after scoring logic changes. Runs at module load, silent if nothing to remove.
try {
  const toRemove = [];
  for (let i = 0; i < sessionStorage.length; i++) {
    const k = sessionStorage.key(i);
    if (k && k.startsWith('usda_v1_')) toRemove.push(k);
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
  return {
    calories: find(1008),
    protein: find(1003),
    fat: find(1004),
    carbs: find(1005),
    fiber: find(1079),
  };
}

// Score a USDA result. Lower is better. We prefer:
//   - Foundation > SR Legacy
//   - shorter descriptions (simpler = more generic = more accurate)
//   - cooked state for grains/legumes (pasta, rice, noodles, beans, lentils)
//     since recipes measure them dry but eat them cooked (same total carbs,
//     but cooked weight per serving is what ends up on the plate)
//   - descriptions that don't contain "breaded", "with sauce", "frozen", etc.
const PREFER_COOKED = ['pasta', 'noodle', 'spaghetti', 'penne', 'fettuccine', 'linguine',
  'macaroni', 'rotini', 'rigatoni', 'farfalle', 'rice', 'lentil', 'bean', 'chickpea',
  'couscous', 'quinoa', 'barley', 'bulgur'];

function scoreResult(food, queryName) {
  let score = (food.description || '').length;
  if (food.dataType === 'Foundation') score -= 30;
  const desc = (food.description || '').toLowerCase();
  const qLower = (queryName || '').toLowerCase();

  // Hard penalties — skip these wherever possible
  const penaltyWords = ['breaded', 'in oil', 'with sauce', 'with gravy', 'frozen', 'canned',
    'flavored', 'sweetened', 'restaurant', 'commercial', 'fast food'];
  for (const w of penaltyWords) {
    if (desc.includes(w)) score += 60;
  }

  // For grains/legumes prefer the cooked entry (matches the served portion)
  const wantsCooked = PREFER_COOKED.some((k) => qLower.includes(k));
  if (wantsCooked) {
    if (desc.includes('cooked')) score -= 40;
    if (desc.includes('dry') || desc.includes('unenriched') || desc.includes('uncooked')) score += 30;
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

export async function fetchNutrition(ingredientName, signal) {
  if (!ingredientName) return null;
  const key = ingredientName.trim().toLowerCase();
  if (!key) return null;

  // Cache: undefined = never seen, null = USDA returned no foods (real miss)
  const cached = readCache(key);
  if (cached !== undefined) return cached;

  // Once we've been 429d this session, stop hammering — every call will fail
  if (rateLimited) return null;

  try {
    const url =
      `${USDA_BASE}/foods/search?query=${encodeURIComponent(key)}` +
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
