import { afterAll, describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

// Tests for scripts/validate-recipes.mjs itself.
//
// The validator is the primary enforcement for the frozen-id invariants: it
// runs as the `prebuild` hook, so it gates every build, whereas the copies in
// recipes.integrity.test.js only gate the merge. That made it the one guard in
// this repo with no guard of its own — a snapshot of hand-run proofs rather
// than something CI can re-run.
//
// These spawn the REAL script against fixture trees. Nothing here mutates
// src/data; each case builds a throwaway repo layout in the OS temp dir. Every
// assertion checks the MESSAGE as well as the exit code — a validator that
// exits 1 for the wrong reason is a false pass.
//
// Placement note: vitest's `include` is 'src/**/*.test.js', so a test for a
// script under scripts/ has to live here to be collected.

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const tempRoots = [];

afterAll(() => {
  for (const dir of tempRoots) {
    try { rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
  }
});

function record(id, name, over = {}) {
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

const BASE_RECORDS = [record('alpha-recipe', 'Alpha Recipe'), record('beta-recipe', 'Beta Recipe')];
const BASE_MANIFEST = {
  _doc: ['fixture'],
  renamed: {},
  ids: { 'alpha-recipe': 'Alpha Recipe', 'beta-recipe': 'Beta Recipe' },
};

const clone = (v) => JSON.parse(JSON.stringify(v));

// Mirrors the repo layout the validator resolves against: it reads
// <root>/src/data/* relative to its own file, and imports sections.js. The
// script, schema and sections are copied VERBATIM so the fixtures exercise the
// same code and the same enums production does.
function fixture({ records = BASE_RECORDS, manifest = BASE_MANIFEST } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'brl-validator-'));
  tempRoots.push(root);
  mkdirSync(join(root, 'scripts'), { recursive: true });
  mkdirSync(join(root, 'src', 'data'), { recursive: true });
  copyFileSync(join(repoRoot, 'scripts', 'validate-recipes.mjs'), join(root, 'scripts', 'validate-recipes.mjs'));
  for (const f of ['sections.js', 'recipe.schema.json']) {
    copyFileSync(join(repoRoot, 'src', 'data', f), join(root, 'src', 'data', f));
  }
  writeFileSync(join(root, 'src', 'data', 'recipes.json'), JSON.stringify(records, null, 2));
  writeFileSync(join(root, 'src', 'data', 'recipes.ids.json'), JSON.stringify(manifest, null, 2));
  return root;
}

function runValidator(root) {
  const res = spawnSync(process.execPath, [join(root, 'scripts', 'validate-recipes.mjs')], {
    encoding: 'utf8',
  });
  return { code: res.status, output: `${res.stdout ?? ''}${res.stderr ?? ''}` };
}

describe('validate-recipes.mjs', () => {
  it('passes a clean fixture tree', () => {
    const { code, output } = runValidator(fixture());
    expect(code).toBe(0);
    expect(output).toMatch(/recipes\.json OK/);
    expect(output).toMatch(/2 records, 2 unique names, 2 unique ids, 2 manifest entries/);
  });

  // Proves the harness is not self-fulfilling: the same spawn, pointed at the
  // REAL src/data, must pass. If the fixtures diverged from production this
  // would be the case that noticed.
  it('passes the real src/data, so the fixtures exercise the production path', () => {
    const { code, output } = runValidator(repoRoot);
    expect(code).toBe(0);
    expect(output).toMatch(/753 records, 753 unique names, 753 unique ids, 753 manifest entries/);
  });

  it('fails when an id is changed', () => {
    const records = clone(BASE_RECORDS);
    records[0].id = 'alpha-recipe-changed';
    const { code, output } = runValidator(fixture({ records }));
    expect(code).not.toBe(0);
    // Caught from both directions: the old id vanished, the new one is unlisted.
    expect(output).toMatch(/manifest id "alpha-recipe" .* is gone from recipes\.json/);
    expect(output).toMatch(/id "alpha-recipe-changed"\) has no entry in recipes\.ids\.json/);
    expect(output).toMatch(/renamed` allowlist/);
  });

  it('fails when a record is renamed with no allowlist entry', () => {
    const records = clone(BASE_RECORDS);
    records[0].name = 'Alpha Recipe Reworked';
    const { code, output } = runValidator(fixture({ records }));
    expect(code).not.toBe(0);
    expect(output).toMatch(/was renamed from "Alpha Recipe"/);
    expect(output).toMatch(/do NOT edit recipes\.ids\.json `ids`/);
  });

  it('passes a rename that IS declared in the allowlist, without touching ids', () => {
    const records = clone(BASE_RECORDS);
    records[0].name = 'Alpha Recipe Reworked';
    const manifest = clone(BASE_MANIFEST);
    manifest.renamed['alpha-recipe'] = 'renamed in a fixture';
    const root = fixture({ records, manifest });
    const { code, output } = runValidator(root);
    expect(code).toBe(0);
    expect(output).toMatch(/recipes\.json OK/);
    // The exemption must not have required rewriting the frozen name.
    expect(manifest.ids['alpha-recipe']).toBe('Alpha Recipe');
  });

  it('fails a stale exemption whose name still matches the manifest', () => {
    const manifest = clone(BASE_MANIFEST);
    manifest.renamed['alpha-recipe'] = 'left behind after a revert';
    const { code, output } = runValidator(fixture({ manifest }));
    expect(code).not.toBe(0);
    expect(output).toMatch(/renamed allowlist lists "alpha-recipe", but its name still matches/);
  });

  it('fails an allowlist entry naming an id that does not exist', () => {
    const manifest = clone(BASE_MANIFEST);
    manifest.renamed['not-a-real-id'] = 'junk';
    const { code, output } = runValidator(fixture({ manifest }));
    expect(code).not.toBe(0);
    expect(output).toMatch(/renamed allowlist lists "not-a-real-id", which is not a recipe id/);
  });

  it('fails when a record is missing from the manifest entirely', () => {
    const records = [...clone(BASE_RECORDS), record('gamma-recipe', 'Gamma Recipe')];
    const { code, output } = runValidator(fixture({ records }));
    expect(code).not.toBe(0);
    expect(output).toMatch(/id "gamma-recipe"\) has no entry in recipes\.ids\.json/);
    expect(output).toMatch(/append-only/);
  });
});
