import { afterAll, describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { createRemovedLookup, removedSuccessorId, successorRow } from './recipeIndex.js';
import { rekeyRemovedState, STORES } from './stateMigration.js';

// The removal path (recipes.ids.json `removed`), driven entirely by fixtures.
// No test here depends on a real removal: the live manifest's `removed` may be
// empty, and a later batch that removes a record must not change these.

// A fixture catalog of plain records. old-multi and gone-multi were versioned
// records (they displayed as <id>::v1..N rows, the For Review shape removed on
// 2026-10-02): their ::vN keys must still resolve.
const ROWS = [
  { id: 'beta-recipe', name: 'Beta Recipe' },
  { id: 'multi-recipe', name: 'Multi Recipe' },
];
const ROWS_BY_ID = new Map(ROWS.map((r) => [r.id, r]));
const MANIFEST = {
  _doc: ['fixture'],
  renamed: {},
  removed: {
    'alpha-recipe': { to: 'beta-recipe', note: 'merged into beta' },
    'gone-recipe': { to: null, note: 'dropped' },
    'old-multi': { to: 'multi-recipe', note: 'folded into multi', versions: 2 },
    'gone-multi': { to: null, note: 'collection removed', versions: 2 },
  },
  ids: {
    'alpha-recipe': 'Alpha Recipe',
    'beta-recipe': 'Beta Recipe',
    'gone-recipe': 'Gone Recipe',
    'old-multi': 'Old Multi - Chicken Marinade',
    'gone-multi': 'Gone Multi - Beef Marinade',
    'multi-recipe': 'Multi Recipe',
  },
};

describe('removed-id resolution', () => {
  const lookup = createRemovedLookup(MANIFEST, ROWS_BY_ID);

  it('resolves a removed id to its successor', () => {
    expect(lookup.byId('alpha-recipe')?.id).toBe('beta-recipe');
  });

  it('resolves a removed id with to: null to null (the not-found path)', () => {
    expect(lookup.byId('gone-recipe')).toBeNull();
  });

  it("resolves a removed record's legacy manifest name to its successor", () => {
    expect(lookup.byName('Alpha Recipe')?.id).toBe('beta-recipe');
    expect(lookup.byName('Gone Recipe')).toBeNull();
  });

  it('resolves <removed>::vN to the successor', () => {
    expect(lookup.byId('old-multi::v1')?.id).toBe('multi-recipe');
    expect(lookup.byId('old-multi::v2')?.id).toBe('multi-recipe');
  });

  it('resolves <removed>::vN with to: null to null, not to "not removed"', () => {
    expect(lookup.byId('gone-multi')).toBeNull();
    expect(lookup.byId('gone-multi::v2')).toBeNull();
    expect(lookup.byName('Gone Multi - Beef Marinade')).toBeNull();
  });

  it("lands on the successor's own row", () => {
    expect(successorRow('multi-recipe', ROWS_BY_ID)?.id).toBe('multi-recipe');
    expect(successorRow('beta-recipe', ROWS_BY_ID)?.id).toBe('beta-recipe');
    expect(successorRow('not-a-row', ROWS_BY_ID)).toBeNull();
    expect(successorRow(null, ROWS_BY_ID)).toBeNull();
  });

  it('leaves every key that is not a removed key alone', () => {
    for (const key of ['beta-recipe', 'multi-recipe', 'multi-recipe::v1', 'Beta Recipe', 'alpha-recipe-2', 'alpha']) {
      expect(lookup.byId(key)).toBeUndefined();
      expect(lookup.byName(key)).toBeUndefined();
    }
  });

  it('gives the successor id for rekeying, and null for to: null', () => {
    expect(removedSuccessorId('alpha-recipe', MANIFEST, ROWS_BY_ID)).toBe('beta-recipe');
    expect(removedSuccessorId('old-multi::v2', MANIFEST, ROWS_BY_ID)).toBe('multi-recipe');
    expect(removedSuccessorId('gone-multi::v1', MANIFEST, ROWS_BY_ID)).toBeNull();
    expect(removedSuccessorId('gone-recipe', MANIFEST, ROWS_BY_ID)).toBeNull();
    expect(removedSuccessorId('beta-recipe', MANIFEST, ROWS_BY_ID)).toBeNull();
  });
});

// --- state rekey ------------------------------------------------------------

function fakeStorage(seed = {}) {
  const data = new Map(Object.entries(seed));
  const writes = [];
  const reads = [];
  return {
    data,
    writes,
    reads,
    getItem: (k) => { reads.push(k); return data.has(k) ? data.get(k) : null; },
    setItem: (k, v) => { writes.push(k); data.set(k, v); },
    get: (k) => JSON.parse(data.get(k)),
  };
}

const run = (storage, manifest = MANIFEST) =>
  rekeyRemovedState({ storage, manifest, rowsById: ROWS_BY_ID });

function world() {
  return {
    [STORES.made]: JSON.stringify(['beta-recipe', 'alpha-recipe', 'gone-recipe', 'old-multi::v2']),
    [STORES.pinned]: JSON.stringify(['alpha-recipe', 'other-recipe']),
    [STORES.cookLog]: JSON.stringify({
      'other-recipe': { dates: ['2026-03-01T00:00:00.000Z'], notes: 'untouched' },
      'alpha-recipe': { dates: ['2026-02-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'], notes: 'alpha notes' },
      'beta-recipe': { dates: ['2026-01-15T00:00:00.000Z'], notes: 'beta notes' },
      'gone-recipe': { dates: ['2026-01-02T00:00:00.000Z'], notes: 'keep me' },
    }),
    [STORES.recent]: JSON.stringify([
      { id: 'alpha-recipe', name: 'Alpha Recipe', section: 'BREAKFAST' },
      { id: 'other-recipe', name: 'Other', section: 'BREAKFAST' },
      { id: 'beta-recipe', name: 'Beta Recipe', section: 'BREAKFAST' },
      { id: 'gone-recipe', name: 'Gone Recipe', section: 'BREAKFAST' },
    ]),
    [STORES.shopping]: JSON.stringify([
      { id: '1', text: '1 egg', recipe: 'alpha-recipe', checked: false },
      { id: '2', text: '2 eggs', recipe: 'gone-recipe', checked: true },
      { id: '3', text: 'salt', recipe: 'old-multi::v1', checked: false },
    ]),
  };
}

describe('rekeyRemovedState', () => {
  it('moves made, pinned, cook log, recent and shopping state to the successor, merged', () => {
    const storage = fakeStorage(world());
    expect(run(storage).status).toBe('rekeyed');

    // Sets take the union: beta was already made, so alpha folds into it once.
    expect(storage.get(STORES.made)).toEqual(['beta-recipe', 'gone-recipe', 'multi-recipe']);
    expect(storage.get(STORES.pinned)).toEqual(['beta-recipe', 'other-recipe']);

    // The cook log keeps every entry from both keys, ordered by date.
    const log = storage.get(STORES.cookLog);
    expect(log['alpha-recipe']).toBeUndefined();
    expect(log['beta-recipe'].dates).toEqual([
      '2026-01-01T00:00:00.000Z',
      '2026-01-15T00:00:00.000Z',
      '2026-02-01T00:00:00.000Z',
    ]);
    expect(log['beta-recipe'].notes).toBe('beta notes\n\nalpha notes');
    expect(log['other-recipe']).toEqual({ dates: ['2026-03-01T00:00:00.000Z'], notes: 'untouched' });

    // Recently viewed: the moved entry keeps its (more recent) place; the
    // successor's own older entry is the duplicate that goes.
    expect(storage.get(STORES.recent).map((r) => r.id)).toEqual(['beta-recipe', 'other-recipe', 'gone-recipe']);

    expect(storage.get(STORES.shopping).map((i) => i.recipe)).toEqual([
      'beta-recipe',
      'gone-recipe',
      'multi-recipe',
    ]);
  });

  it('leaves a removed id with to: null untouched in every store', () => {
    const storage = fakeStorage(world());
    run(storage);
    expect(storage.get(STORES.made)).toContain('gone-recipe');
    expect(storage.get(STORES.cookLog)['gone-recipe']).toEqual({
      dates: ['2026-01-02T00:00:00.000Z'],
      notes: 'keep me',
    });
    expect(storage.get(STORES.recent).some((r) => r.id === 'gone-recipe')).toBe(true);
    expect(storage.get(STORES.shopping).find((i) => i.id === '2').recipe).toBe('gone-recipe');
  });

  it('is idempotent: a second run changes nothing and writes nothing', () => {
    const storage = fakeStorage(world());
    run(storage);
    const after = new Map(storage.data);
    storage.writes.length = 0;
    expect(run(storage).status).toBe('already-current');
    expect(storage.writes).toEqual([]);
    expect(new Map(storage.data)).toEqual(after);
  });

  it('writes only the stores that changed', () => {
    const storage = fakeStorage({
      [STORES.made]: JSON.stringify(['alpha-recipe']),
      [STORES.pinned]: JSON.stringify(['other-recipe', 'other-recipe-2']),
    });
    run(storage);
    expect(storage.writes).toEqual([STORES.made]);
  });

  it('is a no-op that reads nothing while `removed` is empty', () => {
    const storage = fakeStorage(world());
    const result = run(storage, { ...MANIFEST, removed: {} });
    expect(result.status).toBe('nothing-removed');
    expect(storage.reads).toEqual([]);
    expect(storage.writes).toEqual([]);
  });

  it('leaves unparseable stores alone and never throws', () => {
    const storage = fakeStorage({
      [STORES.made]: '{not json',
      [STORES.pinned]: JSON.stringify(['alpha-recipe']),
    });
    expect(() => run(storage)).not.toThrow();
    expect(storage.data.get(STORES.made)).toBe('{not json');
    expect(storage.get(STORES.pinned)).toEqual(['beta-recipe']);
  });
});

// --- prerender redirects ----------------------------------------------------
//
// Spawns the REAL scripts/prerender.mjs against a fixture tree via
// BRL_PRERENDER_ROOT, the same way validateRecipes.test.js drives the validator.

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const tempRoots = [];
afterAll(() => {
  for (const dir of tempRoots) {
    try { rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
  }
});

const SHELL =
  '<!doctype html><html><head><title>Shell</title><meta name="description" content="shell">' +
  '</head><body><div id="root"></div></body></html>';

function recordFixture(id, name, over = {}) {
  return {
    id,
    name,
    section: 'BREAKFAST',
    category: 'Breakfast',
    source: 'Original',
    tags: ['#breakfast'],
    ingredients: [{ type: 'item', text: '1 egg' }],
    instructions: [{ step: 'Cook it', detail: 'Until done.' }],
    is_blank: false,
    ...over,
  };
}

function prerenderFixture() {
  const root = mkdtempSync(join(tmpdir(), 'brl-prerender-'));
  tempRoots.push(root);
  mkdirSync(join(root, 'dist'), { recursive: true });
  mkdirSync(join(root, 'src', 'data'), { recursive: true });
  writeFileSync(join(root, 'dist', 'index.html'), SHELL);
  const records = [
    recordFixture('beta-recipe', 'Beta Recipe'),
    recordFixture('multi-recipe', 'Multi Recipe'),
  ];
  writeFileSync(join(root, 'src', 'data', 'recipes.json'), JSON.stringify(records, null, 2));
  writeFileSync(join(root, 'src', 'data', 'recipes.ids.json'), JSON.stringify(MANIFEST, null, 2));
  return root;
}

describe('prerender redirects for removed ids', () => {
  const root = prerenderFixture();
  const res = spawnSync(process.execPath, [join(repoRoot, 'scripts', 'prerender.mjs')], {
    encoding: 'utf8',
    env: { ...process.env, BRL_PRERENDER_ROOT: root },
  });
  const ORIGIN = 'https://buildwithbaker.github.io/bakers-recipe-list/';
  const page = (slug) => readFileSync(join(root, 'dist', 'r', slug, 'index.html'), 'utf8');
  const expectRedirect = (html, target) => {
    expect(html).toContain(`<meta http-equiv="refresh" content="0; url=${target}">`);
    expect(html).toContain(`<link rel="canonical" href="${target}">`);
    expect(html).toContain(`location.replace(${JSON.stringify(target)})`);
    expect(html).toContain('<meta name="robots" content="noindex">');
  };

  it('runs cleanly against the fixture', () => {
    expect(`${res.stdout}${res.stderr}`).toMatch(/✓ prerender/);
    expect(res.status).toBe(0);
    // alpha, gone, and old-multi / gone-multi with their two version pages each.
    expect(res.stdout).toMatch(/8 redirects/);
  });

  it("redirects a removed id to its successor's page", () => {
    expectRedirect(page('alpha-recipe'), `${ORIGIN}r/beta-recipe/`);
  });

  it('redirects a removed id with to: null to the site root', () => {
    expectRedirect(page('gone-recipe'), ORIGIN);
  });

  it("redirects a removed versioned record and each version page to the successor's page", () => {
    for (const slug of ['old-multi', 'old-multi--v1', 'old-multi--v2']) {
      expectRedirect(page(slug), `${ORIGIN}r/multi-recipe/`);
    }
    expect(existsSync(join(root, 'dist', 'r', 'old-multi--v3'))).toBe(false);
  });

  it('redirects a removed versioned record with to: null, and its version pages, to the site root', () => {
    for (const slug of ['gone-multi', 'gone-multi--v1', 'gone-multi--v2']) {
      expectRedirect(page(slug), ORIGIN);
    }
  });

  it('keeps redirect pages out of the sitemap', () => {
    const sitemap = readFileSync(join(root, 'dist', 'sitemap.xml'), 'utf8');
    expect(sitemap).toContain(`${ORIGIN}r/beta-recipe/`);
    for (const slug of ['alpha-recipe', 'gone-recipe', 'old-multi', 'gone-multi']) {
      expect(sitemap).not.toContain(`/r/${slug}`);
    }
  });
});
