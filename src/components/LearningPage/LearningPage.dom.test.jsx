// @vitest-environment jsdom
// "Used in" is derived and left out when nothing uses a technique. No real
// technique is unused any more, so this runs the page over a fixture.
import { afterEach, describe, it, expect, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';

vi.mock('../../data/techniqueIndex.js', () => {
  const t = (id) => ({
    id, title: `T ${id}`, kicker: 'K', why: 'W', how: ['one'],
    diagram: { src: `diagrams/${id}.svg`, alt: `alt ${id}` },
  });
  return {
    techniques: [t('used'), t('unused')],
    usedIn: (id) => (id === 'used' ? [{ id: 'some-recipe', name: 'Some Recipe' }] : []),
  };
});

const { default: LearningPage } = await import('./LearningPage.jsx');

afterEach(cleanup);

describe('LearningPage Used in', () => {
  it('shows it, with links, for a used technique and omits it for an unused one', () => {
    window.scrollTo = vi.fn();
    render(<LearningPage />);
    const used = document.getElementById('used');
    expect(within(used).getByRole('heading', { name: 'Used in' })).toBeTruthy();
    expect(within(used).getByRole('link', { name: 'Some Recipe' }).getAttribute('href')).toBe('/r/some-recipe/');
    const unused = document.getElementById('unused');
    expect(within(unused).queryByRole('heading', { name: 'Used in' })).toBeNull();
    expect(within(unused).queryByRole('link')).toBeNull();
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual(['T used', 'T unused']);
  });
});
