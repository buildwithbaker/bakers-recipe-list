// @vitest-environment jsdom
// The masthead's "share this site" button: it always shares the site home,
// is absent on a full recipe page (the recipe's own Share is the only one
// there), and never fails silently. vitest's BASE_URL is '/'.
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import App from './App.jsx';

const HOME = `${window.location.origin}/`;
const siteShare = () => screen.queryByRole('button', { name: "Share Baker's Recipe List" });
const state = { overlays: [], page: false, tab: 'recipes' };
const abort = () => Object.assign(new Error('cancelled'), { name: 'AbortError' });

beforeEach(() => {
  localStorage.clear();
  window.scrollTo = vi.fn();
  Element.prototype.scrollIntoView = vi.fn();
  vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  window.history.replaceState(null, '', '/');
});

describe('masthead site share', () => {
  it('on the list: shares the HOME url with a title and no text', async () => {
    const share = vi.fn().mockResolvedValue();
    vi.stubGlobal('navigator', { ...navigator, share });
    window.history.replaceState(state, '', '/');
    render(<App />);
    fireEvent.click(siteShare());
    await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    expect(share).toHaveBeenCalledWith({ title: "Baker's Recipe List", url: HOME });
  });

  it('on About: still shares the HOME url, not /about/', async () => {
    const share = vi.fn().mockResolvedValue();
    vi.stubGlobal('navigator', { ...navigator, share });
    window.history.replaceState(state, '', '/about/');
    render(<App />);
    fireEvent.click(siteShare());
    await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    expect(share.mock.calls[0][0].url).toBe(HOME);
  });

  it('on a full recipe page: no site-share button; the recipe Share still works', async () => {
    const share = vi.fn().mockResolvedValue();
    vi.stubGlobal('navigator', { ...navigator, share });
    window.history.replaceState(null, '', '/r/lasagna/'); // a direct load: the path makes it a full page
    render(<App />);
    expect(siteShare()).toBeNull();
    fireEvent.click(await screen.findByRole('button', { name: /^share$/i }));
    await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    expect(share.mock.calls[0][0].url).toBe(`${window.location.origin}/r/lasagna/`);
  });

  it('with no share sheet: copies the home url and announces "Link copied"', async () => {
    const writeText = vi.fn().mockResolvedValue();
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    window.history.replaceState(state, '', '/');
    render(<App />);
    fireEvent.click(siteShare());
    expect(await screen.findByText('Link copied')).toBeTruthy();
    expect(writeText).toHaveBeenCalledWith(HOME);
  });

  it('a cancelled share shows nothing; any other failure falls back to copy', async () => {
    const writeText = vi.fn().mockResolvedValue();
    const share = vi.fn().mockRejectedValueOnce(abort()).mockRejectedValueOnce(new Error('boom'));
    vi.stubGlobal('navigator', { share, clipboard: { writeText } });
    window.history.replaceState(state, '', '/');
    render(<App />);
    fireEvent.click(siteShare());
    await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    expect(screen.queryByText('Link copied')).toBeNull();
    expect(writeText).not.toHaveBeenCalled();
    fireEvent.click(siteShare());
    expect(await screen.findByText('Link copied')).toBeTruthy();
    expect(writeText).toHaveBeenCalledWith(HOME);
  });
});
