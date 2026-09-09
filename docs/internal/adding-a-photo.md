# Adding a photo to a recipe

The workflow for every dish you remake and shoot. Five minutes, four steps.

The same file does two jobs: it is the hero at the top of the recipe page **and**
the `og:image` in every link preview of that recipe — iMessage, Slack, Facebook,
Discord. Shoot and crop for both.

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

## 3. Name and save it

```
public/photos/<id>.jpg
```

`<id>` is the record's `id` field in `src/data/recipes.json` — **not** its name,
and not a new slug. The id is frozen; the name can change. Naming the file after
the id keeps the pairing obvious and survives a rename.

```
public/photos/spicy-pork-patties.jpg
```

`.jpg`, `.jpeg`, `.png` and `.webp` are all accepted. Prefer `.jpg` for
photographs — PNG of a photo is several times larger for no visible gain.

## 4. Point the record at it

Add one line to that recipe in `src/data/recipes.json`. The path is relative to
`public/` with **no leading slash**:

```json
{
  "id": "spicy-pork-patties",
  "name": "Spicy Pork Patties",
  "image": "photos/spicy-pork-patties.jpg",
  ...
}
```

Then:

```bash
npm run build
```

`prebuild` validates first. If the path is wrong, the file is missing, or the
photo is too heavy, the build fails and tells you which.

---

## What changes once a photo exists

| | No `image` | With `image` |
|---|---|---|
| Full recipe page | brand placeholder hero | the photo |
| Modal over the list | no hero | the photo |
| `og:image` in link previews | brand placeholder | the photo |
| `Recipe` JSON-LD `image` | brand placeholder | the photo |

Nothing else has to be touched — `scripts/prerender.mjs` reads `image` straight
off the record and writes the absolute URL into both the meta tags and the
structured data.

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

Delete the `"image"` line from the record and delete the file. Both the page and
the preview fall back to the placeholder. Leaving the file without the line is
harmless; leaving the line without the file fails the build.
