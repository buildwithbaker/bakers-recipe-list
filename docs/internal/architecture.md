# Baker's Recipe List — Architecture Reference

Deep reference for how Baker's Recipe List is built, how it runs, and how to
extend it. Pairs with the root [`CLAUDE.md`](../../CLAUDE.md) (build/deploy/
do-not-touch quick rules) and [`AGENTS.md`](../../AGENTS.md) (how an AI edits
this repo, and the verification traps in it). Last rewritten 2026-09-09.

---

## 1. What it is

A static React (Vite) app for browsing a personal recipe collection, with
automatic per-recipe macro estimates, and **one real HTML file per recipe on
disk** so shared links get a proper preview.

- **Live:** https://buildwithbaker.github.io/bakers-recipe-list/
- A Build with Baker product. MIT-licensed code; recipe content is the author's own.

The record count is **not written down here on purpose**. It lives in exactly
one place, `src/data/recordCount.js` (`EXPECTED_RECORDS`), which the integrity
tests assert against. A number restated in prose rots silently; read it from
there.

Features: sectioned browser with a sticky TOC and Recipes / For Review / To Try
tabs, plus a Peanut Butter tab built from a *tag* rather than from sections (so
nothing in the drawer routes to it, and `TAB_PEANUT` is deliberately absent from
`TAB_ORDER`) · search + auto-tagging with tag filters · a recipe card *and* a
full page for every recipe, on one URL · serving scaler · USDA macro estimates · shopping
list · cook log · pinned + recently viewed · dark mode · print · cook mode
(screen wake lock) · related recipes · prerendered per-recipe pages with Open
Graph metadata, `Recipe` JSON-LD, and a no-JavaScript fallback.

---

## 2. Tech stack

