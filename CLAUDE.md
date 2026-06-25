# CLAUDE.md - bakers-recipe-list

See @README.md for what this project is.
See @docs/internal/architecture.md for the deep architecture reference (data model, nutrition pipeline, components/hooks/utils map, extension points, gotchas).

## Build, test, deploy
- npm run dev    # Vite dev server, localhost:5173
- npm run build  # production build to dist/
- npm run lint   # must pass before any commit (if lint script exists)
- Deploy: GitHub Pages via .github/workflows/deploy.yml (deploys on merge to main).

## Branching (main is protected)
`main` is protected - direct pushes are rejected. Branch, commit, push, open a
PR, then squash-merge once CI is green. Never run `git push origin main`.

## File organization (root is locked)
Do not add files to root unless required by tooling. New CSS -> src/styles/;
new component -> src/components/; new util -> src/utils/; build script -> scripts/;
planning doc -> docs/internal/.

## Do not touch
- dist/ is generated - never edit by hand.
- CSS belongs in src/styles/, not at root.
