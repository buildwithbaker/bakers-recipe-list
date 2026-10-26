// Runtime auto-tag derivation.
// Returns tags that aren't already in recipe.tags so there are no duplicates.
//
// Two sources:
//   1. Category → cuisine/type tag (100% reliable, no false positives)
//   2. Ingredient keywords → dietary/protein/characteristic tags
//
// These tags behave exactly like manual tags: they appear in the modal meta
// line, match searches, and populate the tag browser counts.

// Maps a record's `category` to a single cuisine/type tag.
//
// Keyed on `category`, not `section`: a Chef's Draft is filed under section
// CHEFS DRAFTS but keeps the category of the section it will move to, so
// keying on section gave drafts no cuisine or dish-type tag at all. For every
// Cookbook record the two agree (category is its section's label), so the
// output there is unchanged. autoTags.test.js holds both to that.
const CATEGORY_TAG_MAP = {
  'American':                     ['#american'],
  'Mexican':                      ['#mexican'],
  'Asian':                        ['#asian'],
  'Italian':                      ['#italian'],
  'Middle Eastern':               ['#middle-eastern'],
  'Breakfast':                    ['#breakfast'],
  'Slow Cooker':                  ['#slow-cooker'],
  'Soups':                        ['#soup'],
  'Sandwiches':                   ['#sandwich'],
  'Sides':                        ['#side-dish'],
  'Snacks':                       ['#snack'],
  'Smoothies':                    ['#smoothie'],
  'Bread':                        ['#bread'],
  'Marinades':                    ['#marinade'],
  'Seasonings':                   ['#seasoning'],
  'Doughs':                       ['#dough'],
};

// Bread above looks dead: no published recipe reaches it, because every record
// in that category is currently a blank placeholder and getAutoTags returns
// nothing for a blank. It is NOT dead: fill one of those recipes in and the key
// becomes live and correct. Do not "tidy" it away. Desserts has no entry, as
// DESSERTS had none when this map was keyed on section.

// Ingredient substrings that signal #spicy.
const SPICY_NEEDLES = [
  'jalapeño', 'jalapeno', 'habanero', 'serrano', 'cayenne',
  'sriracha', 'ghost pepper', 'thai chili', "bird's eye",
  'crushed red pepper', 'red pepper flakes', 'chili pepper',
  'gochujang', 'gochugaru', 'chile de arbol', 'ancho', 'chipotle',
  'scorpion pepper', 'carolina reaper',
];

// Substrings that indicate a line is broth/stock rather than the protein itself.
// Used to suppress false positives like "chicken broth" triggering #chicken.
const BROTH_WORDS = ['broth', 'stock', 'bouillon', 'base', 'powder', 'seasoning'];

// Substrings that name a DIFFERENT animal. A cut word like "steak" is not
// specific to one of them — "pork shoulder steaks" is pork — so a line naming
// another protein cannot also count as this one. Applied per LINE, so a recipe
// with a beef line and a pork line still gets both tags; only a single line
// mentioning both is skipped.
const OTHER_PROTEINS = ['pork', 'chicken', 'turkey', 'lamb', 'salmon', 'tuna', 'shrimp'];

// Returns true if the ingredient line contains any of the needles AND at least
// one matching line is NOT a broth/stock/powder usage, and is not naming a
// different animal (`notWhen`).
// ingLines: string[] of lowercased individual ingredient texts.
function hasProtein(ingLines, needles, notWhen = []) {
  return needles.some((needle) =>
    ingLines.some((raw) => {
      // A packaged cut that ships with its own spice packet is still the
      // protein: "corned beef brisket (with seasoning packet)" is beef.
      const line = raw.replace('seasoning packet', '');
      return line.includes(needle)
        && !BROTH_WORDS.some((w) => line.includes(w))
        && !notWhen.some((w) => line.includes(w));
    })
  );
}

// Ingredient substrings for protein tags.
// Matching is per-line with broth exclusion (see hasProtein above).
const PROTEIN_RULES = [
  { needles: ['chicken', 'poultry'],                                                   tag: '#chicken' },
  // `steak` is a cut, not an animal: "pork shoulder steaks" was yielding #beef.
  // Beef tallow is a cooking fat, not the protein of the dish.
  { needles: ['ground beef', 'beef', 'steak', 'brisket', 'chuck', 'short rib'],       tag: '#beef', notWhen: [...OTHER_PROTEINS, 'tallow'] },
  // "ham" is a substring of "hamburger": a hamburger bun is not pork.
  { needles: ['pork', 'bacon', 'ham', 'prosciutto', 'pancetta', 'chorizo', 'salami'], tag: '#pork', notWhen: ['hamburger'] },
  { needles: ['sausage'],                                                               tag: '#pork'    },
  // Fish sauce is a seasoning, not seafood (Adam, 2026-10-26).
  { needles: ['salmon', 'tuna', 'cod', 'halibut', 'tilapia', 'mahi', 'fish'],         tag: '#seafood', notWhen: ['fish sauce'] },
  { needles: ['shrimp', 'scallop', 'crab', 'lobster', 'clam', 'mussel', 'prawn'],    tag: '#seafood' },
  { needles: ['lamb', 'mutton'],                                                       tag: '#lamb'    },
  { needles: ['turkey'],                                                                tag: '#turkey'  },
];

