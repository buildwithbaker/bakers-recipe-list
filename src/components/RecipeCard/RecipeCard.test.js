// Written without JSX: the suite only collects *.test.js.
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, it, expect } from 'vitest';
import { displayRecipes } from '../../data/recipeIndex.js';
import { photoCredit } from '../../utils/photoCredit.js';
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
