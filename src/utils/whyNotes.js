// Why notes: the optional `why` on a step, which says why it is done that way.
//
// The reader can hide them inline from the Display settings; they then gather
// in the recipe's Notes section instead, each labelled with its step.

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
// `stepText` shapes the title as the method shows it (amounts stripped or not).
export function gatherWhyNotes(steps, stepText = (t) => t) {
  const numbers = stepNumbers(steps);
  return (steps ?? []).flatMap((s, i) => {
    if (numbers[i] === null || !s.why) return [];
    const label = s.detail ? `Step ${numbers[i]}, ${stepText(s.step)}` : `Step ${numbers[i]}`;
    return [{ n: numbers[i], label, why: s.why }];
  });
}
