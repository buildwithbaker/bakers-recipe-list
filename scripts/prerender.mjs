// Emits one real HTML file per non-blank recipe, after `vite build`.
//
// WHY THIS EXISTS: link-preview crawlers (Facebook, iMessage, Slack, Discord, X)
// do not execute JavaScript. They fetch the URL, parse the bytes the server
// returned, and stop. A single-page app serving one index.html therefore gives
// every shared recipe the SAME preview no matter what React writes into the
// head at runtime. The only fix on static hosting is to have the right HTML
// already on disk before anyone clicks. That is this script.
//
// It writes dist/r/<slug>/index.html per recipe, and dist/about/index.html for
// the About page. GitHub Pages serves <dir>/index.html for <dir>/, so those
// become clean URLs with no server.
//
// SLUG vs ID: a removed record that displayed as versions had derived ids like
// `parent::v1`, and its old /r/ URLs still get redirect pages (below). A colon
// is a legal URL character but an ILLEGAL
// Windows filename character, so `mkdir dist/r/parent::v1` fails on Windows
// while succeeding in CI - a local-only build break. The path segment therefore
// swaps `::` for `--`. No authored id contains `--` (the id pattern is
// ^[a-z0-9-]+$ and no record has a double dash), so the transform is
// unambiguous and reversible. src/utils/recipeSlug.js owns both directions and
// the app must resolve incoming paths through it.

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import process from 'node:process';
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { publicSectionLabel } from '../src/data/sections.js';
import { idToSlug } from '../src/utils/recipeSlug.js';
import { ogImageAlt } from '../src/utils/photoCredit.js';
import { relatedRecipes } from '../src/utils/relatedRecipes.js';
import { ABOUT_DOCUMENT_TITLE, SITE_NAME, recipeDocumentTitle } from '../src/utils/siteTitle.js';
import {
  ABOUT_DESCRIPTION, ABOUT_FAQ, ABOUT_FAQ_HEADING, ABOUT_HEADING, ABOUT_INSTALL, ABOUT_INTRO, ABOUT_MAKER,
} from '../src/components/AboutPage/aboutCopy.js';

// BRL_PRERENDER_ROOT points the script at a fixture tree (dist/ + src/data/)
// for tests. Unset in every real build.
const root = process.env.BRL_PRERENDER_ROOT || join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');

// Absolute URLs are mandatory: nothing obliges a crawler to resolve a relative
// og:image against the document base, and a relative one is the single most
// common preview failure.
const SITE = 'https://buildwithbaker.github.io';
const BASE = '/bakers-recipe-list/';
const ORIGIN = SITE + BASE;
const PLACEHOLDER = `${ORIGIN}recipe-placeholder.png`;

if (!existsSync(join(dist, 'index.html'))) {
  console.error('✗ prerender: dist/index.html not found - run `vite build` first');
  process.exit(1);
}

const shell = readFileSync(join(dist, 'index.html'), 'utf8');
const recipes = JSON.parse(readFileSync(join(root, 'src/data/recipes.json'), 'utf8'));
const idManifest = JSON.parse(readFileSync(join(root, 'src/data/recipes.ids.json'), 'utf8'));

// The rows the app renders: one per record (displayRecipes in recipeIndex.js).
const displayRecipes = recipes;

// Blanks are placeholder rows with no ingredients and no method. Publishing
// them would be the thin-content pattern search engines penalise and a dead
// link to anyone they were shared with. They still open in the app from the
// list; they just get no file and no preview of their own.
const published = displayRecipes.filter((r) => r.is_blank === false);

// --- helpers ---------------------------------------------------------------

const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

function truncate(s, n) {
  const t = String(s).replace(/\s+/g, ' ').trim();
  return t.length <= n ? t : t.slice(0, n - 1).replace(/\s\S*$/, '') + '…';
}

// `description` is an optional authored field. Until one is written, derive
// something honest from the recipe itself rather than repeating the site blurb
// on 215 pages.
function describe(r) {
  if (r.description) return truncate(r.description, 155);
  const step = r.instructions?.find((s) => s.detail && s.detail.trim());
  if (step) return truncate(step.detail, 155);
  const items = (r.ingredients || []).filter((i) => i.type === 'item').map((i) => i.text);
  if (items.length) return truncate(`Ingredients: ${items.slice(0, 8).join(', ')}`, 155);
  return `${r.name} from ${SITE_NAME}.`;
}

