# Baker's Recipe List — Architecture Reference

Deep reference for how Baker's Recipe List is built, how it runs, and how to extend it. Pairs with the root [`CLAUDE.md`](../../CLAUDE.md) (build/deploy/do-not-touch quick rules). Last updated 2026-05-29.

---

## 1. What it is

A fast, single-page **React** app for browsing a personal recipe collection (232 recipes) with automatic per-recipe macro/nutrition estimates.

- **Live:** https://buildwithbaker.github.io/bakers-recipe-list/
- A Build with Baker product. MIT-licensed code; recipe content is the author's own.

Features: sectioned recipe browser with sticky TOC nav and Recipes/For-Review tabs · search + auto-tagging with tag filters · recipe detail modal with ingredients/method and a **serving scaler** · **macro & nutrition estimates** via USDA FoodData Central lookups (with per-ingredient overrides and a `DEMO_KEY` fallback) · shopping list · cook log/history · pinned recipes · recently viewed · dark mode · print support · back-to-top. State that should survive reloads is persisted in `localStorage`.

---

## 2. Tech stack

| Layer | Choice | Version |
|---|---|---|
| Build | [Vite](https://vitejs.dev/) | 5 |
| UI | [React](https://react.dev/) | 18 |
| Styling | **CSS Modules** (`*.module.css` per component) + `src/styles/globals.css` | — |
| Data | Static `recipes.json` (bundled at build) | 232 recipes |
| Nutrition | USDA FoodData Central API | — |
| Hosting | GitHub Pages via Actions workflow | — |
| Node | 20 (see `.nvmrc`) | |

`vite.config.js` sets `base: '/bakers-recipe-list/'` to match the Pages project path, and uses `@vitejs/plugin-react`.

---

## 3. Directory & file map

```
bakers-recipe-list/
  index.html                  app entry
  vite.config.js              Vite + React plugin, base '/bakers-recipe-list/'
  package.json                scripts: dev / build / preview

  src/
    main.jsx                  React bootstrap (mounts <App/>)
    App.jsx                   ★ top-level app — wraps AppInner in CookHistoryProvider;
                              owns selected recipe, search, menus, URL ?recipe / ?q sync

    components/               UI components — each in its own folder with a .module.css
      TopBar/                 header + dark-mode toggle + menu
      TOCNav/                 sticky table-of-contents nav
      SearchBar/              search input (ref-forwarded)
      RecipeList/             list of sections
      SectionBlock/           one section (header + rows)
      RecipeRow/              single recipe row
      RecipeModal/            recipe detail modal (ingredients, method, serving scaler, MacroCard)
      MacroCard/              renders the macro/nutrition estimate
      ShoppingList/           shopping list panel
      RecentlyViewed/         recently-viewed strip
      BackToTop/              scroll-to-top button
      UsdaKeyNotice/          "rate limit reached / set a key" notice
      ErrorBoundary/          React error boundary

    hooks/                    custom hooks (localStorage-backed where stateful)
      useDarkMode.js
      useShoppingList.js
      useCookLog.js / useCookHistory.js
      usePinnedRecipes.js
      useRecentlyViewed.js
      useMacroEstimate.js     ★ full USDA estimation pipeline for one recipe (useReducer state machine)
      useFocusTrap.js         modal focus trapping
      useFlashOnHash.js       flash-highlight a recipe when navigated to by hash

    context/
      CookHistoryContext.jsx  cook-history provider/consumer

    data/
      recipes.json            ★ 232 recipes (the content)
      recipeIndex.js          recipesByName Map (name → recipe), built once at module load
      sections.js             SECTIONS array — ordered { key, label, id, review? }
      nutritionOverrides.json per-ingredient nutrient overrides for USDA misses
      expandVersions.js       recipe variant expansion

    utils/                    pure functions (the estimation engine)
      parseIngredient.js      parse "1 lb ground pork" → { qty, unit, name }
      convertToGrams.js       unit → grams conversion
      fractions.js            unicode/ascii fraction parsing (¼ etc.)
      scaleIngredient.js      scaleIngredientText() — serving scaler math
      estimateServings.js     estimate servings from ingredients
      estimateMacros.js       combine per-ingredient nutrition into recipe macros
      fetchNutrition.js       USDA FoodData Central fetch + sessionStorage cache + overrides
      autoTags.js             derive #tags from recipe content

    styles/globals.css        global styles

  .github/workflows/
    ci.yml                    build check
    deploy.yml                GitHub Pages deploy (build dist/, inject USDA secret)

  dist/                       GENERATED — never edit by hand
  docs/internal/
    architecture.md           this file
```

---

## 4. Data model

A recipe (in `recipes.json`):

```json
{
  "name": "Spicy Pork Patties",
  "section": "BREAKFAST",          // matches a SECTIONS key
  "category": "Breakfast",
  "source": "Original",
  "tags": ["#pork", "#breakfast"],
  "ingredients": [ { "type": "item", "text": "1 lb ground pork" }, ... ],
  "instructions": [ { "step": "Mix Ingredients", "detail": "..." }, ... ]
}
```

- **`recipe.name` is the canonical key.** `data/recipeIndex.js` builds `recipesByName` (a `Map`) once at module load — import that instead of re-filtering `recipes.json` in every component. The selected recipe is also reflected in the URL as `?recipe=<name>` (and search as `?q=`), synced via `history.replaceState` in `App.jsx`.
- **`data/sections.js`** is the ordered section list: `{ key, label, id, review? }`. `key` matches the recipe `section` field; `id` is the DOM anchor (`sec-BREAKFAST`); `review: true` flips the header to the green "for review" color and routes it to the For-Review tab.

---

## 5. The nutrition pipeline (the most involved subsystem)

Flow for one recipe's macros:

```
RecipeModal → useMacroEstimate(recipe, servingEstimate)
                 │  (useReducer state machine: unavailable → loading → done/rate-limited/error)
                 ▼
            estimateMacros(ingredients)
                 │  for each ingredient:
                 │    parseIngredient → fractions → convertToGrams
                 │    fetchNutrition(name)  → per-100g { calories, protein, fat, carbs, fiber }
                 │    scale by grams, sum
                 ▼
            MacroCard renders { status, macros, matchedCount, totalCount }
```

Key details:

- **`useMacroEstimate`** is a `useReducer` machine with statuses `unavailable | loading | done | rate-limited | error`. Sections `SEASONINGS` and `DOUGHS` are excluded (`EXCLUDED_SECTIONS`); blank recipes, no serving estimate, or zero matched ingredients also resolve to `unavailable`. It handles async cancellation so a fast modal switch doesn't apply stale results.
- **`fetchNutrition.js`** hits USDA FoodData Central, caches per-ingredient results in `sessionStorage`, and consults `nutritionOverrides.json` first for known misses. Nutrient IDs: `1008` Energy(kcal), `1003` Protein, `1004` Fat, `1005` Carbs, `1079` Fiber. When energy is missing it **falls back to Atwater** (`protein×4 + fat×9 + carbs×4`). A miss/error returns `null` and the ingredient is skipped (that's why `matchedCount`/`totalCount` are surfaced).
- **USDA API key:** read from `import.meta.env.VITE_USDA_API_KEY` at build time, falling back to `DEMO_KEY` (~30 lookups before 429). The key IS visible in the deployed bundle — USDA keys are free, rate-limited per IP, and can't be domain-restricted, so leakage just means re-registering. Don't reuse it for anything sensitive.

---

## 6. How to add / change things

**Add a recipe** → add an object to `data/recipes.json` with a `section` matching an existing `SECTIONS` key (or add a new section to `data/sections.js` first). `recipesByName` and the section browser pick it up automatically. Tags can be explicit (`tags: [...]`) or derived by `autoTags.js`.

**Add a section** → add `{ key, label, id, review? }` to `SECTIONS` in `data/sections.js`. Keep `key` matching the recipe `section` value and `id` as a unique `sec-...` anchor.

**Add a component** → new folder under `src/components/<Name>/` with `<Name>.jsx` + `<Name>.module.css`. Import CSS Modules as `styles` and reference `styles.className`.

**Add persistent UI state** → a hook under `src/hooks/` following the existing `localStorage`-backed pattern (e.g. `useShoppingList`, `usePinnedRecipes`).

**Add/adjust nutrition logic** → the `utils/` pure functions. Fix a bad USDA match by adding an entry to `data/nutritionOverrides.json` rather than special-casing code.

**File-placement rule (root is locked):** new CSS → `src/styles/`; new component → `src/components/`; new util → `src/utils/`; build script → `scripts/`; planning doc → `docs/internal/`.

---

## 7. Build, run, deploy

```bash
npm install
npm run dev        # Vite dev server at localhost:5173
npm run build      # production build → dist/
npm run preview    # serve the production build
npm run lint       # must pass before commit (if a lint script exists)
```

**Deploy:** pushes to `main` auto-deploy via `.github/workflows/deploy.yml` — it runs `npm ci`, `npm run build`, and publishes `dist/` to GitHub Pages. The workflow injects the repo secret `USDA_API_KEY` as `VITE_USDA_API_KEY` at build time (optional — the app degrades to the rate-limited `DEMO_KEY` notice without it). Vite `base` is `/bakers-recipe-list/` to match the Pages project path.

**Local USDA key:** create `.env.local` with `VITE_USDA_API_KEY=your_key` (gitignored) to hit the API at full rate during dev.

---

## 8. Conventions & gotchas / do-not-touch

- **CSS Modules per component** — styles co-locate with their `.jsx` and never live at root. Global styles only in `src/styles/globals.css`.
- **Import `recipesByName` from `data/recipeIndex.js`** — don't re-filter `recipes.json` in components.
- **`vite.config.js` `base` must stay `/bakers-recipe-list/`** — it matches the Pages project path; changing it breaks all asset URLs in production.
- **`dist/` is generated** — never hand-edit.
- **The USDA key in the bundle is intentional and low-risk** — but never put a sensitive/un-rate-limited key here.
- **`ErrorBoundary` wraps the app** — uncaught render errors degrade gracefully rather than white-screening.
```
