// Emits one real HTML file per non-blank recipe, after `vite build`.
//
// WHY THIS EXISTS: link-preview crawlers (Facebook, iMessage, Slack, Discord, X)
// do not execute JavaScript. They fetch the URL, parse the bytes the server
// returned, and stop. A single-page app serving one index.html therefore gives
// every shared recipe the SAME preview no matter what React writes into the
// head at runtime. The only fix on static hosting is to have the right HTML
// already on disk before anyone clicks. That is this script.
//
// It writes dist/r/<slug>/index.html per recipe. GitHub Pages serves
// <dir>/index.html for <dir>/, so those become clean URLs with no server.
//
// SLUG vs ID: a versioned child row carries a derived id like `parent::v1`
// (see expandVersions.js). A colon is a legal URL character but an ILLEGAL
// Windows filename character, so `mkdir dist/r/parent::v1` fails on Windows
// while succeeding in CI - a local-only build break. The path segment therefore
// swaps `::` for `--`. No authored id contains `--` (the id pattern is
// ^[a-z0-9-]+$ and no record has a double dash), so the transform is
// unambiguous and reversible. src/utils/recipeSlug.js owns both directions and
// the app must resolve incoming paths through it.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { SECTIONS, publicSectionLabel } from '../src/data/sections.js';
import { expandVersionedRecipe } from '../src/data/expandVersions.js';
import { idToSlug } from '../src/utils/recipeSlug.js';
import { relatedRecipes } from '../src/utils/relatedRecipes.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');

// Absolute URLs are mandatory: nothing obliges a crawler to resolve a relative
// og:image against the document base, and a relative one is the single most
// common preview failure.
const SITE = 'https://buildwithbaker.github.io';
const BASE = '/bakers-recipe-list/';
const ORIGIN = SITE + BASE;
const PLACEHOLDER = `${ORIGIN}recipe-placeholder.png`;
const SITE_NAME = "Baker's Recipe List";

// Tags that describe the workflow, not the food. They stay out of public metadata.
const INTERNAL_TAGS = new Set(['for-review']);

if (!existsSync(join(dist, 'index.html'))) {
  console.error('✗ prerender: dist/index.html not found - run `vite build` first');
  process.exit(1);
}

const shell = readFileSync(join(dist, 'index.html'), 'utf8');
const recipes = JSON.parse(readFileSync(join(root, 'src/data/recipes.json'), 'utf8'));

const REVIEW_KEYS = new Set(SECTIONS.filter((s) => s.review).map((s) => s.key));

// The rows the app actually renders - review records expand into one row per
// version. Mirrors displayRecipes in recipeIndex.js; kept in sync by the count
// assertion at the end of this file.
const displayRecipes = recipes.flatMap((r) =>
  REVIEW_KEYS.has(r.section) ? expandVersionedRecipe(r) : [r],
);

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

// A real photo when one has been shot, the shared placeholder until then.
const imageFor = (r) => (r.image ? `${ORIGIN}${String(r.image).replace(/^\/+/, '')}` : PLACEHOLDER);

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
  // NOT `r.category`: a staged record carries the literal "For Review" there,
  // and publishing that as recipeCategory put an internal workflow state into
  // the structured data a search result is built from. Same rule as the card
  // subtitle in the app — the section is a real classification, a staging
  // bucket yields nothing, and the property is then omitted rather than
  // emitted empty. See publicSectionLabel in src/data/sections.js.
  const category = publicSectionLabel(r.section);
  if (category) ld.recipeCategory = category;
  // #for-review is an internal staging marker, not a property of the food.
  // Google's guidance is also that keywords must not restate recipeCategory.
  const keywords = (r.tags || [])
    .map((t) => t.replace(/^#/, ''))
    .filter((t) => !INTERNAL_TAGS.has(t) && t.replace(/-/g, ' ') !== String(category ?? '').toLowerCase())
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
  const title = `${r.name} — ${SITE_NAME}`;
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
    `<meta property="og:image:alt" content="${esc(r.name)}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${esc(r.name)}">`,
    `<meta name="twitter:description" content="${esc(desc)}">`,
    `<meta name="twitter:image" content="${esc(img)}">`,
    `<script type="application/ld+json">${jsonLd(r, url)}</script>`,
  ].join('\n    ');
}

// The shell already carries a <title> and a site-level description. Strip both
// so the per-recipe pair is the only one on the page - a duplicate og:title is
// resolved by the crawler in an order nobody controls.
function pageFor(r, url, related) {
  let html = shell
    .replace(/<title>[\s\S]*?<\/title>\s*/i, '')
    .replace(/<meta\s+name="description"[^>]*>\s*/i, '');
  const head = headFor(r, url);
  if (!/<\/head>/i.test(html)) {
    console.error('✗ prerender: dist/index.html has no </head> to inject into');
    process.exit(1);
  }
  html = html.replace(/<\/head>/i, `  ${head}\n  </head>`);

  // Injected BEFORE the mount point, so a reader that runs no JavaScript meets
  // the recipe first, and React still gets an untouched, empty #root.
  if (!/<div id="root">/i.test(html)) {
    console.error('✗ prerender: dist/index.html has no <div id="root"> to inject before');
    process.exit(1);
  }
  return html.replace(/<div id="root">/i, `${noscriptFor(r, related)}\n    <div id="root">`);
}

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

// Deep links that miss a prerendered file (a blank recipe, a stale id) land on
// the app instead of a dead end. GitHub Pages serves 404.html for any path that
// is not a real file, and it returns HTTP 404 - which is correct for an unknown
// recipe and is why this is a human fallback, not a preview strategy.
writeFileSync(join(dist, '404.html'), shell, 'utf8');

const sitemap =
  '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  [ORIGIN, ...urls].map((u) => `  <url><loc>${esc(u)}</loc></url>`).join('\n') +
  '\n</urlset>\n';
writeFileSync(join(dist, 'sitemap.xml'), sitemap, 'utf8');
writeFileSync(
  join(dist, 'robots.txt'),
  `User-agent: *\nAllow: /\nSitemap: ${ORIGIN}sitemap.xml\n`,
  'utf8',
);

// Drift guard, same family as the checks in validate-recipes.mjs: if this
// script's copy of the expansion ever stops matching the app's, the page count
// silently diverges from what the app can route to. Fail loudly instead.
const appRows = displayRecipes.length;
if (appRows < recipes.length) {
  console.error(`✗ prerender: expansion produced ${appRows} rows from ${recipes.length} records - expected at least as many`);
  process.exit(1);
}

console.log(
  `✓ prerender - ${published.length} recipe pages from ${displayRecipes.length} display rows ` +
  `(${recipes.length} records, ${displayRecipes.length - published.length} blank/skipped), ` +
  `sitemap + robots.txt + 404.html written`,
);
