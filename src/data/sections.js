// Ordered list of sections. The `key` matches the `section` field in recipes.json.
// `label` is the display name shown in the TOC and the section header.
// `id` is the DOM id used for anchor scrolling, matching the original HTML's hash links.
// `review` flips the section header to the green "for review" color.

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
  { key: "SOUPS", label: "Soups", id: "sec-SOUPS" },
  { key: "MARINADES", label: "Marinades", id: "sec-MARINADES" },
  { key: "SMOOTHIES", label: "Smoothies", id: "sec-SMOOTHIES" },
  { key: "BREAD", label: "Bread", id: "sec-BREAD" },
  { key: "TO TRY", label: "To Try", id: "sec-TO-TRY" },
  { key: "FOR REVIEW --- CURRY", label: "For Review: Curry", id: "sec-FOR-REVIEW-CURRY", review: true },
  { key: "FOR REVIEW --- SOUPS", label: "For Review: Soups", id: "sec-FOR-REVIEW-SOUPS", review: true },
  { key: "FOR REVIEW - SOUPS", label: "For Review: Soups (More)", id: "sec-FOR-REVIEW-SOUPS-NEW", review: true },
  { key: "FOR REVIEW - MARINADES - CHICKEN", label: "For Review: Marinades - Chicken", id: "sec-FOR-REVIEW-MARINADES-CHICKEN", review: true },
  { key: "FOR REVIEW - MARINADES - BEEF", label: "For Review: Marinades - Beef", id: "sec-FOR-REVIEW-MARINADES-BEEF", review: true },
  { key: "FOR REVIEW - MARINADES - PORK", label: "For Review: Marinades - Pork", id: "sec-FOR-REVIEW-MARINADES-PORK", review: true },
];
