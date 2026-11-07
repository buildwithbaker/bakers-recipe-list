import { afterEach, describe, it, expect, vi } from 'vitest';
import { shareLink } from './shareLink.js';

const URL_ = 'https://example.test/app/';
const abort = () => Object.assign(new Error('cancelled'), { name: 'AbortError' });

afterEach(() => vi.unstubAllGlobals());

describe('shareLink', () => {
  it('uses navigator.share with title and url only, and says nothing on success', async () => {
    const share = vi.fn().mockResolvedValue();
    vi.stubGlobal('navigator', { share });
    const toast = vi.fn();
    await shareLink({ title: 'T', url: URL_, toast });
    expect(share).toHaveBeenCalledWith({ title: 'T', url: URL_ });
    expect(toast).not.toHaveBeenCalled();
  });

  it('treats AbortError as silent: no toast, no copy', async () => {
    const writeText = vi.fn();
    vi.stubGlobal('navigator', { share: vi.fn().mockRejectedValue(abort()), clipboard: { writeText } });
    const toast = vi.fn();
    await shareLink({ title: 'T', url: URL_, toast });
    expect(toast).not.toHaveBeenCalled();
    expect(writeText).not.toHaveBeenCalled();
  });

  it('falls back to copying after a non-abort share failure', async () => {
    const writeText = vi.fn().mockResolvedValue();
    vi.stubGlobal('navigator', { share: vi.fn().mockRejectedValue(new Error('NotAllowedError')), clipboard: { writeText } });
    const toast = vi.fn();
    await shareLink({ title: 'T', url: URL_, toast });
    expect(writeText).toHaveBeenCalledWith(URL_);
    expect(toast).toHaveBeenCalledWith('Link copied');
  });

  it('copies when there is no share sheet', async () => {
    const writeText = vi.fn().mockResolvedValue();
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    const toast = vi.fn();
    await shareLink({ title: 'T', url: URL_, toast });
    expect(writeText).toHaveBeenCalledWith(URL_);
    expect(toast).toHaveBeenCalledWith('Link copied');
  });

  it('says so when the clipboard is missing or refuses', async () => {
    const toast = vi.fn();
    vi.stubGlobal('navigator', {});
    await shareLink({ title: 'T', url: URL_, toast });
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } });
    await shareLink({ title: 'T', url: URL_, toast });
    expect(toast.mock.calls).toEqual([['Could not copy the link'], ['Could not copy the link']]);
  });
});
