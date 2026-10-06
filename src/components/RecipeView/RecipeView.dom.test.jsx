// @vitest-environment jsdom
// The recipe as a reader sees it: its title, ingredients and method, and an AI
// photo labelled twice (a faint badge on the image, the caption under it). The
// caption links to the About page's photos question; the badge is only a label.
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { displayRecipes } from '../../data/recipeIndex.js';
import { AI_PHOTO_CAPTION } from '../../utils/photoCaption.js';
import { SHOW_WHY_KEY } from '../../utils/whyNotes.js';
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
    const caption = screen.getByText(AI_PHOTO_CAPTION).closest('figcaption');
    expect(caption).toBeTruthy();
    expect(caption.textContent).toBe(AI_PHOTO_CAPTION);
    expect(caption.textContent).toContain('Every Cookbook recipe is cooked and tested');
    expect(caption.closest('figure').querySelector('img')).toBeTruthy();
  });

  it('links the caption to the photos question on the About page', () => {
    render(<RecipeView recipe={lasagna} headingLevel={1} />);
    const link = screen.getByRole('link', { name: AI_PHOTO_CAPTION });
    expect(link.closest('figcaption')).toBeTruthy();
    expect(link.getAttribute('href')).toMatch(/\/about\/#photos$/);
  });

  it('goes to About in-app on a plain click, and leaves a modified click to the browser', () => {
    const onAbout = vi.fn();
    render(<RecipeView recipe={lasagna} headingLevel={1} onAbout={onAbout} />);
    const link = screen.getByRole('link', { name: AI_PHOTO_CAPTION });

    const plain = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
    link.dispatchEvent(plain);
    expect(plain.defaultPrevented).toBe(true);
    expect(onAbout).toHaveBeenCalledWith('photos');

    onAbout.mockClear();
    fireEvent.click(link, { ctrlKey: true });
    expect(onAbout).not.toHaveBeenCalled();
  });

  it('marks the photo itself with the faint AI badge', () => {
    render(<RecipeView recipe={lasagna} headingLevel={1} />);
    const badge = screen.getByRole('img', { name: 'AI-generated image' });
    expect(badge.textContent).toBe('AI');
    expect(badge.closest('figure')).toBe(screen.getByText(AI_PHOTO_CAPTION).closest('figure'));
    // A label, not a control: the caption is the link.
    expect(badge.closest('a, button')).toBeNull();
  });
});

// Why notes: the optional `why` on a step, shown in muted italic after the
// step and hideable with "Show why notes". Hidden ones gather in Notes.
describe('RecipeView why notes', () => {
  const pilot = displayRecipes.find((r) => r.id === 'sheet-pan-paprika-chicken-thighs-with-potatoes');
  const whySteps = pilot.instructions.filter((s) => s.why);
  const toggle = () => screen.getByRole('checkbox', { name: 'Show why notes' });
  const method = () => screen.getByRole('region', { name: /method/i });
  const notesRegion = () => screen.queryByRole('region', { name: 'Notes' });

  it('the pilot recipe carries why notes (the fixture this block relies on)', () => {
    expect(whySteps.length).toBeGreaterThan(0);
  });

  it('shows each why after its step, in the same paragraph, by default', () => {
    render(<RecipeView recipe={pilot} headingLevel={1} />);
    expect(toggle().checked).toBe(true);
    const steps = within(method()).getAllByRole('listitem');
    pilot.instructions.forEach((s, i) => {
      const p = steps[i].querySelector('p');
      if (s.why) {
        expect(p.textContent).toBe(`${s.detail} ${s.why}`);
        expect(within(p).getByText(s.why).tagName).toBe('SPAN');
      } else {
        expect(p.textContent).toBe(s.detail);
      }
    });
    // Nothing to gather while they are inline, and the pilot has no notes.
    expect(notesRegion()).toBeNull();
  });

  it('places the checkbox just above the method list', () => {
    render(<RecipeView recipe={pilot} headingLevel={1} />);
    const label = toggle().closest('label');
    expect(label.nextElementSibling.tagName).toBe('OL');
  });

  it('unticking hides only the why text, and lists it in Notes by step', () => {
    render(<RecipeView recipe={pilot} headingLevel={1} />);
    fireEvent.click(toggle());
    expect(toggle().checked).toBe(false);

    const steps = within(method()).getAllByRole('listitem');
    expect(steps).toHaveLength(pilot.instructions.length);
    pilot.instructions.forEach((s, i) => {
      expect(steps[i].textContent).toContain(s.step);
      expect(steps[i].querySelector('p').textContent).toBe(s.detail);
    });

    const notes = within(notesRegion()).getAllByRole('listitem').map((li) => li.textContent);
    expect(notes).toEqual(
      whySteps.map((s) => `Step ${pilot.instructions.indexOf(s) + 1}, ${s.step}: ${s.why}`),
    );

    fireEvent.click(toggle());
    expect(notesRegion()).toBeNull();
    expect(within(method()).getByText(whySteps[0].why)).toBeTruthy();
  });

  it('remembers the choice across views', () => {
    const { unmount } = render(<RecipeView recipe={pilot} headingLevel={1} />);
    fireEvent.click(toggle());
    expect(localStorage.getItem(SHOW_WHY_KEY)).toBe('0');
    unmount();
    render(<RecipeView recipe={pilot} headingLevel={1} />);
    expect(toggle().checked).toBe(false);
    expect(notesRegion()).toBeTruthy();
  });

  it('still renders, defaulting to shown, when storage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    try {
      render(<RecipeView recipe={pilot} headingLevel={1} />);
      expect(toggle().checked).toBe(true);
      fireEvent.click(toggle());
      expect(toggle().checked).toBe(false);
    } finally {
      vi.restoreAllMocks();
    }
  });

  it('shows no checkbox on a recipe with no why', () => {
    expect(lasagna.instructions.some((s) => s.why)).toBe(false);
    render(<RecipeView recipe={lasagna} headingLevel={1} />);
    expect(screen.queryByRole('checkbox', { name: 'Show why notes' })).toBeNull();
    expect(notesRegion()).toBeNull();
  });

  it("always shows a recipe's own notes, ahead of any gathered why notes", () => {
    const withNotes = { ...pilot, notes: ['Keeps three days in the fridge.'] };
    render(<RecipeView recipe={withNotes} headingLevel={1} />);
    expect(within(notesRegion()).getAllByRole('listitem').map((li) => li.textContent))
      .toEqual(['Keeps three days in the fridge.']);
    fireEvent.click(toggle());
    const items = within(notesRegion()).getAllByRole('listitem');
    expect(items[0].textContent).toBe('Keeps three days in the fridge.');
    expect(items).toHaveLength(1 + whySteps.length);
  });

  it('shows notes on a recipe with no why, and no checkbox', () => {
    render(<RecipeView recipe={{ ...lasagna, notes: ['Better the next day.'] }} headingLevel={1} />);
    expect(screen.queryByRole('checkbox', { name: 'Show why notes' })).toBeNull();
    expect(within(notesRegion()).getByText('Better the next day.')).toBeTruthy();
  });
});
