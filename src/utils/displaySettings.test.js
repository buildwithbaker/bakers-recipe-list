// @vitest-environment jsdom
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { DISPLAY_KEYS, loadDisplaySettings, saveDisplaySetting } from './displaySettings.js';

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe('display settings', () => {
  it('uses brl_-prefixed keys, keeping the PR A why key', () => {
    expect(DISPLAY_KEYS).toEqual({ why: 'brl_show_why', amounts: 'brl_step_amounts' });
  });

  it('defaults both to on', () => {
    expect(loadDisplaySettings()).toEqual({ why: true, amounts: true });
  });

  it('saves and reads each one on its own', () => {
    saveDisplaySetting('amounts', false);
    expect(localStorage.getItem('brl_step_amounts')).toBe('0');
    expect(loadDisplaySettings()).toEqual({ why: true, amounts: false });
    saveDisplaySetting('why', false);
    saveDisplaySetting('amounts', true);
    expect(loadDisplaySettings()).toEqual({ why: false, amounts: true });
  });

  it('reads as on and never throws when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(loadDisplaySettings()).toEqual({ why: true, amounts: true });
    expect(() => saveDisplaySetting('why', false)).not.toThrow();
  });
});
