// Per-serving macros from pinned USDA data. Pure arithmetic, no network calls.
//
// This module has NO JSON imports so plain Node can run it (the prebuild
// validator does). Both functions take the data as arguments; the app binds the
// real files in src/data/nutrition/index.js.
//
// Data (both maintained by The Chef, validated at build time):
//   src/data/nutrition/foods.json - each food pinned to one USDA FoodData Central
//     record (fdcId), with per-100 g kcal / protein / fat / carbs / fiber.
//   src/data/nutrition/lines.json - for every recipe, every ingredient line (keyed
//     by its exact text) -> { food, grams, retain?, fatRetain?, note? } or
//     { exclude: reason }. A recipe can instead carry { skip: reason }.
//
// grams is the edible weight that goes into the dish. retain (0-1] scales the
// whole line (discarded marinade). fatRetain (0-1] scales only the fat, and the
// lost fat's calories (9 kcal/g) come off too (fat poured off or skimmed).

export const NO_MACRO_SECTIONS = new Set(['SEASONINGS', 'DOUGHS']);

function itemLines(recipe) {
  return (recipe.ingredients || []).filter(
    (i) => i && i.type !== 'header' && i.type !== 'section' && typeof i.text === 'string',
  );
}

// foods = the `foods` object of foods.json, lines = the `recipes` object of lines.json.
// Returns one of:
//   { status: 'none' }                                   - blank recipe or a no-macro section
//   { status: 'skipped', reason }                        - recipe-level skip in lines.json
//   { status: 'incomplete', missing: [text, ...] }       - unmapped lines (the build should prevent this)
//   { status: 'ok', perServing: {calories, protein, fat, carbs, fiber}, excluded: [{text, reason}], counted }
export function computeMacros(recipe, servings, foods, lines) {
  if (!recipe || recipe.is_blank || NO_MACRO_SECTIONS.has(recipe.section)) return { status: 'none' };
  const entry = lines[recipe.id];
  if (entry && entry.skip) return { status: 'skipped', reason: entry.skip };
  if (!servings || servings <= 0) return { status: 'none' };
  const map = (entry && entry.lines) || {};
  const missing = [];
  const excluded = [];
  const t = { calories: 0, protein: 0, fat: 0, carbs: 0, fiber: 0 };
  let counted = 0;
  for (const { text } of itemLines(recipe)) {
    const m = map[text];
    if (!m || (!m.exclude && !foods[m.food])) { missing.push(text); continue; }
    if (m.exclude) { excluded.push({ text, reason: m.exclude }); continue; }
    const n = foods[m.food].per100g;
    const k = (m.grams / 100) * (m.retain ?? 1);
    const fatKept = n.fat * k * (m.fatRetain ?? 1);
    t.calories += n.kcal * k - (n.fat * k - fatKept) * 9;
    t.protein += n.protein * k;
    t.fat += fatKept;
    t.carbs += n.carbs * k;
    t.fiber += n.fiber * k;
    counted++;
  }
  if (missing.length) return { status: 'incomplete', missing };
  const per = (v) => Math.round(v / servings);
  return {
    status: 'ok',
    perServing: { calories: per(t.calories), protein: per(t.protein), fat: per(t.fat), carbs: per(t.carbs), fiber: per(t.fiber) },
    excluded,
    counted,
  };
}

// Build-time check. Returns a list of human-readable problems; empty means valid.
export function validateNutrition(recipes, foods, lines) {
  const problems = [];
  const byId = new Map(recipes.map((r) => [r.id, r]));
  for (const [id, f] of Object.entries(foods)) {
    const n = f.per100g || {};
    for (const k of ['kcal', 'protein', 'fat', 'carbs', 'fiber']) {
      if (typeof n[k] !== 'number' || n[k] < 0) problems.push(`foods.json: ${id} has no valid per100g.${k}`);
    }
    if (!Number.isInteger(f.fdcId)) problems.push(`foods.json: ${id} has no fdcId`);
  }
  for (const r of recipes) {
    if (r.is_blank || NO_MACRO_SECTIONS.has(r.section)) continue;
    const entry = lines[r.id];
    if (!entry) { problems.push(`lines.json: recipe "${r.id}" has no nutrition entry`); continue; }
    if (entry.skip) continue;
    const texts = new Set(itemLines(r).map((i) => i.text));
    for (const text of texts) {
      const m = entry.lines?.[text];
      if (!m) { problems.push(`lines.json: "${r.id}" line not mapped: ${text}`); continue; }
      if (m.exclude) { if (typeof m.exclude !== 'string' || !m.exclude) problems.push(`lines.json: "${r.id}" exclude needs a reason: ${text}`); continue; }
      if (!foods[m.food]) problems.push(`lines.json: "${r.id}" unknown food "${m.food}": ${text}`);
      if (!(typeof m.grams === 'number' && m.grams > 0)) problems.push(`lines.json: "${r.id}" grams must be > 0: ${text}`);
      for (const k of ['retain', 'fatRetain']) {
        if (m[k] !== undefined && !(m[k] > 0 && m[k] <= 1)) problems.push(`lines.json: "${r.id}" ${k} must be in (0, 1]: ${text}`);
      }
    }
    for (const text of Object.keys(entry.lines || {})) {
      if (!texts.has(text)) problems.push(`lines.json: "${r.id}" maps a line the recipe no longer has (edited or removed?): ${text}`);
    }
  }
  for (const id of Object.keys(lines)) {
    const r = byId.get(id);
    if (!r) problems.push(`lines.json: entry for unknown recipe id "${id}"`);
    else if (r.is_blank || NO_MACRO_SECTIONS.has(r.section)) problems.push(`lines.json: "${id}" is blank or in a no-macro section, remove its entry`);
  }
  return problems;
}
