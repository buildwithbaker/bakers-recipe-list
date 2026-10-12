import { afterAll, describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

// A Chef's Draft's prerendered page says "draft" before a crawler or a no-JS
// reader sees anything else; a cookbook page is unchanged. The REAL
// scripts/prerender.mjs runs against a two-recipe fixture tree via
// BRL_PRERENDER_ROOT (as AboutPage.prerender.test.js and removal.test.js do).

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const SHELL =
  '<!doctype html><html><head><title>Shell</title><meta name="description" content="shell">' +
  '</head><body><div id="root"></div></body></html>';
const LONG = 'Boneless chicken thighs marinated in yogurt, lemon, garlic and warm spices, roasted hot and ' +
  'charred under the broiler, then served with a garlic yogurt sauce and warm flatbread.';

const record = (id, name, over) => ({
  id, name, section: 'MIDDLE EASTERN', category: 'Middle Eastern', source: 'Original', tags: [],
  ingredients: [{ type: 'item', text: '1 lb chicken' }],
  instructions: [{ step: 'Roast', detail: 'Roast until done.' }],
  is_blank: false, ...over,
});
const draft = record('a-draft', 'A Draft', { section: 'CHEFS DRAFTS', description: LONG });
const cookbook = record('a-cookbook', 'A Cookbook Recipe', { description: 'A short cookbook description.' });

const root = mkdtempSync(join(tmpdir(), 'brl-drafts-'));
afterAll(() => {
  try { rmSync(root, { recursive: true, force: true }); } catch { /* best effort */ }
});
mkdirSync(join(root, 'dist'), { recursive: true });
mkdirSync(join(root, 'src', 'data'), { recursive: true });
writeFileSync(join(root, 'dist', 'index.html'), SHELL);
writeFileSync(join(root, 'src', 'data', 'recipes.json'), JSON.stringify([cookbook, draft]));
writeFileSync(join(root, 'src', 'data', 'recipes.ids.json'), JSON.stringify({
  ids: { 'a-draft': 'A Draft', 'a-cookbook': 'A Cookbook Recipe' }, renamed: {}, removed: {},
}));

const res = spawnSync(process.execPath, [join(repoRoot, 'scripts', 'prerender.mjs')], {
  encoding: 'utf8',
  env: { ...process.env, BRL_PRERENDER_ROOT: root },
});
const page = (id) => readFileSync(join(root, 'dist', 'r', id, 'index.html'), 'utf8');
const meta = (html, attr, key) => html.match(new RegExp(`<meta ${attr}="${key}" content="([^"]*)">`))?.[1];
const unesc = (s) => s.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&');
const noscript = (html) => html.slice(html.indexOf('<noscript>'), html.indexOf('</noscript>'));

describe("prerendered Chef's Draft pages", () => {
  it('runs cleanly', () => {
    expect(`${res.stdout}${res.stderr}`).toMatch(/✓ prerender - 2 recipe pages/);
    expect(res.status).toBe(0);
  });

  it('starts every description with the draft prefix, within the 155-character limit', () => {
    const html = page('a-draft');
    const descs = [
      meta(html, 'name', 'description'),
      meta(html, 'property', 'og:description'),
      meta(html, 'name', 'twitter:description'),
    ].map(unesc);
    for (const d of descs) {
      expect(d.startsWith("Chef's Draft (not cooked yet): Boneless chicken thighs")).toBe(true);
      expect(d.length).toBeLessThanOrEqual(155);
      expect(d.endsWith('…')).toBe(true);
    }
    expect(new Set(descs).size).toBe(1);
  });

  it('puts "Draft - not cooked yet" directly under the name in <noscript>', () => {
    const ns = noscript(page('a-draft'));
    expect(ns).toMatch(/<h1>A Draft<\/h1>\s*<p>Draft - not cooked yet<\/p>/);
  });

  it('leaves a cookbook page as it was: plain description, no draft line', () => {
    const html = page('a-cookbook');
    expect(meta(html, 'name', 'description')).toBe('A short cookbook description.');
    expect(meta(html, 'property', 'og:description')).toBe('A short cookbook description.');
    expect(meta(html, 'name', 'twitter:description')).toBe('A short cookbook description.');
    expect(html).not.toContain('not cooked yet');
    expect(noscript(html)).toMatch(/<h1>A Cookbook Recipe<\/h1>\s*<p>A short cookbook description\.<\/p>/);
  });
});

describe("prerendered Chef's Drafts page and sitemap", () => {
  const drafts = () => readFileSync(join(root, 'dist', 'drafts', 'index.html'), 'utf8');
  const sitemap = () => readFileSync(join(root, 'dist', 'sitemap.xml'), 'utf8');

  it('writes /drafts/ as a noindex page listing every draft and no cookbook recipe', () => {
    const html = drafts();
    expect(html).toContain('<meta name="robots" content="noindex">');
    const ns = noscript(html);
    expect(ns).toContain('/r/a-draft/');
    expect(ns).toContain('Draft - not cooked yet');
    expect(ns).not.toContain('a-cookbook');
  });

  it('keeps drafts and the Drafts page out of the sitemap', () => {
    const xml = sitemap();
    expect(xml).toContain('/r/a-cookbook/');
    expect(xml).not.toContain('/r/a-draft/');
    expect(xml).not.toContain('/drafts/');
  });

  it("still writes the draft's own page", () => {
    expect(page('a-draft')).toContain('<h1>A Draft</h1>');
  });
});
