// @vitest-environment jsdom
// The About page as a reader sees it: every answer visible (no accordion), each
// question a heading, the photos question the target of the AI caption's link.
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ABOUT_DOCUMENT_TITLE } from '../../utils/siteTitle.js';
import { ABOUT_FAQ, ABOUT_INTRO, ABOUT_DESCRIPTION } from './aboutCopy.js';
import AboutPage from './AboutPage.jsx';

beforeEach(() => {
  window.scrollTo = vi.fn();
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => {
  cleanup();
  window.history.replaceState(null, '', '/');
});

describe('AboutPage', () => {
  it('is titled as the page heading and in the document title', () => {
    render(<AboutPage />);
    expect(screen.getByRole('heading', { level: 1, name: "About Baker's Recipe List" })).toBeTruthy();
    expect(document.title).toBe("About - Baker's Recipe List");
    expect(ABOUT_DOCUMENT_TITLE).toBe("About - Baker's Recipe List");
  });

  it('restores the previous document title on the way out', () => {
    document.title = 'Before';
    const { unmount } = render(<AboutPage />);
    unmount();
    expect(document.title).toBe('Before');
  });

  it('shows every intro paragraph and every answer, with nothing folded away', () => {
    const { container } = render(<AboutPage />);
    for (const p of ABOUT_INTRO) expect(screen.getByText(p).tagName).toBe('P');
    for (const { a } of ABOUT_FAQ) expect(screen.getByText(a).tagName).toBe('P');
    expect(container.querySelector('details, [hidden], [aria-expanded]')).toBeNull();
  });

  it('makes each FAQ question a heading under the FAQ heading', () => {
    render(<AboutPage />);
    expect(screen.getByRole('heading', { level: 2, name: 'FAQ' })).toBeTruthy();
    const questions = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(questions).toEqual(ABOUT_FAQ.map((f) => f.q));
  });

  it('anchors the photos question at #photos', () => {
    render(<AboutPage />);
    expect(document.getElementById('photos').textContent).toBe('Why are the photos AI-generated?');
  });

  it('lands on the question named in the hash', () => {
    window.history.replaceState(null, '', '/about/#photos');
    render(<AboutPage />);
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
    expect(window.scrollTo).not.toHaveBeenCalled();
  });

  it('keeps the install hint and the maker link, opening in a new tab', () => {
    render(<AboutPage />);
    expect(screen.getByText('On iPhone: tap Share, then Add to Home Screen.')).toBeTruthy();
    const maker = screen.getByRole('link', { name: 'Made by Build with Baker' });
    expect(maker.getAttribute('href')).toBe('https://buildwithbaker.io');
    expect(maker.getAttribute('target')).toBe('_blank');
    expect(maker.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('describes itself with the first paragraph', () => {
    expect(ABOUT_DESCRIPTION).toBe(ABOUT_INTRO[0]);
  });
});
