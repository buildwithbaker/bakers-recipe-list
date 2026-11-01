# Improvement Backlog

Prioritized improvement ideas for Baker's Recipe List. P1 = high value / low
risk, P2 = worthwhile, P3 = nice-to-have.

Originally an audit from 2026-06-02. Reconciled against the code on 2026-09-09,
after the routing / prerender / related-recipes run — several P2 items had
shipped and were still listed as open. Reconciled again on 2026-10-31 against
`main` e77a5c1, after the October features run, and the open owner-Adam items
from the closed handoff scopes were moved here.

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

### 2026-10-24 to 2026-10-31

- [x] **#141** 61 AI placeholder photos for the blank recipes, dormant until
  each recipe is filled in (the dormancy rule is #140).
- [x] **#143** Schema: `added`, `waitTime`, `waitLabel`; `description`
  required; Cookbook baseline frozen.
- [x] **#145** Cuisine and dish-type auto-tags keyed on category, not section.
- [x] **#146** The `#new` auto-tag and a NEW pill on the card, for 14 days from
  `added`. Proven by a test with an injected clock at merge. First live on
  2026-10-31, when #160 put three recipes into the Cookbook with `added`; their
  pills run until 2026-11-14.
- [x] **#147** Option A recipe card, led by cook time, with the wait shown
  separately. Difficulty dropped.
- [x] **#148** Search: Name / Ingredient / All toggle, Chef's Drafts in the
  results with their pill, `matchedLine` on each card.
- [x] **#149** Tag pass against the approved criteria, plus wait times.
  `#weeknight` removed; `#high-protein` is manual at 30 g per serving.
- [x] **#150** The USDA key notice shows only in the Vite dev server.
- [x] **#151** AI photos for four Chef's Drafts.
- [x] **Photo coverage checked 2026-10-31:** 145 of 146 records have a photo
  and a credit, with no credit lacking a file and no file lacking a credit.
  `spinach-pepper-cheddar-egg-muffins` keeps the placeholder on purpose.
- [x] **#159** One dependency update for eslint 10.13.0, jsdom 30.1.3 (with
  @asamuzakjp/dom-selector 10.0.5), react and react-dom 19.3.1, vite 8.3.5,
  undici 8.12.3 and fast-uri 3.1.9. Replaces Dependabot #152-#158, closed
  unmerged. Same approach as #137: Dependabot's lockfile entries merged by
  hand, no re-resolve.
- [x] **#160** Cajun Blackened Chicken Cutlets (American), Smoky Rice and Red
  Beans and Quick Pickled Red Onions (Sides) graduated from Chef's Drafts with
  `added` 2026-10-31; the onions switched to distilled white vinegar. `/drafts/`
  gained a Planned section listing every placeholder by name, grouped by
  category, as plain cards (a blank has no page). Verified live after deploy.

### 2026-10-23 repo cleanup

- [x] **#137** One dependency update for vite 8.3.4, vitest 5.0.3, eslint
  10.12.0, jsdom 30.1.2, @vitejs/plugin-react 6.1.2 and source-map-js 1.2.2.
  Replaces Dependabot #106, #112, #113, #114, #116 and #136, closed unmerged.
  A fresh `npm install` of plugin-react 6.1.2 fails ERESOLVE on an optional
  peer chain that ends at `@babel/core` 8, so the PR kept Dependabot's minimal
  lockfile edits rather than re-resolving.
- [x] **#138** vite-plugin-pwa 2.0.0 (replaces #115). The major version only
  raises the Node floor to 20.19. `sw.js`, `registerSW.js`, the manifest and
  the Workbox runtime built byte-identical to 1.3.0, so `swUpdate.js` is
  unaffected.
