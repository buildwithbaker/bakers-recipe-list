# Baker's Recipe List — Color System

The single reference for the app's palette. All colors are CSS custom properties
defined in [`src/styles/globals.css`](../../src/styles/globals.css) — components
reference tokens, never raw hex. Last updated 2026-06-02.

> This file replaces the old `card_color_schemes.md` reference that `globals.css`
> used to point at (the file no longer existed). The warm-cookbook card palette
> is documented in the "Recipe card / modal palette" section below.

---

## The idea

A **warm cookbook** look: a cream page, white surfaces, deep-navy chrome, and an
amber accent. Navy + amber on cream reads editorial and food-friendly rather than
the generic "SaaS blue on stark white." Dark mode keeps the same hues, just
brighter, on a deep-navy background.

Accent discipline (60-30-10): cream/white is the dominant 60%, navy chrome and
borders are the ~30%, **amber is the ~10% accent** — used for the brand mark,
the title, primary affordances, and pills. Don't spread amber across large fills
or it stops signalling "act here."

---

## Core tokens (light mode)

| Token | Value | Role |
|---|---|---|
| `--bg` | `#FEFCF5` | Page background (warm off-white, not stark `#fff`) |
| `--surface` | `#ffffff` | Cards / panels — advance off the cream page |
| `--border` | `#ede9dc` | Hairline borders |
| `--text` | `#2C2C2A` | Body text — 13.6:1 on `--bg` |
| `--text-muted` | `#6E6D66` | Secondary text — ~5.1:1 on `--bg` (AA) |
| `--navy` | `#042C53` | Brand navy (text/icons). **Flips light in dark mode** |
| `--blue` | `#0C447C` | Links / blue accents — 9.6:1 on `--bg` |
| `--blue-mid` | `#185FA5` | Secondary blue |
| `--amber` | `#EF9F27` | Primary accent |
| `--amber-dark` | `#BA7517` | Amber on light surfaces (needs more contrast) |
| `--amber-deep` | `#412402` | Text on amber pills |
| `--pill-bg` / `--pill-text` | `#EF9F27` / `#412402` | Tag pills |
| `--hover-row-bg` | `#fef8ec` | Row hover wash |

## Brand "dark fill" tokens

These exist so header chrome stays dark in **both** themes. `--navy` cannot be
used for this because dark mode redefines `--navy` to a *light* tone (for use as
text), which previously made the top-bar title ~1.4:1 contrast.

| Token | Value | Role |
|---|---|---|
| `--brand-dark` | `#042C53` | Dark fill for chrome that must stay dark in dark mode |
| `--topbar-bg` | → `--brand-dark` | Top-bar background |
| `--topbar-accent` | `#EF9F27` | Top-bar title |
| `--topbar-subtitle` | `#85B7EB` | Top-bar subtitle |

Used by: top bar, shopping-list header, and the dark hover state of the
back-to-top, view, and confirm buttons.

## Recipe card / modal palette (warm cookbook)

Scoped to the recipe modal. Slightly warmer headings, cooler blue tags.

| Token | Light | Role |
|---|---|---|
| `--card-surface` | `#FFFFFF` | Modal surface |
| `--card-border` | `#E5DFCF` | Modal borders |
| `--card-heading` | `#B5631F` | Recipe title (large/bold) |
| `--card-tag` | `#5E7196` | Tag text (AA for small text on white) |
| `--card-tag-strong` | `#5A6B8E` | Active/strong tag |
| `--card-section-label` | `#1A2B4A` | "Ingredients" / "Method" labels |
| `--card-body` | `#1C1C1C` | Method/body copy |
| `--card-muted` | `#6B7280` | De-emphasized card text |
| `--card-divider` | `#C9D3E0` | Section dividers |

## Dark mode

Toggled by `[data-theme="dark"]` on `<html>` (defaults OFF regardless of system
preference — see `useDarkMode.js`). The dark block in `globals.css` redefines the
core tokens onto a deep-navy background (`--bg: #141A22`, `--surface: #1C2430`)
and brightens amber/blue. The `--brand-dark` / `--topbar-*` tokens are **not**
overridden, so they persist as the dark navy chrome.

---

## Contrast — verified 2026-06-02 (WCAG 2.2 AA)

Targets: 4.5:1 normal text, 3:1 large/bold text and UI components.

| Pair | Ratio | Status |
|---|---|---|
| `--text` on `--bg` | 13.6:1 | AAA |
| `--text-muted` on `--bg` | ~5.1:1 | AA ✅ (was 3.51:1 — fixed) |
| Top-bar title amber on `--brand-dark` | 6.5:1 | AA ✅ (was 1.4:1 in dark mode — fixed) |
| Top-bar subtitle on `--brand-dark` | 6.7:1 | AA |
| `--blue` link on `--bg` | 9.6:1 | AAA |
| Pill text `--amber-deep` on `--amber` | 6.5:1 | AA |
| `--card-heading` on white (heading) | 4.4:1 | AA (large) |
| `--card-tag` on white | ~4.6:1 | AA ✅ (was 4.05:1 — nudged) |

## Rules when editing colors

1. **Reference tokens, never raw hex** in component CSS.
2. **Never use `--navy` as a background** — it flips light in dark mode. Use
   `--brand-dark` for dark chrome.
3. **Re-check contrast** for any text/background change against the table above
   (4.5:1 normal, 3:1 large). Pure `#000`/`#fff` pairs are banned — they read harsh.
4. **Keep amber to ~10%** of any given view.
