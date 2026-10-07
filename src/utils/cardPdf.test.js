import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as pdfLib from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import recipes from '../data/recipes.json';
import { buildCardPdf, layoutCard, metaLine, MIN_SIZE, PAGE, wrapRuns } from './cardPdf.js';
import { stripStepAmounts } from './stepAmounts.js';

// The card is built with the same fonts the browser fetches, so widths and
// page breaks here are the real ones.
const file = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)));
const fontBytes = {
  serif: file('../../node_modules/@fontsource/young-serif/files/young-serif-latin-400-normal.woff'),
  sans: file('../fonts/inter/Inter-Regular.ttf'),
  sansBold: file('../fonts/inter/Inter-SemiBold.ttf'),
  sansItalic: file('../fonts/inter/Inter-Italic.ttf'),
};

const pilot = recipes.find((r) => r.id === 'sheet-pan-paprika-chicken-thighs-with-potatoes');
const ON = { why: true, amounts: true };
const OFF = { why: false, amounts: false };

let measure;
beforeAll(async () => {
  const doc = await pdfLib.PDFDocument.create();
  doc.registerFontkit(fontkit);
  const fonts = {};
  for (const [k, bytes] of Object.entries(fontBytes)) fonts[k] = await doc.embedFont(bytes, { subset: true });
  fonts.title = fonts.serif;
  measure = (key, t, size) => fonts[key].widthOfTextAtSize(t, size);
});

const texts = (layout) => layout.pages.flat().filter((op) => op.kind === 'text');
const allText = (layout) => texts(layout).map((op) => op.text).join(' ');

describe('card layout', () => {
  it('never sets text below 9pt', () => {
    for (const settings of [ON, OFF]) {
      for (const op of texts(layoutCard({ recipe: pilot, settings, measure }))) {
        expect(op.size).toBeGreaterThanOrEqual(MIN_SIZE);
      }
    }
  });

  it('keeps every line inside the border, on every page', () => {
    const layout = layoutCard({ recipe: pilot, settings: ON, measure });
    for (const op of texts(layout)) {
      expect(op.x, op.text).toBeGreaterThanOrEqual(28);
      expect(op.x + measure(op.font === 'title' ? 'serif' : op.font, op.text, op.size), op.text).toBeLessThanOrEqual(PAGE.width - 28);
      expect(op.y, op.text).toBeGreaterThanOrEqual(18);
      expect(op.y + op.size, op.text).toBeLessThanOrEqual(PAGE.height - 18);
    }
  });

  it('puts the frame and the footer on every page', () => {
    const many = { ...pilot, instructions: Array.from({ length: 30 }, () => pilot.instructions[2]) };
    const layout = layoutCard({ recipe: many, settings: ON, measure });
    expect(layout.pages.length).toBeGreaterThan(2);
    for (const page of layout.pages) {
      expect(page.some((op) => op.kind === 'frame')).toBe(true);
      expect(page.some((op) => op.kind === 'text' && op.text === "BAKER'S RECIPE LIST")).toBe(true);
    }
  });

  it('shows the why inline when on, and gathers it under Notes when off', () => {
    const why = pilot.instructions[2].why;
    const words = (t) => t.replace(/\s+/g, ' ');
    const on = layoutCard({ recipe: pilot, settings: ON, measure });
    const off = layoutCard({ recipe: pilot, settings: { ...ON, why: false }, measure });
    expect(texts(on).some((op) => op.font === 'sansItalic')).toBe(true);
    expect(words(allText(on))).toContain(why.split(' ').slice(0, 3).join(' '));
    expect(texts(on).some((op) => op.text === 'Notes')).toBe(false);
    expect(texts(off).some((op) => op.text === 'Notes')).toBe(true);
    expect(texts(off).some((op) => op.text === 'Step 3, Start the Potatoes Alone:')).toBe(true);
  });

  it('takes the amounts out of the steps, never out of the ingredients', () => {
    const on = allText(layoutCard({ recipe: pilot, settings: ON, measure }));
    const off = allText(layoutCard({ recipe: pilot, settings: { ...ON, amounts: false }, measure }));
    expect(on).toContain('(1 Tbsp)');
    expect(off).not.toContain('(1 Tbsp)');
    for (const ing of pilot.ingredients) {
      for (const word of ing.text.split(' ')) expect(off).toContain(word);
    }
    expect(stripStepAmounts(pilot.instructions[1].detail)).not.toMatch(/\(/);
  });

  it("lists a recipe's own notes", () => {
    const layout = layoutCard({ recipe: { ...pilot, notes: ['Keeps three days.'] }, settings: ON, measure });
    expect(texts(layout).some((op) => op.text === 'Notes')).toBe(true);
    expect(allText(layout)).toContain('Keeps three days.');
  });

  it('builds the meta line from the authored yield and times', () => {
    expect(metaLine({ recipeYield: '4 servings', prepTime: 'PT10M', cookTime: 'PT1H5M' })).toBe(
      '4 SERVINGS · PREP 10 MIN · COOK 1 HR 5 MIN',
    );
    expect(metaLine({}, { servings: 6 })).toBe('SERVES ABOUT 6');
    expect(metaLine({})).toBe('');
  });

  it('wraps styled runs without losing or reordering words', () => {
    const runs = [{ text: 'Brown It.', font: 'sansBold', colour: 'navy' }, { text: 'Broil 2-3 minutes at the end.', font: 'sans', colour: 'ink' }];
    const lines = wrapRuns(runs, 80, 9, measure);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.flat().map((p) => p.text).join(' ')).toBe('Brown It. Broil 2-3 minutes at the end.');
  });
});

describe('card PDF', () => {
  it('is a 5x7 inch PDF with embedded fonts and no images (real, selectable text)', async () => {
    const bytes = await buildCardPdf({ pdfLib, fontkit, fontBytes, recipe: pilot, settings: ON });
    const doc = await pdfLib.PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1);
    for (const page of doc.getPages()) expect(page.getSize()).toEqual({ width: 360, height: 504 });
    expect(doc.getTitle()).toBe(pilot.name);
    // Objects sit in compressed streams, so read the parsed object graph.
    const { PDFDict, PDFName, PDFRawStream } = pdfLib;
    const objects = doc.context.enumerateIndirectObjects().map(([, obj]) => obj);
    const dicts = objects.map((o) => (o instanceof PDFDict ? o : o instanceof PDFRawStream ? o.dict : null)).filter(Boolean);
    const embedded = dicts.filter((d) => d.get(PDFName.of('FontFile2')) || d.get(PDFName.of('FontFile3')));
    expect(embedded.length).toBeGreaterThanOrEqual(4);
    const images = dicts.filter((d) => d.get(PDFName.of('Subtype')) === PDFName.of('Image'));
    expect(images).toEqual([]);
  });

  it('builds a card for every published recipe without throwing', async () => {
    for (const recipe of recipes.filter((r) => !r.is_blank)) {
      const bytes = await buildCardPdf({ pdfLib, fontkit, fontBytes, recipe, settings: OFF });
      expect(bytes.length, recipe.id).toBeGreaterThan(1000);
    }
  }, 60000);
});
