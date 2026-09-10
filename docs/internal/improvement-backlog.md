# Improvement Backlog

Prioritized improvement ideas for Baker's Recipe List. P1 = high value / low
risk, P2 = worthwhile, P3 = nice-to-have.

Originally an audit from 2026-06-02. Reconciled against the code on 2026-09-09,
after the routing / prerender / related-recipes run — several P2 items had
shipped and were still listed as open.

---

## Shipped since this list was written

Closed on 2026-09-09 because the work is on `main` and live. See
[`architecture.md`](./architecture.md) for how each one actually works.

- [x] **PWA install support.** `vite-plugin-pwa` generates
  `manifest.webmanifest` at build (name, `theme_color` `#042C53`, standalone,
  three icons including a maskable 512), plus `apple-touch-icon.png`. The site
  installs to a phone home screen. *(Delivered by the plugin rather than a
  hand-written manifest, which is why the original wording no longer matches.)*
- [x] **Social share meta (Open Graph / Twitter card).** `scripts/prerender.mjs`
  writes per-recipe `og:*` and `twitter:*` tags with absolute URLs into one real
  HTML file per recipe. This is the item the whole routing/prerender run existed
  to close — a query string could never have carried it, because link-preview
  crawlers do not run JavaScript.
- [x] **Schema.org Recipe structured data (JSON-LD).** Per-recipe `Recipe`
  JSON-LD, not the site-level `WebSite` fallback this item hedged toward. The
  build step the item said it would need is `prerender.mjs`.
- [x] **Apple-touch-icon + PNG favicon fallback.** `apple-touch-icon.png` is
  referenced from `index.html`; `pwa-192x192.png`, `pwa-512x512.png` and
  `maskable-512x512.png` ship alongside the SVG favicon.

### Earlier, from the 2026-06-02 session

- [~] **Logo — skipped.** A whisk mark was prototyped then removed. `theme-color`
  and `description` meta were kept.
- [x] **Dark-mode header contrast bug** — `--brand-dark` / `--topbar-*` tokens
  that stay dark in both themes.
- [x] **`--text-muted` failed WCAG AA** (3.51:1) — darkened to ~5.1:1.
- [x] **Color system documented** — `docs/internal/color-system.md`.
- [x] **Blank-recipe worklist** — `docs/internal/blank-recipes-worklist.md`.

---

## P1 — high value, low risk

- [ ] **Fill the blank recipes.** Still the biggest content gap by a wide margin:
  most records are `is_blank: true` placeholders. Worklist:
  [`blank-recipes-worklist.md`](./blank-recipes-worklist.md) — note that file's
  own count is older than the catalog, so derive the current number from
  `recipes.json` rather than trusting either document. Blanks get no prerendered
  page and no link preview, so filling one is also what publishes it.
  *(Owner: Adam.)*
- [ ] **README screenshot.** README still carries an `_(add a screenshot)_`
  placeholder. Capture light + dark and drop into `docs/screenshot.png`.
- [ ] **Confirm cook mode on a real phone.** Shipped deliberately unverified on
  hardware: Wake Lock needs a secure context, so it cannot be exercised on a LAN
  dev server over plain HTTP, and Pages has no preview environment. The
  revoke-then-return logic is unit-tested in `screenLock.test.js`; what is
  missing is one person, one phone, one screen-lock-and-wake against the live
  site. *(Owner: Adam.)*
- [ ] **`aria-expanded` on the menu + list toggles.** `TopBar`'s buttons open the
  TOC drawer and the shopping-list panel but still expose no open/closed state to
  screen readers. `menuOpen` / `listOpen` already exist in `App.jsx`; pass them
  down. Verified still missing on 2026-09-09.

## P2 — worthwhile

- [ ] **Related recipes by ingredient overlap.** The parked next iteration, and
  the real answer to the ranking problem below. Two recipes sharing gochujang and
  fish sauce are genuinely related; two sharing `#marinade` are not. The signal
  already exists in the data via `parseIngredient.js` and needs no hand-tagging.
  Its own PR — see `relatedRecipes.js` and §7 of `architecture.md`.
- [ ] **The tag vocabulary cannot carry similarity on its own.** Roughly half the
  tags sit on exactly one recipe, so they can never be *shared*; the effective
  matching vocabulary is about 31 tags, dominated by `#marinade`, `#for-review`
  and `#chicken`. A scoring function cannot separate candidates whose shared tag
  sets are identical, which is every chicken marinade. Cross-section exclusion
  plus a distinctiveness floor made the feature worth shipping, but the ceiling
  is the data. Either enrich the tags or go to ingredient overlap above — do not
  expect a cleverer scorer to fix it.
- [ ] **`autoTags.js` keyword false positives.** Lasagna picks up `#spicy`, and a
  potato side picks up `#beef`. Harmless in search, visible in related-recipe
  results where they produce picks no cook would make. Wants per-line context
  rules like the existing broth/stock exclusion.
- [ ] **`ci.yml` only triggers on PRs based on `main`.** Both `push` and
  `pull_request` are filtered to `branches: [main]`, so a stacked PR — one
  feature branch targeting another — gets **no `verify` check at all**, and
  "checks green" becomes unsatisfiable without retargeting it. This bit during
  the PR 60/61 stack. Either add the feature-branch pattern or accept that
  stacked PRs must target `main` and carry their parent's diff until the parent
  merges.
- [ ] **`FOR REVIEW` sections → a dedicated `status` field.** Known tech debt,
  now with a second cost attached: because staging is encoded in `section` *and*
  `category`, two separate surfaces leaked the label to visitors before
  `publicSectionLabel` was introduced. A real `status` field removes the whole
  class of leak. Delimiters are also inconsistent (`FOR REVIEW ---` vs
  `FOR REVIEW -`) and the soup buckets are duplicated.

## P3 — nice-to-have

- [ ] **Component/UI tests.** The suite covers pure utils and data integrity in a
  node environment. A couple of render tests for `RecipeView` in both frames, and
  for search/tab filtering in `RecipeList`, would need `jsdom`. Note `useWakeLock`
  is already covered indirectly: its lifecycle lives in `utils/screenLock.js`
  precisely so it could be tested without a DOM.
- [ ] **Bundle growth plan.** `recipes.json` is bundled eagerly and has roughly
  doubled since this item was written. Still acceptable, but if the catalog keeps
  growing consider lazy-loading the data or splitting it by section. The
  prerendered pages add about 1.2 MB to `dist/`, a quarter of which is the
  `<noscript>` fallback.
- [ ] **Prerender output size.** One file per published recipe, each carrying the
  full shell head. If that ever becomes a problem, the `<noscript>` block is the
  compressible part — but read §6 of `architecture.md` before touching it.

---

## Notes / non-issues (verified healthy)

- Architecture is clean: CSS Modules per component, semantic color tokens, pure
  util functions, `ErrorBoundary` wrapping, `localStorage`-backed hooks keyed by
  **id**, and a build-time `validate-recipes` guard that also enforces the frozen
  id manifest and the 500 KB photo ceiling.
- Routing is path-based (`/r/<slug>/`) with `?recipe=` kept as a permanent legacy
  alias. The old note here described `?recipe=` as the routing model; that has
  been wrong since the routing PR.
- The USDA `DEMO_KEY` in the bundle is intentional and low-risk (documented).
- The `<noscript>` block appearing in `document.body.innerText` with JavaScript
  enabled is known, understood and **accepted** — see §6 of `architecture.md`
  before "fixing" it into something worse.
