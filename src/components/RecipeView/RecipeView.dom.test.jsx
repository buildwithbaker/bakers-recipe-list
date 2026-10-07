// @vitest-environment jsdom
// The recipe as a reader sees it: its title, ingredients and method, its
// actions, the Display settings, and an AI photo labelled twice (a faint badge
// on the image, the caption under it). The caption's "Why?" links to the About
// page's photos question; the badge is only a label.
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { displayRecipes } from '../../data/recipeIndex.js';
import { AI_PHOTO_CAPTION, CAPTION_LINK_TEXT } from '../../utils/photoCaption.js';
import { DISPLAY_KEYS } from '../../utils/displaySettings.js';
import { CookHistoryProvider } from '../../context/CookHistoryContext.jsx';
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

  it('captions the AI photo in one short paragraph', () => {
    render(<RecipeView recipe={lasagna} headingLevel={1} />);
    const caption = screen.getByRole('link', { name: CAPTION_LINK_TEXT }).closest('figcaption');
    expect(caption.textContent).toBe(`${AI_PHOTO_CAPTION} ${CAPTION_LINK_TEXT}`);
    expect(caption.textContent).toContain('Every recipe is cooked and tested');
    expect(caption.closest('figure').querySelector('img')).toBeTruthy();
  });

  it('links only "Why?" to the photos question on the About page', () => {
    render(<RecipeView recipe={lasagna} headingLevel={1} />);
    const caption = screen.getByRole('link', { name: CAPTION_LINK_TEXT }).closest('figcaption');
    const links = within(caption).getAllByRole('link');
    expect(links).toHaveLength(1);
    expect(links[0].textContent).toBe('Why?');
    expect(links[0].getAttribute('href')).toMatch(/\/about\/#photos$/);
  });

  it('goes to About in-app on a plain click, and leaves a modified click to the browser', () => {
    const onAbout = vi.fn();
    render(<RecipeView recipe={lasagna} headingLevel={1} onAbout={onAbout} />);
    const link = screen.getByRole('link', { name: CAPTION_LINK_TEXT });

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
    expect(badge.closest('figure')).toBe(screen.getByRole('link', { name: CAPTION_LINK_TEXT }).closest('figure'));
    // A label, not a control: "Why?" is the link.
    expect(badge.closest('a, button')).toBeNull();
  });
});

// The top card's actions: cook mode first, then Pin, Made it, Share, Card.
describe('RecipeView actions', () => {
  it('offers Card and no longer Print', () => {
    render(<RecipeView recipe={lasagna} headingLevel={1} />);
    expect(screen.getByRole('button', { name: 'Download recipe card (PDF)' }).textContent).toBe('Card');
    expect(screen.queryByRole('button', { name: /print/i })).toBeNull();
  });

  it('labels Pin "Pinned" while it is on', () => {
    render(<CookHistoryProvider><RecipeView recipe={lasagna} headingLevel={1} /></CookHistoryProvider>);
    const pin = screen.getByRole('button', { name: 'Pin' });
    fireEvent.click(pin);
    expect(pin.textContent).toBe('Pinned');
    expect(pin.getAttribute('aria-pressed')).toBe('true');
  });

  it('keeps the four tiles in order: Pin, Made it, Share, Card', () => {
    render(<RecipeView recipe={lasagna} headingLevel={1} />);
    const tiles = screen.getByRole('button', { name: 'Pin' }).parentElement;
    expect([...tiles.querySelectorAll('button')].map((b) => b.textContent)).toEqual(['Pin', 'Made it', 'Share', 'Card']);
  });
});

