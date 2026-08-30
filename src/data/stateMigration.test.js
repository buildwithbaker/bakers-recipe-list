import { describe, it, expect } from 'vitest';
import {
  migrateState,
  buildNameToId,
  STORES,
  STATE_VERSION_KEY,
  TARGET_VERSION,
} from './stateMigration.js';
import { displayRecipes } from './recipeIndex.js';

// A localStorage stand-in that records every write and can be told to throw on
// the Nth setItem — that is how the quota/atomicity case is exercised.
function fakeStorage(seed = {}, { throwOnWrite = null } = {}) {
  const data = new Map(Object.entries(seed));
  const writes = [];
  return {
    data,
    writes,
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem(k, v) {
      writes.push(k);
      if (throwOnWrite !== null && writes.length === throwOnWrite) {
        const err = new Error('QuotaExceededError');
        err.name = 'QuotaExceededError';
        throw err;
      }
      data.set(k, v);
    },
    snapshot: () => Object.fromEntries(data),
  };
}

// Real ids, taken from the live display list rather than hard-coded guesses.
const ID = {
  v1: 'lemon-herb-chicken-marinade::v1',
  v2: 'lemon-herb-chicken-marinade::v2',
  tandoori: 'tandoori-chicken-marinade',
  patties: 'spicy-pork-patties',
};
const UNMAPPABLE = 'A Recipe That No Longer Exists';

// The old, name-keyed shape across all five stores.
function oldWorld() {
  return {
    [STORES.made]: JSON.stringify(['Lemon Herb (Version 1)', 'Spicy Pork Patties']),
    [STORES.pinned]: JSON.stringify(['Tandoori - Chicken Marinade', UNMAPPABLE]),
    [STORES.cookLog]: JSON.stringify({
      'Lemon Herb (Version 1)': { dates: ['2026-01-01T00:00:00.000Z'], notes: 'good with thighs' },
      [UNMAPPABLE]: { dates: [], notes: 'keep me' },
    }),
    [STORES.recent]: JSON.stringify([
      { name: 'Tandoori - Chicken Marinade', section: 'MARINADES' },
      { name: UNMAPPABLE, section: 'AMERICAN' },
    ]),
    [STORES.shopping]: JSON.stringify([
      { id: '1', text: '2 lb chicken drumsticks', recipe: 'Tandoori - Chicken Marinade', checked: false },
      { id: '2', text: 'something', recipe: UNMAPPABLE, checked: true },
    ]),
  };
}

describe('name→id map', () => {
  it('covers legacy manifest names, raw names and display names', () => {
    const map = buildNameToId();
    expect(map.get('Lemon Herb (Version 1)')).toBe(ID.v1);
    expect(map.get('Tandoori - Chicken Marinade')).toBe(ID.tandoori);
    expect(map.get('Spicy Pork Patties')).toBe(ID.patties);
    expect(map.get(UNMAPPABLE)).toBeUndefined();
  });

  // Non-vacuity: two records sharing a name must abort, not silently collapse
  // two users' worth of state onto one id.
  it('throws rather than collapsing a duplicate name onto one id', () => {
    const dupes = [
      { id: 'alpha', name: 'Same Name' },
      { id: 'beta', name: 'Same Name' },
    ];
    expect(() => buildNameToId(dupes, { ids: {} })).toThrow(/not injective/);
    // and the honest control: distinct names build fine
    expect(() => buildNameToId([{ id: 'alpha', name: 'A' }, { id: 'beta', name: 'B' }], { ids: {} }))
      .not.toThrow();
  });

  it('is injective over the real catalog', () => {
    expect(() => buildNameToId()).not.toThrow();
    expect(buildNameToId().size).toBeGreaterThanOrEqual(displayRecipes.length);
  });
});

