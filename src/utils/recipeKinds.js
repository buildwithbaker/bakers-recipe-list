// A placeholder record (`is_blank: true`) is a recipe that is on the list but
// not written yet: "coming soon". The list hides it and says "N more planned"
// on its category header instead; search leaves it out. It still has a URL and
// still opens in the app if someone holds a link to it.
//
// (Until 2026-10-02 a blank with a URL source was a different kind: a To Try
// link. That collection was removed, so every blank is now a placeholder.)

export function isComingSoon(recipe) {
  return !!recipe?.is_blank;
}
