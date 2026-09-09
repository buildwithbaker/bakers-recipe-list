// The one place the recipe id <-> URL path segment transform lives.
//
// A versioned child row carries a derived id like `parent::v1` (expandVersions.js).
// `::` is legal in a URL but illegal in a Windows filename, so the prerender step
// cannot create dist/r/parent::v1/ on Windows - it would break local builds while
// passing in CI. The path segment uses `--` instead.
//
// Safe because the authored id pattern is ^[a-z0-9-]+$ and no record contains a
// double dash, so `--` can only ever have come from a `::`. Enforced by the
// no-double-dash assertion in recipes.integrity.test.js - do not relax it.

export function idToSlug(id) {
  return String(id).replace(/::/g, '--');
}

export function slugToId(slug) {
  return String(slug).replace(/--/g, '::');
}