describe('migrateState', () => {
  it('converts all five stores and sets the flag last', () => {
    const storage = fakeStorage(oldWorld());
    const result = migrateState({ storage });

    expect(result.status).toBe('migrated');
    expect(result.migrated).toEqual([
      STORES.made, STORES.pinned, STORES.cookLog, STORES.recent, STORES.shopping,
    ]);

    expect(JSON.parse(storage.getItem(STORES.made))).toEqual([ID.v1, ID.patties]);
    expect(JSON.parse(storage.getItem(STORES.pinned))).toEqual([ID.tandoori, UNMAPPABLE]);

    const log = JSON.parse(storage.getItem(STORES.cookLog));
    expect(Object.keys(log).sort()).toEqual([UNMAPPABLE, ID.v1].sort());
    expect(log[ID.v1].notes).toBe('good with thighs');

    expect(JSON.parse(storage.getItem(STORES.recent))).toEqual([
      { id: ID.tandoori, name: 'Tandoori - Chicken Marinade', section: 'MARINADES' },
      { id: UNMAPPABLE, name: UNMAPPABLE, section: 'AMERICAN' },
    ]);

    const list = JSON.parse(storage.getItem(STORES.shopping));
    expect(list[0].recipe).toBe(ID.tandoori);
    expect(list[0].text).toBe('2 lb chicken drumsticks');

    // The flag is written after every store.
    expect(storage.writes[storage.writes.length - 1]).toBe(STATE_VERSION_KEY);
    expect(storage.getItem(STATE_VERSION_KEY)).toBe(String(TARGET_VERSION));
  });

  it('keeps an expanded review row distinct from its sibling', () => {
    const storage = fakeStorage({ [STORES.made]: JSON.stringify(['Lemon Herb (Version 1)']) });
    migrateState({ storage });
    const made = JSON.parse(storage.getItem(STORES.made));
    expect(made).toEqual([ID.v1]);
    expect(made).not.toContain(ID.v2);
  });

  it('preserves a name that maps to nothing, never drops it', () => {
    const storage = fakeStorage(oldWorld());
    migrateState({ storage });
    expect(JSON.parse(storage.getItem(STORES.pinned))).toContain(UNMAPPABLE);
    expect(JSON.parse(storage.getItem(STORES.cookLog))[UNMAPPABLE]).toEqual({ dates: [], notes: 'keep me' });
    expect(JSON.parse(storage.getItem(STORES.shopping))[1].recipe).toBe(UNMAPPABLE);
  });

  it('is idempotent — a second run writes nothing', () => {
    const storage = fakeStorage(oldWorld());
    migrateState({ storage });
    const afterFirst = storage.snapshot();
    const writesAfterFirst = storage.writes.length;

    const second = migrateState({ storage });
    expect(second.status).toBe('already-current');
    expect(storage.writes.length).toBe(writesAfterFirst);      // no extra writes
    expect(storage.snapshot()).toEqual(afterFirst);            // byte-identical
  });

  it('skips absent stores without erroring', () => {
    const storage = fakeStorage({ [STORES.made]: JSON.stringify(['Spicy Pork Patties']) });
    const result = migrateState({ storage });
    expect(result.status).toBe('migrated');
    expect(result.migrated).toEqual([STORES.made]);
    expect(storage.getItem(STORES.pinned)).toBeNull();
  });

  it('leaves unparseable JSON exactly as it is', () => {
    const storage = fakeStorage({ ...oldWorld(), [STORES.cookLog]: 'not json{' });
    migrateState({ storage });
    expect(storage.getItem(STORES.cookLog)).toBe('not json{');
  });

  // Atomicity. The third store's write throws; the flag must not be set, and a
  // later run must finish the job cleanly.
  it('does not set the flag when a store write throws, and recovers on re-run', () => {
    const storage = fakeStorage(oldWorld(), { throwOnWrite: 3 });
    const failed = migrateState({ storage });

    expect(failed.status).toBe('failed');
    expect(storage.getItem(STATE_VERSION_KEY)).toBeNull();
    expect(storage.writes).not.toContain(STATE_VERSION_KEY);
    // The two stores written before the throw did land; the rest are untouched.
    expect(JSON.parse(storage.getItem(STORES.made))).toEqual([ID.v1, ID.patties]);
    expect(JSON.parse(storage.getItem(STORES.recent))[0].id).toBeUndefined();

    // Re-run against the same half-migrated storage.
    const storage2 = fakeStorage(storage.snapshot());
    const retry = migrateState({ storage: storage2 });
    expect(retry.status).toBe('migrated');
    expect(storage2.getItem(STATE_VERSION_KEY)).toBe(String(TARGET_VERSION));

    // Already-id stores pass straight through unchanged; the rest complete.
    expect(JSON.parse(storage2.getItem(STORES.made))).toEqual([ID.v1, ID.patties]);
    expect(JSON.parse(storage2.getItem(STORES.cookLog))[ID.v1].notes).toBe('good with thighs');
    expect(JSON.parse(storage2.getItem(STORES.recent))[0].id).toBe(ID.tandoori);
    expect(JSON.parse(storage2.getItem(STORES.shopping))[0].recipe).toBe(ID.tandoori);

    // And the completed result equals a clean one-shot migration.
    const oneShot = fakeStorage(oldWorld());
    migrateState({ storage: oneShot });
    expect(storage2.snapshot()).toEqual(oneShot.snapshot());
  });

  it('aborts without writing when the name map is not injective', () => {
    const storage = fakeStorage(oldWorld());
    const result = migrateState({
      storage,
      records: [{ id: 'alpha', name: 'Same Name' }, { id: 'beta', name: 'Same Name' }],
      manifest: { ids: {} },
    });
    expect(result.status).toBe('aborted');
    expect(result.reason).toMatch(/not injective/);
    expect(storage.writes).toEqual([]);
    expect(storage.snapshot()).toEqual(oldWorld());
  });

  it('no-ops when the flag is already at the target version', () => {
    const storage = fakeStorage({ ...oldWorld(), [STATE_VERSION_KEY]: String(TARGET_VERSION) });
    const result = migrateState({ storage });
    expect(result.status).toBe('already-current');
    expect(storage.writes).toEqual([]);
  });

  it('returns a skip rather than throwing when there is no storage', () => {
    expect(migrateState({ storage: null }).status).toBe('skipped');
  });
});
