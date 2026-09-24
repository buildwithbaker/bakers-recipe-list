import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { SITE_NAME, recipeDocumentTitle } from './siteTitle.js';

describe('recipeDocumentTitle', () => {
  it('names the recipe first, then the site, with an em dash', () => {
    expect(recipeDocumentTitle('Pulled Pork')).toBe("Pulled Pork — Baker's Recipe List");
  });

  // Closing a recipe restores the title that was there before it opened, which
  // on the list is the shell's own <title>. The two must say the same thing.
  it('matches the shell <title> in index.html', () => {
    const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
    const shellTitle = /<title>([^<]*)<\/title>/.exec(html)?.[1];
    expect(shellTitle).toBe(SITE_NAME);
  });
});
