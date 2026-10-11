import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as pdfLib from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import sharp from 'sharp';
import recipes from '../data/recipes.json';
import { buildCardPdf, layoutCard, PAGE } from './cardPdf.js';

// Technique diagrams on the card: the page's SVGs, as their PNG companions,
// after Notes. Same fonts as the browser, so widths and page breaks are real.
const file = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)));
const fontBytes = {
  serif: file('../../node_modules/@fontsource/young-serif/files/young-serif-latin-400-normal.woff'),
  sans: file('../fonts/inter/Inter-Regular.ttf'),
  sansBold: file('../fonts/inter/Inter-SemiBold.ttf'),
  sansItalic: file('../fonts/inter/Inter-Italic.ttf'),
};

const pilot = recipes.find((r) => r.id === 'sheet-pan-paprika-chicken-thighs-with-potatoes');
const ON = { why: true, amounts: true };
const CONTENT_W = PAGE.width - 60;

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
const images = (layout) => layout.pages.flat().filter((op) => op.kind === 'image');

describe('card layout: technique diagrams', () => {
  const wide = { caption: 'Cutting it', width: 1200, height: 600 };

  it('adds nothing when there are no diagrams', () => {
    const without = layoutCard({ recipe: pilot, settings: ON, measure });
    expect(layoutCard({ recipe: pilot, settings: ON, measure, diagrams: [] })).toEqual(without);
    expect(images(without)).toEqual([]);
    expect(texts(without).some((op) => op.text === 'Technique')).toBe(false);
  });

  it('puts a Technique heading, the image and its caption after Notes', () => {
    const recipe = { ...pilot, notes: ['Keeps three days.'] };
    const layout = layoutCard({ recipe, settings: ON, measure, diagrams: [wide] });
    const flat = layout.pages.flat();
    const at = (pred) => flat.findIndex(pred);
    const notes = at((op) => op.text === 'Notes');
    const technique = at((op) => op.text === 'Technique');
    const image = at((op) => op.kind === 'image');
    const caption = at((op) => op.text === 'Cutting it');
    expect(notes).toBeGreaterThan(-1);
    expect(technique).toBeGreaterThan(notes);
    expect(image).toBeGreaterThan(technique);
    expect(caption).toBeGreaterThan(image);
    // Heading in the same style as Notes; caption muted italic, below the image.
    const style = (op) => ({ font: op.font, size: op.size, colour: op.colour });
    expect(style(flat[technique])).toEqual(style(flat[notes]));
    expect(flat[caption]).toMatchObject({ font: 'sansItalic', colour: 'muted' });
    expect(flat[caption].y).toBeLessThan(flat[image].y);
  });

  it('scales the image to the content width, keeping its aspect ratio', () => {
    const [img] = images(layoutCard({ recipe: pilot, settings: ON, measure, diagrams: [wide] }));
    expect(img.width).toBeCloseTo(CONTENT_W, 5);
    expect(img.height).toBeCloseTo(CONTENT_W / 2, 5);
    expect(img.x).toBeCloseTo(30, 5);
  });

  it('breaks the page rather than shrinking an image that does not fit', () => {
    const tall = { caption: 'Step', width: 1000, height: 600 };
    const layout = layoutCard({ recipe: pilot, settings: ON, measure, diagrams: [tall, tall] });
    const imgs = images(layout);
    expect(imgs).toHaveLength(2);
    for (const img of imgs) expect(img.width).toBeCloseTo(CONTENT_W, 5);
    const pageOf = (img) => layout.pages.findIndex((p) => p.includes(img));
    expect(pageOf(imgs[1])).toBeGreaterThan(pageOf(imgs[0]));
    const page = layout.pages[pageOf(imgs[1])];
    expect(page.some((op) => op.kind === 'frame')).toBe(true);
    expect(page.some((op) => op.text === "BAKER'S RECIPE LIST")).toBe(true);
  });

  it('keeps every diagram inside the border and at least 60% of the content width', () => {
    const huge = { caption: 'Very tall', width: 400, height: 560 };
    const layout = layoutCard({ recipe: pilot, settings: ON, measure, diagrams: [wide, huge] });
    for (const img of images(layout)) {
      expect(img.width).toBeGreaterThanOrEqual(CONTENT_W * 0.6 - 1e-6);
      expect(img.x).toBeGreaterThanOrEqual(28);
      expect(img.x + img.width).toBeLessThanOrEqual(PAGE.width - 28);
      expect(img.y).toBeGreaterThanOrEqual(18);
    }
  });
});

describe('card PDF: technique diagrams', () => {
  const png = async () => new Uint8Array(await sharp({
    create: { width: 240, height: 120, channels: 3, background: '#e8913a' },
  }).png().toBuffer());
  const imageXObjects = async (bytes) => {
    const doc = await pdfLib.PDFDocument.load(bytes);
    const { PDFDict, PDFName, PDFRawStream } = pdfLib;
    return doc.context.enumerateIndirectObjects()
      .map(([, o]) => (o instanceof PDFDict ? o : o instanceof PDFRawStream ? o.dict : null))
      .filter((d) => d && d.get(PDFName.of('Subtype')) === PDFName.of('Image'));
  };

  it('embeds one image and sets the caption as text', async () => {
    const diagrams = [{ src: 'diagrams/cut.svg', caption: 'Cutting the carrots', alt: 'How to cut.', png: await png() }];
    const bytes = await buildCardPdf({ pdfLib, fontkit, fontBytes, recipe: pilot, settings: ON, diagrams });
    expect(await imageXObjects(bytes)).toHaveLength(1);
    const layout = layoutCard({
      recipe: pilot, settings: ON, measure, diagrams: [{ caption: 'Cutting the carrots', width: 240, height: 120 }],
    });
    expect(allText(layout)).toContain('Cutting the carrots');
  });

  it('embeds none for a recipe without diagrams', async () => {
    const bytes = await buildCardPdf({ pdfLib, fontkit, fontBytes, recipe: pilot, settings: ON });
    expect(await imageXObjects(bytes)).toEqual([]);
  });
});
