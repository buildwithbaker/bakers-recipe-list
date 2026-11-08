import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as pdfLib from 'pdf-lib';
import recipes from '../data/recipes.json';
import { BASE_PATH } from './recipeRoute.js';
import { downloadRecipeCard, fetchDiagrams } from './recipeCard.js';

const file = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)));
const honey = recipes.find((r) => r.id === 'honey-carrots');

// Serves the card fonts from disk; PNG requests follow `png`.
const fakeFetch = (png) => async (url) => {
  const u = String(url);
  if (u.endsWith('.png')) return png(u);
  const rel = /young-serif/.test(u)
    ? '../../node_modules/@fontsource/young-serif/files/young-serif-latin-400-normal.woff'
    : `../fonts/inter/${/Italic/.test(u) ? 'Inter-Italic' : /SemiBold/.test(u) ? 'Inter-SemiBold' : 'Inter-Regular'}.ttf`;
  return { ok: true, status: 200, arrayBuffer: async () => file(rel) };
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('recipe card diagrams (browser side)', () => {
  it('fetches the PNG companion of each referenced technique diagram, captioned with its title', async () => {
    const seen = [];
    vi.stubGlobal('fetch', async (url) => {
      seen.push(url);
      return { ok: true, status: 200, arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer };
    });
    const out = await fetchDiagrams(honey);
    expect(seen).toEqual([`${BASE_PATH}diagrams/honey-carrots-roll-cut.png`]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ src: 'diagrams/honey-carrots-roll-cut.svg', caption: 'Roll-cutting carrots' });
    expect([...out[0].png]).toEqual([1, 2, 3]);
  });

  it('collects diagrams from the technique ids on the steps: deduplicated, in step order, none when no step names one', async () => {
    const seen = [];
    vi.stubGlobal('fetch', async (url) => {
      seen.push(url);
      return { ok: true, status: 200, arrayBuffer: async () => new Uint8Array([9]).buffer };
    });
    const all = [
      { id: 'a', title: 'Tech A', diagram: { src: 'diagrams/a.svg', alt: 'A' } },
      { id: 'b', title: 'Tech B', diagram: { src: 'diagrams/b.svg', alt: 'B' } },
    ];
    const recipe = { instructions: [{ technique: 'b' }, { step: 'x' }, { technique: 'a' }, { technique: 'b' }, { technique: 'gone' }] };
    const out = await fetchDiagrams(recipe, all);
    expect(out.map((d) => d.caption)).toEqual(['Tech B', 'Tech A']);
    expect(seen).toEqual([`${BASE_PATH}diagrams/b.png`, `${BASE_PATH}diagrams/a.png`]);
    expect(await fetchDiagrams({ instructions: [{ step: 'x' }] }, all)).toEqual([]);
  });

  it('still prints the roll-cut diagram on the Honey Carrots card, from the technique on its Cut step', async () => {
    let blob;
    const a = { click: vi.fn(), remove: vi.fn() };
    vi.stubGlobal('fetch', fakeFetch(() => ({
      ok: true, status: 200, arrayBuffer: async () => file('../../public/diagrams/honey-carrots-roll-cut.png'),
    })));
    vi.stubGlobal('document', { createElement: () => a, body: { append: vi.fn() } });
    vi.spyOn(URL, 'createObjectURL').mockImplementation((b) => { blob = b; return 'blob:x'; });

    await downloadRecipeCard(honey, { why: true, amounts: true });

    const doc = await pdfLib.PDFDocument.load(new Uint8Array(await blob.arrayBuffer()));
    const images = [...doc.context.enumerateIndirectObjects()]
      .map(([, obj]) => obj)
      .filter((obj) => obj.dict?.get(pdfLib.PDFName.of('Subtype')) === pdfLib.PDFName.of('Image'));
    expect(images).toHaveLength(1);
  }, 30000);

  it.each([
    ['a rejected fetch', () => Promise.reject(new Error('offline'))],
    ['a 404', () => ({ ok: false, status: 404 })],
  ])('still resolves a PDF, and warns, on %s', async (_label, png) => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    let blob;
    const a = { click: vi.fn(), remove: vi.fn() };
    vi.stubGlobal('fetch', fakeFetch(png));
    vi.stubGlobal('document', { createElement: () => a, body: { append: vi.fn() } });
    vi.spyOn(URL, 'createObjectURL').mockImplementation((b) => { blob = b; return 'blob:x'; });

    await expect(downloadRecipeCard(honey, { why: true, amounts: true })).resolves.toBeUndefined();

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toMatch(/honey-carrots-roll-cut\.svg/);
    expect(a.click).toHaveBeenCalled();
    const doc = await pdfLib.PDFDocument.load(new Uint8Array(await blob.arrayBuffer()));
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1);
  }, 30000);
});