// Link-preview images. A photo dropped in src/photos/ (see
// scripts/build-photos.mjs) becomes a 1200x630 JPEG at dist/og/<segment>.jpg:
// JPEG because preview crawlers are unreliable with WebP, 1200x630 because
// that is the card every major one draws. The legacy `image` field is next,
// and the shared placeholder until either exists.
const PHOTO_SRC = join(root, 'src', 'photos');
const photoSources = new Map(
  (existsSync(PHOTO_SRC) ? readdirSync(PHOTO_SRC) : [])
    .filter((f) => /\.(jpe?g|png|webp)$/i.test(f))
    .map((f) => [f.replace(/\.[^.]+$/, ''), join(PHOTO_SRC, f)]),
);
const ogMade = new Set();
if (photoSources.size) mkdirSync(join(dist, 'og'), { recursive: true });
for (const r of published) {
  const segment = idToSlug(r.id);
  const src = photoSources.get(segment);
  if (!src) continue;
  await sharp(src).rotate().resize(1200, 630, { fit: 'cover' }).jpeg({ quality: 80 }).toFile(join(dist, 'og', `${segment}.jpg`));
  ogMade.add(segment);
}

const imageFor = (r) => {
  const segment = idToSlug(r.id);
  if (ogMade.has(segment)) return `${ORIGIN}og/${segment}.jpg`;
  if (r.image) return `${ORIGIN}${String(r.image).replace(/^\/+/, '')}`;
  return PLACEHOLDER;
};
// An AI photo's preview is labelled in its alt text (src/data/photoCredits.json).
const imageAltFor = (r) => ogImageAlt(r, imageFor(r) !== PLACEHOLDER);

