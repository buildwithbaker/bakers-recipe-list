# Adding a photo to a recipe

The workflow for every dish you remake and shoot. Five minutes, four steps, and
no edit to `recipes.json`.

The same file does three jobs: the photo on the recipe's card in the list, the
photo beside its title, **and** the `og:image` in every link preview of that
recipe (iMessage, Slack, Facebook, Discord). The card crops it square and the
preview crops it wide, so keep the dish in the middle of the frame.

---

## 1. Shoot it

- **Fill the frame with the dish.** The preview card crops to roughly 1200×630
  and renders small; a plate photographed from across the table becomes an
  unreadable smudge at thumbnail size.
- **Landscape, not portrait.** 1200×630 is a wide frame. A portrait photo gets
  centre-cropped and you lose the top and bottom of the plate.
- Daylight beats the kitchen ceiling light. Near a window, no flash.

## 2. Resize it

Target: **about 1600px wide, JPEG quality 80, under 500 KB.**

An untreated phone photo is 3–5 MB. Committing those is not just slow — git
keeps every version forever, so a few hundred of them would put hundreds of
megabytes into the repo permanently and push the published site towards the
GitHub Pages 1 GB limit. A resized copy looks identical at the size it is
actually displayed.

**The build enforces this.** A photo over 500 KB fails `npm run build` with the
ceiling and this fix in the error text.

Any of these work:

- **Windows Photos:** open → `…` → Resize → Custom → 1600px wide → Save a copy.
- **macOS Preview:** Tools → Adjust Size → 1600 px wide → Export as JPEG,
  quality slider around 80%.
- **Squoosh** (<https://squoosh.app>, runs locally in the browser, nothing is
  uploaded): drop the file, set MozJPEG quality 80, resize width 1600, download.

## 3. Drop it in `src/photos/`

```
src/photos/<id>.jpg
```

`<id>` is the recipe's `id` in `src/data/recipes.json`, which is also the last
part of its address: `/r/spicy-pork-patties/` means `spicy-pork-patties.jpg`.
Use the id, **not** the name: the id is frozen, the name can change. For one
version of a multi-version recipe, use the version's address:
`/r/chili--v2/` means `chili--v2.jpg`.

`.jpg`, `.jpeg`, `.png` and `.webp` are accepted. iPhone photos are HEIC by
default: export as JPEG first (Photos → Share → Save to Files as JPEG, or the
resize tools in step 2, which all save JPEG).

**No edit to `recipes.json`.** That is the whole change.

## 4. Build

```bash
npm run build
```

Before `vite build`, `scripts/build-photos.mjs` makes the sizes the app shows,
into `src/photos/generated/` (gitignored, rebuilt every time):

| file | size | used for |
|---|---|---|
| `<id>-thumb.webp` | 240×240, cropped to fill | the photo slot on every card |
| `<id>-large.webp` | 800px wide | the photo beside the title on the recipe |

After `vite build`, `scripts/prerender.mjs` makes `dist/og/<id>.jpg`, 1200×630,
for link previews (JPEG, because preview crawlers are unreliable with WebP).

**The build fails, and says why, when** a file in `src/photos/` matches no
recipe (usually a typo or the name instead of the id), is over 500 KB, is not a
photo, or is a second photo for the same recipe. Commit the photo in
`src/photos/`; never commit anything under `generated/`.

---

## What changes once a photo exists

| | No photo | With a photo |
|---|---|---|
| Card in the list | tinted slot with the dish's initial | the photo |
| Recipe (card or page) | no photo | the photo beside the title |
| `og:image` in link previews | brand placeholder | the photo, 1200×630 |
| `Recipe` JSON-LD `image` | brand placeholder | the photo, 1200×630 |

Offline, in the installed app: card thumbnails are precached with the app;
a recipe's large photo is cached the first time you open that recipe.

### The older `image` field

Before 2026-09 a photo lived in `public/photos/` and was named in the record's
optional `image` field. That still works as a fallback (no record uses it
today), but a photo in `src/photos/` wins, and it is the only path that gets
the sized versions. Prefer `src/photos/`.

## While you are in the record anyway

Four more optional fields are worth filling in for a recipe you actually share.
All are optional and validated only when present — see
`src/data/recipe.schema.json` for the exact rules.

- **`description`** — one sentence, up to 200 characters. This becomes the
  preview's subtitle. Without it the build derives one from your first
  instruction, which is serviceable but rarely reads like a description.
- **`prepTime`** / **`cookTime`** — ISO 8601 durations, `"PT20M"`, `"PT1H30M"`.
  **Author both or neither** — the build rejects one without the other, because
  Google pairs them and a lone value reads as missing data. `totalTime` is
  computed for you.
- **`recipeYield`** — the yield as written, `"4 servings"`, `"about 24 cookies"`.
  This is separate from the runtime serving estimate that drives the scaler:
  only an authored yield is ever published as fact.

## Removing a photo

Delete the file from `src/photos/` and rebuild. Its sizes are removed from
`generated/` automatically, and the card, the recipe and the preview fall back
to the placeholder.