- [x] **Stale branches, deleted.** Confirmed gone from GitHub on 2026-10-31
  (`git ls-remote --heads` lists only `main` and the Dependabot branches). Every
  one was merged under another SHA (squash) or made moot by #94. Restore any of them with
  `git push origin <sha>:refs/heads/<name>`:

  | Branch | SHA | Why it can go |
  |---|---|---|
  | `recipes/add-two-chicken-dinners` | `4672971` | both recipes are filled on `main` |
  | `slow-cooker-recipes-complete` | `0a7d671` | all four recipes are filled on `main` |
  | `chore/docs-and-line-endings` | `47242ab` | `CLAUDE.md` carries the branching section |
  | `fix/audit-followups` | `3038b20` | June audit fixes, superseded |
  | `recipe-standard` | `0fa9d55` | schema, validator and `AGENTS.md` are on `main` |
  | `feat/peanut-tab-tag-driven` | `5acd3b9` | moot since #94 (Cookbook only) |
  | `feat/to-try-restructure` | `b4bc5da` | moot since #94 |
  | `feat/to-try-restructure-460` | `a74a855` | moot since #94 |
  | `feat/to-try-section` | `01af04e` | moot since #94 |

### 2026-09-29 to 2026-10-03

- [x] **#86** AI label follow-up: no card badge, a faint badge on the recipe
  photo, and the Cookbook "tested" sentence in the caption.
- [x] **#87** Mobile navigation: Recipes / Pinned / Shopping tab bar, Pinned
  view, sticky header, About sheet.
- [x] **#88, #89, #90** Dependabot bumps for vite, vitest and sharp, closed
  unmerged: shipped together in #93.
- [x] **#91** Pulled Pork v2 (3–4 lb boneless, sear, trimmed salt, defat and
  reduce).
- [x] **#92** Mobile UI follow-ups: Filters chip first, touch baseline with a
  pressed state on every control, sticky category headers.
- [x] **#93** One dependency update for eslint, globals, vite, vitest and sharp
  (patch/minor only).
- [x] **#94** Cookbook only: the To Try and For Review collections removed (622
  records, all declared in `removed`), archived outside the repo and in git
  history at `d58c4db`.

### Earlier, from the 2026-06-02 session

- [~] **Logo — skipped.** A whisk mark was prototyped then removed. `theme-color`
  and `description` meta were kept.
- [x] **Dark-mode header contrast bug** — `--brand-dark` / `--topbar-*` tokens
  that stay dark in both themes.
- [x] **`--text-muted` failed WCAG AA** (3.51:1) — darkened to ~5.1:1.
- [x] **Color system documented** — `docs/internal/color-system.md`.
- [x] **Blank-recipe worklist** — retired; the blanks are the `is_blank: true` records in `src/data/recipes.json`.

---

## P1 — high value, low risk

- [ ] **Fill the blank recipes.** Still the biggest content gap by a wide margin:
  most records are `is_blank: true` placeholders. Worklist:
  the `is_blank: true` records in [`recipes.json`](../../src/data/recipes.json);
  count them there for the current number. Blanks get no prerendered
  page and no link preview, so filling one is also what publishes it.
  *(Owner: Adam.)*
- [x] **README screenshot.** *Done in #98:* `docs/screenshot.png` shows the
  list and the Lasagna page at 390x844, light only.
- [ ] **Confirm cook mode on a real phone.** Shipped deliberately unverified on
  hardware: Wake Lock needs a secure context, so it cannot be exercised on a LAN
  dev server over plain HTTP, and Pages has no preview environment. The
  revoke-then-return logic is unit-tested in `screenLock.test.js`; what is
  missing is one person, one phone, one screen-lock-and-wake against the live
  site. *(Owner: Adam.)*
