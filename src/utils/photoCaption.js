// The caption under an AI-generated recipe photo (RecipeView).
//
// The "cooked and tested" promise is made for Cookbook recipes only (Adam,
// 2026-09-28): For Review and To Try entries have not been through it.
import { COLL_BOOK, collectionOf } from '../data/catalog.js';

export const AI_CAPTION = 'AI-generated image, not a photo of this recipe as cooked.';
export const COOKBOOK_TESTED = "Every Cookbook recipe is cooked and tested by a real person before it's posted.";

export function aiPhotoCaption(recipe) {
  return collectionOf(recipe) === COLL_BOOK ? `${AI_CAPTION} ${COOKBOOK_TESTED}` : AI_CAPTION;
}
