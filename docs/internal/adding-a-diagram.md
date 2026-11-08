# Adding a technique (and its diagram)

For how-to pictures: how to cut, fold or shape something. A technique lives in
one place, `src/data/techniques.json`, and is taught in three places:

- a recipe step that names it gets an (i) button after its title, which opens
  the technique as a popup card;
- the **Learning to Cook** page (`/learning-to-cook/`) lists every technique,
  each anchored by its id (`/learning-to-cook/#<id>`), with the recipes that use
  it ("Used in", derived from the steps, never stored);
- the recipe-card PDF prints the diagrams of the techniques a recipe's steps
  name, under a "Technique" heading, captioned with the technique's title.

They are not dish photos (those are [`adding-a-photo.md`](./adding-a-photo.md))
and they are not searchable or in any recipe's JSON-LD.

---

## 1. Make the SVG

- One idea per diagram.
- Plain SVG with a `viewBox` and no fixed width/height, so it scales to a phone.
- **No scripts and no event handlers.** The build fails on a `<script` element
  or any `on…=` attribute (`onload`, `onclick`, …), in any letter case.
- **At most 150 KB.** Embedded raster data is the usual cause; draw it in
  vectors instead.
- Keep any provenance `<metadata>` block the generator wrote.

## 2. Drop it in `public/diagrams/`

```
public/diagrams/<what>.svg
```

Lowercase letters, digits and hyphens only, e.g. `honey-carrots-roll-cut.svg`.

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

## 4. Add the technique

Append an item to `src/data/techniques.json`. Its contract is
`src/data/techniques.schema.json`; the order of the file is the order of the
Learning to Cook page.

```json
{
  "id": "carrot-roll-cut",
  "title": "Roll-cutting carrots",
  "kicker": "Knife work · Vegetables",
  "diagram": { "src": "diagrams/honey-carrots-roll-cut.svg", "alt": "What the diagram teaches, in words a screen reader can use." },
  "how": ["Trim the stem and halve the thick top third lengthwise."],
  "why": "Same-size pieces finish together."
}
```

| field | rule |
|---|---|
| `id` | required; `^[a-z0-9-]+$`, unique; it is the page anchor and what steps reference |
| `title`, `kicker`, `why` | required; non-empty strings |
| `diagram.src` | required; `diagrams/<lowercase-name>.svg`, relative to `public/`, no leading slash |
| `diagram.alt` | required; say what the diagram **teaches** (the steps), not "a diagram of carrots" |
| `how` | required; a non-empty array of strings, shown as an ordered list |

No other keys are allowed, on a technique or on its diagram.

## 5. Reference it from a recipe step

On the step that uses the technique, in `src/data/recipes.json`:

```json
{ "step": "Cut", "detail": "…", "technique": "carrot-roll-cut" }
```

`technique` is optional and must be the id of a technique in `techniques.json`.
`EXPECTED_RECORDS` and `recipes.ids.json` do not change: this is an edit to an
existing record. (The recipe-level `diagrams` field was retired when techniques
moved to their own file; the validator rejects it.)

## 6. Check

```bash
npm run validate:recipes
npm run build
```

The validator fails, and says why, on: a step `technique` that is not a
technique id, a duplicate technique id, an unknown key, a `diagram.src` that
does not match the pattern, a file that is not in `public/`, a file over
150 KB, a script or event handler in the SVG, a missing PNG companion, a PNG
over 400 KB, or a missing or empty `alt`.

## What it does not do

Techniques are never indexed by search and never published in the Recipe
JSON-LD. If a card PNG cannot be fetched, the card downloads without that
diagram and the browser console warns. Diagrams are served as `<img>`, so an
SVG's own scripts could never run there; the no-script rule keeps the file safe
to open on its own.
