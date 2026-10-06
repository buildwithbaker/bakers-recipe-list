import { describe, it, expect } from 'vitest';
import { gatherWhyNotes, hasWhy, stepNumbers } from './whyNotes.js';

describe('whyNotes', () => {
  const classic = [
    { step: 'Heat', detail: 'Heat the oven.' },
    { step: 'Roast', detail: 'Roast 20 minutes.', why: 'So it browns.' },
  ];

  it('numbers steps the way the method does, restarting after a section', () => {
    const steps = [
      { type: 'section', step: 'Glaze', detail: '' },
      { type: 'item', step: 'Mix it.', detail: '' },
      { type: 'header', step: 'Note', detail: '' },
      { type: 'item', step: 'Brush it on.', detail: '' },
      { type: 'section', step: 'Rub', detail: '' },
      { type: 'item', step: 'Rub it in.', detail: '' },
    ];
    expect(stepNumbers(steps)).toEqual([null, 1, null, 2, null, 1]);
  });

  it('knows whether any step has a why', () => {
    expect(hasWhy(classic)).toBe(true);
    expect(hasWhy([classic[0]])).toBe(false);
    expect(hasWhy(undefined)).toBe(false);
  });

  it('labels a classic step by number and title, a grouped step by number', () => {
    const grouped = [{ type: 'item', step: 'Mix everything well.', detail: '', why: 'Even coating.' }];
    expect(gatherWhyNotes(classic)).toEqual([{ n: 2, label: 'Step 2, Roast', why: 'So it browns.' }]);
    expect(gatherWhyNotes(grouped)).toEqual([{ n: 1, label: 'Step 1', why: 'Even coating.' }]);
  });
});
