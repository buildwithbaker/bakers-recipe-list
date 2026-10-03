// The touch baseline in globals.css, read as source: there is no DOM in this
// suite, so it checks the rules exist rather than how a browser applies them.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const GLOBALS = readFileSync('src/styles/globals.css', 'utf8');

function cssFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return cssFiles(p);
    return p.endsWith('.css') ? [p] : [];
  });
}

describe('touch baseline', () => {
  it('drops the tap flash and the double-tap delay on controls', () => {
    const rule = GLOBALS.match(/a, button[^{]*\{([^}]*)\}/);
    expect(rule).not.toBeNull();
    expect(rule[1]).toMatch(/-webkit-tap-highlight-color:\s*transparent/);
    expect(rule[1]).toMatch(/touch-action:\s*manipulation/);
  });

  // Removing the flash without a pressed state leaves a tap with no feedback.
  it('ships a pressed state in the same file', () => {
    expect(GLOBALS).toMatch(/:where\(a, button[^)]*\):not\(:disabled\):active\s*\{[^}]*transform/);
  });

  it('never stops text from being selected', () => {
    const offenders = cssFiles('src').filter((f) => /user-select:\s*none/.test(readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });
});
