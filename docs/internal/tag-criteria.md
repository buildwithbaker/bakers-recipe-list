# Tag criteria

Approved by Adam on 2026-10-25 and 2026-10-26. The research behind these rules is
in his knowledge base (github-pages-recipe-site-workflow, module 08). The list
itself lives in `src/data/tagFacets.js`, and `scripts/validate-recipes.mjs`
enforces it at build time.

## What a manual tag must pass

1. It belongs to exactly one facet.
2. Nothing else already says it: not the category, a time field, an auto-tag, or
   the dish name.
3. It is not just an ingredient. Ingredient lookup is search's job.
4. It helps a choice at a glance: how it is cooked, when it fits, who can eat it.
5. It applies to 2 or more recipes, or it is on the controlled list.
6. It has one spelling.
7. A diet tag is a claim: only when it is true for the recipe as written.

## The controlled list (29)

| Facet | Tags |
|---|---|
| Method / equipment | `#one-pan` `#sheet-pan` `#slow-cooker` `#oven` `#skillet` `#stir-fry` `#no-cook` `#no-bake` `#microwave` |
| Plan / occasion | `#make-ahead` `#holiday` |
| Diet | `#vegetarian` `#high-protein` |
| Dish form (only where the category does not say it) | `#salad` `#dip` `#rice-bowl` `#dressing` `#condiment` `#casserole` `#pasta` `#noodles` `#curry` |
| Sub-cuisine (only where the category does not say it) | `#korean` `#thai` `#indian` `#tex-mex` `#cajun` `#bbq` |
| Collection | `#peanut-butter` |

A recipe may also carry, by hand, any tag the auto-tags can derive (for example
`#soup` on a Slow Cooker stew, or `#chicken` on a marinade that names chicken
only in its method), but only where the auto-tags do not already supply it.

## Specific decisions

- **`#high-protein`:** 30 g protein or more per authored serving, applied by hand
  only when the protein-bearing ingredients trace to verified USDA figures (the
  site's `nutritionOverrides.json`). A figure built on wrong gram inputs (bone-in
  weight against an edible-portion value, say) does not count.
- **`#weeknight`:** retired. No manual tag and no derived one.
- **`#greek-yogurt`, `#rotisserie`, `#eggs`:** dropped; search finds them.
- **`#peanut-butter`:** kept as a browsable collection.
- **`#new`:** never typed. It is derived for 14 days after `added`.

## Auto-tags (derived, never typed)

`src/utils/autoTags.js` derives cuisine and dish type from `category`, protein
from ingredient lines, `#spicy` from ingredients, and `#new` from `added`. Known
exceptions in the protein rules: fish sauce is not seafood, a hamburger bun is
not pork, beef tallow is not beef, and a corned beef brisket that ships with a
seasoning packet is still beef.

## Recipe cards

A card shows at most 3 tag chips, in the order Method > Plan > Diet > Protein,
and never one that repeats the card's category label. Cuisine, dish form,
sub-cuisine, collection, `#spicy` and `#new` are not chips (`#new` is a pill).

## Adding a tag

Add it to `TAG_FACETS` in `src/data/tagFacets.js` with its facet, after checking
it against the rules above. The validator rejects any other tag on a written
recipe. Blank placeholders are checked once they are written.
