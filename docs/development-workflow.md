# Development Workflow

Melodarr protects `main` with a GitHub ruleset and the required `verify` status check. Use this
workflow for code, configuration, Docker, CI, and documentation changes.

## Required Flow

1. Start from an up-to-date `main` branch.
   - Run `git fetch origin`.
   - Create the topic branch from `origin/main`, not from a stale local branch.
2. Create a short-lived branch before committing changes.
   - Examples: `fix/header-layout`, `feat/request-flow`, `docs/readme-refresh`, `ci/verify-gate`
3. Commit changes on that branch using Conventional Commits.
4. Before pushing, sync the branch with the latest `origin/main`.
   - Rebase or merge `origin/main` if the branch is behind.
   - Resolve conflicts locally before opening or updating the pull request.
5. Push the branch and open a pull request into `main`.
6. Confirm the pull request is conflict-free and that the required `verify` check appears.
5. Wait for GitHub Actions to complete.
7. Merge only after the required `verify` check is green.
8. Delete the branch after merge and update local `main`.

For agent-driven changes, pushing a branch implies follow-through unless the user says otherwise:
open or update the pull request, watch GitHub Actions, merge when `verify` and any other required
checks are green, delete the remote branch, and make sure local `main` is current. If a check fails or
is blocked, stop and report the failure with the relevant check/log link or error summary, then
propose the smallest safe fix and wait for explicit approval before changing code again. If the
required `verify` check never appears, first confirm the pull request is not conflicted with `main`
and that the branch is based on the latest `origin/main`.

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

If the pull request is conflicted with `main`, GitHub may not create the `pull_request` workflow run
at all. A missing `verify` check is therefore a branch-health problem first, not just a CI problem.
Update the branch with the latest `origin/main`, resolve conflicts, push again, and then confirm
that `verify` appears on the pull request.

## Branch Sync Rules

- Treat local `main` as disposable state. Refresh from `origin/main` before cutting a new branch.
- Before opening a pull request, run `git fetch origin` and rebase or merge `origin/main` if the
  branch is behind.
- After any other pull request merges to `main`, re-sync long-lived topic branches before expecting
  CI or mergeability to stay valid.
- If two agents might touch the same files, prefer serializing that work or assigning one agent to
  land first and having the other rebase immediately afterward.
- Keep branches narrow. One feature, one fix, or one test gap per branch reduces conflict pressure.

## Agent Notes

- Keep commits off local `main` when possible; create or switch to a topic branch first.
- If local changes already exist on `main`, create a topic branch before committing them.
- Before pushing a new branch, fetch `origin/main` and confirm the branch still applies cleanly.
- After pushing a PR branch, watch GitHub Actions and complete the merge/delete-branch/update-main
  steps when checks are green unless the user asks you to stop earlier.
- If `verify` is missing from the PR, check for merge conflicts with `main` before debugging CI.
- Stop on any failed check. Report the failure, propose the fix, and get approval before changing
  code.
- Use `.github/rulesets/main-protection.json` as the importable source for the GitHub ruleset.
- The CI workflow that supplies the required `verify` check is `.github/workflows/docker.yml`.
