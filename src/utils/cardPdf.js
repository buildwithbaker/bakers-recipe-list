// The downloadable recipe card: a 5x7 inch PDF in the site's look (design A,
// "Site Match", Adam 2026-10-06). Cream page, double amber border, Young
// Serif navy title, small amber meta line, ingredients in two columns with
// amber dots, a numbered method, why notes in muted italic, notes, and the
// site name at the foot of every page.
//
// Real vector text in embedded, subset fonts. Never smaller than 9pt: a
// recipe that does not fit continues on another page with the same frame.
//
// pdf-lib is passed in, not imported, so this module costs nothing until the
// lazy chunk (recipeCard.js) hands it over, and tests can run it in Node.
import { stripStepAmounts } from './stepAmounts.js';
import { gatherWhyNotes, stepNumbers } from './whyNotes.js';

export const PAGE = { width: 5 * 72, height: 7 * 72 };
export const MIN_SIZE = 9;

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
export const COLOURS = {
  page: hex('#fffbf5'),
  amber: hex('#b7791f'),
  navy: hex('#1f3a5f'),
  ink: hex('#2a221c'),
  muted: hex('#5f5349'),
  rule: hex('#e6d8c3'),
};

const MARGIN_X = 30;        // text inset from the page edge
const TOP = 36;             // first baseline region below the top edge
const FOOTER_Y = 20;        // footer baseline above the bottom edge
const BOTTOM = 40;          // lowest a content line may sit
const CONTENT_W = PAGE.width - MARGIN_X * 2;

const SIZE = { title: 18, heading: 12, body: MIN_SIZE, numeral: 11, meta: MIN_SIZE, footer: MIN_SIZE };
const LEAD = 1.38;          // body line height, as a multiple of the size

const clean = (t) => String(t ?? '').replace(/\s+/g, ' ').trim();

// "PT1H30M" -> "1 HR 30 MIN"
function duration(iso) {
  const m = /^PT(?:(\d+)H)?(?:(\d+)M)?$/.exec(iso ?? '');
  if (!m) return null;
  return [m[1] && `${m[1]} HR`, m[2] && `${m[2]} MIN`].filter(Boolean).join(' ') || null;
}

export function metaLine(recipe, servings) {
  const parts = [];
  if (recipe.recipeYield) parts.push(recipe.recipeYield);
  else if (servings?.servings) parts.push(`Serves about ${Math.round(servings.servings)}`);
  const prep = duration(recipe.prepTime);
  const cook = duration(recipe.cookTime);
  if (prep) parts.push(`Prep ${prep}`);
  if (cook) parts.push(`Cook ${cook}`);
  return parts.join(' · ').toUpperCase();
}

// Break runs of differently styled text into lines no wider than `width`.
// A run is { text, font, colour }; a line is a list of positioned pieces.
export function wrapRuns(runs, width, size, measure) {
  const words = [];
  for (const run of runs) {
    for (const w of clean(run.text).split(' ').filter(Boolean)) words.push({ ...run, text: w });
  }
  const lines = [];
  let line = [];
  let x = 0;
  for (const w of words) {
    const ww = measure(w.font, w.text, size);
    const space = line.length ? measure(w.font, ' ', size) : 0;
    if (line.length && x + space + ww > width) {
      lines.push(line);
      line = [];
      x = 0;
    }
    const prev = line[line.length - 1];
    if (prev && prev.font === w.font && prev.colour === w.colour) {
      // Same style as the word before: one piece, so the font's own spacing holds.
      prev.text += ` ${w.text}`;
      x += space + ww;
    } else {
      const at = line.length ? x + space : 0;
      line.push({ text: w.text, font: w.font, colour: w.colour, x: at });
      x = at + ww;
    }
  }
  if (line.length) lines.push(line);
  return lines;
}

/**
 * Lay the card out as drawing operations, page by page.
 *
 * @param recipe    the display row
 * @param settings  { why, amounts } — the reader's Display settings
 * @param measure   (fontKey, text, size) -> width in points
 * @param servings  estimateServings() result, used when no yield is authored
 * @returns { pages: Array<Array<op>> } where an op is
 *   { kind: 'text', text, font, size, colour, x, y } |
 *   { kind: 'dot', x, y, r, colour } | { kind: 'line', x1, y1, x2, y2, width, colour }
 */
