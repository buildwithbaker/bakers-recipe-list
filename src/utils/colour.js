// Colour arithmetic for the category palette.
//
// Tints are mixed here, in JavaScript, rather than with CSS color-mix(): iOS
// before 16.2 has no color-mix, and a custom property holding an unsupported
// value does not fall back to an earlier declaration. It goes invalid, and the
// background vanishes. A precomputed hex works in every browser.

const hex = (n) => Math.round(n).toString(16).padStart(2, '0');
const channels = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

// `amount` of `colour` over `base`, the same as
// color-mix(in srgb, colour amount%, base).
export function mix(colour, base, amount) {
  const a = channels(colour);
  const b = channels(base);
  return `#${a.map((c, i) => hex(c * amount + b[i] * (1 - amount))).join('')}`;
}

export function luminance(h) {
  const [r, g, b] = channels(h).map((c) => c / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
