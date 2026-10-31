// Ordered list of sections. The `key` matches the `section` field in recipes.json.
// `label` is the display name shown in the TOC and the section header.
// `id` is the DOM id used for anchor scrolling, matching the original HTML's hash links.
//
// Cookbook sections, then Chef's Drafts LAST. The To Try and For Review
// collections were removed on 2026-10-02 (archived outside the repo, and in git
// history at d58c4db), so a record can no longer be filed under them: the
// schema enum mirrors this list.
//
// CHEFS DRAFTS (added 2026-10-11) is the one deliberate exception to "every
// recipe is cooked and tested": full recipes my cooking assistant built that I
// have not cooked yet. Every draft is labelled as untested wherever it shows. A
// draft keeps the `category` of the section it will move to, so graduating it
// into the cookbook is a one-field change to its `section`.

export const SECTIONS = [
  { key: "BREAKFAST", label: "Breakfast", id: "sec-BREAKFAST" },
  { key: "SLOW COOKER", label: "Slow Cooker", id: "sec-SLOW-COOKER" },
  { key: "SEASONINGS", label: "Seasonings", id: "sec-SEASONINGS" },
  { key: "DOUGHS", label: "Doughs", id: "sec-DOUGHS" },
  { key: "AMERICAN", label: "American", id: "sec-AMERICAN" },
  { key: "MEXICAN", label: "Mexican", id: "sec-MEXICAN" },
  { key: "ASIAN", label: "Asian", id: "sec-ASIAN" },
  { key: "ITALIAN", label: "Italian", id: "sec-ITALIAN" },
  { key: "MIDDLE EASTERN", label: "Middle Eastern", id: "sec-MIDDLE-EASTERN" },
  { key: "SANDWICHES", label: "Sandwiches", id: "sec-SANDWICHES" },
  { key: "SIDES", label: "Sides", id: "sec-SIDES" },
  { key: "SNACKS", label: "Snacks", id: "sec-SNACKS" },
  { key: "DESSERTS", label: "Desserts", id: "sec-DESSERTS" },
  { key: "SOUPS", label: "Soups", id: "sec-SOUPS" },
  { key: "MARINADES", label: "Marinades", id: "sec-MARINADES" },
  { key: "SMOOTHIES", label: "Smoothies", id: "sec-SMOOTHIES" },
  { key: "BREAD", label: "Bread", id: "sec-BREAD" },
  { key: "CHEFS DRAFTS", label: "Chef's Drafts", id: "sec-CHEFS-DRAFTS" },
];

// The subtitle a recipe can safely show to anyone a link was shared with: its
// section's label, or null for a key that is not a section (callers then
// render no subtitle). Shared surfaces go through here rather than reading
// `recipe.category` (architecture.md section 8).
const SECTION_BY_KEY = new Map(SECTIONS.map((s) => [s.key, s]));

// Chef's Drafts: recipes not cooked yet. Every surface that shows a recipe asks
// this, so the untested label and the caption can never disagree.
export const DRAFTS_SECTION = 'CHEFS DRAFTS';
export const isDraft = (recipe) => recipe?.section === DRAFTS_SECTION;

// The label every draft carries, on its page and on its card.
export const DRAFT_LABEL = 'Draft - not cooked yet';
// The one line under the Chef's Drafts heading in the list (Adam, 2026-10-11).
export const DRAFTS_INTRO = "Recipes my cooking assistant built that I haven't cooked yet. Once I've made one and liked it, it moves into the cookbook.";
// The second part of the Chef's Drafts page: the placeholders, by name
// (Adam, 2026-10-31). PLANNED_ROWS in catalog.js.
export const PLANNED_HEADING = 'Planned';
export const PLANNED_INTRO = "On the list but not written yet. Each one gets a full recipe once it's made.";
export const PLANNED_LABEL = 'Not written yet';

export function publicSectionLabel(sectionKey) {
  return SECTION_BY_KEY.get(sectionKey)?.label ?? null;
}
