import { describe, it, expect } from 'vitest';
import { formatMinutes, isoToMinutes, recipeTimes } from './isoDuration.js';

describe('isoToMinutes', () => {
  it('reads minutes, hours, and both', () => {
    expect(isoToMinutes('PT25M')).toBe(25);
    expect(isoToMinutes('PT2H')).toBe(120);
    expect(isoToMinutes('PT1H30M')).toBe(90);
    expect(isoToMinutes('PT10H15M')).toBe(615);
    expect(isoToMinutes('PT0M')).toBe(0);
  });

  it('gives null for a missing or malformed value', () => {
    for (const bad of [undefined, null, '', 'PT', 'P1D', 'PT30S', 'PT1M30H', '30 min', 'pt5m', 45]) {
      expect(isoToMinutes(bad), String(bad)).toBeNull();
    }
  });
});

describe('formatMinutes', () => {
  it('writes minutes under an hour as min', () => {
    expect(formatMinutes(0)).toBe('0 min');
    expect(formatMinutes(25)).toBe('25 min');
    expect(formatMinutes(59)).toBe('59 min');
  });

  it('writes whole hours as hr, and the rest as hr and min', () => {
    expect(formatMinutes(60)).toBe('1 hr');
    expect(formatMinutes(70)).toBe('1 hr 10 min');
    expect(formatMinutes(470)).toBe('7 hr 50 min');
    expect(formatMinutes(120)).toBe('2 hr');
  });

  it('gives an empty string for a value that is not a whole minute count', () => {
    for (const bad of [null, undefined, -5, 1.5, NaN, '25']) expect(formatMinutes(bad)).toBe('');
  });
});

describe('recipeTimes', () => {
  it('adds prep and cook for the ready time, and keeps prep as hands-on', () => {
    expect(recipeTimes({ prepTime: 'PT20M', cookTime: 'PT7H30M' })).toEqual({ ready: 470, handsOn: 20 });
    expect(recipeTimes({ prepTime: 'PT5M', cookTime: 'PT0M' })).toEqual({ ready: 5, handsOn: 5 });
  });

  it('gives null when either half is missing or malformed', () => {
    expect(recipeTimes({ prepTime: 'PT20M' })).toBeNull();
    expect(recipeTimes({ cookTime: 'PT20M' })).toBeNull();
    expect(recipeTimes({ prepTime: 'PT20M', cookTime: 'soon' })).toBeNull();
    expect(recipeTimes({})).toBeNull();
    expect(recipeTimes(null)).toBeNull();
  });
});
