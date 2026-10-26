// The controlled tag list: every tag a recipe may carry BY HAND, mapped to the
// one facet it belongs to. Approved in the tag criteria (2026-10-25), plus
// #peanut-butter, which Adam kept as a collection. #greek-yogurt, #rotisserie
// and #eggs were dropped and are deliberately absent.
//
// A new manual tag is a deliberate edit to this list, not a typo that slips
// in. Plain ES module with no browser-only imports: scripts/validate-recipes.mjs
// can import it under Node.
//
// Auto-tags (autoTags.js) are not typed by hand and are not on this list, but
// the protein ones have a facet so the recipe card can show them: see
// facetOf below.
import { PROTEIN_TAGS } from '../utils/autoTags.js';

export const FACET = Object.freeze({
  METHOD: 'method',           // how it is cooked, or the equipment
  PLAN: 'plan',               // when it fits
  DIET: 'diet',               // who can eat it (a claim: only when true as written)
  DISH_FORM: 'dish-form',     // only where the category does not already say it
  SUB_CUISINE: 'sub-cuisine', // only where the category does not already say it
  COLLECTION: 'collection',   // an ingredient set kept browsable on purpose
  PROTEIN: 'protein',         // auto-tags from ingredient lines; never manual
});

export const TAG_FACETS = Object.freeze({
  // Method / equipment
  '#one-pan': FACET.METHOD,
  '#sheet-pan': FACET.METHOD,
  '#slow-cooker': FACET.METHOD,
  '#oven': FACET.METHOD,
  '#skillet': FACET.METHOD,
  '#stir-fry': FACET.METHOD,
  '#no-cook': FACET.METHOD,
  '#no-bake': FACET.METHOD,
  '#microwave': FACET.METHOD,
  // Plan / occasion
  '#make-ahead': FACET.PLAN,
  '#holiday': FACET.PLAN,
  // Diet
  '#vegetarian': FACET.DIET,
  '#high-protein': FACET.DIET,
  // Dish form
  '#salad': FACET.DISH_FORM,
  '#dip': FACET.DISH_FORM,
  '#rice-bowl': FACET.DISH_FORM,
  '#dressing': FACET.DISH_FORM,
  '#condiment': FACET.DISH_FORM,
  '#casserole': FACET.DISH_FORM,
  '#pasta': FACET.DISH_FORM,
  '#noodles': FACET.DISH_FORM,
  '#curry': FACET.DISH_FORM,
  // Sub-cuisine
  '#korean': FACET.SUB_CUISINE,
  '#thai': FACET.SUB_CUISINE,
  '#indian': FACET.SUB_CUISINE,
  '#tex-mex': FACET.SUB_CUISINE,
  '#cajun': FACET.SUB_CUISINE,
  '#bbq': FACET.SUB_CUISINE,
  // Collection
  '#peanut-butter': FACET.COLLECTION,
});

/** Every tag allowed by hand. */
export const CONTROLLED_TAGS = Object.freeze(Object.keys(TAG_FACETS));

const AUTO_TAG_FACETS = Object.freeze(Object.fromEntries(PROTEIN_TAGS.map((t) => [t, FACET.PROTEIN])));

/** The facet of a manual tag or an auto protein tag; null for anything else (cuisine, dish type, #spicy, #new, an off-list tag). */
export function facetOf(tag) {
  return Object.hasOwn(TAG_FACETS, tag) ? TAG_FACETS[tag]
    : Object.hasOwn(AUTO_TAG_FACETS, tag) ? AUTO_TAG_FACETS[tag]
      : null;
}

/** The facets a recipe card shows as chips, in the order it shows them. */
export const CARD_FACETS = Object.freeze([FACET.METHOD, FACET.PLAN, FACET.DIET, FACET.PROTEIN]);
