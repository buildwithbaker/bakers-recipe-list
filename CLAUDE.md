# CLAUDE.md - bakers-recipe-list

See @README.md for what this project is.
See @docs/internal/architecture.md for the deep architecture reference (data model, nutrition pipeline, components/hooks/utils map, extension points, gotchas).

## Build, test, deploy
- npm run dev    # Vite dev server, localhost:5173
- npm run build  # production build to dist/
- npm run lint   # must pass before any commit (if lint script exists)
- Deploy: GitHub Pages via .github/workflows/deploy.yml (deploys on merge to main).

## Branching (main is protected - PR only)

`main` is protected: direct pushes are rejected. **Never run `git push origin main`.**

1. `git checkout main && git pull origin main` - start from an up-to-date main
2. `git checkout -b <type>/<slug>` - branch BEFORE staging, so local `main` never diverges
3. edit, then `git add -- <explicit paths>` - never `git add -A`
4. `git commit -m "<message>"`
5. `git push -u origin <branch>`
6. `gh pr create --base main --fill`
7. `gh pr checks <branch> --watch` - wait for the required checks
8. `gh pr merge <branch> --squash --delete-branch`
9. `git checkout main && git pull origin main`

Never merge while a required check is failing or pending, and never disable a check to
force a merge through - stop and report instead.

`npm run lint` must pass before you commit. Merging deploys to GitHub Pages via
`.github/workflows/deploy.yml`.

## File organization (root is locked)
Do not add files to root unless required by tooling. New CSS -> src/styles/;
new component -> src/components/; new util -> src/utils/; build script -> scripts/;
planning doc -> docs/internal/.

## Do not touch
- dist/ is generated - never edit by hand.
- CSS belongs in src/styles/, not at root.
