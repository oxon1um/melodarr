# Development Workflow

Melodarr protects `main` with a GitHub ruleset and the required `verify` status check. Use this
workflow for code, configuration, Docker, CI, and documentation changes.

## Required Flow

1. Start from an up-to-date `main` branch.
2. Create a short-lived branch before committing changes.
   - Examples: `fix/header-layout`, `feat/request-flow`, `docs/readme-refresh`, `ci/verify-gate`
3. Commit changes on that branch using Conventional Commits.
4. Push the branch and open a pull request into `main`.
5. Wait for GitHub Actions to complete.
6. Merge only after the required `verify` check is green.
7. Delete the branch after merge and update local `main`.

For agent-driven changes, pushing a branch implies follow-through unless the user says otherwise:
open or update the pull request, watch GitHub Actions, merge when `verify` and any other required
checks are green, delete the remote branch, and make sure local `main` is current. If a check fails or
is blocked, stop and report the failure with the relevant check/log link or error summary, then
propose the smallest safe fix and wait for explicit approval before changing code again.

Do not push directly to `main`. The remote ruleset should reject direct pushes, force pushes, and
branch deletion, but agents and contributors should not attempt to bypass it.

## Verification Gate

The `verify` check runs the same production-safety gate in CI as `npm run verify` locally:

- ESLint (`npm run lint`)
- Prisma client generation (`npm run prisma:generate`)
- Vitest unit tests (`npm run test`)
- Prisma schema push against test Postgres (`npm run prisma:push`)
- Next.js production build (`npm run build`)
- Playwright smoke tests (`npm run test:e2e`)

Run `npm run verify` locally when practical before opening a pull request. If local Docker is not
available for the verification database, either provide `DATABASE_URL` and `REDIS_URL` for existing
test services or run the focused checks relevant to the change and rely on GitHub Actions for the
full gate.

## Agent Notes

- Keep commits off local `main` when possible; create or switch to a topic branch first.
- If local changes already exist on `main`, create a topic branch before committing them.
- After pushing a PR branch, watch GitHub Actions and complete the merge/delete-branch/update-main
  steps when checks are green unless the user asks you to stop earlier.
- Stop on any failed check. Report the failure, propose the fix, and get approval before changing
  code.
- Use `.github/rulesets/main-protection.json` as the importable source for the GitHub ruleset.
- The CI workflow that supplies the required `verify` check is `.github/workflows/docker.yml`.
