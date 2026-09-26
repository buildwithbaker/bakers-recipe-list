// WCAG contrast for every text/background pair the design uses, measured from
// the token file itself, so changing a colour there re-runs the measurement.
//
// The pairs are listed by hand because a stylesheet cannot say which
// background a colour will land on. When a new text colour meets a new
// background, add the pair here in the same change.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const TOKENS = readFileSync('src/styles/tokens.css', 'utf8');

// `--name: #rrggbb;` declarations. Anything else (var(), rgb()) is skipped: only
// literal colours can be measured, and every text colour is one.
function tokenColours(css) {
  const out = new Map();
  for (const m of css.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-f]{6})\b/gi)) out.set(m[1], m[2].toLowerCase());
  return out;
}

export function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const colours = tokenColours(TOKENS);
const resolve = (c) => (c.startsWith('#') ? c : colours.get(c));

// [text, background, minimum]. 4.5 is AA body text; 3 is AA large text
// (>= 24px, or >= 18.66px bold) and non-text UI.
const PAIRS = [
  ['ink', 'paper', 4.5], ['ink', 'surface', 4.5], ['ink', 'surface-sunk', 4.5],
  ['ink-muted', 'paper', 4.5], ['ink-muted', 'surface', 4.5], ['ink-muted', 'surface-sunk', 4.5],
  ['brand', 'paper', 4.5], ['brand', 'surface', 4.5], ['brand', 'brand-soft', 4.5],
  ['#ffffff', 'brand', 4.5], ['#ffffff', 'brand-hover', 4.5],
  ['accent-ink', 'paper', 4.5], ['accent-ink', 'surface', 4.5], ['accent-ink', 'accent-soft', 4.5],
  ['made', 'surface', 4.5], ['made', 'made-soft', 4.5], ['#ffffff', 'made', 4.5],
  ['review-ink', 'review-soft', 4.5], ['review-ink', 'surface', 4.5],
  ['ink', 'review-soft', 4.5], ['brand', 'review-soft', 4.5],   // USDA notice
  ['ink', 'accent-soft', 4.5],         // search-hit highlight
  ['danger', 'surface', 4.5],
  ['band-ink', 'band', 4.5], ['band-ink-muted', 'band', 4.5],
  ['band', 'band-accent', 4.5],        // shopping-list badge: navy digits on amber
  ['band-accent', 'band', 3],          // amber "Recipe" in the large serif wordmark
];

describe('token contrast (WCAG AA)', () => {
  it('declares every colour the pairs name', () => {
    const missing = PAIRS.flatMap(([fg, bg]) => [fg, bg]).filter((c) => !resolve(c));
    expect(missing).toEqual([]);
  });

  it.each(PAIRS)('%s on %s is at least %s:1', (fg, bg, min) => {
    const ratio = contrast(resolve(fg), resolve(bg));
    expect(Math.round(ratio * 100) / 100).toBeGreaterThanOrEqual(min);
  });
});
