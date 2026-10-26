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

describe('recipe card: Option A layout', () => {
  const lasagna = displayRecipes.find((r) => r.id === 'lasagna');
  const html = (recipe, props = {}) => renderToString(createElement(RecipeCard, { recipe, onViewRecipe: () => {}, ...props }));
  // Visible text in document order, tags stripped.
  const text = (out) => out.replace(/<[^>]+>/g, '|').replace(/\|+/g, '|');
  const at = (out, s) => {
    const i = text(out).indexOf(s);
    expect(i, s).toBeGreaterThan(-1);
    return i;
  };
  // The live lasagna has a 30-minute rest (waitTime); the base drops it so each
  // test adds a wait only when it means to.
  const { waitTime: _wait, waitLabel: _label, ...lasagnaNoWait } = lasagna;
  const base = { ...lasagnaNoWait, prepTime: 'PT20M', cookTime: 'PT55M', tags: ['#make-ahead'], description: 'Layers of pasta, ragu and ricotta, baked in one pan.' };

  it('leads with the ready time, hands-on beside it', () => {
    const out = html(base);
    expect(out).toMatch(/<strong>1 hr 15 min<\/strong>/);
    expect(text(out)).toContain(' · 20 min hands-on');
  });

  it('orders kicker, title, time, Plan ahead, description, chips', () => {
    const out = html({ ...base, waitTime: 'PT8H', waitLabel: 'marinate 8-12 hr first' }, { showCategory: true });
    const order = ['Italian', lasagna.name, '1 hr 15 min', 'Plan ahead: marinate 8-12 hr first', base.description, 'Make ahead'];
    const positions = order.map((s) => at(out, s));
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it('shows Plan ahead only when the recipe has a wait', () => {
    expect(html(base)).not.toContain('Plan ahead');
    expect(html({ ...base, waitTime: 'PT30M', waitLabel: 'chill 30 min' })).toContain('Plan ahead: chill 30 min');
  });

  it('shows no time line without both prepTime and cookTime', () => {
    const { cookTime: _c, ...noCook } = base;
    const { prepTime: _p, ...noPrep } = base;
    for (const r of [noCook, noPrep]) {
      const out = html(r);
      expect(out).not.toContain('hands-on');
      expect(out).not.toContain('<strong>');
    }
  });

  it('has no ingredient or step counts and no difficulty', () => {
    const out = html(base);
    expect(out).not.toMatch(/\d+ ingredients?/);
    expect(out).not.toMatch(/\d+ steps?/);
    expect(out).not.toMatch(/difficulty|\beasy\b|\bmedium\b|\bhard\b/i);
  });

  it('shows up to three chips, Method > Plan > Diet > Protein', () => {
    const out = html({ ...base, tags: ['#chicken', '#vegetarian', '#make-ahead', '#oven', '#korean'] });
    const chips = [...out.matchAll(/<li class="[^"]*chip[^"]*">([^<]+)<\/li>/g)].map((m) => m[1]);
    expect(chips).toEqual(['Oven', 'Make ahead', 'Vegetarian']);
  });

  it('never shows a chip that repeats the category label', () => {
    const slow = displayRecipes.find((r) => r.section === 'SLOW COOKER' && !r.is_blank);
    const out = html({ ...slow, tags: ['#slow-cooker', '#make-ahead'] }, { showCategory: true });
    const chips = [...out.matchAll(/<li class="[^"]*chip[^"]*">([^<]+)<\/li>/g)].map((m) => m[1]);
    expect(chips).toContain('Make ahead');
    expect(chips).not.toContain('Slow cooker');
  });

  it('renders the matched line under the description only when given', () => {
    expect(html(base)).not.toContain('matched:');
    const out = html(base, { matchedLine: '1 red onion, diced' });
    expect(text(out)).toContain('matched: |1 red onion, diced');
    expect(at(out, 'matched:')).toBeGreaterThan(at(out, base.description));
  });

  it("keeps the draft pill in the top row, above the title", () => {
    const draft = displayRecipes.find((r) => r.section === 'CHEFS DRAFTS' && !r.is_blank);
    const out = html(draft);
    expect(at(out, 'Draft - not cooked yet')).toBeLessThan(at(out, draft.name));
  });
});
