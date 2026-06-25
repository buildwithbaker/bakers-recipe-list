# Improvement Backlog

Prioritized improvement ideas for Baker's Recipe List, from an audit on
2026-06-02. P1 = high value / low risk, P2 = worthwhile, P3 = nice-to-have.
Items checked off were done in the 2026-06-02 session.

---

## Done this session (2026-06-02)

- [~] **Logo — skipped.** A whisk mark was prototyped then removed per decision
  to skip a logo for now. `theme-color` + `description` meta were kept in
  `index.html`. (A logo can be revisited later — see P2 below.)
- [x] **Dark-mode header contrast bug.** Top bar (and shopping-list header) used
  `var(--navy)`, which flips light in dark mode → amber title was ~1.4:1. Added
  `--brand-dark` / `--topbar-*` tokens that stay dark in both themes.
- [x] **`--text-muted` failed WCAG AA** (3.51:1). Darkened to ~5.1:1. Also nudged
  `--card-tag` to clear AA for small text.
- [x] **Color system documented.** New `docs/internal/color-system.md` replaces
  the dead `card_color_schemes.md` reference in `globals.css`.
- [x] **Blank-recipe worklist.** `docs/internal/blank-recipes-worklist.md` (87 items).

---

## P1 — high value, low risk

- [ ] **Fill the 87 blank recipes.** Biggest content gap. Worklist:
  `docs/internal/blank-recipes-worklist.md`. (Owner: Adam.)
- [ ] **README screenshot.** README still has a `_(add a screenshot)_` placeholder.
  Capture the running app (light + dark) and drop into `docs/screenshot.png`.
- [ ] **`aria-expanded` on the menu + list toggles.** `TopBar` buttons open the
  TOC drawer and shopping-list panel but don't expose open/closed state to screen
  readers. Pass `menuOpen` / `listOpen` down and set `aria-expanded`.

## P2 — worthwhile

- [ ] **PWA install support.** Add a `public/manifest.webmanifest` (name, theme
  `#042C53`, icons) + `apple-touch-icon` PNG so the site installs to a phone home
  screen — natural fit for a kitchen-counter recipe app. (Needs a 180px + 512px PNG
  rendered from the whisk mark.) Ref: `github-pages-recipe-site-workflow` module 06.
- [ ] **Social share meta (Open Graph / Twitter card).** When the live URL is
  shared, there's no preview image/title. Add OG tags + a share image
  (`logo-lockup.svg` exported to PNG). Ref: `social-share-card-design` KB module.
- [ ] **Schema.org Recipe structured data (JSON-LD).** Recipe sites get rich
  results from per-recipe `Recipe` JSON-LD. Hard in a client-only SPA, but a
  site-level `WebSite` block is cheap, and per-recipe is feasible if you ever add
  a build step. Ref: `github-pages-recipe-site-workflow` module 05.
- [ ] **Apple-touch-icon + PNG favicon fallback.** SVG favicon covers modern
  browsers; older Safari/iOS want a PNG. Produce from the whisk master.

## P3 — nice-to-have

- [ ] **Component/UI tests.** Suite currently covers pure utils + data integrity
  only (`vitest`, node env). Add a couple of render tests for `RecipeModal` and
  the search/tab filtering in `RecipeList`. Would need `jsdom`.
- [ ] **Bundle growth plan.** `recipes.json` is ~362 KB and bundled eagerly. Fine
  at 232 recipes; if the catalog grows large, consider lazy-loading the data or
  splitting by section.
- [ ] **Integrity test count.** `recipes.integrity.test.js` pins
  `EXPECTED_RECORDS = 232`. Filling blanks won't change it, but remember to bump
  it intentionally when *adding* recipes (it's there to catch surprise add/drops).

---

## Notes / non-issues (verified healthy)

- Architecture is clean: CSS Modules per component, semantic color tokens, pure
  util functions, `ErrorBoundary` wrapping, `localStorage`-backed hooks, URL sync
  for `?recipe`/`?q`, build-time `validate-recipes` guard. No structural concerns.
- USDA `DEMO_KEY` in the bundle is intentional and low-risk (documented).
