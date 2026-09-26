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
export const CATEGORIES = [
  { id: 'breakfast', label: 'Breakfast' },
  { id: 'slow-cooker', label: 'Slow Cooker' },
  { id: 'seasonings', label: 'Seasonings' },
  { id: 'doughs', label: 'Doughs' },
  { id: 'american', label: 'American' },
  { id: 'mexican', label: 'Mexican' },
  { id: 'asian', label: 'Asian' },
  { id: 'italian', label: 'Italian' },
  { id: 'middle-eastern', label: 'Middle Eastern' },
  { id: 'sandwiches', label: 'Sandwiches' },
  { id: 'sides', label: 'Sides' },
  { id: 'snacks', label: 'Snacks' },
  { id: 'desserts', label: 'Desserts' },
  { id: 'soups', label: 'Soups' },
  { id: 'marinades', label: 'Marinades' },
  { id: 'smoothies', label: 'Smoothies' },
  { id: 'bread', label: 'Bread' },
  { id: 'curry', label: 'Curry' },
  { id: 'marinades-chicken', label: 'Marinades · Chicken' },
  { id: 'marinades-beef', label: 'Marinades · Beef' },
  { id: 'marinades-pork', label: 'Marinades · Pork' },
];

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
