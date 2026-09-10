// Ordered list of sections. The `key` matches the `section` field in recipes.json.
// `label` is the display name shown in the TOC and the section header.
// `id` is the DOM id used for anchor scrolling, matching the original HTML's hash links.
// `review` flips the section header to the green "for review" color.
// `toTry` routes the section to the "To Try" tab, where it is displayed as a
// cuisine sub-section (label) of blank "View source" backlog cards.

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
  { key: "TO TRY --- AMERICAN", label: "American", id: "sec-TO-TRY-AMERICAN", toTry: true },
  { key: "TO TRY --- MEXICAN", label: "Mexican", id: "sec-TO-TRY-MEXICAN", toTry: true },
  { key: "TO TRY --- ASIAN", label: "Asian", id: "sec-TO-TRY-ASIAN", toTry: true },
  { key: "TO TRY --- ITALIAN", label: "Italian", id: "sec-TO-TRY-ITALIAN", toTry: true },
  { key: "TO TRY --- MIDDLE EASTERN", label: "Middle Eastern", id: "sec-TO-TRY-MIDDLE-EASTERN", toTry: true },
  { key: "TO TRY --- SIDES", label: "Sides", id: "sec-TO-TRY-SIDES", toTry: true },
  { key: "TO TRY --- SOUPS", label: "Soups", id: "sec-TO-TRY-SOUPS", toTry: true },
  { key: "TO TRY --- SANDWICHES", label: "Sandwiches", id: "sec-TO-TRY-SANDWICHES", toTry: true },
  { key: "TO TRY --- SLOW COOKER", label: "Slow Cooker", id: "sec-TO-TRY-SLOW-COOKER", toTry: true },
  { key: "TO TRY --- MARINADES", label: "Marinades", id: "sec-TO-TRY-MARINADES", toTry: true },
  { key: "TO TRY --- SNACKS", label: "Snacks", id: "sec-TO-TRY-SNACKS", toTry: true },
  { key: "TO TRY --- SMOOTHIES", label: "Smoothies", id: "sec-TO-TRY-SMOOTHIES", toTry: true },
  { key: "TO TRY --- DESSERTS", label: "Desserts", id: "sec-TO-TRY-DESSERTS", toTry: true },
  { key: "TO TRY --- BREAD", label: "Bread", id: "sec-TO-TRY-BREAD", toTry: true },
  { key: "FOR REVIEW --- CURRY", label: "For Review: Curry", id: "sec-FOR-REVIEW-CURRY", review: true },
  { key: "FOR REVIEW --- SOUPS", label: "For Review: Soups", id: "sec-FOR-REVIEW-SOUPS", review: true },
  { key: "FOR REVIEW - SOUPS", label: "For Review: Soups (More)", id: "sec-FOR-REVIEW-SOUPS-NEW", review: true },
  { key: "FOR REVIEW - MARINADES - CHICKEN", label: "For Review: Marinades - Chicken", id: "sec-FOR-REVIEW-MARINADES-CHICKEN", review: true },
  { key: "FOR REVIEW - MARINADES - BEEF", label: "For Review: Marinades - Beef", id: "sec-FOR-REVIEW-MARINADES-BEEF", review: true },
  { key: "FOR REVIEW - MARINADES - PORK", label: "For Review: Marinades - Pork", id: "sec-FOR-REVIEW-MARINADES-PORK", review: true },
];

// The subtitle a recipe can safely show to ANYONE — including whoever a link
// was shared with, who has no idea this collection has a staging area.
//
// Recipes awaiting review are staged by overloading TWO fields: `section`
// becomes a "FOR REVIEW ..." key and `category` becomes the literal string
// "For Review". Both are internal workflow state. `category` was reaching a
// related-recipe card as its subtitle, which published that state to a
// stranger — the same leak as `#for-review` in the JSON-LD keywords, arriving
// through a different field.
//
// The fix is not to filter the string but to render the right thing: a
// section is a real classification to a reader where a staging category is
// not. A staging bucket returns null and the caller renders NO subtitle rather
// than a placeholder, because "For Review" and "Uncategorised" are equally
// meaningless to a visitor.
//
// This is the owner-facing/visitor-facing split. The list's own section
// headers and its "For Review" tab keep their labels on purpose — that is
// Adam's staging view of his own collection. Anything on a shared recipe goes
// through here.
const SECTION_BY_KEY = new Map(SECTIONS.map((s) => [s.key, s]));

export function publicSectionLabel(sectionKey) {
  const section = SECTION_BY_KEY.get(sectionKey);
  if (!section || section.review) return null;
  return section.label;
}
