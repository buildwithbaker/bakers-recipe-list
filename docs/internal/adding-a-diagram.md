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

## 3. Reference it from the record

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

## 4. Check

```bash
npm run validate:recipes
npm run build
```

The validator fails, and says why, on: a `src` that does not match the pattern,
a file that is not in `public/`, a file over 150 KB, a script or event handler
in the SVG, a missing or empty `alt`, an empty `caption`, or an extra key.

## What it does not do

Diagrams are never indexed by search, never published in the Recipe JSON-LD,
and never drawn on the recipe-card PDF. They do print with the recipe page.
They are served as `<img>`, so an SVG's own scripts could never run there; the
no-script rule keeps the file safe to open on its own.
