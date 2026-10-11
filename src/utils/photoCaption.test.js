import { describe, it, expect } from 'vitest';
import { AI_PHOTO_CAPTION, CAPTION_LINK_TEXT, DRAFT_PHOTO_CAPTION, TESTED, photoCaptionFor } from './photoCaption.js';

describe('AI photo caption', () => {
  it('says what the image is and that the recipe was cooked and tested', () => {
    expect(AI_PHOTO_CAPTION).toBe(
      "AI-generated image. Every recipe is cooked and tested by a real person before it's posted.",
    );
  });

  it('ends with a short "Why?" link', () => {
    expect(CAPTION_LINK_TEXT).toBe('Why?');
  });

  it('never makes the tested claim for a Chef\'s Draft', () => {
    expect(DRAFT_PHOTO_CAPTION).toBe("AI-generated image. This one is a Chef's Draft: I haven't cooked it yet.");
    expect(photoCaptionFor({ section: 'CHEFS DRAFTS' })).toBe(DRAFT_PHOTO_CAPTION);
    expect(photoCaptionFor({ section: 'CHEFS DRAFTS' })).not.toContain(TESTED);
  });

  it('keeps the tested claim for a cookbook recipe', () => {
    expect(photoCaptionFor({ section: 'AMERICAN' })).toBe(AI_PHOTO_CAPTION);
  });
});
