// Runtime auto-tag derivation.
// Returns tags that aren't already in recipe.tags so there are no duplicates.
//
// Two sources:
//   1. Section → cuisine/type tag (100% reliable, no false positives)
//   2. Ingredient keywords → dietary/protein/characteristic tags
//
// These tags behave exactly like manual tags: they appear in the modal meta
// line, match searches, and populate the tag browser counts.

// Maps a section key to a single cuisine/type tag.
const SECTION_TAG_MAP = {
  'AMERICAN':                     ['#american'],
  'MEXICAN':                      ['#mexican'],
  'ASIAN':                        ['#asian'],
  'ITALIAN':                      ['#italian'],
  'MIDDLE EASTERN':               ['#middle-eastern'],
  'BREAKFAST':                    ['#breakfast'],
  'SLOW COOKER':                  ['#slow-cooker'],
  'SOUPS':                        ['#soup'],
  'SANDWICHES':                   ['#sandwich'],
  'SIDES':                        ['#side-dish'],
  'SNACKS':                       ['#snack'],
  'SMOOTHIES':                    ['#smoothie'],
  'BREAD':                        ['#bread'],
  'MARINADES':                    ['#marinade'],
  'SEASONINGS':                   ['#seasoning'],
  'DOUGHS':                       ['#dough'],
};

// SANDWICHES and BREAD above look dead — no published recipe reaches them,
// because every record in those sections is currently a blank placeholder and
// getAutoTags returns nothing for a blank. They are NOT dead: fill one of those
// recipes in and the key becomes live and correct. Do not "tidy" them away.

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

  // ── 1. Section tags ──────────────────────────────────────────────────────
  const sectionTags = SECTION_TAG_MAP[recipe.section];
  if (sectionTags) sectionTags.forEach((t) => result.add(t));

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