// Every tag the protein rules can produce, once each. tagFacets.js reads this to
// give an auto protein tag its facet without keeping a second copy of the list.
export const PROTEIN_TAGS = Object.freeze([...new Set(PROTEIN_RULES.map((r) => r.tag))]);

// ── NEW: 14 days after `added` ─────────────────────────────────────────────
//
// `added` is a bare calendar date in Central time (schema). "Today" is the
// calendar date in America/Chicago at this instant, never the device's zone,
// and both are compared as calendar dates: no `new Date("YYYY-MM-DD")`, which
// parses as UTC midnight and lands on the previous day west of Greenwich.
//
// Computed at render in the browser only. The prerender writes an empty #root
// and its JSON-LD keywords come from `recipe.tags`, so #new never reaches
// either.
export const NEW_TAG = '#new';
export const NEW_DAYS = 14;

// The clock every NEW check reads. Tests (and renderToString output) set it
// with setClock so the answer does not depend on when the suite runs.
let clock = () => new Date();

/** Point the NEW clock at a fixed instant (a Date or a () => Date); no argument restores the real clock. */
export function setClock(now) {
  if (now === undefined) clock = () => new Date();
  else clock = typeof now === 'function' ? now : () => now;
}

const CENTRAL_DATE = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit',
});

/** Today's calendar date in Central time, "YYYY-MM-DD". */
export function centralToday(now = clock()) {
  const parts = Object.fromEntries(CENTRAL_DATE.formatToParts(now).map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

// A "YYYY-MM-DD" date as a whole day number. Date.UTC is pure calendar
// arithmetic here (no zone is involved), so the difference of two of these is
// an exact count of calendar days, DST or not.
function dayNumber(ymd) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd ?? '');
  if (!m) return null;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / 86400000;
}

/** Calendar days from `added` to today in Central (0 on the day it went live), or null without a valid `added`. */
export function daysSinceAdded(recipe, now = clock()) {
  const added = dayNumber(recipe?.added);
  if (added === null) return null;
  return dayNumber(centralToday(now)) - added;
}

/** True for the first 14 days a recipe is live: day 0 through day 13. A future `added` is never new. */
export function isNew(recipe, now = clock()) {
  if (!recipe || recipe.is_blank) return false;
  const days = daysSinceAdded(recipe, now);
  return days !== null && days >= 0 && days < NEW_DAYS;
}

// options.now: an optional Date to judge #new against (default: the clock above).
export function getAutoTags(recipe, options) {
  if (!recipe || recipe.is_blank) return [];

  const result = new Set();

  // ── 1. Category tags ─────────────────────────────────────────────────────
  const categoryTags = CATEGORY_TAG_MAP[recipe.category];
  if (categoryTags) categoryTags.forEach((t) => result.add(t));

  // ── 2. Ingredient-derived tags ───────────────────────────────────────────
  const ingLines = recipe.ingredients
    ?.filter((i) => i.type === 'item')
    .map((i) => i.text.toLowerCase()) ?? [];

  // #spicy: flat match is fine — "chipotle powder" or "cayenne" in any context = spicy
  const ingText = ingLines.join(' ');
  if (SPICY_NEEDLES.some((n) => ingText.includes(n))) result.add('#spicy');

  // Protein tags: per-line match with broth/stock exclusion
  for (const { needles, tag, notWhen } of PROTEIN_RULES) {
    if (hasProtein(ingLines, needles, notWhen)) result.add(tag);
  }

  // ── 3. Date-derived tags ─────────────────────────────────────────────────
  if (isNew(recipe, options?.now ?? clock())) result.add(NEW_TAG);

  // ── 4. Remove tags already set manually (dedup) ──────────────────────────
  const manual = new Set(recipe.tags ?? []);
  return [...result].filter((t) => !manual.has(t));
}

// Convenience: returns manual + auto tags merged, deduped. `now` as getAutoTags.
export function getEffectiveTags(recipe, options) {
  return [...(recipe?.tags ?? []), ...getAutoTags(recipe, options)];
}
