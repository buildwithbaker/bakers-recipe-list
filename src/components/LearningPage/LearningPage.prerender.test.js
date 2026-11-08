import { afterAll, describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { LEARNING_DESCRIPTION, LEARNING_INTRO } from './learningCopy.js';

// /learning-to-cook/ as GitHub Pages serves it: the REAL scripts/prerender.mjs,
// run against a fixture tree via BRL_PRERENDER_ROOT (like the About test), must
// write dist/learning-to-cook/index.html with its own head, a <noscript> card
// per technique with "Used in" links only where a recipe uses it, and list the
// page in the sitemap.

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
const ORIGIN = 'https://buildwithbaker.github.io/bakers-recipe-list/';
const SHELL =
  '<!doctype html><html><head><title>Shell</title><meta name="description" content="shell">' +
  '</head><body><div id="root"></div></body></html>';

const TECHNIQUES = [
  {
    id: 'used-one',
    title: 'Used technique',
    kicker: 'Knife work · Test',
    diagram: { src: 'diagrams/used.svg', alt: 'A used diagram' },
    how: ['First <step>.', 'Second step.'],
    why: 'Because it works.',
  },
  {
    id: 'unused-one',
    title: 'Unused technique',
    kicker: 'Knife work · Test',
    diagram: { src: 'diagrams/unused.svg', alt: 'An unused diagram' },
    how: ['Only step.'],
    why: 'Because.',
  },
];

const root = mkdtempSync(join(tmpdir(), 'brl-learning-'));
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
  instructions: [{ step: 'Cook it', detail: 'Until done.', technique: 'used-one' }],
  is_blank: false,
}]));
writeFileSync(join(root, 'src', 'data', 'techniques.json'), JSON.stringify(TECHNIQUES));
writeFileSync(join(root, 'src', 'data', 'mealSets.json'), '[]');
writeFileSync(join(root, 'src', 'data', 'recipes.ids.json'), JSON.stringify({
  ids: { 'only-recipe': 'Only Recipe' }, renamed: {}, removed: {},
}));

const res = spawnSync(process.execPath, [join(repoRoot, 'scripts', 'prerender.mjs')], {
  encoding: 'utf8',
  env: { ...process.env, BRL_PRERENDER_ROOT: root },
});
const read = (...p) => readFileSync(join(root, 'dist', ...p), 'utf8');

describe('prerendered Learning to Cook page', () => {
  it('runs cleanly, with the recipe page count unchanged', () => {
    expect(`${res.stdout}${res.stderr}`).toMatch(/✓ prerender - 1 recipe pages/);
    expect(res.status).toBe(0);
  });

  it('writes dist/learning-to-cook/index.html with its own title and description, and only those', () => {
    const html = read('learning-to-cook', 'index.html');
    expect(html).toContain("<title>Learning to Cook — Baker&#39;s Recipe List</title>");
    expect(html).toContain('<meta property="og:title" content="Learning to Cook — Baker&#39;s Recipe List">');
    expect(html).not.toContain('<title>Shell</title>');
    expect(html.match(/<title>/g)).toHaveLength(1);
    expect(html).toContain(`<meta name="description" content="${LEARNING_DESCRIPTION}">`);
    expect(html.match(/<meta name="description"/g)).toHaveLength(1);
    expect(html).toContain(`<link rel="canonical" href="${ORIGIN}learning-to-cook/">`);
    expect(html).toContain('<div id="root"></div>');
  });

  it('carries the intro and every technique in <noscript>, anchored, in order, escaped', () => {
    const html = read('learning-to-cook', 'index.html');
    const noscript = html.slice(html.indexOf('<noscript>'), html.indexOf('</noscript>'));
    expect(noscript).toContain('<h1>Learning to Cook</h1>');
    expect(noscript).toContain(`<p>${LEARNING_INTRO}</p>`);
    expect(noscript.indexOf('id="used-one"')).toBeGreaterThan(-1);
    expect(noscript.indexOf('id="unused-one"')).toBeGreaterThan(noscript.indexOf('id="used-one"'));
    expect(noscript).toContain('<h2>Used technique</h2>');
    expect(noscript).toContain(`<img src="${ORIGIN}diagrams/used.svg" alt="A used diagram">`);
    expect(noscript).toContain('<li>First &lt;step&gt;.</li>');
    expect(noscript).toContain('Because it works.');
  });

  it('lists "Used in" links only for a technique a recipe uses', () => {
    const html = read('learning-to-cook', 'index.html');
    const noscript = html.slice(html.indexOf('<noscript>'), html.indexOf('</noscript>'));
    const used = noscript.slice(noscript.indexOf('id="used-one"'), noscript.indexOf('id="unused-one"'));
    const unused = noscript.slice(noscript.indexOf('id="unused-one"'));
    expect(used).toContain('<h3>Used in</h3>');
    expect(used).toContain(`<a href="${ORIGIN}r/only-recipe/">Only Recipe</a>`);
    expect(unused).not.toContain('Used in');
    expect(unused).not.toContain('<a ');
  });

  it('lists the page in the sitemap, and keeps technique data out of recipe pages', () => {
    expect(read('sitemap.xml')).toContain(`<loc>${ORIGIN}learning-to-cook/</loc>`);
    const recipe = read('r', 'only-recipe', 'index.html');
    expect(recipe).not.toContain('used-one');
    expect(recipe).not.toContain('Used technique');
  });
});
