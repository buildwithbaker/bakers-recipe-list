// How the list is organised for a reader: CATEGORIES, each holding display rows.
//
// sections.js is the storage model (a section key per record). This file is the
// browsing model laid over it. Nothing here edits a record; it only says which
// category a section belongs to.
//
// The site is the Cookbook only. The To Try and For Review collections were
// removed on 2026-10-02 (archived outside the repo; in git history at d58c4db).
//
// Every section must map to a category. catalog.test.js fails the suite when a
// new section is added to sections.js without a line in SECTION_CATEGORY, so a
// new bucket can never silently vanish from the list.
import { SECTIONS } from './sections.js';
import { displayRecipes } from './recipeIndex.js';
import { isComingSoon } from '../utils/recipeKinds.js';
import { mix } from '../utils/colour.js';

// tokens.css --surface. Kept in step by contrast.test.js.
export const SURFACE = '#fffbf5';

// Reader-facing categories, one per section.
//
// Each owns one colour (prototype v2). Seventeen categories share ten
// colours, so neighbours can repeat; the colour is a wayfinding cue, never the only
// signal. Every colour must clear 4.5:1 as text on the card surface and under
// white text; contrast.test.js measures each one.
const RAW_CATEGORIES = [
  { id: 'breakfast', label: 'Breakfast', color: '#8a5a00' },
  { id: 'slow-cooker', label: 'Slow Cooker', color: '#8b3a1a' },
  { id: 'seasonings', label: 'Seasonings', color: '#56662a' },
  { id: 'doughs', label: 'Doughs', color: '#9a4a12' },
  { id: 'american', label: 'American', color: '#1f3a5f' },
  { id: 'mexican', label: 'Mexican', color: '#a63d24' },
  { id: 'asian', label: 'Asian', color: '#1d6663' },
  { id: 'italian', label: 'Italian', color: '#a63d24' },
  { id: 'middle-eastern', label: 'Middle Eastern', color: '#6b3a5e' },
  { id: 'sandwiches', label: 'Sandwiches', color: '#3e4f7a' },
  { id: 'sides', label: 'Sides', color: '#56662a' },
  { id: 'snacks', label: 'Snacks', color: '#9a4a12' },
  { id: 'desserts', label: 'Desserts', color: '#6b3a5e' },
  { id: 'soups', label: 'Soups', color: '#3e4f7a' },
  { id: 'marinades', label: 'Marinades', color: '#46644f' },
  { id: 'smoothies', label: 'Smoothies', color: '#46644f' },
  { id: 'bread', label: 'Bread', color: '#8a5a00' },
];

// Two tints per category, precomputed (see utils/colour.js for why not
// color-mix): `soft` 13% for photo slots and the recipe header band, `mid` 30%
// for borders and rules.
export const CATEGORIES = RAW_CATEGORIES.map((c) => ({
  ...c,
  soft: mix(c.color, SURFACE, 0.13),
  mid: mix(c.color, SURFACE, 0.30),
}));

// The CSS custom properties that theme an element to its category.
export function categoryStyle(category) {
  if (!category) return undefined;
  return { '--cc': category.color, '--cc-soft': category.soft, '--cc-mid': category.mid };
}

export const CATEGORY_BY_ID = new Map(CATEGORIES.map((c) => [c.id, c]));

// Section key -> category id. Hand-written on purpose: a derived mapping would
// guess at new buckets, and a wrong guess puts recipes under the wrong heading.
export const SECTION_CATEGORY = {
  'BREAKFAST': 'breakfast',
  'SLOW COOKER': 'slow-cooker',
  'SEASONINGS': 'seasonings',
  'DOUGHS': 'doughs',
  'AMERICAN': 'american',
  'MEXICAN': 'mexican',
  'ASIAN': 'asian',
  'ITALIAN': 'italian',
  'MIDDLE EASTERN': 'middle-eastern',
  'SANDWICHES': 'sandwiches',
  'SIDES': 'sides',
  'SNACKS': 'snacks',
  'DESSERTS': 'desserts',
  'SOUPS': 'soups',
  'MARINADES': 'marinades',
  'SMOOTHIES': 'smoothies',
  'BREAD': 'bread',
};

export function categoryOf(recipe) {
  return CATEGORY_BY_ID.get(SECTION_CATEGORY[recipe.section]) ?? null;
}

// Every display row, in SECTIONS order (the order the list has always used),
// so groups come out Breakfast, Slow Cooker, ... not file order.
const SECTION_ORDER = new Map(SECTIONS.map((s, i) => [s.key, i]));
export const ROWS = [...displayRecipes].sort(
  (a, b) => (SECTION_ORDER.get(a.section) ?? 1e9) - (SECTION_ORDER.get(b.section) ?? 1e9),
);

// A written recipe: not a placeholder. Each one has its own page.
export const isWritten = (r) => !r.is_blank;

// Headline numbers, counted off the same rows the list renders.
export const CATALOG_COUNTS = {
  written: ROWS.filter(isWritten).length,
  comingSoon: ROWS.filter(isComingSoon).length,
};

// Groups rows into [{ category, rows }] in first-appearance order. Rows with no
// category (impossible while the mapping test passes) are kept under a null
// category rather than dropped.
export function groupByCategory(rows) {
  const groups = new Map();
  for (const r of rows) {
    const cat = categoryOf(r);
    const key = cat?.id ?? '';
    if (!groups.has(key)) groups.set(key, { category: cat, rows: [] });
    groups.get(key).rows.push(r);
  }
  return [...groups.values()];
}

// Coming-soon placeholders, per category. The list hides placeholder cards and
// says "N more planned" on the category header instead.
export const PLANNED_BY_CATEGORY = (() => {
  const out = new Map();
  for (const r of ROWS) {
    if (!isComingSoon(r)) continue;
    const id = categoryOf(r)?.id ?? '';
    out.set(id, (out.get(id) ?? 0) + 1);
  }
  return out;
})();

// What the list shows: the written recipes.
export const LISTED_ROWS = ROWS.filter((r) => !isComingSoon(r));
