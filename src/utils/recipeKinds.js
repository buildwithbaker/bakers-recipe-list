// The two kinds of placeholder record. Both are `is_blank: true`, and they are
// NOT the same thing to a visitor:
//
// - a "To Try" entry carries a real URL in `source` - a link to try later. The
//   whole To Try tab is made of these, and it renders them as source-link cards.
// - a "coming soon" placeholder has no URL - a recipe that is on the list but
//   not written yet.
//
// The list's placeholder filter hides coming-soon rows only. It once hid every
// blank, which emptied the To Try and Peanut Butter tabs entirely while their
// labels still promised hundreds of entries.

const URL_RE = /^https?:\/\//i;

export function isToTry(recipe) {
  return !!recipe?.is_blank && typeof recipe.source === 'string' && URL_RE.test(recipe.source);
}

export function isComingSoon(recipe) {
  return !!recipe?.is_blank && !isToTry(recipe);
}