export function layoutCard({ recipe, settings, measure, servings = null }) {
  const pages = [];
  let ops;
  let y;
  const newPage = () => {
    ops = [];
    pages.push(ops);
    y = PAGE.height - TOP;
  };
  const room = (h) => y - h >= BOTTOM;
  const ensure = (h) => { if (!room(h)) newPage(); };
  const text = (t, font, size, colour, x, yy = y) => ops.push({ kind: 'text', text: t, font, size, colour, x, y: yy });

  const stepText = (t) => (settings.amounts ? clean(t) : clean(stripStepAmounts(t)));
  const lineH = SIZE.body * LEAD;

  newPage();

  // Title
  const titleFont = 'title';
  for (const l of wrapRuns([{ text: recipe.name, font: titleFont, colour: 'navy' }], CONTENT_W, SIZE.title, measure)) {
    y -= SIZE.title;
    for (const p of l) text(p.text, p.font, SIZE.title, p.colour, MARGIN_X + p.x);
    y -= SIZE.title * 0.18;
  }

  // Meta line, then a rule
  const meta = metaLine(recipe, servings);
  if (meta) {
    y -= 6;
    for (const l of wrapRuns([{ text: meta, font: 'sans', colour: 'amber' }], CONTENT_W, SIZE.meta, measure)) {
      y -= SIZE.meta;
      for (const p of l) text(p.text, p.font, SIZE.meta, p.colour, MARGIN_X + p.x);
      y -= 3;
    }
  }
  y -= 8;
  ops.push({ kind: 'line', x1: MARGIN_X, y1: y, x2: PAGE.width - MARGIN_X, y2: y, width: 0.75, colour: 'rule' });
  y -= 6;

  // A paragraph that fits on a fresh page starts on one rather than splitting.
  const keepTogether = (lineCount) => {
    const h = lineCount * lineH + 3;
    if (!room(h) && h <= PAGE.height - TOP - BOTTOM) newPage();
  };

  const heading = (label) => {
    ensure(SIZE.heading + 10 + 3 * lineH); // never a heading alone at the foot of a page
    y -= SIZE.heading + 6;
    text(label, 'serif', SIZE.heading, 'navy', MARGIN_X);
    y -= 4;
  };

  // Ingredients: two columns, read down the left then down the right. Laid
  // out row by row (left item i beside right item i) so a page break never
  // splits a column out of order.
  const ingredients = (recipe.ingredients ?? []).filter((i) => clean(i.text));
  if (ingredients.length) {
    heading('Ingredients');
    const gap = 14;
    const colW = (CONTENT_W - gap) / 2;
    const indent = 8;
    const cell = (ing) => {
      if (ing.type !== 'item') {
        return { sub: true, lines: wrapRuns([{ text: clean(ing.text).replace(/:$/, '').toUpperCase(), font: 'sansBold', colour: 'amber' }], colW, SIZE.body, measure) };
      }
      return { sub: false, lines: wrapRuns([{ text: ing.text, font: 'sans', colour: 'ink' }], colW - indent, SIZE.body, measure) };
    };
    const half = Math.ceil(ingredients.length / 2);
    const left = ingredients.slice(0, half).map(cell);
    const right = ingredients.slice(half).map(cell);
    const drawCell = (c, x0, top) => {
      c.lines.forEach((l, li) => {
        const yy = top - SIZE.body - li * lineH;
        if (li === 0 && !c.sub) ops.push({ kind: 'dot', x: x0 + 2, y: yy + SIZE.body * 0.32, r: 1.5, colour: 'amber' });
        for (const p of l) text(p.text, p.font, SIZE.body, p.colour, x0 + (c.sub ? 0 : indent) + p.x, yy);
      });
    };
    const colHeight = (col) => col.reduce((h, c) => h + c.lines.length * lineH + 2, 0);
    const blockH = Math.max(colHeight(left), colHeight(right));
    if (room(blockH)) {
      // The whole block fits: each column flows on its own, like the page.
      [left, right].forEach((col, ci) => {
        let top = y;
        for (const c of col) {
          drawCell(c, MARGIN_X + ci * (colW + gap), top);
          top -= c.lines.length * lineH + 2;
        }
      });
      y -= blockH;
    } else {
      // Too long for the rest of the page: row by row (left item i beside
      // right item i), so a page break never reads a column out of order.
      for (let i = 0; i < half; i += 1) {
        const row = [left[i], right[i]].filter(Boolean);
        const h = Math.max(...row.map((c) => c.lines.length)) * lineH + 2;
        ensure(h);
        row.forEach((c) => drawCell(c, MARGIN_X + (c === left[i] ? 0 : colW + gap), y));
        y -= h;
      }
    }
  }

  // Method
  const steps = recipe.instructions ?? [];
  if (steps.length) {
    heading('Method');
    const numbers = stepNumbers(steps);
    const indent = 18;
    steps.forEach((s, i) => {
      if (numbers[i] === null) {
        ensure(lineH * 2);
        y -= SIZE.body + 4;
        text(clean(s.step).toUpperCase(), 'sansBold', SIZE.body, 'amber', MARGIN_X);
        y -= 2;
        return;
      }
      const runs = s.detail
        ? [{ text: `${stepText(s.step)}.`, font: 'sansBold', colour: 'navy' }, { text: stepText(s.detail), font: 'sans', colour: 'ink' }]
        : [{ text: stepText(s.step), font: 'sans', colour: 'ink' }];
      if (settings.why && s.why) runs.push({ text: s.why, font: 'sansItalic', colour: 'muted' });
      const lines = wrapRuns(runs, CONTENT_W - indent, SIZE.body, measure);
      keepTogether(lines.length);
      lines.forEach((l, li) => {
        const step = li === 0 ? lineH + 3 : lineH;
        ensure(step);
        y -= step;
        if (li === 0) text(String(numbers[i]), 'serif', SIZE.numeral, 'amber', MARGIN_X);
        for (const p of l) text(p.text, p.font, SIZE.body, p.colour, MARGIN_X + indent + p.x);
      });
    });
  }

  // Notes: the recipe's own, then the why notes the reader moved out of the
  // method — the same rule as the page.
  const gathered = settings.why ? [] : gatherWhyNotes(steps, (t) => stepText(t));
  const notes = [
    ...(recipe.notes ?? []).map((n) => [{ text: n, font: 'sans', colour: 'ink' }]),
    ...gathered.map((g) => [{ text: `${g.label}:`, font: 'sansBold', colour: 'navy' }, { text: g.why, font: 'sansItalic', colour: 'muted' }]),
  ];
  if (notes.length) {
    heading('Notes');
    const indent = 8;
    for (const runs of notes) {
      const lines = wrapRuns(runs, CONTENT_W - indent, SIZE.body, measure);
      keepTogether(lines.length);
      lines.forEach((l, li) => {
        const step = li === 0 ? lineH + 3 : lineH;
        ensure(step);
        y -= step;
        if (li === 0) ops.push({ kind: 'dot', x: MARGIN_X + 2, y: y + SIZE.body * 0.32, r: 1.5, colour: 'amber' });
        for (const p of l) text(p.text, p.font, SIZE.body, p.colour, MARGIN_X + indent + p.x);
      });
    }
  }

  // The frame and the footer go on every page, under everything else.
  const footer = "BAKER'S RECIPE LIST";
  return {
    pages: pages.map((pageOps) => [
      { kind: 'frame' },
      {
        kind: 'text', text: footer, font: 'sans', size: SIZE.footer, colour: 'amber',
        x: (PAGE.width - measure('sans', footer, SIZE.footer)) / 2, y: FOOTER_Y,
      },
      ...pageOps,
    ]),
  };
}

