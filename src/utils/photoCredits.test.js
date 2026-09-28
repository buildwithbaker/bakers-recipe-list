import { readdirSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import credits from '../data/photoCredits.json';
import recipes from '../data/recipes.json';
import { expandVersionedRecipe } from '../data/expandVersions.js';
import { PHOTO_SOURCE_EXT, checkPhotoCredits } from './photoFiles.js';
import { photoCredit } from './recipePhoto.js';

// Guards src/data/photoCredits.json: no AI photo is ever live without its label.
const knownIds = new Set(recipes.flatMap((r) => expandVersionedRecipe(r).map((row) => row.id)));
const segments = new Set(readdirSync('src/photos').filter((n) => PHOTO_SOURCE_EXT.test(n)).map((n) => n.replace(PHOTO_SOURCE_EXT, '')));

describe('photo credits file', () => {
  it('names only real recipes that have a photo, and labels every AI photo', () => {
    expect(checkPhotoCredits(credits, segments, knownIds)).toEqual([]);
  });
});

describe('photo credits rules', () => {
  const ids = new Set(['lasagna', 'chili::v2', 'beef-stew']);
  const segs = new Set(['lasagna', 'chili--v2']);
  const ok = { ai: true, alt: 'AI-generated image of lasagna.' };

  it('accepts a labelled AI photo, including a version row', () => {
    expect(checkPhotoCredits({ lasagna: ok, 'chili::v2': ok }, segs, ids)).toEqual([]);
  });

  it('fails on an id with no photo', () => {
    expect(checkPhotoCredits({ 'beef-stew': ok }, segs, ids)[0]).toMatch(/no photo in src\/photos\//);
  });

  it('fails on an id that is not a recipe', () => {
    expect(checkPhotoCredits({ lasagne: ok }, segs, ids)[0]).toMatch(/no recipe has this id/);
  });

  it('fails on an AI photo with missing, empty or unlabelled alt text', () => {
    for (const bad of [{ ai: true }, { ai: true, alt: '' }, { ai: true, alt: '   ' }, { ai: true, alt: 'A slice of lasagna.' }]) {
      expect(checkPhotoCredits({ lasagna: bad }, segs, ids)).toEqual([
        'photoCredits.json "lasagna": an AI photo needs alt text that starts with "AI-generated".',
      ]);
    }
  });

  it('reads a credit, and treats a recipe with no entry as a real photo', () => {
    expect(photoCredit('lasagna')).toEqual({ ai: true, alt: credits.lasagna.alt });
    expect(photoCredit('no-photo-here')).toEqual({ ai: false, alt: '' });
    expect(photoCredit('constructor')).toEqual({ ai: false, alt: '' });
  });
});