function jsonLd(r, url) {
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'Recipe',
    name: r.name,
    image: [imageFor(r)],
    description: describe(r),
    url,
    author: { '@type': 'Person', name: 'Adam Baker' },
  };
  // The section's label, the same subtitle the app shows (publicSectionLabel
  // in src/data/sections.js); omitted rather than emitted empty.
  const category = publicSectionLabel(r.section);
  if (category) ld.recipeCategory = category;
  // Google's guidance is that keywords must not restate recipeCategory.
  const keywords = (r.tags || [])
    .map((t) => t.replace(/^#/, ''))
    .filter((t) => t.replace(/-/g, ' ') !== String(category ?? '').toLowerCase())
    .map((t) => t.replace(/-/g, ' '))
    .join(', ');
  if (keywords) ld.keywords = keywords;
  const ingredients = (r.ingredients || []).filter((i) => i.type === 'item').map((i) => i.text);
  if (ingredients.length) ld.recipeIngredient = ingredients;
  const steps = (r.instructions || []).filter((s) => s.type !== 'section' && s.type !== 'header');
  if (steps.length) {
    ld.recipeInstructions = steps.map((s, i) => {
      // Two authoring conventions coexist (recipe.schema.json): classic is
      // {step: short title, detail: full text}; grouped is {step: the whole
      // step, detail: ""}. Emitting name === text in the grouped case is
      // duplicate markup, so name is set only when there is a real title.
      const detail = (s.detail || '').trim();
      const node = { '@type': 'HowToStep', text: detail || s.step, url: `${url}#step-${i + 1}` };
      if (detail) node.name = s.step;
      return node;
    });
  }
  // Emitted only when authored. Google pairs cookTime with prepTime, and
  // requires recipeYield alongside nutrition.calories - so a value that is
  // merely ESTIMATED at runtime is deliberately not published here as fact.
  if (r.prepTime) ld.prepTime = r.prepTime;
  if (r.cookTime) ld.cookTime = r.cookTime;
  if (r.prepTime && r.cookTime) ld.totalTime = addDurations(r.prepTime, r.cookTime);
  if (r.recipeYield) ld.recipeYield = String(r.recipeYield);
  // </script> inside a JSON string would close the tag early.
  return JSON.stringify(ld).replace(/<\//g, '<\\/');
}

// Adds two ISO-8601 minute/hour durations (PT20M, PT1H30M) into one.
function addDurations(a, b) {
  const mins = (d) => {
    const m = /^PT(?:(\d+)H)?(?:(\d+)M)?$/.exec(String(d).trim().toUpperCase());
    return m ? (Number(m[1] || 0) * 60 + Number(m[2] || 0)) : 0;
  };
  const t = mins(a) + mins(b);
  if (!t) return undefined;
  const h = Math.floor(t / 60), m = t % 60;
  return `PT${h ? `${h}H` : ''}${m ? `${m}M` : ''}`;
}

// --- the no-JavaScript fallback ------------------------------------------
//
// The prerendered files carry head metadata and an EMPTY <div id="root">. That
// is enough for a link-preview crawler, which reads meta tags and stops, and
// for Google, which renders JavaScript. It is nothing at all for a visitor with
// JavaScript off or a crawler that does not render — they get a blank page
// where a recipe should be.
//
// So the recipe is also written into the body as plain semantic HTML inside
// <noscript>. Browsers hide that entirely when scripting is on, so it costs a
// normal visitor nothing but bytes.
//
// The related links matter as much as the recipe: without them these are 216
// pages with no path between them. With them, the same fallback that serves a
// person with JavaScript off gives a non-rendering crawler a graph to walk.

const fallbackPath = (id) => `${BASE}r/${idToSlug(id)}/`;

// Renders one authored array as a list, starting a fresh list at every
// section/header marker so a sub-heading stays a sub-heading instead of
// becoming an item. `render` returns the already-escaped inner HTML of an <li>.
function fallbackList(items, tag, render) {
  const out = [];
  let open = false;
  const closeList = () => { if (open) { out.push(`</${tag}>`); open = false; } };
  for (const item of items) {
    if (item.type === 'section' || item.type === 'header') {
      closeList();
      out.push(`<h3>${esc(item.text ?? item.step ?? '')}</h3>`);
      continue;
    }
    if (!open) { out.push(`<${tag}>`); open = true; }
    out.push(`<li>${render(item)}</li>`);
  }
  closeList();
  return out;
}

function noscriptFor(r, related) {
  const parts = [`<h1>${esc(r.name)}</h1>`, `<p>${esc(describe(r))}</p>`];

  const ingredients = r.ingredients || [];
  if (ingredients.length) {
    parts.push('<h2>Ingredients</h2>');
    parts.push(...fallbackList(ingredients, 'ul', (i) => esc(i.text)));
  }

  const steps = r.instructions || [];
  if (steps.length) {
    parts.push('<h2>Method</h2>');
    parts.push(...fallbackList(steps, 'ol', (st) => {
      // Two authoring conventions (recipe.schema.json): classic carries a short
      // title in `step` and the real text in `detail`; grouped puts everything
      // in `step` and leaves `detail` empty. Emitting the title twice, or a
      // bare title with no method, would both be wrong.
      const detail = (st.detail || '').trim();
      return detail ? `<strong>${esc(st.step)}</strong> ${esc(detail)}` : esc(st.step);
    }));
  }

  if (related.length) {
    parts.push('<h2>Related recipes</h2>', '<ul>');
    for (const item of related) {
      parts.push(`<li><a href="${esc(fallbackPath(item.id))}">${esc(item.name)}</a></li>`);
    }
    parts.push('</ul>');
  }

  const indented = parts.map((line) => `      ${line}`).join('\n');
  return `<noscript>\n${indented}\n    </noscript>`;
}

function headFor(r, url) {
  // Shared with RecipeView, which sets the same title at runtime.
  const title = recipeDocumentTitle(r.name);
  const desc = describe(r);
  const img = imageFor(r);
  return [
    `<title>${esc(title)}</title>`,
    `<link rel="canonical" href="${esc(url)}">`,
    `<meta name="description" content="${esc(desc)}">`,
    `<meta property="og:type" content="article">`,
    `<meta property="og:site_name" content="${esc(SITE_NAME)}">`,
    `<meta property="og:title" content="${esc(r.name)}">`,
    `<meta property="og:description" content="${esc(desc)}">`,
    `<meta property="og:url" content="${esc(url)}">`,
    `<meta property="og:image" content="${esc(img)}">`,
    `<meta property="og:image:width" content="1200">`,
    `<meta property="og:image:height" content="630">`,
    `<meta property="og:image:alt" content="${esc(imageAltFor(r))}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${esc(r.name)}">`,
    `<meta name="twitter:description" content="${esc(desc)}">`,
    `<meta name="twitter:image" content="${esc(img)}">`,
    `<script type="application/ld+json">${jsonLd(r, url)}</script>`,
  ].join('\n    ');
}

// The shell already carries a <title> and a site-level description. Strip both
// so the page's own pair is the only one on the page - a duplicate og:title is
// resolved by the crawler in an order nobody controls.
function injectIntoShell(head, noscript) {
  let html = shell
    .replace(/<title>[\s\S]*?<\/title>\s*/i, '')
    .replace(/<meta\s+name="description"[^>]*>\s*/i, '');
  if (!/<\/head>/i.test(html)) {
    console.error('✗ prerender: dist/index.html has no </head> to inject into');
    process.exit(1);
  }
  html = html.replace(/<\/head>/i, `  ${head}\n  </head>`);

  // Injected BEFORE the mount point, so a reader that runs no JavaScript meets
  // the page first, and React still gets an untouched, empty #root.
  if (!/<div id="root">/i.test(html)) {
    console.error('✗ prerender: dist/index.html has no <div id="root"> to inject before');
    process.exit(1);
  }
  return html.replace(/<div id="root">/i, `${noscript}\n    <div id="root">`);
}

function pageFor(r, url, related) {
  return injectIntoShell(headFor(r, url), noscriptFor(r, related));
}

// --- the About page --------------------------------------------------------
//
// /about/ is a route in the app, so a direct load or a refresh needs a real
// file the same way /r/<slug>/ does. The words come from aboutCopy.js, the
// module AboutPage renders, so the file and the app say the same thing.

function aboutHead(url) {
  return [
    `<title>${esc(ABOUT_DOCUMENT_TITLE)}</title>`,
    `<link rel="canonical" href="${esc(url)}">`,
    `<meta name="description" content="${esc(ABOUT_DESCRIPTION)}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="${esc(SITE_NAME)}">`,
    `<meta property="og:title" content="${esc(ABOUT_DOCUMENT_TITLE)}">`,
    `<meta property="og:description" content="${esc(ABOUT_DESCRIPTION)}">`,
    `<meta property="og:url" content="${esc(url)}">`,
    `<meta property="og:image" content="${esc(PLACEHOLDER)}">`,
    `<meta name="twitter:card" content="summary">`,
    `<meta name="twitter:title" content="${esc(ABOUT_DOCUMENT_TITLE)}">`,
    `<meta name="twitter:description" content="${esc(ABOUT_DESCRIPTION)}">`,
  ].join('\n    ');
}

function aboutNoscript() {
  const parts = [`<h1>${esc(ABOUT_HEADING)}</h1>`];
  for (const p of ABOUT_INTRO) parts.push(`<p>${esc(p)}</p>`);
  parts.push(`<h2>${esc(ABOUT_FAQ_HEADING)}</h2>`);
  for (const { id, q, a } of ABOUT_FAQ) {
    parts.push(id ? `<h3 id="${esc(id)}">${esc(q)}</h3>` : `<h3>${esc(q)}</h3>`, `<p>${esc(a)}</p>`);
  }
  parts.push(
    `<p>${esc(ABOUT_INSTALL)}</p>`,
    `<p><a href="${esc(ABOUT_MAKER.href)}" target="_blank" rel="noopener noreferrer">${esc(ABOUT_MAKER.text)}</a></p>`,
  );
  const indented = parts.map((line) => `      ${line}`).join('\n');
  return `<noscript>\n${indented}\n    </noscript>`;
}

const ABOUT_URL = `${ORIGIN}about/`;
mkdirSync(join(dist, 'about'), { recursive: true });
writeFileSync(join(dist, 'about', 'index.html'), injectIntoShell(aboutHead(ABOUT_URL), aboutNoscript()), 'utf8');

// --- write -----------------------------------------------------------------

const urls = [];
for (const r of published) {
  const slug = idToSlug(r.id);
  const url = `${ORIGIN}r/${slug}/`;
  const dir = join(dist, 'r', slug);
  mkdirSync(dir, { recursive: true });
  // The SAME ranking the app renders — imported, never reimplemented. Two
  // copies of it would drift, and the fallback agreeing with what the app shows
  // is the whole reason for writing it.
  const related = relatedRecipes(r, displayRecipes);
  writeFileSync(join(dir, 'index.html'), pageFor(r, url, related), 'utf8');
  urls.push(url);
}

// --- redirects for removed records ---------------------------------------
//
// A removed id (recipes.ids.json `removed`) keeps its old URL working: its
// /r/<slug>/ becomes a redirect to the successor's page, or to the site root
// when `to` is null. A record that displayed as N versions also had
// /r/<id>--v1..N/ pages, so those redirect too when `versions` says how many.
// Redirect pages are noindex and never go in the sitemap.

function redirectPage(target) {
  const t = esc(target);
  return [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '  <meta charset="utf-8">',
    `  <title>${esc(SITE_NAME)}</title>`,
    '  <meta name="robots" content="noindex">',
    `  <link rel="canonical" href="${t}">`,
    `  <meta http-equiv="refresh" content="0; url=${t}">`,
    // `target` is ORIGIN + an [a-z0-9-] slug, so it can never contain `</`.
    `  <script>location.replace(${JSON.stringify(target)})</script>`,
    '</head>',
    '<body>',
    `  <p>This recipe has moved. <a href="${t}">Continue</a>.</p>`,
    '</body>',
    '</html>',
    '',
  ].join('\n');
}

const displayIds = new Set(displayRecipes.map((r) => r.id));
let redirects = 0;
for (const [removedId, entry] of Object.entries(idManifest.removed ?? {})) {
  const to = entry?.to ?? null;
  const landing = to && displayIds.has(to) ? to : null;
  if (to && !landing) {
    console.error(`✗ prerender: removed "${removedId}" names successor "${to}", which has no display row`);
    process.exit(1);
  }
  const target = landing ? `${ORIGIN}r/${idToSlug(landing)}/` : ORIGIN;
  const ids = [removedId];
  const versions = Number.isInteger(entry?.versions) ? entry.versions : 0;
  for (let n = 1; n <= versions; n++) ids.push(`${removedId}::v${n}`);
  for (const id of ids) {
    const dir = join(dist, 'r', idToSlug(id));
    if (existsSync(join(dir, 'index.html'))) {
      console.error(`✗ prerender: redirect for removed "${id}" would overwrite a live page`);
      process.exit(1);
    }
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'index.html'), redirectPage(target), 'utf8');
    redirects++;
  }
}

// Deep links that miss a prerendered file (a blank recipe, a stale id) land on
// the app instead of a dead end. GitHub Pages serves 404.html for any path that
// is not a real file, and it returns HTTP 404 - which is correct for an unknown
// recipe and is why this is a human fallback, not a preview strategy.
writeFileSync(join(dist, '404.html'), shell, 'utf8');

const sitemap =
  '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  [ORIGIN, ABOUT_URL, ...urls].map((u) => `  <url><loc>${esc(u)}</loc></url>`).join('\n') +
  '\n</urlset>\n';
writeFileSync(join(dist, 'sitemap.xml'), sitemap, 'utf8');
writeFileSync(
  join(dist, 'robots.txt'),
  `User-agent: *\nAllow: /\nSitemap: ${ORIGIN}sitemap.xml\n`,
  'utf8',
);

console.log(
  `✓ prerender - ${published.length} recipe pages from ${displayRecipes.length} display rows ` +
  `(${recipes.length} records, ${displayRecipes.length - published.length} blank/skipped), ` +
  `${ogMade.size} photo preview${ogMade.size === 1 ? '' : 's'}, ` +
  `${redirects} redirect${redirects === 1 ? '' : 's'}, about page, sitemap + robots.txt + 404.html written`,
);
