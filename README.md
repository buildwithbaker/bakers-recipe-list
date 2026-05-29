# Baker's Recipe List

A fast, single-page React app for browsing a personal recipe collection with
automatic per-recipe macro/nutrition estimates.

> **Screenshot:** _(UI app — add a screenshot or GIF here, e.g. `docs/screenshot.png`, once captured.)_

**Live:** https://buildwithbaker.github.io/bakers-recipe-list/

## Features

- **Sectioned recipe browser** with a sticky table-of-contents nav and
  **Recipes / For Review** tabs.
- **Search** plus **auto-tagging** with quick tag filtering.
- **Recipe detail modal** with ingredients, method, and a **serving scaler**.
- **Macro & nutrition estimates** per recipe via USDA FoodData Central lookups
  (with per-ingredient overrides and a graceful `DEMO_KEY` fallback).
- **Ingredient parsing**, **unit-to-grams conversion**, and serving/macro estimation.
- **Shopping list** and **cook log / history** with notes.
- **Pinned recipes**, **recently viewed**, **dark mode**, print support, and
  back-to-top — persisted in `localStorage`.

## Tech stack

- [Vite](https://vitejs.dev/) 5 + [React](https://react.dev/) 18
- CSS Modules for component styling
- Deployed as a static site to GitHub Pages

## Local setup

Requires Node 20 (see `.nvmrc`).

```bash
git clone https://github.com/buildwithbaker/bakers-recipe-list.git
cd bakers-recipe-list
npm install
npm run dev        # Vite dev server at http://localhost:5173
npm run build      # production build to dist/
```

Nutrition lookups work without configuration (they fall back to `DEMO_KEY`). To
avoid rate limits, set `VITE_USDA_API_KEY` in a local `.env` (gitignored) or as
the `USDA_API_KEY` repo secret used by the deploy workflow.

## Project structure

```
index.html              app entry
vite.config.js          Vite config (base: /bakers-recipe-list/)
src/
  main.jsx              React bootstrap
  App.jsx               top-level app
  components/           UI components (CSS Modules) — TopBar, TOCNav, SearchBar,
                       RecipeList/Row/Modal, SectionBlock, MacroCard, ShoppingList,
                       RecentlyViewed, BackToTop, ErrorBoundary, UsdaKeyNotice
  hooks/               useDarkMode, useShoppingList, useCookLog/useCookHistory,
                       usePinnedRecipes, useRecentlyViewed, useMacroEstimate,
                       useFocusTrap, useFlashOnHash
  context/             CookHistoryContext
  data/                recipes.json, recipeIndex, sections, nutritionOverrides, expandVersions
  utils/               ingredient parsing, gram conversion, macro/serving estimates,
                       USDA fetch, autoTags, fractions, scaleIngredient
  styles/globals.css   global styles
.github/workflows/      ci.yml (build check), deploy.yml (Pages)
```

## Deployment

Pushes to `main` auto-deploy to GitHub Pages via
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) (builds `dist/`
and publishes it). The Vite `base` is set to `/bakers-recipe-list/` to match the
Pages project path.

## License

[MIT](LICENSE). The MIT license covers the **code**; the recipe content is the
author's own.
