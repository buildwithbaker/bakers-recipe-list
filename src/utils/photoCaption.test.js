import { describe, it, expect } from 'vitest';
import { COLL_BOOK, COLL_REVIEW, COLL_TRY, collectionOf } from '../data/catalog.js';
import { displayRecipes } from '../data/recipeIndex.js';
import { aiPhotoCaption } from './photoCaption.js';

const inCollection = (coll) => displayRecipes.find((r) => collectionOf(r) === coll);

describe('AI photo caption', () => {
  it('adds the tested sentence for a Cookbook recipe', () => {
    const lasagna = displayRecipes.find((r) => r.id === 'lasagna');
    expect(collectionOf(lasagna)).toBe(COLL_BOOK);
    expect(aiPhotoCaption(lasagna)).toBe(
      "AI-generated image, not a photo of this recipe as cooked. Every Cookbook recipe is cooked and tested by a real person before it's posted.",
    );
  });

  it.each([COLL_REVIEW, COLL_TRY])('keeps the plain caption in the %s collection', (coll) => {
    const r = inCollection(coll);
    expect(r).toBeTruthy();
    expect(aiPhotoCaption(r)).toBe('AI-generated image, not a photo of this recipe as cooked.');
  });
});
