import { describe, it, expect } from 'vitest';
import { AI_PHOTO_CAPTION, CAPTION_LINK_TEXT } from './photoCaption.js';

describe('AI photo caption', () => {
  it('says what the image is and that the recipe was cooked and tested', () => {
    expect(AI_PHOTO_CAPTION).toBe(
      "AI-generated image. Every recipe is cooked and tested by a real person before it's posted.",
    );
  });

  it('ends with a short "Why?" link', () => {
    expect(CAPTION_LINK_TEXT).toBe('Why?');
  });
});
