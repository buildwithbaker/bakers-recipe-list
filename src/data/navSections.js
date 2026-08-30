// The sections drawer's model: which sections are worth linking to, and which
// tab owns each one.
//
// TOCNav used to render `SECTIONS.map(...)` directly — all 37 sections — while
// RecipeList renders only the sections belonging to the active tab. From the
// default Recipes tab that left 21 of the 37 links pointing at elements that
// were not in the DOM: `getElementById` returned null and `handleLinkClick`
// bailed out, so the click did nothing at all. Same silent-failure shape as the
// marinade bug: one path enumerating a set that another path had narrowed.
//
// So the drawer is driven from here instead — every entry carries the tab that
// renders it, and a section that renders no rows is not listed at all.
import { SECTIONS } from './sections.js';
import { displayedBySection } from './recipeIndex.js';

export const TAB_RECIPES = 'recipes';
export const TAB_REVIEW = 'review';
export const TAB_TOTRY = 'totry';
export const TAB_PEANUT = 'peanut';

// Tabs the drawer can route to, in drawer order.
export const TAB_ORDER = [TAB_RECIPES, TAB_REVIEW, TAB_TOTRY];

export const TAB_LABELS = {
  [TAB_RECIPES]: 'Recipes',
  [TAB_REVIEW]: 'For Review',
  [TAB_TOTRY]: 'To Try',
};

// Every section belongs to exactly one tab. The Peanut Butter tab is built from
// a tag (PEANUT_GROUPS in RecipeList), not from sections, so nothing in the
// drawer routes there and TAB_PEANUT never appears in TAB_ORDER.
export function tabForSection(section) {
  if (section.review) return TAB_REVIEW;
  if (section.toTry) return TAB_TOTRY;
  return TAB_RECIPES;
}

// How many rows a section actually renders. Counted off the display list, so an
// expanded review section reports its expanded row count.
export function displayRowCount(sectionKey) {
  return (displayedBySection.get(sectionKey) ?? []).length;
}

// Sections that render at least one row, each tagged with its owning tab.
// Dropping the empty ones is what removes DESSERTS (0 records) from the drawer
// without special-casing it by name.
export const navSections = SECTIONS
  .map((section) => ({
    ...section,
    tab: tabForSection(section),
    count: displayRowCount(section.key),
  }))
  .filter((section) => section.count > 0);

// The same list grouped for rendering: one heading per tab, in TAB_ORDER.
export const navSectionsByTab = TAB_ORDER
  .map((tab) => ({
    tab,
    label: TAB_LABELS[tab],
    sections: navSections.filter((s) => s.tab === tab),
  }))
  .filter((group) => group.sections.length > 0);