const FONT_KEYS = ['serif', 'sans', 'sansBold', 'sansItalic'];

/**
 * Build the card PDF.
 *
 * @param pdfLib     the pdf-lib module ({ PDFDocument, rgb })
 * @param fontkit    @pdf-lib/fontkit
 * @param fontBytes  { serif, sans, sansBold, sansItalic } — font file bytes
 * @returns Uint8Array
 */
export async function buildCardPdf({ pdfLib, fontkit, fontBytes, recipe, settings, servings }) {
  const { PDFDocument, rgb } = pdfLib;
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  doc.setTitle(recipe.name);
  doc.setCreator("Baker's Recipe List");
  doc.setProducer("Baker's Recipe List");

  const fonts = {};
  for (const key of FONT_KEYS) fonts[key] = await doc.embedFont(fontBytes[key], { subset: true });
  // Young Serif's web subset lacks a few glyphs (⅓, ⅔, ⅛). A title that needs
  // one is set in Inter SemiBold rather than printing an empty box.
  const serif = fontkit.create(fontBytes.serif);
  const serifCovers = [...recipe.name].every((c) => c === ' ' || serif.hasGlyphForCodePoint(c.codePointAt(0)));
  fonts.title = serifCovers ? fonts.serif : fonts.sansBold;

  const measure = (key, t, size) => fonts[key].widthOfTextAtSize(t, size);
  const colour = (name) => rgb(...COLOURS[name]);
  const { pages } = layoutCard({ recipe, settings, measure, servings });

  for (const ops of pages) {
    const page = doc.addPage([PAGE.width, PAGE.height]);
    for (const op of ops) {
      if (op.kind === 'frame') {
        page.drawRectangle({ x: 0, y: 0, width: PAGE.width, height: PAGE.height, color: colour('page') });
        page.drawRectangle({ x: 9, y: 9, width: PAGE.width - 18, height: PAGE.height - 18, borderColor: colour('amber'), borderWidth: 1.25 });
        page.drawRectangle({ x: 13, y: 13, width: PAGE.width - 26, height: PAGE.height - 26, borderColor: colour('amber'), borderWidth: 0.6 });
      } else if (op.kind === 'text') {
        page.drawText(op.text, { x: op.x, y: op.y, size: op.size, font: fonts[op.font], color: colour(op.colour) });
      } else if (op.kind === 'dot') {
        page.drawCircle({ x: op.x, y: op.y, size: op.r, color: colour(op.colour) });
      } else if (op.kind === 'line') {
        page.drawLine({ start: { x: op.x1, y: op.y1 }, end: { x: op.x2, y: op.y2 }, thickness: op.width, color: colour(op.colour) });
      }
    }
  }
  return doc.save();
}
