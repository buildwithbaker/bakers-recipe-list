// Written without JSX: the suite only collects *.test.js.
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, it, expect } from 'vitest';
import { displayRecipes } from '../../data/recipeIndex.js';
import { photoCredit } from '../../utils/photoCredit.js';
import { setClock } from '../../utils/autoTags.js';
import RecipeCard from './RecipeCard.jsx';

describe('recipe card thumbnail', () => {
  it('shows an AI-credited photo with no badge', () => {
    const lasagna = displayRecipes.find((r) => r.id === 'lasagna');
    expect(photoCredit('lasagna').ai).toBe(true);
    // `image` guarantees a photo even before build-photos has run (CI tests
    // run before the build); a sized photo in src/photos/ wins when present.
    const html = renderToString(createElement(RecipeCard, { recipe: { ...lasagna, image: 'photos/lasagna.jpg' }, onViewRecipe: () => {} }));
    expect(html).toMatch(/<img[^>]*alt=""/);
    expect(html).not.toMatch(/AI-generated/);
    expect(html).not.toMatch(/>AI</);
  });
});

describe("recipe card: Chef's Drafts", () => {
  const draft = displayRecipes.find((r) => r.section === 'CHEFS DRAFTS');
  const cookbook = displayRecipes.find((r) => r.id === 'lasagna');
  const html = (recipe) => renderToString(createElement(RecipeCard, { recipe, onViewRecipe: () => {} }));

  it('labels a draft as not cooked yet', () => {
    expect(draft).toBeTruthy();
    expect(html(draft)).toContain('Draft - not cooked yet');
  });

  it('puts no draft label on a cookbook recipe', () => {
    expect(html(cookbook)).not.toContain('Draft - not cooked yet');
  });
});

describe('recipe card: NEW pill', () => {
  // Noon on 2026-10-26 in Central. The card reads the autoTags clock, so the
  // rendered HTML does not depend on the day the suite runs.
  beforeEach(() => setClock(new Date('2026-10-26T17:00:00Z')));
  afterEach(() => setClock());

  const lasagna = displayRecipes.find((r) => r.id === 'lasagna');
  const html = (recipe, props = {}) => renderToString(createElement(RecipeCard, { recipe, onViewRecipe: () => {}, ...props }));
  const NEW_PILL = />New<\/span>/;

  it('puts NEW before the category kicker', () => {
    const out = html({ ...lasagna, added: '2026-10-20' }, { showCategory: true });
    expect(out).toMatch(NEW_PILL);
    expect(out.search(NEW_PILL)).toBeLessThan(out.indexOf('>Italian</p>'));
  });

  it('shows NEW above the title when there is no kicker', () => {
    const out = html({ ...lasagna, added: '2026-10-26' });
    expect(out).toMatch(NEW_PILL);
    expect(out).not.toContain('>Italian</p>');
    expect(out.search(NEW_PILL)).toBeLessThan(out.indexOf('<h3'));
  });

  it('shows no NEW from day 14, for a future date, or without added', () => {
    expect(html({ ...lasagna, added: '2026-10-12' }, { showCategory: true })).not.toMatch(NEW_PILL);
    expect(html({ ...lasagna, added: '2026-10-27' }, { showCategory: true })).not.toMatch(NEW_PILL);
    expect(html(lasagna, { showCategory: true })).not.toMatch(NEW_PILL);
  });
});
