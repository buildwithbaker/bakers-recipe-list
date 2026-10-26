// ISO 8601 durations as the schema allows them (prepTime, cookTime, waitTime):
// PTnH, PTnM or PTnHnM. Nothing else: no days, no seconds.
const DURATION = /^PT(?:(\d+)H)?(?:(\d+)M)?$/;

/** "PT1H30M" -> 90. Null for anything missing or not in the schema's shape (including a bare "PT"). */
export function isoToMinutes(iso) {
  if (typeof iso !== 'string' || iso === 'PT') return null;
  const m = DURATION.exec(iso);
  if (!m) return null;
  return Number(m[1] ?? 0) * 60 + Number(m[2] ?? 0);
}

/** 25 -> "25 min", 60 -> "1 hr", 70 -> "1 hr 10 min". Empty for a value that is not a whole, non-negative number. */
export function formatMinutes(minutes) {
  if (!Number.isInteger(minutes) || minutes < 0) return '';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
}

/**
 * Ready time and hands-on time in minutes: prepTime + cookTime, and prepTime.
 * Null unless BOTH are authored and valid (the schema pairs them), so a card
 * never shows half a time.
 */
export function recipeTimes(recipe) {
  const prep = isoToMinutes(recipe?.prepTime);
  const cook = isoToMinutes(recipe?.cookTime);
  if (prep === null || cook === null) return null;
  return { ready: prep + cook, handsOn: prep };
}
