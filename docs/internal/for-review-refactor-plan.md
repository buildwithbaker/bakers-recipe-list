# Refactor Plan — Replace `FOR REVIEW` sections with a `status` field

Status: proposed (not started). Author hand-off doc. Last updated 2026-06-24.

> **Base-branch prerequisite (important).** This refactor MUST be built on top of
> `fix/audit-followups` (or on `main` *after* that branch merges) — NOT on the
> current `origin/main`. `origin/main` has a latent data bug: 19 soups exist
> twice (a blank `SOUPS` placeholder + a real `FOR REVIEW - SOUPS` recipe with
> the same name), which the new validator correctly rejects. `fix/audit-followups`
> already removes those duplicate placeholders (232 records, 0 dups). Building
> this refactor on `origin/main` would fail validation before it started.

The `section` field is overloaded. It encodes a recipe's display category AND
its review state, by prefixing the section name with `FOR REVIEW`. This causes:

- Inconsistent delimiters: `FOR REVIEW --- CURRY` / `FOR REVIEW --- SOUPS` vs
  `FOR REVIEW - SOUPS` vs `FOR REVIEW - MARINADES - CHICKEN`.
- Duplicate buckets: two separate review-soup sections (`FOR REVIEW --- SOUPS`
  and `FOR REVIEW - SOUPS`) plus the live `SOUPS` section.
- Protein and version metadata jammed into the section key
  (`FOR REVIEW - MARINADES - CHICKEN`).
- A recipe can't be "a Soup that is in review" — it's either in `SOUPS` or in a
  review-soup section, so promoting a recipe out of review means renaming its
  section (and it loses its place).

## Current wiring (the blast radius — 5 files)

Review state today is derived entirely from the section key via `review: true`
in `sections.js`. Touching this touches:

1. `src/data/sections.js` — the 6 `FOR REVIEW ...` entries carry `review: true`.
2. `src/components/RecipeList/RecipeList.jsx` — `mainSections` / `reviewSections`
   split (lines ~26-27), the Recipes/For-Review tab (lines ~278, ~363),
   `hideSource={section.review}` (~372), and `expandVersionedRecipe` only on
   review sections (~33).
3. `src/components/SectionBlock/SectionBlock.jsx` — green "review" header style
   (~20).
4. `src/components/TOCNav/TOCNav.jsx` — green review link style (~68).
5. `src/utils/autoTags.js` — strips the literal `FOR REVIEW --- ` prefix (~82).
6. `src/utils/estimateServings.js` — per-section serving defaults keyed on the
   6 `FOR REVIEW ...` strings (~33-38).

## Affected data (104 recipes currently in review sections)

| Current section | Count | Proposed target section | Proposed status |
|---|---|---|---|
| `FOR REVIEW - MARINADES - CHICKEN` | 30 | `MARINADES` | `review` |
| `FOR REVIEW - MARINADES - BEEF` | 18 | `MARINADES` | `review` |
| `FOR REVIEW - MARINADES - PORK` | 15 | `MARINADES` | `review` |
| `FOR REVIEW - SOUPS` | 26 | `SOUPS` | `review` |
| `FOR REVIEW --- SOUPS` | 5 | `SOUPS` | `review` |
| `FOR REVIEW --- CURRY` | 10 | `CURRY` (new) — see decision 1 | `review` |

Category `For Review` (the 41 soups + curries) also retires — each recipe takes
the real category of its new section.

## Proposed design

1. Add a `status` field to the schema: `"published"` (default) or `"review"`.
   It replaces the `FOR REVIEW` section concept entirely.
2. Move every review recipe to its true section and set `status: "review"`.
3. Drive the For-Review tab and green styling off `recipe.status === "review"`,
   not off the section name. `sections.js` loses the 6 `FOR REVIEW` entries and
   the `review` flag.
4. Update the schema enum (drop the 6 `FOR REVIEW` keys, add `CURRY` if chosen),
   bump the validator's drift guard, and add `status` to the contract.

## Migration steps

1. Schema: add `status` (enum `published` | `review`, required), drop the 6
   `FOR REVIEW` section enum values, add the new section value (decision 1).
2. Data: script over `recipes.json` — for each review recipe, set its new
   `section` + `category`, add `status: "review"`; for all others add
   `status: "published"`. Resolve marinade protein grouping (decision 2).
3. `sections.js`: remove the 6 `FOR REVIEW` entries + `review` flags; add the new
   section in the desired display order.