- [ ] **The other phone checks on the live site.** Clear the service worker
  first (`AGENTS.md`). Three are outstanding, all *(Owner: Adam)*:
  - A chip and a recipe card show a pressed state when tapped on an iPhone
    (#92). Asked 2026-10-02, never answered.
  - The four photos from #151 look right (three of those recipes are in the
    Cookbook since #160). The pages were checked and serve their images;
    nobody has looked at them on a phone.
  - The NEW pill (#146) on the three #160 recipes. Check before 2026-11-14,
    when it expires.
- [x] **`aria-expanded` on the menu + list toggles.** *Superseded by the
  2026-09 redesign.* The TOC drawer and `TopBar` are gone. The shopping list
  and the Filters sheet are now modal dialogs: focus moves in, is trapped, and
  returns to the opener on close. A modal that takes focus announces itself,
  so the opener needs no `aria-expanded`. The Filters button carries
  `aria-haspopup="dialog"`.

## P2 — worthwhile

- [x] **Related recipes by ingredient overlap.** *Shipped.* Replaced tag
  matching entirely: several hundred ingredient tokens instead of ~31 shareable
  tags, coverage 84.7% → 94.9%, top-10 concentration roughly halved, and it
  finds pairs tags structurally could not (Beef Stew → Pork Stew; a chicken
  marinade → the pork and beef versions of itself). See §7 of
  `architecture.md`.
- [~] **The tag vocabulary cannot carry similarity — resolved by going around
  it.** Roughly half the tags sit on exactly one recipe and can never be
  *shared*, leaving ~31 usable, and no scoring function can separate candidates
  whose shared sets are identical. Rather than enrich the tags, the related
  ranking moved to ingredient overlap. **The tags themselves are fine and need
  no work** — they serve the tag chips and search, which is what they are for.
  Recorded here only so the next person does not re-derive the finding.
- [ ] **`STOPWORDS` in `relatedRecipes.js` drifts silently.** The new maintenance
  hazard, and the one to actually watch. A brand or product word in a new recipe
  is rare, so the rarity weighting scores it at the top, and it can pair two
  unrelated recipes with nothing failing. Salt brands (`diamond`, `crystal`,
  `morton`) were the first instance. `MIN_SCORE` blunts it — three maximally-rare
  tokens are needed to clear the floor — but does not remove it. §7 of
  `architecture.md` has the failure signature and the rule.
- [ ] **`autoTags.js` keyword false positives — mostly closed.** The measured
  count across the whole catalog is three, two of which are correct. The one real
  miss, `#beef` on "pork shoulder steaks", is **fixed**: the `steak` needle now
  skips any line naming another animal, per line, so Meatloaf still gets both
  `#beef` and `#pork`. What remains is cosmetic and no longer affects related
  recipes, which no longer read tags at all. Left open only in case the same
  shape appears with another cut word.
- [x] **`ci.yml` only triggers on PRs based on `main`.** *Done in #95:*
  `pull_request` now runs `verify` on every PR whatever its base, proven on a
  stacked draft PR. Original note: both `push` and
  `pull_request` are filtered to `branches: [main]`, so a stacked PR — one
  feature branch targeting another — gets **no `verify` check at all**, and
  "checks green" becomes unsatisfiable without retargeting it. This bit during
  the PR 60/61 stack. Either add the feature-branch pattern or accept that
  stacked PRs must target `main` and carry their parent's diff until the parent
  merges.
- [x] **`FOR REVIEW` sections → a dedicated `status` field.** *Moot since #94:*
  the For Review collection and its sections are gone, so there is nothing
  left to refactor. Original note: known tech debt,
  now with a second cost attached: because staging is encoded in `section` *and*
  `category`, two separate surfaces leaked the label to visitors before
  `publicSectionLabel` was introduced. A real `status` field removes the whole
  class of leak. Delimiters are also inconsistent (`FOR REVIEW ---` vs
  `FOR REVIEW -`) and the soup buckets are duplicated.

## P3 — nice-to-have

- [x] **Component/UI tests.** *Done in #97:* jsdom + Testing Library tests for
  `RecipeView` and `RecipeList` (`*.dom.test.jsx`, opted in per file; the rest
  of the suite stays in node). Original note: the suite covers pure utils and data integrity in a
  node environment. A couple of render tests for `RecipeView` in both frames, and
  for search/tab filtering in `RecipeList`, would need `jsdom`. Note `useWakeLock`
  is already covered indirectly: its lifecycle lives in `utils/screenLock.js`
  precisely so it could be tested without a DOM.
- [x] **Bundle growth plan — not needed now.** As of 2026-10-03 (#94),
  `recipes.json` holds 123 records and is 205 KB, down from 659 KB at
  `d58c4db`; the main JS bundle fell from 867 KB to about 600 KB. Revisit only
  if the Cookbook grows several-fold. Original note: `recipes.json` is bundled
  eagerly; if the catalog keeps growing consider lazy-loading the data or
  splitting it by section.
- [ ] **Reroll the weakest placeholder photos (optional).** From the #141 picks:
  parmesan-baked-carrots, chopped-salami, breakfast-muffins, fried-rice and
  the thin-cut stir-fry rows. Each is dormant until its recipe is written, so
  rerolling can wait until then. *(Owner: Adam.)*
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
