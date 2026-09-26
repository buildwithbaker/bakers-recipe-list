// WCAG contrast for every text/background pair the design uses, measured from
// the token file itself, so changing a colour there re-runs the measurement.
//
// The pairs are listed by hand because a stylesheet cannot say which
// background a colour will land on. When a new text colour meets a new
// background, add the pair here in the same change.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { contrast, mix } from '../utils/colour.js';
import { CATEGORIES, SURFACE } from '../data/catalog.js';

const TOKENS = readFileSync('src/styles/tokens.css', 'utf8');

// `--name: #rrggbb;` declarations. Anything else (var(), rgb()) is skipped: only
// literal colours can be measured, and every text colour is one.
function tokenColours(css) {
  const out = new Map();
  for (const m of css.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-f]{6})\b/gi)) out.set(m[1], m[2].toLowerCase());
  return out;
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
  ['accent', 'surface', 3],            // filled star of a pinned card (graphic)
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

// Category colours (data/catalog.js) and the tints mixed from them.
describe('category colour contrast (WCAG AA)', () => {
  it('mixes tints over the real surface token', () => {
    expect(SURFACE).toBe(resolve('surface'));
  });

  it('mixes like color-mix(in srgb)', () => {
    expect(mix('#000000', '#ffffff', 0.5)).toBe('#808080');
    expect(mix('#1f3a5f', '#fffbf5', 1)).toBe('#1f3a5f');
  });

  // Where each category colour is used as text or under text:
  //   colour on surface      card titles, kickers, method headings (body size)
  //   white on colour        divider-tab names, pressed chips, step circles
  //   colour on soft tint    recipe header band: kicker text, h1
  //   ink-muted on soft tint recipe header facts line
  //   brand, ink on soft     facts-line links and bold counts
  //   colour on soft tint    photo-slot letter (large, 3:1)
  it.each(CATEGORIES.map((c) => [c.label, c]))('%s', (_, c) => {
    const r = (x) => Math.round(x * 100) / 100;
    expect(r(contrast(c.color, SURFACE))).toBeGreaterThanOrEqual(4.5);
    expect(r(contrast('#ffffff', c.color))).toBeGreaterThanOrEqual(4.5);
    expect(r(contrast(c.color, c.soft))).toBeGreaterThanOrEqual(4.5);
    expect(r(contrast(resolve('ink-muted'), c.soft))).toBeGreaterThanOrEqual(4.5);
    expect(r(contrast(resolve('brand'), c.soft))).toBeGreaterThanOrEqual(4.5);   // facts-line links
    expect(r(contrast(resolve('ink'), c.soft))).toBeGreaterThanOrEqual(4.5);     // bold counts
  });
});
