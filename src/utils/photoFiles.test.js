import { describe, it, expect } from 'vitest';
import { MAX_SOURCE_BYTES, generatedName, planPhotos } from './photoFiles.js';

const ids = new Set(['lasagna', 'chili::v2', 'beef-stew']);

describe('photo drop folder rules', () => {
  it('accepts a photo named after an id, including a version row', () => {
    const { photos, errors } = planPhotos([
      { name: 'lasagna.jpg', bytes: 1000 },
      { name: 'chili--v2.webp', bytes: 1000 },
    ], ids);
    expect(errors).toEqual([]);
    expect(photos.map((p) => p.id)).toEqual(['lasagna', 'chili::v2']);
    expect(photos[1].segment).toBe('chili--v2');
  });

  it('fails loudly on a name that matches no recipe', () => {
    const { photos, errors } = planPhotos([{ name: 'lasagne.jpg', bytes: 1000 }], ids);
    expect(photos).toEqual([]);
    expect(errors[0]).toMatch(/no recipe has the address \/r\/lasagne\//);
  });

  it('fails on an oversized or non-photo file, and on two photos for one recipe', () => {
    const { errors } = planPhotos([
      { name: 'beef-stew.jpg', bytes: MAX_SOURCE_BYTES + 1 },
      { name: 'lasagna.heic', bytes: 1000 },
      { name: 'lasagna.jpg', bytes: 1000 },
      { name: 'lasagna.png', bytes: 1000 },
    ], ids);
    expect(errors).toHaveLength(3);
    expect(errors.join('\n')).toMatch(/over the 2 MB limit/);
    expect(errors.join('\n')).toMatch(/not a photo/);
    expect(errors.join('\n')).toMatch(/already the photo for lasagna/);
  });

  it('accepts an unresized phone photo up to 2 MB', () => {
    const { photos, errors } = planPhotos([{ name: 'lasagna.jpg', bytes: 1.5 * 1024 * 1024 }], ids);
    expect(errors).toEqual([]);
    expect(photos).toHaveLength(1);
    expect(MAX_SOURCE_BYTES).toBe(2 * 1024 * 1024);
  });

  it('ignores the generated folder and notes', () => {
    const { photos, errors } = planPhotos([{ name: 'generated', bytes: 0 }, { name: 'README.md', bytes: 10 }, { name: '.gitkeep', bytes: 0 }], ids);
    expect(photos).toEqual([]);
    expect(errors).toEqual([]);
  });

  it('names outputs by segment and size', () => {
    expect(generatedName('chili--v2', 'thumb')).toBe('chili--v2-thumb.webp');
  });
});
