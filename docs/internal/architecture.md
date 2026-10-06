# Baker's Recipe List — Architecture Reference

Deep reference for how Baker's Recipe List is built, how it runs, and how to
extend it. Pairs with the root [`CLAUDE.md`](../../CLAUDE.md) (build/deploy/
do-not-touch quick rules) and [`AGENTS.md`](../../AGENTS.md) (how an AI edits
this repo, and the verification traps in it). Last rewritten 2026-09-09;
list and navigation sections updated for the 2026-09 redesign.

---

## 1. What it is

A static React (Vite) app for browsing a personal cookbook, with automatic
per-recipe macro estimates, and **one real HTML file per recipe on disk** so
shared links get a proper preview.

The site is the **Cookbook only**. The To Try and For Review collections were
removed on 2026-10-02; they are archived outside the repo and in git history at
`d58c4db`.

- **Live:** https://buildwithbaker.github.io/bakers-recipe-list/
- A Build with Baker product. MIT-licensed code; recipe content is the author's own.

The record count is **not written down here on purpose**. It lives in exactly
one place, `src/data/recordCount.js` (`EXPECTED_RECORDS`), which the integrity
tests assert against. A number restated in prose rots silently; read it from
there.

Features: one search (names, ingredients, tags) · the Cookbook narrowed by
category chips (§3a) · a recipe card *and* a full page for every recipe, on
one URL · serving scaler · USDA macro estimates · shopping list · cook log ·
pinned + recently viewed · print · cook mode (screen wake lock) · related
recipes · prerendered per-recipe pages with Open Graph metadata, `Recipe`
JSON-LD, and a no-JavaScript fallback. Light theme only, by decision; the
colours are role-named tokens so a dark block could be added later.

---

## 2. Tech stack