| Layer | Choice |
|---|---|
| Build | [Vite](https://vitejs.dev/) 5 (+ `vite-plugin-pwa`) |
| UI | [React](https://react.dev/) 18 |
| Styling | CSS Modules per component + `src/styles/globals.css` |
| Data | static `src/data/recipes.json`, bundled at build |
| Nutrition | USDA FoodData Central API |
| Hosting | GitHub Pages via Actions |
| Node | 20 (see `.nvmrc`) |

`vite.config.js` sets `base: '/bakers-recipe-list/'` to match the Pages project
path. **It must stay that** — every asset URL and the whole routing model derive
from it.

---

## 3. Routing — the path is the source of truth

**`/bakers-recipe-list/r/<slug>/` names exactly one recipe, and nothing else.**
This is the single most important change from the app's original design and the
thing most likely to surprise you if you last read the old docs.

`src/utils/recipeRoute.js` owns it:

| export | does |
|---|---|
| `BASE_PATH` | `import.meta.env.BASE_URL` — `/bakers-recipe-list/` in dev *and* prod |
| `recipePath(id)` | id → `/bakers-recipe-list/r/<slug>/` |
| `recipeKeyFromPath(pathname)` | pathname → recipe key, or `''` when it is not a recipe route |

`App.jsx` reads the path on first paint and on every `popstate`, resolves it
through `resolveRecipe`, and renders. Opening a recipe from the list is a real
`pushState` to its path, so Back pops the recipe for free.

### `?recipe=` is legacy and works forever

Old shared links carry `?recipe=<key>`. On load, `App.jsx` resolves that key and
`replaceState`s to the equivalent `/r/<slug>/`, preserving `?q=`. A key that
resolves to nothing leaves the visitor on the list with the URL cleaned, rather
than showing them an error. **Do not remove this path.** Links live in other
people's messages forever.

### The overlay model, and what is NOT in it

Only the dismissable *layers* — the sections drawer and the shopping list — live
in `history.state.overlays`. The recipe is not among them: it is in the URL.

Each history entry also carries `state.page`, a boolean saying whether the
recipe on that entry renders as a modal or as a full page. That is what makes
Back, Forward **and reload** all restore what was actually on screen.

### Modal vs page: one route, two frames

| arrived by | renders |
|---|---|
| clicking from the list | `RecipeModal` over the list |
| landing on `/r/<slug>/` directly | `RecipePage`, a full page |
| "Open full page" in the modal header | same URL, `replaceState` to `page: true` |

Both render **`RecipeView`**, which owns the entire recipe body plus Share,
Print and cook mode. There is deliberately no second renderer: a card and its
page drift apart the moment they are two components.

`RecipePage` passes `showPlaceholderHero`, so an unphotographed recipe still
gets a hero and the page never opens on a bare title line. The modal does not —
a placeholder card over a list the visitor is already looking at is noise.

---

## 4. Identity: `id` is canonical, `name` is an alias

**`recipe.name` is NOT the canonical key.** Older docs said it was; that is
wrong and was the source of real bugs.

- **`id`** is frozen and permanent. It was a slug of the name *at assignment
  time*, and is never recomputed. It keys state (`madeSet`, `pinnedSet`, cook
  log, shopping list, recently viewed), `?recipe=` links, and the URL path.
- **`name`** is an alias layer. Names stay resolvable forever so no stored entry
  or shared link ever dies, but they are not identity.
- **`src/data/recipes.ids.json`** is the frozen `{id: nameAtAssignment}`
  manifest plus a `renamed` allowlist. `scripts/validate-recipes.mjs` enforces
  that an id never disappears, every record is listed, and a rename is declared
  rather than hidden by editing the manifest.

`src/data/recipeIndex.js` builds the lookups once at module load:

```
rawRecipes          the stored catalog, file order
displayRecipes      every row the app renders — review records expanded to one row per version
displayedBySection  display rows grouped by section key
recipesById         id → row, over DISPLAY rows
recipesByName       name → row; the alias layer, seeded in ascending precedence:
                      legacy manifest names, then raw names, then display names (which win)
resolveRecipe(key)  THE resolution entry point: id first, then any name alias
```

Everything that turns a stored string back into a recipe goes through
`resolveRecipe`. Do not re-derive lookups in a component.

### Versioned rows

A record in a `review: true` section whose ingredients/instructions contain
`type: "section"` markers is expanded by `expandVersions.js` into one row per
version, with a **derived** child id `parent::v1`, `parent::v2`. Those ids are
never persisted — `n` is 1-based from marker order *within that record alone*,
so an unrelated record changing cannot renumber siblings.

### The `::` ↔ `--` slug transform

`src/utils/recipeSlug.js` is the one place this lives.

A colon is legal in a URL but **illegal in a Windows filename**, so
`mkdir dist/r/parent::v1` fails locally while succeeding in CI — a build that
breaks only on one machine. The path segment therefore uses `--`:

```
idToSlug('chili::v2')   →  'chili--v2'
slugToId('chili--v2')   →  'chili::v2'
```

Safe because the authored id pattern is `^[a-z0-9-]+$` and no record contains a
double dash, so `--` can only ever have come from a `::`. That invariant is
asserted in `recipes.integrity.test.js` ("no authored id containing a double
dash"). **Do not relax it.**

`recipeSlug.js` and `recipeRoute.js` are also the only two files allowed to say
"slug" — see §11.

---

## 5. The prerender pipeline

`npm run build` is `vite build && node scripts/prerender.mjs`.

### Why it exists

Link-preview crawlers — iMessage, Slack, Facebook, Discord, X — **do not execute
JavaScript**. They fetch the URL, parse the bytes the server returned, and stop.
A single-page app serving one `index.html` therefore gives every shared recipe
the *same* generic preview no matter what React writes into the head at runtime.
The only fix on static hosting is to have the right HTML already on disk before
anyone clicks.

### What it writes

For every **non-blank** display row, `dist/r/<slug>/index.html`: the built shell
with its site-level `<title>` and description stripped, and per-recipe
`<title>`, canonical link, description, Open Graph and Twitter tags, and a
`Recipe` JSON-LD block injected into the head. Plus `dist/sitemap.xml`,
`dist/robots.txt`, and `dist/404.html` (the shell, so an unknown path lands on
the app; Pages returns a real 404 for it, which is correct).

Blank "coming soon" records get no file — publishing them would be thin content
and a dead link for anyone they were shared with. They still open in the app.

**Only the HEAD is prerendered.** The body is the `<noscript>` fallback plus an
empty `<div id="root">`. This is not a server-rendering setup and should not be
mistaken for one.

Absolute URLs in `og:image` and `og:url` are mandatory — nothing obliges a
crawler to resolve a relative one, and that is the most common preview failure.

### `vite.config.js` is deliberately untouched by this

VitePWA builds its precache manifest during `vite build`, which runs **before**
prerender, so `dist/r/` can never enter it. That is intentional; see §9.

---

## 6. The `<noscript>` fallback

Head metadata serves crawlers that read meta tags, and Google renders
JavaScript. Neither helps a visitor with JavaScript off, or a crawler that does
not render — they got a blank page.

So each prerendered file also carries the recipe as plain semantic HTML inside
`<noscript>`, injected **before** `<div id="root">`: an `h1`, the description,
the ingredients, the numbered method, and the related recipes as **real
anchors** to their `/r/<slug>/` URLs.

The related list is computed by importing the *same* `src/utils/relatedRecipes.js`
the app uses. **Never reimplement it in the script.** Two copies of that ranking
will drift, and the fallback agreeing with what the app shows is the whole point.

The anchors matter as much as the recipe text: without them the prerendered
pages are orphans with no path between them. With them, the same fallback that
serves a person with JavaScript off gives a non-rendering crawler a graph to
walk.

Cost: about 0.32 MB across the prerendered set, roughly a quarter of that HTML.

### The `innerText` caveat — accepted, do not "fix" it

With scripting enabled the HTML parser leaves the `<noscript>` contents as a
**single raw text node with no element children**. It generates no boxes
(`offsetHeight` 0, no client rects), contributes nothing to the accessibility
tree, and is not inside `[data-print-modal]` so print hides it too.

**But `document.body.innerText` does include that text**, because Chrome's
`innerText` walks the node. This is known, understood and accepted:

- What is exposed is the same recipe content already on the page. Nothing
  private.
- Every alternative is worse. A JS-hidden `<div>` flashes before hydration and
  *does* sit in the accessibility tree — trading a theoretical exposure for a
  real regression.

`<noscript>` is the correct mechanism. If you are reading this because you just
found the `innerText` behaviour and want to fix it: don't.

---

## 7. Related recipes

`src/utils/relatedRecipes.js`, rendered by `RelatedRecipes` on the **full page
only** — in a modal, the whole list is already sitting behind the card.
`scripts/prerender.mjs` imports the same module for the `<noscript>` links, so
the two can never disagree. Do not fork the logic.

Scored on **ingredient overlap**, not tags. Each `type: "item"` line is
lowercased, its parentheticals dropped, non-alpha stripped, and split on
whitespace; tokens shorter than `TOKEN_MIN_LENGTH` (3) or present in
`STOPWORDS` are discarded. A candidate scores the sum of `log(N / df)` over the
tokens it shares, so `gochujang` counts for far more than `garlic`. Tokenised
once per candidate list and cached by the array itself.

The rules:

1. **Rarity weighting**, as above. The principle is inherited from the tag
   version; the vocabulary is what changed.
2. **A minimum score.** `MIN_SCORE` (10) — see below, it is not independent of
   the stoplist.
3. **Siblings sit outside all of it.** Two rows expanded from the same record
   are related *by construction*, not by inference, so the scoring does not
   judge them: they skip the floor entirely and sort ahead of every inferred
   match, in version order. They still count against the cap. The one rule they
   do not escape is the blank exclusion — a "coming soon" version has nothing
   to show either.
4. **No section rule of any kind.** Deliberate, and measured both ways. The old
   tag version *excluded* a recipe's own section to break the section-listing
   effect; ingredients do not have that failure, and the exclusion would discard
   the single best result in the catalog — Beef Stew and Pork Stew are the same
   dish with a different protein, and share a section. A same-section *bonus*
   was tested at +2 and +4: it pushed same-section results from 33% to 49% and
   64% while leaving the lists no better, and at +4 promoted a section-mate
   above a cross-protein match. Neither direction earns its place.

Capped at `RELATED_LIMIT` (6). Renders **nothing at all** when nothing clears
the floor — an unrelated recipe presented as related is worse than an absent
heading.

### Why not tags

Worth knowing, because "just use the tags" is the obvious first idea and it was
tried. There are ~68 tags; roughly half sit on exactly one recipe and so can
never be *shared*, leaving an effective vocabulary of about 31, dominated by
`#marinade`, `#for-review` and `#chicken`. A scoring function can only re-rank
candidates whose shared sets *differ* — and every chicken marinade carries the
identical four tags, so file order silently picked the results. Ingredients give
several hundred tokens over the same catalog and describe the food rather than
the drawer it lives in.

Tags are still right for what they do: the tag chips, and search. They are not a
similarity signal and no amount of scoring makes them one.

### STOPWORDS is load-bearing, and it drifts silently

**This is the maintenance hazard in this feature.** The stoplist will need to
grow as recipes are added, and the failure mode makes no noise: nothing throws,
no test goes red, the lists just get quietly slightly wrong.

**The failure signature**, so it is recognisable: two recipes that share nothing
a cook would call related, scoring *high*, on a token that is rare in the
catalog and says nothing about the dish. Rare and contentless is the worst
combination there is here, because the rarity weighting hands exactly those
tokens the top score.

**The worked example**, found while tuning this: `diamond`, `crystal` and
`morton` — salt brands. Each appeared on two recipes, so each scored at the very
top of the range, and Pepperoncini Beef's best match was
`crystal(4.7) diamond(4.7) morton(4.0) reserved(4.0)` — nine points for two
recipes agreeing about which salt to buy, plus a prep verb from "reserved pasta
water". Note that raising the threshold would have made this **worse**: the junk
outscored the genuine matches.

**The rule.** A token naming a producer, a package, a grade or a preparation
goes in `STOPWORDS`. Then **re-sweep `MIN_SCORE`** — the tokeniser, the stoplist
and the threshold move together and are not independent choices. The stoplist
is grouped by the failure each block prevents; keep it that way, or it becomes
a junk drawer nobody can review.

**`MIN_SCORE` is the second line of defence.** The most a single shared token
can be worth is `log(216/2) = 4.68`, since a token on one recipe can never be
shared. So at 10, one rare token cannot clear the floor alone — and neither can
two (9.36). It takes three. That is deliberate: a single leaked brand word
cannot by itself surface an unrelated pair, which buys time to notice a stoplist
gap before it does damage. It also means lowering `MIN_SCORE` weakens the
stoplist, and vice versa.

The threshold was chosen by sweeping 0–15 and **reading the resulting lists**,
not by reading the aggregate metrics, which barely move below 8. Ten is the
first value at which spice-rack matches disappear — candidates sharing only
`chili`, `cumin`, `paprika`, `powder`, `garlic` — and the last before genuine
cross-protein matches start dropping.

---

## 8. Owner-facing vs visitor-facing labels

Recipes awaiting review are staged by overloading **two** fields: `section`
becomes a `FOR REVIEW …` key and `category` becomes the literal string
`"For Review"`. Both are internal workflow state.

`publicSectionLabel(sectionKey)` in `src/data/sections.js` is the gate. It
returns a real section's label, and **`null` for a staging bucket** — callers
then render no subtitle at all rather than a placeholder that says nothing.

Everything on a **shared** surface goes through it:

- the related-recipe card subtitle in `RelatedRecipes`
- `recipeCategory` in the prerendered `Recipe` JSON-LD, which is omitted
  entirely for a staged record

The list's own section headers and its "For Review" tab keep their labels **on
purpose** — that is Adam's staging view of his own collection.

**Never render `recipe.category` to a reader.** It is a staging-capable field.
Its only legitimate runtime use is the `sameCategory` tie-break in
`relatedRecipes.js`, which compares without displaying. `#for-review` is
likewise stripped from JSON-LD keywords by `INTERNAL_TAGS` in `prerender.mjs`.

---

## 9. The service worker, and a trap it sets

`vite-plugin-pwa` in `registerType: 'autoUpdate'` mode, with
`navigateFallback: '/bakers-recipe-list/index.html'`.

In production that is correct: a repeat visitor with the worker active gets the
cached shell for `/r/<slug>/`, and the app routes from `location.pathname`
anyway. Crawlers and JS-off visitors never have a worker, so they get the real
prerendered file.

**The trap:** once the worker is active, a browser asking for a prerendered page
receives the shell, so any check of prerendered output silently measures the
cache instead. Before verifying anything about `dist/r/`, unregister every
registration, delete every cache, and confirm — the shell's own title
(`Baker's Recipe List` rather than the recipe's) is the cheapest tell. This is
written up as a standing rule in `AGENTS.md`.

`src/utils/swUpdate.js` reloads the page once when a new worker takes control —
never on first visit, never over an open overlay, at most once per session.

### Every Build with Baker project shares one origin

`buildwithbaker.github.io` hosts **all** of them — this app at
`/bakers-recipe-list/`, Wren at `/wren/`, and others. GitHub Pages gives a user
or org site exactly one origin, and paths do not create origins.

What that does and does not separate:

| | scoped by path? |
|---|---|
| Service worker **control** — which pages a worker intercepts | **Yes.** A worker registered at `/wren/sw.js` cannot control `/bakers-recipe-list/` pages. |
| `navigator.serviceWorker.getRegistrations()` | **No.** Returns every registration on the origin. |
| **Cache Storage** (`caches.keys()`) | **No.** Origin-wide. |
| **`localStorage`** / `sessionStorage` / IndexedDB | **No.** Origin-wide, no path scoping at all. |

Concretely, and verified: clearing caches from a recipe-list page,
`caches.keys()` returned **`wren-shell-v2`** alongside this app's workbox
precache. Wren's cache, reachable from this app's page context.

**Nothing is broken today.** The precaches are separate keys, worker control is
path-scoped, and this app's `localStorage` keys are distinctive. But two
consequences follow and are worth knowing before they bite:

1. **A storage-key collision between two projects is possible**, and would be
   silent. `localStorage` has no path namespace — a generic key like `theme` or
   `settings` written by two apps is one key. This app is already safe: every
   key it writes is `brl_`-prefixed (`brl_cook_log`, `brl_dark_mode`,
   `brl_made_v1`, `brl_pinned_v1`, `brl_recently_viewed`, `brl_shopping_list`,
   `brl_state_version`). Keep it that way; never introduce an unprefixed key.
2. **Clearing storage for one project clears it for the others.** The standard
   verification dance above — `getRegistrations()` then unregister everything,
   `caches.keys()` then delete everything — unregisters *Wren's* worker and
   deletes *Wren's* cache too. Harmless during development against `localhost`,
   which is a different origin; not harmless run against the live site.

What actually separates them is a **different origin**: a custom domain per
project, or moving a project to its own Cloudflare Pages host. Path prefixes
never will. *(No hosting change is proposed here — this is recorded so the
constraint is known.)*

---

## 10. Directory map

```
index.html                  app entry (shell)
vite.config.js              Vite + React + PWA, base '/bakers-recipe-list/'
scripts/
  validate-recipes.mjs      prebuild schema + manifest + photo guard
  prerender.mjs             per-recipe HTML, noscript block, sitemap, robots, 404

src/
  main.jsx                  bootstrap: state migration, SW update hook, render
  App.jsx                   ★ routing (path ⇄ recipe), overlay history, modal-vs-page

  components/
    RecipeView/             ★ THE recipe body — used by BOTH frames
    RecipeModal/            modal chrome only: backdrop, dialog, close, open-full-page
    RecipePage/             full-page frame: back link, card, placeholder hero
    RelatedRecipes/         cross-section related list, real <a href> links
    RecipeList/ SectionBlock/ RecipeRow/    the browser
    TopBar/ TOCNav/ SearchBar/ ShoppingList/ RecentlyViewed/ BackToTop/
    MacroCard/ UsdaKeyNotice/ Footer/ ErrorBoundary/

  hooks/
    useWakeLock.js          cook mode (React wrapper over utils/screenLock.js)
    useMacroEstimate.js     ★ USDA pipeline for one recipe (useReducer machine)
    useShoppingList / useCookLog / useCookHistory / usePinnedRecipes /
    useRecentlyViewed / useDarkMode / useFocusTrap / useFlashOnHash

  data/
    recipes.json            ★ the content
    recipe.schema.json      ★ the contract — read before editing a recipe
    recipes.ids.json        frozen id manifest + rename allowlist
    recordCount.js          EXPECTED_RECORDS — the ONE hand-authored count
    recipeIndex.js          displayRecipes, lookups, resolveRecipe
    sections.js             SECTIONS + publicSectionLabel
    expandVersions.js       version expansion → parent::vN rows
    navSections.js          tab routing for sections
    stateMigration.js       one-time localStorage name→id migration
    nutritionOverrides.json per-ingredient USDA overrides

  utils/
    recipeRoute.js          path ⇄ recipe key
    recipeSlug.js           id ⇄ path segment (:: ⇄ --)
    relatedRecipes.js       the related ranking (also imported by prerender.mjs)
    screenLock.js           wake-lock lifecycle, injectable nav/doc so it is testable
    autoTags.js             derived tags from section + ingredients
    parseIngredient / convertToGrams / fractions / scaleIngredient /
    estimateServings / estimateMacros / fetchNutrition / swUpdate

  styles/globals.css        tokens, dark mode, print rules
```

---

## 11. The nutrition pipeline

```
RecipeView → useMacroEstimate(recipe, servingEstimate)
               │  useReducer machine: unavailable | loading | done | rate-limited | error
               ▼
          estimateMacros(ingredients)
               │  per ingredient: parseIngredient → fractions → convertToGrams
               │                  fetchNutrition(name) → per-100g nutrients
               │                  scale by grams, sum
               ▼
          MacroCard renders { status, macros, matchedCount, totalCount }
```

- `SEASONINGS` and `DOUGHS` are excluded; so are blanks, recipes with no serving
  estimate, and recipes where nothing matched.
- `fetchNutrition.js` caches per ingredient in `sessionStorage` and consults
  `nutritionOverrides.json` first. Nutrient ids: `1008` kcal, `1003` protein,
  `1004` fat, `1005` carbs, `1079` fibre. Missing energy falls back to Atwater.
- The USDA key is read from `VITE_USDA_API_KEY` at build time, falling back to
  `DEMO_KEY` (~30 lookups before 429). **The key is visible in the bundle by
  design** — USDA keys are free, per-IP rate limited and cannot be domain
  restricted. Never put a sensitive key here.
- Fix a bad match by adding to `nutritionOverrides.json`, not by special-casing
  code.

---

## 12. Cook mode

`useWakeLock()` → `{ supported, active, toggle }`, rendered in `RecipeView` so
both frames get it. Where the API is missing the control is **absent**, not
disabled.

The hard part is not taking the lock. The browser **silently drops it** whenever
the document stops being visible, and never restores it — so a naive
implementation works until the first time the phone locks, which is the exact
moment cook mode exists for. The user's *intent* is therefore tracked separately
from the live sentinel, and the lock is re-acquired on `visibilitychange` for as
long as that intent stands.

The lifecycle lives in `src/utils/screenLock.js`, which takes its `navigator`
and `document` as arguments precisely so the sleep/wake path can be tested
without a phone — see `screenLock.test.js`.

> **Unverified on physical hardware.** Wake Lock needs a secure context, so it
> cannot be exercised on a LAN dev server over plain HTTP, and GitHub Pages has
> no preview environment — the criterion could not be met before deploying. The
> logic is unit-tested including revoke-then-return; a real phone confirmation
> against the live site is still outstanding.

---

## 13. Photos and the optional schema fields

Five **optional** fields exist on a recipe: `image`, `description`, `prepTime`,
`cookTime`, `recipeYield`. All are validated only when present; every existing
record stays valid without them. `recipe.schema.json` is the contract.

`prepTime` and `cookTime` must be authored **together** — Google pairs them and
a lone value reads as missing data. A referenced photo must exist and must be
**under 500 KB**; the build fails otherwise, with the fix in the error text.
That ceiling is not fussiness: untreated phone photos are 3–5 MB, git keeps
every version forever, and a few hundred would push the published site toward
the Pages 1 GB limit.

The workflow for adding one is [`adding-a-photo.md`](./adding-a-photo.md) — shoot,
resize, name after the **id**, add the `image` line, rebuild. Not restated here.

---

## 14. How to add or change things

**Add a recipe** → follow `src/data/recipe.schema.json` field by field, add to
`recipes.json`, append an id-manifest entry, bump `EXPECTED_RECORDS`, run
`npm run validate:recipes`. Full rules in [`AGENTS.md`](../../AGENTS.md).

**Add a section** → `{ key, label, id, review?, toTry? }` in `sections.js`, and
mirror the key into the schema's `section.enum` — the validator fails if they
drift.

**Add a component** → `src/components/<Name>/` with `<Name>.jsx` +
`<Name>.module.css`.

**Change the recipe body** → `RecipeView`. Not the modal, not the page.

**Change the related ranking** → `relatedRecipes.js` only. `prerender.mjs`
imports it; do not fork the logic.

**Add persistent UI state** → a hook under `src/hooks/`, `localStorage`-backed,
keyed by **id**.

**File placement (root is locked)** → new CSS `src/styles/`, component
`src/components/`, util `src/utils/`, build script `scripts/`, planning doc
`docs/internal/`.

---

## 15. Conventions, gotchas, do-not-touch

- **`dist/` is generated.** Never hand-edit.
- **`base` must stay `/bakers-recipe-list/`.** Assets and routing both derive
  from it.
- **`recipe.name` is not identity.** Key by `id`.
- **Nothing may derive an id from a name at runtime.** The slug function exists
  only in the one-time assignment script, outside `src/`. `recipes.integrity.test.js`
  enforces this two ways: shape patterns over raw source (catching a slugifier
  whatever it is called), and a blanket `\bslug` word ban over
  *comment-stripped* source with a two-file allowlist (`recipeSlug.js`,
  `recipeRoute.js`). Comments may discuss slugs; code may not mint one.
- **Never render `recipe.category`.** See §8.
- **`data-print-modal` must stay** on both the modal card and the page article —
  `globals.css` keys its print rules off that attribute.
- **The USDA key in the bundle is intentional** and low-risk.
- **Verifying prerendered output requires killing the service worker first.**
  See §9 and `AGENTS.md`.
- **`FOR REVIEW` sections are known tech debt.** They overload `section` to
  encode a category *and* a review status, with inconsistent delimiters. Valid
  for now, slated for a dedicated `status` field. Do not add new recipes under
  one unless you are deliberately staging.

---

## 16. Build, test, deploy

```bash
npm install
npm run dev              # Vite dev server (serves SOURCE — no prerendered files)
npm run build            # validate → vite build → prerender
npm run preview          # serve dist/ — the only way to see prerendered output locally
npm run lint             # must pass before commit
npm test                 # vitest, node env, pure utils + data integrity
```

`prebuild` runs `validate-recipes.mjs`, so a schema violation, a missing id
manifest entry, a broken photo path or an oversized photo fails the build and
CI, and can never reach the live site.

**CI** (`.github/workflows/ci.yml`) runs lint, test and build on PRs into `main`
as the required `verify` check. Note it triggers **only** on PRs whose base is
`main`, so a stacked PR gets no check until it is retargeted — see the backlog.

**Deploy** (`.github/workflows/deploy.yml`) builds and publishes `dist/` to
GitHub Pages on merge to `main`, injecting `USDA_API_KEY` as
`VITE_USDA_API_KEY`.

`main` is protected: branch, PR, green checks, squash merge. Never push to it.
