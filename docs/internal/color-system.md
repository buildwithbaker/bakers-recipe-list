# Baker's Recipe List — Color System

The single reference for the app's palette. Last rewritten 2026-09-26 for the
warm-cookbook redesign (prototype v2).

- **Tokens:** [`src/styles/tokens.css`](../../src/styles/tokens.css). Components
  reference tokens, never raw hex.
- **Category colours:** `CATEGORIES` in
  [`src/data/catalog.js`](../../src/data/catalog.js).
- **Contrast is tested, not asserted:**
  [`src/styles/contrast.test.js`](../../src/styles/contrast.test.js) reads
  `tokens.css` and the category list and fails the suite below WCAG AA. Change a
  colour and `npm test` re-measures it. Add a pair there when a new text colour
  lands on a new background.

**Light only, by decision.** Every colour is named for its role, not its hue,
so a dark theme would be one more block re-pointing the same names. There is no
toggle; do not add one without asking.

---

## The idea

A recipe box on a kitchen counter:

- **Paper:** cream page with a faint grain.
- **Band:** an enamel-navy masthead with a double amber rule.
- **Cards:** off-white.
- **Category colour:** each category's colour carries through its chips, its
  divider-tab header, its cards and its recipe page, so you always know which
  drawer you are in.

Amber is an accent: rules, badges, the pinned star. It is never body text on
paper; use `--accent-ink` for amber-coloured text.

## Role tokens

| Token | Value | Role |
|---|---|---|
| `--paper` | `#f3ebdc` | page background (plus `--paper-texture`) |
| `--surface` | `#fffbf5` | cards, sheets, inputs |
| `--surface-sunk` | `#ece3d4` | segmented-control track |
| `--line` / `--line-strong` | `#e0d4c1` / `#c9b89f` | hairlines / control borders (never text) |
| `--ink` / `--ink-muted` | `#2a221c` / `#5f5349` | text / secondary text |
| `--brand` | `#1f3a5f` | links, focus ring, primary buttons |
| `--band` / `--band-ink` / `--band-accent` | `#1f3a5f` / `#f6e7c8` / `#e0a63a` | masthead background / its text / its amber |
| `--accent` / `--accent-ink` / `--accent-soft` | `#b7791f` / `#7a4f0e` / `#f6e7c8` | amber graphic / amber text / amber wash |
| `--made` / `--made-soft` | `#3d6b37` / `#e2eedb` | the Made state |
| `--review-ink` / `--review-soft` | `#6b4e00` / `#f7ecc6` | the For Review badge |
| `--danger` | `#a3301f` | destructive text (Clear all) |

## Category colours

Twenty-one categories share ten colours, per the approved SOW. Neighbours can
repeat, so the colour is a wayfinding cue and never the only signal: every
category is also named in text.

| Colour | Categories |
|---|---|
| `#8a5a00` | Breakfast, Bread, Curry |
| `#8b3a1a` | Slow Cooker, Marinades · Beef |
| `#56662a` | Seasonings, Sides |
| `#9a4a12` | Doughs, Snacks |
| `#1f3a5f` | American |
| `#a63d24` | Mexican, Italian, Marinades · Chicken |
| `#1d6663` | Asian |
| `#6b3a5e` | Middle Eastern, Desserts, Marinades · Pork |
| `#3e4f7a` | Sandwiches, Soups |
| `#46644f` | Marinades, Smoothies |

Each colour gets two tints, **mixed in JavaScript** (`src/utils/colour.js`) and
set on the element as custom properties by `categoryStyle()`:

| Property | Value | Used for |
|---|---|---|
| `--cc` | the colour | titles, kicker, divider tab, step circles, checked boxes, Cook mode |
| `--cc-soft` | 13% over `--surface` | photo slot, recipe header band, sticky bar |
| `--cc-mid` | 30% over `--surface` | card border, dashed photo frame, method line |

**Why not CSS `color-mix()`?** iOS before 16.2 does not support it. A custom
property holding an unsupported value does not fall back to an earlier
declaration; it goes invalid and the background vanishes. Precomputed hex works
everywhere.

Every category colour is tested at 4.5:1 or better:

- as text on `--surface`
- under white text
- as text on its own `--cc-soft`
- with `--ink`, `--ink-muted` and `--brand` text on its `--cc-soft`

## Focus

Focus is a 3px `--focus` (navy) outline, offset 2px, everywhere. That includes
the search box, where the prototype showed an amber ring: amber on paper is
2.1:1, below the 3:1 a focus indicator needs.
