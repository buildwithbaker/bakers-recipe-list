import { afterAll, describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { ABOUT_DESCRIPTION, ABOUT_FAQ, ABOUT_INTRO } from './aboutCopy.js';

// /about/ as GitHub Pages serves it: the REAL scripts/prerender.mjs, run
// against a one-recipe fixture tree via BRL_PRERENDER_ROOT (the same way
// removal.test.js drives it), must write dist/about/index.html and list it in
// the sitemap, so a direct load or a refresh of /about/ finds a real file.

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
const ORIGIN = 'https://buildwithbaker.github.io/bakers-recipe-list/';
const SHELL =
  '<!doctype html><html><head><title>Shell</title><meta name="description" content="shell">' +
  '</head><body><div id="root"></div></body></html>';

const root = mkdtempSync(join(tmpdir(), 'brl-about-'));
afterAll(() => {
  try { rmSync(root, { recursive: true, force: true }); } catch { /* best effort */ }
});
mkdirSync(join(root, 'dist'), { recursive: true });
mkdirSync(join(root, 'src', 'data'), { recursive: true });
writeFileSync(join(root, 'dist', 'index.html'), SHELL);
writeFileSync(join(root, 'src', 'data', 'recipes.json'), JSON.stringify([{
  id: 'only-recipe',
  name: 'Only Recipe',
  section: 'BREAKFAST',
  category: 'Breakfast',
  source: 'Original',
  tags: ['#breakfast'],
  ingredients: [{ type: 'item', text: '1 egg' }],
  instructions: [{ step: 'Cook it', detail: 'Until done.' }],
  is_blank: false,
}]));
writeFileSync(join(root, 'src', 'data', 'recipes.ids.json'), JSON.stringify({
  ids: { 'only-recipe': 'Only Recipe' }, renamed: {}, removed: {},
}));

const res = spawnSync(process.execPath, [join(repoRoot, 'scripts', 'prerender.mjs')], {
  encoding: 'utf8',
  env: { ...process.env, BRL_PRERENDER_ROOT: root },
});
const read = (...p) => readFileSync(join(root, 'dist', ...p), 'utf8');

describe('prerendered About page', () => {
  it('runs cleanly, with the recipe page count unchanged by About', () => {
    expect(`${res.stdout}${res.stderr}`).toMatch(/✓ prerender - 1 recipe pages/);
    expect(res.status).toBe(0);
  });

  it('writes dist/about/index.html with its own title and description, and only those', () => {
    const html = read('about', 'index.html');
    expect(html).toContain("<title>About - Baker&#39;s Recipe List</title>");
    expect(html).not.toContain('<title>Shell</title>');
    expect(html.match(/<title>/g)).toHaveLength(1);
    expect(html).toContain(`<meta name="description" content="${ABOUT_DESCRIPTION.replace(/'/g, '&#39;')}">`);
    expect(html.match(/<meta name="description"/g)).toHaveLength(1);
    expect(html).toContain(`<link rel="canonical" href="${ORIGIN}about/">`);
    expect(html).toContain('<div id="root"></div>');
  });

  it('carries the copy in <noscript>, with the photos question anchored', () => {
    const html = read('about', 'index.html');
    const noscript = html.slice(html.indexOf('<noscript>'), html.indexOf('</noscript>'));
    const esc = (s) => s.replace(/'/g, '&#39;');
    for (const p of ABOUT_INTRO) expect(noscript).toContain(`<p>${esc(p)}</p>`);
    for (const { q } of ABOUT_FAQ) expect(noscript).toContain(esc(q));
    expect(noscript).toContain('<h3 id="photos">Why are the photos AI-generated?</h3>');
  });

  it('lists /about/ in the sitemap', () => {
    expect(read('sitemap.xml')).toContain(`<loc>${ORIGIN}about/</loc>`);
  });
});
