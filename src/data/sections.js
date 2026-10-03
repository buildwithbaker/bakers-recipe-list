// Ordered list of sections. The `key` matches the `section` field in recipes.json.
// `label` is the display name shown in the TOC and the section header.
// `id` is the DOM id used for anchor scrolling, matching the original HTML's hash links.
//
// Cookbook sections only. The To Try and For Review collections were removed
// on 2026-10-02 (archived outside the repo, and in git history at d58c4db), so
// a record can no longer be filed under them: the schema enum mirrors this list.

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
];

// The subtitle a recipe can safely show to anyone a link was shared with: its
// section's label, or null for a key that is not a section (callers then
// render no subtitle). Shared surfaces go through here rather than reading
// `recipe.category` (architecture.md section 8).
const SECTION_BY_KEY = new Map(SECTIONS.map((s) => [s.key, s]));

export function publicSectionLabel(sectionKey) {
  return SECTION_BY_KEY.get(sectionKey)?.label ?? null;
}
