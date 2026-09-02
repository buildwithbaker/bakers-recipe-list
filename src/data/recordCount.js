// How many records the catalog holds, authored by hand.
//
// This is the ONE place that number lives. Everything else that asserts a
// record count derives from it, so adding or removing a recipe is a single
// intentional bump here rather than a hunt through the test files. Before this
// existed the number was repeated in three places and the middle one was
// undocumented - it was found by going red after a merge.
//
// It is deliberately NOT computed from recipes.json. A count read out of the
// data it is meant to guard proves nothing. Hand-authoring it is the whole
// mechanism: a surprise add or drop moves recipes.length away from this number
// and the build fails.
//
// Who derives from it:
//   recipes.integrity.test.js - compares recipes.length against it, and the
//     id manifest length against recipes.length.
//   validateRecipes.test.js   - builds the summary line it expects from the
//     production validator out of it.
//
// Bump this in the same commit as the data change, never after the fact.
export const EXPECTED_RECORDS = 754;
