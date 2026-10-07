// The reader's Display settings for a recipe: why notes and the amounts
// written inside steps. Both on unless turned off, one site-wide choice each
// (not per recipe). A blocked or broken storage reads as the default and
// never throws into the page.

export const DISPLAY_KEYS = {
  why: 'brl_show_why',
  amounts: 'brl_step_amounts',
};

export function loadDisplaySettings() {
  const read = (key) => {
    try { return localStorage.getItem(key) !== '0'; }
    catch { return true; }
  };
  return { why: read(DISPLAY_KEYS.why), amounts: read(DISPLAY_KEYS.amounts) };
}

export function saveDisplaySetting(name, on) {
  try { localStorage.setItem(DISPLAY_KEYS[name], on ? '1' : '0'); }
  catch { /* storage blocked or full: the choice lasts this visit only */ }
}
