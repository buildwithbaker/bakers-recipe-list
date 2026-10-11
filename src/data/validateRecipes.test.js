import { Buffer } from 'node:buffer';
import { afterAll, describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { EXPECTED_RECORDS } from './recordCount.js';
import idManifest from './recipes.ids.json';

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

// The validator's summary line, built from a record count. The count itself is
// hand-authored once in src/data/recordCount.js - this only formats it, so a
// catalog change is a one-line bump there and nothing to remember here.
// A removed id keeps its manifest entry, so the manifest holds n + removed.
const summaryLine = (n, removed = 0) =>
  new RegExp(
    `${n} records, ${n} unique names, ${n} unique ids, ${n + removed} manifest entries, ${removed} removed`,
  );

// Mirrors the repo layout the validator resolves against: it reads
// <root>/src/data/* relative to its own file, and imports sections.js. The
// script, schema and sections are copied VERBATIM so the fixtures exercise the
// same code and the same enums production does.
function fixture({ records = BASE_RECORDS, manifest = BASE_MANIFEST, publicFiles = {} } = {}) {
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
  // Files the fixture serves from public/, keyed by path (e.g. 'diagrams/x.svg').
  for (const [path, body] of Object.entries(publicFiles)) {
    mkdirSync(dirname(join(root, 'public', path)), { recursive: true });
    writeFileSync(join(root, 'public', path), body);
  }
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
    expect(output).toMatch(summaryLine(BASE_RECORDS.length));
  });

  // Proves the harness is not self-fulfilling: the same spawn, pointed at the
  // REAL src/data, must pass. If the fixtures diverged from production this
  // would be the case that noticed.
  it('passes the real src/data, so the fixtures exercise the production path', () => {
    const { code, output } = runValidator(repoRoot);
    expect(code).toBe(0);
    expect(output).toMatch(summaryLine(EXPECTED_RECORDS, Object.keys(idManifest.removed ?? {}).length));
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

  it("accepts a record filed under CHEFS DRAFTS", () => {
    const records = clone(BASE_RECORDS);
    records[0].section = 'CHEFS DRAFTS';
    records[0].category = 'Middle Eastern';
    const { code, output } = runValidator(fixture({ records }));
    expect(code).toBe(0);
    expect(output).toMatch(/recipes\.json OK/);
  });

  // --- optional why (per step) and notes (per recipe) ----------------------

  it('passes a step with a why and a recipe with notes', () => {
    const records = clone(BASE_RECORDS);
    records[0].instructions[0].why = 'So it cooks evenly.';
    records[0].notes = ['Keeps three days in the fridge.'];
    const { code, output } = runValidator(fixture({ records }));
    expect(code).toBe(0);
    expect(output).toMatch(/recipes\.json OK/);
  });

  it.each(['', '   ', 42])('fails a why of %j', (why) => {
    const records = clone(BASE_RECORDS);
    records[0].instructions[0].why = why;
    const { code, output } = runValidator(fixture({ records }));
    expect(code).not.toBe(0);
    expect(output).toMatch(/instruction #0 why must be a non-empty string when present/);
  });

  it.each([[[]], ['a string'], [null]])('fails notes of %j', (notes) => {
    const records = clone(BASE_RECORDS);
    records[0].notes = notes;
    const { code, output } = runValidator(fixture({ records }));
    expect(code).not.toBe(0);
    expect(output).toMatch(/notes must be a non-empty array when present/);
  });

  it.each(['', '  ', 7])('fails a note of %j', (note) => {
    const records = clone(BASE_RECORDS);
    records[0].notes = ['A fine note.', note];
    const { code, output } = runValidator(fixture({ records }));
    expect(code).not.toBe(0);
    expect(output).toMatch(/note #1 must be a non-empty string/);
  });

  // --- optional diagrams (per recipe) --------------------------------------

  const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><title>ok</title><circle r="4"/></svg>';
  // Each SVG needs its PNG companion beside it (made by scripts/rasterize-diagrams.mjs).
  const PNG = Buffer.from('89504e470d0a1a0a', 'hex');
  const diagramRun = (diagrams, publicFiles = { 'diagrams/cut.svg': SVG, 'diagrams/cut.png': PNG }) => {
    const records = clone(BASE_RECORDS);
    records[0].diagrams = diagrams;
    return runValidator(fixture({ records, publicFiles }));
  };
  const good = { src: 'diagrams/cut.svg', alt: 'How to cut it.', caption: 'Cutting it' };

  it('passes a valid diagram, with and without a caption', () => {
    expect(diagramRun([good]).code).toBe(0);
    const { code, output } = diagramRun([{ src: good.src, alt: good.alt }]);
    expect(code).toBe(0);
    expect(output).toMatch(/recipes\.json OK/);
  });

  it.each([[[]], ['a string'], [null]])('fails diagrams of %j', (diagrams) => {
    const { code, output } = diagramRun(diagrams);
    expect(code).not.toBe(0);
    expect(output).toMatch(/diagrams must be a non-empty array when present/);
  });

  it.each(['photos/cut.svg', '/diagrams/cut.svg', 'diagrams/Cut.svg', 'diagrams/cut.png', 'diagrams/sub/cut.svg'])(
    'fails a bad src %j',
    (src) => {
      const { code, output } = diagramRun([{ ...good, src }]);
      expect(code).not.toBe(0);
      expect(output).toMatch(/diagram #0 src .* must match/);
    },
  );

  it('fails a src whose file is missing', () => {
    const { code, output } = diagramRun([{ ...good, src: 'diagrams/missing.svg' }]);
    expect(code).not.toBe(0);
    expect(output).toMatch(/does not exist at public\/diagrams\/missing\.svg/);
  });

  it('fails a missing alt, an empty alt and an empty caption', () => {
    expect(diagramRun([{ src: good.src }]).output).toMatch(/diagram #0 is missing required field "alt"/);
    expect(diagramRun([{ ...good, alt: '  ' }]).output).toMatch(/diagram #0 alt must be a non-empty string/);
    expect(diagramRun([{ ...good, caption: '' }]).output).toMatch(/diagram #0 caption must be a non-empty string/);
  });

  it('fails an extra key on a diagram', () => {
    const { code, output } = diagramRun([{ ...good, width: 400 }]);
    expect(code).not.toBe(0);
    expect(output).toMatch(/diagram #0 has unknown field "width"/);
  });

  it('fails a diagram with no PNG companion', () => {
    const { code, output } = diagramRun([good], { 'diagrams/cut.svg': SVG });
    expect(code).not.toBe(0);
    expect(output).toMatch(/diagram #0 src "diagrams\/cut\.svg" has no PNG companion at public\/diagrams\/cut\.png/);
  });

  it('fails a PNG companion over 400 KB, and passes one at the limit', () => {
    const png = (kb) => Buffer.alloc(kb * 1024, 1);
    const over = diagramRun([good], { 'diagrams/cut.svg': SVG, 'diagrams/cut.png': png(401) });
    expect(over.code).not.toBe(0);
    expect(over.output).toMatch(/PNG companion "diagrams\/cut\.png" is 401 KB, over the 400 KB limit/);
    expect(diagramRun([good], { 'diagrams/cut.svg': SVG, 'diagrams/cut.png': png(400) }).code).toBe(0);
  });

  it('fails a diagram over 150 KB', () => {
    const big = `<svg xmlns="http://www.w3.org/2000/svg"><!--${'x'.repeat(151 * 1024)}--></svg>`;
    const { code, output } = diagramRun([good], { 'diagrams/cut.svg': big, 'diagrams/cut.png': PNG });
    expect(code).not.toBe(0);
    expect(output).toMatch(/is 15\d KB, over the 150 KB limit/);
  });

  it.each([
    ['a script element', '<svg xmlns="http://www.w3.org/2000/svg"><SCRIPT>alert(1)</SCRIPT></svg>', /contains a <script> element/],
    ['an event handler', '<svg xmlns="http://www.w3.org/2000/svg"><circle onLoad="alert(1)" r="4"/></svg>', /event-handler attribute/],
    ['an event handler after a quote', '<svg xmlns="http://www.w3.org/2000/svg"><circle r="4"onclick = "x()"/></svg>', /event-handler attribute/],
  ])('fails a diagram carrying %s', (_label, svg, message) => {
    const { code, output } = diagramRun([good], { 'diagrams/cut.svg': svg, 'diagrams/cut.png': PNG });
    expect(code).not.toBe(0);
    expect(output).toMatch(message);
  });

  // --- removal path (recipes.ids.json `removed`) ---------------------------

  // alpha removed, beta its successor: the record is gone, its `ids` entry stays.
  const removal = (entry = { to: 'beta-recipe', note: 'merged into beta' }) => {
    const manifest = clone(BASE_MANIFEST);
    manifest.removed = { 'alpha-recipe': entry };
    return { records: [clone(BASE_RECORDS[1])], manifest };
  };

  it('passes a declared removal with a live successor', () => {
    const { code, output } = runValidator(fixture(removal()));
    expect(code).toBe(0);
    expect(output).toMatch(summaryLine(1, 1));
  });

  it('passes a declared removal with a null successor and a versions count', () => {
    const { code, output } = runValidator(fixture(removal({ to: null, note: 'dropped', versions: 3 })));
    expect(code).toBe(0);
    expect(output).toMatch(/recipes\.json OK/);
  });

  it('still fails an undeclared removal', () => {
    const { code, output } = runValidator(fixture({ records: [clone(BASE_RECORDS[1])] }));
    expect(code).not.toBe(0);
    expect(output).toMatch(/manifest id "alpha-recipe" .* is gone from recipes\.json/);
  });

  // The manifest is append-only, so a renamed record that is later removed
  // keeps its `renamed` exemption. Only an id that is neither live nor
  // removed is junk (previous case).
  it('passes a removed id that keeps its renamed exemption', () => {
    const { records, manifest } = removal();
    manifest.renamed['alpha-recipe'] = 'renamed before it was removed';
    const { code, output } = runValidator(fixture({ records, manifest }));
    expect(code).toBe(0);
    expect(output).toMatch(summaryLine(1, 1));
  });

  it('fails a removed id that is still in recipes.json', () => {
    const { manifest } = removal();
    const { code, output } = runValidator(fixture({ manifest }));
    expect(code).not.toBe(0);
    expect(output).toMatch(/removed entry "alpha-recipe" is still in recipes\.json/);
  });

  it('fails a removed id that has no ids entry', () => {
    const { records, manifest } = removal();
    delete manifest.ids['alpha-recipe'];
    const { code, output } = runValidator(fixture({ records, manifest }));
    expect(code).not.toBe(0);
    expect(output).toMatch(/removed entry "alpha-recipe" is not in recipes\.ids\.json `ids`/);
  });

  it('fails a successor that is not a recipe id', () => {
    const { code, output } = runValidator(fixture(removal({ to: 'no-such-recipe', note: 'x' })));
    expect(code).not.toBe(0);
    expect(output).toMatch(/removed entry "alpha-recipe" has successor "no-such-recipe", which is not a recipe id/);
  });

  it('fails a successor that is live but also listed as removed (no chains)', () => {
    const manifest = clone(BASE_MANIFEST);
    manifest.ids['gamma-recipe'] = 'Gamma Recipe';
    manifest.removed = {
      'gamma-recipe': { to: 'beta-recipe', note: 'removed' },
      'beta-recipe': { to: null, note: 'also removed' },
    };
    const { code, output } = runValidator(fixture({ manifest }));
    expect(code).not.toBe(0);
    expect(output).toMatch(/removed entry "gamma-recipe" has successor "beta-recipe", which is itself removed/);
  });

  it('fails a removed entry with no `to`, no note, or an unknown field', () => {
    const { code, output } = runValidator(fixture(removal({ successor: 'beta-recipe' })));
    expect(code).not.toBe(0);
    expect(output).toMatch(/removed entry "alpha-recipe" is missing `to`/);
    expect(output).toMatch(/removed entry "alpha-recipe" needs a non-empty `note`/);
    expect(output).toMatch(/removed entry "alpha-recipe" has unknown field "successor"/);
  });

  it.each([0, -1, 1.5, '2'])('fails versions %j (must be a positive integer)', (versions) => {
    const { code, output } = runValidator(fixture(removal({ to: 'beta-recipe', note: 'x', versions })));
    expect(code).not.toBe(0);
    expect(output).toMatch(/removed entry "alpha-recipe" has versions .*; it must be a positive integer/);
  });
});
