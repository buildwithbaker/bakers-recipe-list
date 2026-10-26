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
    ingLines.some((line) =>
      line.includes(needle)
      && !BROTH_WORDS.some((w) => line.includes(w))
      && !notWhen.some((w) => line.includes(w))
    )
  );
}

// Ingredient substrings for protein tags.
// Matching is per-line with broth exclusion (see hasProtein above).
const PROTEIN_RULES = [
  { needles: ['chicken', 'poultry'],                                                   tag: '#chicken' },
  // `steak` is a cut, not an animal: "pork shoulder steaks" was yielding #beef.
  { needles: ['ground beef', 'beef', 'steak', 'brisket', 'chuck', 'short rib'],       tag: '#beef', notWhen: OTHER_PROTEINS },
  { needles: ['pork', 'bacon', 'ham', 'prosciutto', 'pancetta', 'chorizo', 'salami'], tag: '#pork'    },
  { needles: ['sausage'],                                                               tag: '#pork'    },
  { needles: ['salmon', 'tuna', 'cod', 'halibut', 'tilapia', 'mahi', 'fish'],         tag: '#seafood' },
  { needles: ['shrimp', 'scallop', 'crab', 'lobster', 'clam', 'mussel', 'prawn'],    tag: '#seafood' },
  { needles: ['lamb', 'mutton'],                                                       tag: '#lamb'    },
  { needles: ['turkey'],                                                                tag: '#turkey'  },
];

export function getAutoTags(recipe) {
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

  // ── 3. Remove tags already set manually (dedup) ──────────────────────────
  const manual = new Set(recipe.tags ?? []);
  return [...result].filter((t) => !manual.has(t));
}

// Convenience: returns manual + auto tags merged, deduped.
export function getEffectiveTags(recipe) {
  return [...(recipe?.tags ?? []), ...getAutoTags(recipe)];
}
