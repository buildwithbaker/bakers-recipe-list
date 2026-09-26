// How the list is organised for a reader: three COLLECTIONS, each made of
// CATEGORIES, each holding display rows.
//
// sections.js is the storage model (a section key per record, including the
// FOR REVIEW and TO TRY staging buckets). This file is the browsing model laid
// over it. Nothing here edits a record; it only says which collection and which
// category a section belongs to.
//
// Every section must map to a category. catalog.test.js fails the suite when a
// new section is added to sections.js without a line in SECTION_CATEGORY, so a
// new bucket can never silently vanish from the list.
import { SECTIONS } from './sections.js';
import { displayRecipes } from './recipeIndex.js';
import { isComingSoon, isToTry } from '../utils/recipeKinds.js';
import { mix } from '../utils/colour.js';

// tokens.css --surface. Kept in step by contrast.test.js.
export const SURFACE = '#fffbf5';

export const COLL_BOOK = 'book';
export const COLL_REVIEW = 'review';
export const COLL_TRY = 'try';

export const COLLECTIONS = [
  { key: COLL_BOOK, label: 'Cookbook' },
  { key: COLL_REVIEW, label: 'For Review' },
  { key: COLL_TRY, label: 'To Try' },
];

export const COLLECTION_LABELS = Object.fromEntries(COLLECTIONS.map((c) => [c.key, c.label]));

// Reader-facing categories. A category is a label, not a section: the two For
// Review soup buckets are one "Soups" category, and "Asian" means the same
// thing in the Cookbook and in To Try.
//
// Each owns one colour (prototype v2). Twenty-one categories share ten
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
  { id: 'curry', label: 'Curry', color: '#8a5a00' },
  { id: 'marinades-chicken', label: 'Marinades · Chicken', color: '#a63d24' },
  { id: 'marinades-beef', label: 'Marinades · Beef', color: '#8b3a1a' },
  { id: 'marinades-pork', label: 'Marinades · Pork', color: '#6b3a5e' },
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
  'TO TRY --- AMERICAN': 'american',
  'TO TRY --- MEXICAN': 'mexican',
  'TO TRY --- ASIAN': 'asian',
  'TO TRY --- ITALIAN': 'italian',
  'TO TRY --- MIDDLE EASTERN': 'middle-eastern',
  'TO TRY --- SIDES': 'sides',
  'TO TRY --- SOUPS': 'soups',
  'TO TRY --- SANDWICHES': 'sandwiches',
  'TO TRY --- SLOW COOKER': 'slow-cooker',
  'TO TRY --- MARINADES': 'marinades',
  'TO TRY --- SNACKS': 'snacks',
  'TO TRY --- SMOOTHIES': 'smoothies',
  'TO TRY --- DESSERTS': 'desserts',
  'TO TRY --- BREAD': 'bread',
  'FOR REVIEW --- CURRY': 'curry',
  'FOR REVIEW --- SOUPS': 'soups',
  'FOR REVIEW - SOUPS': 'soups',
  'FOR REVIEW - MARINADES - CHICKEN': 'marinades-chicken',
  'FOR REVIEW - MARINADES - BEEF': 'marinades-beef',
  'FOR REVIEW - MARINADES - PORK': 'marinades-pork',
};

const SECTION_BY_KEY = new Map(SECTIONS.map((s) => [s.key, s]));

export function collectionOfSection(section) {
  if (section?.review) return COLL_REVIEW;
  if (section?.toTry) return COLL_TRY;
  return COLL_BOOK;
}

export function collectionOf(recipe) {
  return collectionOfSection(SECTION_BY_KEY.get(recipe.section));
}

export function categoryOf(recipe) {
  return CATEGORY_BY_ID.get(SECTION_CATEGORY[recipe.section]) ?? null;
}

// Display rows per collection, in SECTIONS order (the order the list has
// always used), so groups come out Breakfast, Slow Cooker, ... not file order.
const SECTION_ORDER = new Map(SECTIONS.map((s, i) => [s.key, i]));
const ordered = [...displayRecipes].sort(
  (a, b) => (SECTION_ORDER.get(a.section) ?? 1e9) - (SECTION_ORDER.get(b.section) ?? 1e9),
);

export const ROWS_BY_COLLECTION = {
  [COLL_BOOK]: ordered.filter((r) => collectionOf(r) === COLL_BOOK),
  [COLL_REVIEW]: ordered.filter((r) => collectionOf(r) === COLL_REVIEW),
  [COLL_TRY]: ordered.filter((r) => collectionOf(r) === COLL_TRY),
};

// A written recipe: not a placeholder and not a To Try link. Each one has its
// own page, including every version row of a multi-version review record.
export const isWritten = (r) => !r.is_blank;

// Headline numbers, counted off the same rows the list renders.
export const CATALOG_COUNTS = {
  written: displayRecipes.filter(isWritten).length,
  toTry: displayRecipes.filter(isToTry).length,
  comingSoon: displayRecipes.filter(isComingSoon).length,
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

// Coming-soon placeholders, per category, in one collection. The list hides
// placeholder cards and says "N more planned" on the category header instead.
export function plannedByCategory(collection) {
  const out = new Map();
  for (const r of ROWS_BY_COLLECTION[collection] ?? []) {
    if (!isComingSoon(r)) continue;
    const id = categoryOf(r)?.id ?? '';
    out.set(id, (out.get(id) ?? 0) + 1);
  }
  return out;
}

// What a collection lists: written recipes, or links for To Try.
export function listedRows(collection) {
  return (ROWS_BY_COLLECTION[collection] ?? []).filter((r) => !isComingSoon(r));
}