| Layer | Choice |
|---|---|
| Build | [Vite](https://vitejs.dev/) 8 (+ `vite-plugin-pwa`) |
| UI | [React](https://react.dev/) 19 |
| Styling | CSS Modules per component; design tokens in `src/styles/tokens.css`; base + print rules in `src/styles/globals.css` |
| Type | Young Serif (headings, self-hosted via `@fontsource/young-serif`, precached) + the system sans stack |
| Data | static `src/data/recipes.json`, bundled at build |
| Nutrition | USDA FoodData Central API |
| Hosting | GitHub Pages via Actions |
| Node | 22 (see `.nvmrc`) |

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
| `aboutPath(base, hash)` / `isAboutPath(pathname)` | the About page at `/bakers-recipe-list/about/` |

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

Only the dismissable *layer* — the shopping list — lives in
`history.state.overlays`. The sections drawer that used to share it was
removed in the 2026-09 redesign (category chips replaced it), and the About
sheet became a page at `/about/`; `entryOverlays` drops the retired `about`
token from old entries. The recipe is not in it: the recipe is in the URL.

Each history entry also carries `state.page`, a boolean saying whether the
recipe on that entry renders as a modal or as a full page, and `state.tab`,
the main view underneath (`recipes` or `pinned`). That is what makes Back,
Forward **and reload** all restore what was actually on screen.

### Tabs (2026-09 mobile navigation)

Three destinations: **Recipes** (the list), **Pinned** (`PinnedList`, every
pinned recipe as cards) and **Shopping** (opens the shopping list layer, and
shows as the current tab while it is on top). `TabBar` is a fixed bottom bar
below 720px and sits in the masthead above it; App renders it twice and CSS
shows one, because the sticky masthead is its own stacking context and a bar
inside it could not rise above the shopping list's scrim. Anything that
should hide the phone bar (the recipe modal, the Filters sheet) marks
itself `data-hides-tabbar`; `globals.css` also zeroes `--tabbar-space` then.

A tab switch pushes an entry, only from the tap. A tap on the current tab
scrolls to the top (this replaced the back-to-top button). A tab tapped over
the shopping list *replaces* the list's entry, so Back from the new tab goes to
where the list was opened. The decisions and the entry shape live in
`src/utils/navHistory.js`, which takes `history` as an argument and is tested
against a fake history in `navHistory.test.js`.

The masthead is two siblings: a sticky row (wordmark, header tabs, the (i),
a real link to `/about/`) and a foot (tagline, the search-box overlap, the double rule) that
scrolls away. `--masthead-stuck` is the row's height; `RecipePage` pins its
bar there and `scroll-padding-top` keeps anchor jumps clear of it.

### The About page

`/about/` is the one route besides the list and the recipes. Going there is a
push, so Back returns to whatever was on screen (list, tab, card or page); a
direct load is a real prerendered file. `AboutPage` renders the copy in
`aboutCopy.js`, which `prerender.mjs` imports for the head and `<noscript>`, so
the words live in one place. The AI photo caption on every AI recipe photo
links to `about/#photos`. On About the masthead (i) is marked current and
closes the page by stepping Back; every way in leaves an in-site entry behind
(an in-app push, or the list entry put behind a direct load).

### Modal vs page: one route, two frames

| arrived by | renders |
|---|---|
| clicking from the list | `RecipeModal` over the list |
| landing on `/r/<slug>/` directly | `RecipePage`, a full page |
| "Open full page" in the modal header | same URL, `replaceState` to `page: true` |

Both render **`RecipeView`**, which owns the entire recipe body plus Share,
Print and cook mode. There is deliberately no second renderer: a card and its
page drift apart the moment they are two components.

Both frames give `RecipeView` a sticky bar (at most 56px, so the modal's Close
is always on screen at 390px) and put their own controls in it: the page's
"All recipes", the modal's "Open full page" and Close. A photo shows beside the
title only when one exists; there is no placeholder hero. The modal returns
focus to the card that opened it when it closes.

---

## 3a. The browsing model — categories

`src/data/catalog.js` lays a reader-facing model over the storage model in
`sections.js`: each section maps to one **category** (`SECTION_CATEGORY`,
hand-written). `catalog.test.js` fails if a section is added without a
category, or a category is declared that no section uses.

The list shows the Cookbook (`LISTED_ROWS`); category chips narrow it and the
Filters sheet (pinned only, made, top-24 tags) narrows further. **Every chip's
count is counted from the rows that chip would show**, after the filters, so a
number never promises rows the list does not have. A search
(`src/utils/search.js`) ignores the chips and the filters and returns one flat
list of matching cards.

**Coming-soon placeholders are never listed.** Each category header says
"N more planned" instead (`PLANNED_BY_CATEGORY`). They still have a URL and
still open in the app if someone has one; they just are not browsable.

**Category colour.** Each category owns one colour (`CATEGORIES[].color`).
Its 13% and 30% tints are mixed in JavaScript (`src/utils/colour.js`) and
passed as `--cc`, `--cc-soft` and `--cc-mid` via `categoryStyle()`, not with
CSS `color-mix()`: iOS before 16.2 lacks it, and a custom property holding an
unsupported value goes invalid instead of falling back. `contrast.test.js`
measures every category colour against the surface, under white text and on
its own tint.

**Pinned and Recently viewed** shelves show on the unfiltered list only.

The category is not persisted. An old `#sec-<SECTION>` link from the retired
drawer lands on the matching category; one for a removed To Try or For Review
section (`#sec-TO-TRY-*`, `#sec-FOR-REVIEW-*`) matches nothing and lands on the
whole list.

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
- Its **`removed`** map (`{ id: { to, note, versions? } }`) is the one way a
  record leaves the catalog. The id keeps its `ids` entry; `to` names a live
  successor (never another removed id) or is `null`. A removed id, the
  `<id>::vN` keys it had if it displayed as versions, and its legacy name
  resolve to the successor; a removed id also keeps its `renamed` exemption; `rekeyRemovedState`
  in `stateMigration.js` moves saved state onto it at load; prerender writes a
  redirect page for its old URLs. Rule and steps: `AGENTS.md`, "Removing a recipe".

`src/data/recipeIndex.js` builds the lookups once at module load:

```
rawRecipes          the stored catalog, file order
displayRecipes      every row the app renders: one per record
displayedBySection  display rows grouped by section key
recipesById         id → row
recipesByName       name → row; the alias layer, seeded in ascending precedence:
                      legacy manifest names, then current names (which win)
resolveRecipe(key)  THE resolution entry point: id first, then a removed id (-> its
                      successor, or null), then any name alias
```

Everything that turns a stored string back into a recipe goes through
`resolveRecipe`. Do not re-derive lookups in a component.

### Versioned rows (removed records only)

Until 2026-10-02, For Review records with "Version N" markers were expanded
into one row per version with a derived id `parent::v1`, `parent::v2`. That
collection was removed and nothing expands any more: every record is one row,
and `recipes.integrity.test.js` fails on a "Version N" marker. The `::vN` keys
survive only for the removed records, whose `versions` count keeps their old
links and saved state resolving.

### The `::` ↔ `--` slug transform

`src/utils/recipeSlug.js` is the one place this lives. It still matters for the
redirect pages of removed versioned records (`/r/parent--v2/`).

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
`Recipe` JSON-LD block injected into the head. For every recipe with a photo
in `src/photos/`, `dist/og/<id>.jpg` (§13). Plus `dist/sitemap.xml`,
`dist/about/index.html` (the About page, also in the sitemap),
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
the two can never disagree. Do not fork the logic. The app shows them as
recipe cards under **"More like this"**, not "More <category>": the ranking
crosses sections on purpose, so each card names its own category.

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
3. **Blanks never appear.** A "coming soon" placeholder has nothing to show.
   (Until 2026-10-02 version rows of one record were "siblings" that skipped
   scoring; the For Review collection that produced them is gone, and so is
   that rule.)
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

## 8. The label a shared surface shows

`publicSectionLabel(sectionKey)` in `src/data/sections.js` gives a section's
label, or `null` for a key that is not a section — callers then render no
subtitle at all rather than a placeholder that says nothing.

Everything on a **shared** surface goes through it:

- the related-recipe card subtitle in `RelatedRecipes`
- `recipeCategory` in the prerendered `Recipe` JSON-LD, omitted when null

**Never render `recipe.category` to a reader.** Use the section's label. Its
only legitimate runtime use is the `sameCategory` tie-break in
`relatedRecipes.js`, which compares without displaying. (This rule was written
when For Review records carried the staging value "For Review" in `category`;
that collection was removed on 2026-10-02, and the rule stays.)

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
never on first visit, never over an open overlay **or an open recipe** (card or
full page: the recipe is in the path, so `swUpdate.js` checks it separately and
waits until you close it), at most once per session.

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
   key it writes is `brl_`-prefixed (`brl_cook_log`, `brl_made_v1`,
   `brl_pinned_v1`, `brl_recently_viewed`, `brl_shopping_list`,
   `brl_state_version`; session: `brl_ingredient_ticks`, `brl_sw_reloaded`;
   cache: `brl-photos`). `brl_dark_mode`, `brl_hide_blanks` and
   `brl_collapsed_sections` are no longer read. Keep it that way; never
   introduce an unprefixed key.
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
  build-photos.mjs          prebuild/predev: src/photos/ -> card + header WebP sizes
  prerender.mjs             per-recipe HTML, the About page, og:image JPEGs, noscript, sitemap, robots, 404

src/
  main.jsx                  bootstrap: state migration, SW update hook, render
  App.jsx                   ★ routing (path ⇄ recipe), overlay history, modal-vs-page

  components/
    RecipeView/             ★ THE recipe body — used by BOTH frames
    RecipeModal/            modal chrome only: backdrop, dialog, close, open-full-page
    RecipePage/             full-page frame: back link, card, related recipes
    RelatedRecipes/         "More like this": cross-section related cards, real <a href> links
    RecipeList/             the browser: category chips, filters, groups
    RecipeCard/ SearchResults/ Highlight/ Icon/
    FiltersSheet/ Shelves/
    Masthead/ TabBar/ PinnedList/ AboutPage/ AiBadge/
    SearchBar/ ShoppingList/ MacroCard/ UsdaKeyNotice/ ErrorBoundary/

  hooks/
    useWakeLock.js          cook mode (React wrapper over utils/screenLock.js)
    useMacroEstimate.js     ★ USDA pipeline for one recipe (useReducer machine)
    useShoppingList / useCookLog / useCookHistory / usePinnedRecipes /
    useRecentlyViewed / useFocusTrap / useIngredientTicks

  data/
    recipes.json            ★ the content
    recipe.schema.json      ★ the contract — read before editing a recipe
    recipes.ids.json        frozen id manifest + rename allowlist
    recordCount.js          EXPECTED_RECORDS — the ONE hand-authored count
    recipeIndex.js          displayRecipes, lookups, resolveRecipe
    sections.js             SECTIONS + publicSectionLabel
    catalog.js              categories over sections, list rows and counts (§3a)
    stateMigration.js       one-time localStorage name→id migration
    nutritionOverrides.json per-ingredient USDA overrides

  utils/
    recipeRoute.js          path ⇄ recipe key
    recipeSlug.js           id ⇄ path segment (:: ⇄ --)
    recipePhoto.js          the ONE place a recipe's photo URL is resolved
    photoFiles.js           rules for the src/photos/ drop folder (+ photoCredits.json guard)
    photoCredit.js          AI-photo credits (data/photoCredits.json); also imported by prerender.mjs
    photoCaption.js         the caption under an AI photo (Cookbook adds the tested sentence)
    navHistory.js           tab + layer history rules, injectable history (tested)
    colour.js               tint mixing + WCAG contrast for the category palette
    search.js               one search across the Cookbook
    relatedRecipes.js       the related ranking (also imported by prerender.mjs)
    screenLock.js           wake-lock lifecycle, injectable nav/doc so it is testable
    autoTags.js             derived tags from section + ingredients
    parseIngredient / convertToGrams / fractions / scaleIngredient /
    estimateServings / estimateMacros / fetchNutrition / swUpdate

  photos/                   drop folder for recipe photos (generated/ is gitignored)
  styles/tokens.css         design tokens (colour roles, type, space) — light only
  styles/globals.css        base element styles, print rules
  styles/contrast.test.js   WCAG AA check of every token text/background pair
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

`MacroCard` sits in a closed **"Estimated nutrition"** `<details>` after the
method, and the disclosure is omitted when there is nothing to show. The
estimate still runs when the recipe opens; only its presentation is folded.

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
disabled. `toggle()` resolves to `'on'`, `'refused'` or `'off'`, and the view
says which in a toast (`cookModeMessage` in `screenLock.js`): "Cook mode on:
the screen will stay awake", or "This browser will not keep the screen awake"
when the browser refuses.

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

**Photos come from a drop folder, not from the record.** Put
`src/photos/<id>.jpg` in the repo and build. No `recipes.json` edit.

- `scripts/build-photos.mjs` (prebuild and predev, uses `sharp`) writes a
  240×240 card thumbnail and an 800px-wide header photo, as WebP, into
  `src/photos/generated/` (gitignored). It fails the build on a file that
  matches no recipe id, is over 2 MB, is not a photo, or duplicates another.
  Originals never ship; the 2 MB limit bounds repo history, not the site.
  The rules are `src/utils/photoFiles.js` (unit-tested). File names are matched
  against the real ids, never turned into new ones.
- `src/utils/recipePhoto.js` finds the outputs with `import.meta.glob` and is
  the one place any component asks for a photo. Vite fingerprints them.
- `scripts/prerender.mjs` makes `dist/og/<id>.jpg`, 1200×630 JPEG (preview
  crawlers are unreliable with WebP), for `og:image` and the JSON-LD `image`.
  No photo: `recipe-placeholder.png`.
- Offline: thumbnails are precached; header photos are cached on first view
  (Workbox runtime cache `brl-photos`).

The workflow is [`adding-a-photo.md`](./adding-a-photo.md).

Five **optional** fields exist on a recipe: `image`, `description`, `prepTime`,
`cookTime`, `recipeYield`. All are validated only when present; every existing
record stays valid without them. `recipe.schema.json` is the contract.
`image` (a path under `public/`) is the older photo mechanism and still works
as a fallback, but a photo in `src/photos/` wins. No record uses it today.

`prepTime` and `cookTime` must be authored **together**: Google pairs them and
a lone value reads as missing data.

---

## 14. How to add or change things

**Add a recipe** → follow `src/data/recipe.schema.json` field by field, add to
`recipes.json`, append an id-manifest entry, bump `EXPECTED_RECORDS`, run
`npm run validate:recipes`. Full rules in [`AGENTS.md`](../../AGENTS.md).

**Add a section** → `{ key, label, id }` in `sections.js`, add its category in
`catalog.js` `SECTION_CATEGORY`, and
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
- **Cookbook only.** There are no To Try or For Review sections (removed
  2026-10-02; archived outside the repo and in git history at `d58c4db`). Do not
  re-add one: a recipe that is not ready is an `is_blank: true` placeholder.

---

## 16. Build, test, deploy

```bash
npm install
npm run dev              # Vite dev server (serves SOURCE — no prerendered files)
npm run build            # validate → photos → vite build → prerender
npm run photos           # just make the photo sizes (also runs before dev)
npm run preview          # serve dist/ — the only way to see prerendered output locally
npm run lint             # must pass before commit
npm test                 # vitest, node env, pure utils + data integrity
```

`prebuild` runs `validate-recipes.mjs` then `build-photos.mjs`, so a schema
violation, a missing id manifest entry, a broken photo path, an oversized photo
or a photo named after no recipe fails the build and CI, and can never reach
the live site.

**CI** (`.github/workflows/ci.yml`) runs lint, test and build
as the required `verify` check. It runs on every PR whatever its base, so a
stacked PR is checked too, and on pushes to `main`.

**Deploy** (`.github/workflows/deploy.yml`) builds and publishes `dist/` to
GitHub Pages on merge to `main`, injecting `USDA_API_KEY` as
`VITE_USDA_API_KEY`.

`main` is protected: branch, PR, green checks, squash merge. Never push to it.
