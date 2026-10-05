// @vitest-environment jsdom
// The recipe as a reader sees it: its title, ingredients and method, and an AI
// photo labelled twice (a faint badge on the image, the caption under it).
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { displayRecipes } from '../../data/recipeIndex.js';
import { AI_PHOTO_CAPTION } from '../../utils/photoCaption.js';
import RecipeView from './RecipeView.jsx';

// `image` guarantees a photo even before build-photos has run (CI tests run
// before the build); a sized photo in src/photos/ wins when present.
const lasagna = { ...displayRecipes.find((r) => r.id === 'lasagna'), image: 'photos/lasagna.jpg' };
const items = lasagna.ingredients.filter((i) => i.type === 'item');

beforeEach(() => {
  localStorage.clear();
  // The nutrition estimate looks ingredients up over the network; never let a
  // test reach it.
  vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('RecipeView', () => {
  it('names the recipe in the tab, and hands the tab back to the site name on the way out', () => {
    // A direct load of /r/lasagna/: the prerendered file already carries the
    // recipe's own title. Back then lands on the list, which must not keep it.
    document.title = "Lasagna — Baker's Recipe List";
    const { unmount } = render(<RecipeView recipe={lasagna} headingLevel={1} />);
    expect(document.title).toBe("Lasagna — Baker's Recipe List");
    unmount();
    expect(document.title).toBe("Baker's Recipe List");
  });

  it('retitles the tab when the view moves to another recipe', () => {
    const other = displayRecipes.find((r) => r.id !== 'lasagna' && !r.is_blank);
    const { rerender } = render(<RecipeView recipe={lasagna} headingLevel={1} />);
    rerender(<RecipeView recipe={other} headingLevel={1} />);
    expect(document.title).toBe(`${other.name} — Baker's Recipe List`);
  });

  it('shows the recipe title as the page heading', () => {
    render(<RecipeView recipe={lasagna} headingLevel={1} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Lasagna' })).toBeTruthy();
  });

  it('lists every ingredient, in order, as something you can tick off', () => {
    render(<RecipeView recipe={lasagna} headingLevel={1} />);
    const section = screen.getByRole('region', { name: /ingredients/i });
    const ticks = within(section).getAllByRole('checkbox');
    expect(ticks.map((t) => t.closest('label').textContent.trim())).toEqual(items.map((i) => i.text));
  });

  it('shows every step of the method, in order', () => {
    render(<RecipeView recipe={lasagna} headingLevel={1} />);
    const method = screen.getByRole('region', { name: /method/i });
    const steps = within(method).getAllByRole('listitem');
    expect(steps).toHaveLength(lasagna.instructions.length);
    lasagna.instructions.forEach((s, i) => {
      expect(steps[i].textContent).toContain(s.step);
    });
  });

  it('labels the AI photo with the caption, Cookbook sentence included', () => {
    render(<RecipeView recipe={lasagna} headingLevel={1} />);
    const caption = screen.getByText(AI_PHOTO_CAPTION);
    expect(caption.tagName).toBe('FIGCAPTION');
    expect(caption.textContent).toContain('Every Cookbook recipe is cooked and tested');
  });

  it('marks the photo itself with the faint AI badge', () => {
    render(<RecipeView recipe={lasagna} headingLevel={1} />);
    const badge = screen.getByRole('img', { name: 'AI-generated image' });
    expect(badge.textContent).toBe('AI');
    expect(badge.closest('figure')).toBe(screen.getByText(AI_PHOTO_CAPTION).closest('figure'));
  });
});