// Display settings: why notes and the amounts written inside steps, behind
// the "Display" button in the Method header. Hidden why notes gather in Notes.
describe('RecipeView display settings', () => {
  const pilot = displayRecipes.find((r) => r.id === 'sheet-pan-paprika-chicken-thighs-with-potatoes');
  const whySteps = pilot.instructions.filter((s) => s.why);
  const method = () => screen.getByRole('region', { name: /method/i });
  const notesRegion = () => screen.queryByRole('region', { name: 'Notes' });
  const openDisplay = () => fireEvent.click(within(method()).getByRole('button', { name: 'Display' }));
  const sw = (name) => screen.getByRole('switch', { name });

  it('shows each why after its step, in the same paragraph, by default', () => {
    render(<RecipeView recipe={pilot} headingLevel={1} />);
    const steps = within(method()).getAllByRole('listitem');
    pilot.instructions.forEach((s, i) => {
      const p = steps[i].querySelector('p');
      expect(p.textContent).toBe(s.why ? `${s.detail} ${s.why}` : s.detail);
      if (s.why) expect(within(p).getByText(s.why).tagName).toBe('SPAN');
    });
    expect(notesRegion()).toBeNull();
  });

  it('has no checkbox any more, and a Display button in the Method header', () => {
    render(<RecipeView recipe={pilot} headingLevel={1} />);
    expect(screen.queryByRole('checkbox', { name: /why notes/i })).toBeNull();
    const button = within(method()).getByRole('button', { name: 'Display' });
    expect(button.closest('div').parentElement.querySelector('h2, h3').textContent).toBe('Method');
  });

  it('offers both switches, on by default', () => {
    render(<RecipeView recipe={pilot} headingLevel={1} />);
    openDisplay();
    expect(sw('Why notes').getAttribute('aria-checked')).toBe('true');
    expect(sw('Amounts in steps').getAttribute('aria-checked')).toBe('true');
  });

  it('Why notes off hides only the why text, and lists it in Notes by step', () => {
    render(<RecipeView recipe={pilot} headingLevel={1} />);
    openDisplay();
    fireEvent.click(sw('Why notes'));
    expect(sw('Why notes').getAttribute('aria-checked')).toBe('false');

    const steps = within(method()).getAllByRole('listitem');
    pilot.instructions.forEach((s, i) => {
      expect(steps[i].textContent).toContain(s.step);
      expect(steps[i].querySelector('p').textContent).toBe(s.detail);
    });
    const notes = within(notesRegion()).getAllByRole('listitem').map((li) => li.textContent);
    expect(notes).toEqual(whySteps.map((s) => `Step ${pilot.instructions.indexOf(s) + 1}, ${s.step}: ${s.why}`));

    fireEvent.click(sw('Why notes'));
    expect(notesRegion()).toBeNull();
  });

  it('Amounts in steps off strips the step amounts, never the ingredients or the why', () => {
    render(<RecipeView recipe={pilot} headingLevel={1} />);
    openDisplay();
    fireEvent.click(sw('Amounts in steps'));
    const p = within(method()).getAllByRole('listitem')[1].querySelector('p');
    expect(p.textContent).toBe(
      'In a small bowl, stir together the smoked paprika, garlic powder, dried oregano, cayenne, table salt, and black pepper.',
    );
    const ingredients = screen.getByRole('region', { name: /ingredients/i });
    expect(within(ingredients).getByText('1 Tbsp smoked paprika')).toBeTruthy();
    expect(within(method()).getByText(whySteps[0].why)).toBeTruthy();
  });

  it('remembers both settings across views', () => {
    const { unmount } = render(<RecipeView recipe={pilot} headingLevel={1} />);
    openDisplay();
    fireEvent.click(sw('Why notes'));
    fireEvent.click(sw('Amounts in steps'));
    expect(localStorage.getItem(DISPLAY_KEYS.why)).toBe('0');
    expect(localStorage.getItem(DISPLAY_KEYS.amounts)).toBe('0');
    unmount();
    render(<RecipeView recipe={pilot} headingLevel={1} />);
    expect(notesRegion()).toBeTruthy();
    expect(within(method()).queryByText(/\(1 Tbsp\)/)).toBeNull();
  });

  it('still renders, defaulting to on, when storage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    try {
      render(<RecipeView recipe={pilot} headingLevel={1} />);
      openDisplay();
      expect(sw('Why notes').getAttribute('aria-checked')).toBe('true');
      fireEvent.click(sw('Why notes'));
      expect(sw('Why notes').getAttribute('aria-checked')).toBe('false');
    } finally {
      vi.restoreAllMocks();
    }
  });

  it('hides the Why notes row on a recipe with no why, and keeps Amounts in steps', () => {
    expect(lasagna.instructions.some((s) => s.why)).toBe(false);
    render(<RecipeView recipe={lasagna} headingLevel={1} />);
    openDisplay();
    expect(screen.queryByRole('switch', { name: 'Why notes' })).toBeNull();
    expect(sw('Amounts in steps')).toBeTruthy();
  });

  it('shows no Display button on a recipe with neither why nor step amounts', () => {
    const plain = { ...lasagna, instructions: [{ step: 'Bake', detail: 'Bake until golden.' }] };
    render(<RecipeView recipe={plain} headingLevel={1} />);
    expect(screen.queryByRole('button', { name: 'Display' })).toBeNull();
  });

  it('says step amounts are for the original recipe only while scaled with amounts on', () => {
    render(<RecipeView recipe={pilot} headingLevel={1} />);
    const hint = 'Amounts in steps are for the original recipe.';
    expect(screen.queryByText(hint)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'More servings' }));
    expect(screen.getByText(hint)).toBeTruthy();
    openDisplay();
    fireEvent.click(sw('Amounts in steps'));
    expect(screen.queryByText(hint)).toBeNull();
  });

  it("always shows a recipe's own notes, ahead of any gathered why notes", () => {
    render(<RecipeView recipe={{ ...pilot, notes: ['Keeps three days in the fridge.'] }} headingLevel={1} />);
    expect(within(notesRegion()).getAllByRole('listitem').map((li) => li.textContent))
      .toEqual(['Keeps three days in the fridge.']);
    openDisplay();
    fireEvent.click(sw('Why notes'));
    const items = within(notesRegion()).getAllByRole('listitem');
    expect(items[0].textContent).toBe('Keeps three days in the fridge.');
    expect(items).toHaveLength(1 + whySteps.length);
  });
});
