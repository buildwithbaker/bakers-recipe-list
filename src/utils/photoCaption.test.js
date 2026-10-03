import { describe, it, expect } from 'vitest';
import { AI_PHOTO_CAPTION } from './photoCaption.js';

describe('AI photo caption', () => {
  it('carries the AI label and the Cookbook tested sentence', () => {
    expect(AI_PHOTO_CAPTION).toBe(
      "AI-generated image, not a photo of this recipe as cooked. Every Cookbook recipe is cooked and tested by a real person before it's posted.",
    );
  });
});