4. Components: replace every `section.review` check with a `status`-based check.
   The tab split filters recipes by `status`; section/TOC styling keys off
   whether the *active tab* is review, not the section.
5. `autoTags.js`: delete the `FOR REVIEW --- ` prefix strip (no longer needed).
6. `estimateServings.js`: rekey the serving defaults to the real section names
   (`MARINADES`, `SOUPS`, `CURRY`) instead of the 6 `FOR REVIEW` strings.
7. Run `npm run validate:recipes`, `npm run lint`, `npm run test`, `npm run build`.
8. Manual QA: For-Review tab still lists the same recipes; green styling intact;
   serving estimates unchanged; version expansion (multi-version marinades) still
   renders one row per version.

## Resolved spec (locked 2026-06-24)

All three open decisions are now locked. Counts below are from the clean
`fix/audit-followups` base (232 records, 104 in review).

### Decision 1 — Curries get a new `CURRY` section

The 10 curries span Indian, Thai, Japanese, Sri Lankan, and South African — no
single existing cuisine fits, so they get their own section.

- **New section:** `sections.js` entry
  `{ key: "CURRY", label: "Curry", id: "sec-CURRY" }` (no `review` flag).
  Insert in display order immediately after `MIDDLE EASTERN`.
- **New category:** add `"Curry"` to the schema `category` enum.
- **The 10 records:** set `section: "CURRY"`, `category: "Curry"`,
  `status: "review"`, keep names and existing `#curry` tag. They are:
  Butter Chicken (Murgh Makhani), Chana Masala (Chickpea Curry), Lamb Rogan Josh,
  Thai Green Curry (Vegetarian), Beef Madras, Japanese Curry (Kare Raisu),
  Saag Paneer (Spinach Curry), Goan Fish Curry (Tomato Base),
  Sri Lankan Dhal Curry, South African Bunny Chow (Chicken Curry in Bread).
- Note: 3 of these carry a stale `#middle-eastern` tag from auto-tagging
  (e.g. Butter Chicken). Drop it during migration; the `CURRY` section is the
  correct home.

### Decision 2 — Marinade protein stays as tags (already present)

All 63 review marinades **already carry** a protein tag (`#chicken` ×30,
`#beef` ×18, `#pork` ×15), so no tagging work is needed — the grouping survives
the section collapse for free.

- **The 63 records:** set `section: "MARINADES"`, `category: "Marinades"`,
  `status: "review"`. Keep the existing protein tag and `#marinade` tag.
- **Do NOT rename** these recipes (names like `Lemon Herb - Chicken Marinade`
  are the canonical key used in deep links / cook log — renaming breaks state).
- **Drop the `#for-review` tag** from all of them — it is replaced by the
  `status` field and would otherwise be redundant/stale.

### Decision 3 — `status` field: `published` | `review`, required, no default

- **Schema:** add `status` to `required`; `{ "type": "string", "enum":
  ["published", "review"] }`. No JSON default — every record gets an explicit
  value during migration (a missing `status` is a validation error).
- **Migration rule:** `status = "review"` for every recipe currently in a
  `FOR REVIEW ...` section; `status = "published"` for all others.
- **Validator:** add the `status` enum check alongside the existing field checks,
  and drop the 6 `FOR REVIEW` keys from the section drift-guard once `sections.js`
  is updated.

### Review-soup cleanup (folds in here)

The 31 review soups (26 in `FOR REVIEW - SOUPS` + 5 in `FOR REVIEW --- SOUPS`)
all move to `section: "SOUPS"`, `category: "Soups"`, `status: "review"`, merging
the two duplicate review buckets into one. The blank `SOUPS` placeholders that
duplicated their names are already removed on `fix/audit-followups` — confirm
none remain before migrating (the validator's uniqueness check will catch any).

## Risk & effort

- Risk: medium. Logic is mechanical but spread across 6 files + a 104-record data
  migration. The validator + existing tests (`recipes.integrity.test.js`,
  `estimateServings.test.js`) are the safety net; the version-expansion path is
  the easiest thing to break.
- Effort: roughly half a day, most of it QA and the data script.
- Reversible: yes — it's a branch + PR; no destructive ops.

## Out of scope

Multi-version recipe expansion (`expandVersions.js`) behavior stays as-is; this
refactor only changes how a recipe is *flagged* as in-review, not how versions
render.
