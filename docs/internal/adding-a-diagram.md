# Adding a technique diagram to a recipe

For how-to pictures: how to cut, fold or shape something. They show after the
recipe's Notes, under a "Technique" heading. They are not dish photos (those are
[`adding-a-photo.md`](./adding-a-photo.md)) and they are not searchable.

---

## 1. Make the SVG

- One idea per diagram. A recipe may have several; each is its own file.
- Plain SVG with a `viewBox` and no fixed width/height, so it scales to a phone.
- **No scripts and no event handlers.** The build fails on a `<script` element
  or any `on…=` attribute (`onload`, `onclick`, …), in any letter case.
- **At most 150 KB.** Embedded raster data is the usual cause; draw it in
  vectors instead.
- Keep any provenance `<metadata>` block the generator wrote.

## 2. Drop it in `public/diagrams/`

```
public/diagrams/<recipe-id>-<what>.svg
```

Lowercase letters, digits and hyphens only, e.g. `honey-carrots-roll-cut.svg`.
Name it after the recipe's `id` so the pairing stays obvious.

## 3. Make its PNG companion

The downloadable recipe card draws each diagram as a PNG; it never parses SVG.
Every `public/diagrams/<name>.svg` therefore needs `public/diagrams/<name>.png`
beside it, same base name, about 1200 px wide, on the card's cream. Generate
them all and commit the result:

```bash
node scripts/rasterize-diagrams.mjs
```

Run it by hand, whenever a diagram is added or changed. It is deliberately not
an npm script and not part of `prebuild`: a build must never rewrite committed
files. It uses `sharp`, already a devDependency.

## 4. Reference it from the record

In `src/data/recipes.json`, right after the record's `notes`:

```json
"diagrams": [
  {
    "src": "diagrams/honey-carrots-roll-cut.svg",
    "alt": "What the diagram teaches, in words a screen reader can use.",
    "caption": "Cutting the carrots"
  }
]
```

| field | rule |
|---|---|
| `src` | required; `diagrams/<lowercase-name>.svg`, relative to `public/`, no leading slash |
| `alt` | required; say what the diagram **teaches** (the steps), not "a diagram of carrots" |
| `caption` | optional; a few words shown under the image |

Omit `diagrams` entirely rather than leaving it empty. No other keys are allowed.
`EXPECTED_RECORDS` and `recipes.ids.json` do not change: this is an edit to an
existing record.

## 5. Check

```bash
npm run validate:recipes
npm run build
```

The validator fails, and says why, on: a `src` that does not match the pattern,
a file that is not in `public/`, a file over 150 KB, a script or event handler
in the SVG, a missing PNG companion, a PNG over 400 KB, a missing or empty `alt`, an empty `caption`, or an extra key.

## What it does not do

Diagrams are never indexed by search and never published in the Recipe JSON-LD.
They print with the recipe page, and the recipe-card PDF carries them (as the
PNG companions) after Notes, under "Technique". If a PNG cannot be fetched, the
card downloads without that diagram and the browser console warns.
They are served as `<img>`, so an SVG's own scripts could never run there; the
no-script rule keeps the file safe to open on its own.
