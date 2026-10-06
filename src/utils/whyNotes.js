// Why notes: the optional `why` on a step, which says why it is done that way.
//
// The reader can hide them inline with "Show why notes"; they then gather in
// the recipe's Notes section instead, each labelled with its step. The choice
// is one site-wide preference, not per recipe.

export const SHOW_WHY_KEY = 'brl_show_why';

// Shown unless the reader has turned them off. A blocked or broken storage
// reads as the default and never throws into the page.
export function loadShowWhy() {
  try { return localStorage.getItem(SHOW_WHY_KEY) !== '0'; }
  catch { return true; }
}

export function saveShowWhy(show) {
  try { localStorage.setItem(SHOW_WHY_KEY, show ? '1' : '0'); }
  catch { /* storage blocked or full: the choice lasts this visit only */ }
}

const isHeading = (s) => s.type === 'section' || s.type === 'header';

// The number each step shows, or null for a sub-heading. Numbering restarts
// after a `section` marker, so the Notes labels match the method exactly.
export function stepNumbers(steps) {
  let n = 0;
  return (steps ?? []).map((s) => {
    if (isHeading(s)) {
      if (s.type === 'section') n = 0;
      return null;
    }
    n += 1;
    return n;
  });
}

export const hasWhy = (steps) => (steps ?? []).some((s) => !isHeading(s) && s.why);

// Every why note in method order, with the label it is listed under in Notes.
// A classic step names itself by its short title; a grouped step's `step` is
// the whole instruction, so it goes by its number alone.
export function gatherWhyNotes(steps) {
  const numbers = stepNumbers(steps);
  return (steps ?? []).flatMap((s, i) => {
    if (numbers[i] === null || !s.why) return [];
    const label = s.detail ? `Step ${numbers[i]}, ${s.step}` : `Step ${numbers[i]}`;
    return [{ n: numbers[i], label, why: s.why }];
  });
}
