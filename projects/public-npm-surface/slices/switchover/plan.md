# Slice: switchover — plan

**Issue:** [TML-3124](https://linear.app/prisma-company/issue/TML-3124) · **Branch:** `tml-3124-switchover` (stacked on `tml-3139-migration-import-root`)

## Outcome

`packages/9-public/` is the publish list. Every other workspace package is `"private": true`. A publish dry-run names exactly the ADR 242 surface and nothing else.

**This slice does not publish.** It leaves the repo ready to publish. The actual release is the operator's call and additionally depends on npm org readiness (publish rights and provenance for the `@prisma/orm-*` names), which is outside the repo.

## Order of work

1. **Flip and repoint, atomically.** Every package outside `packages/9-public/` becomes `"private": true`; the publish workflow and `scripts/publish-packages.mjs` target exactly the `9-public` set. These land together — a half-flip either publishes internals or publishes nothing.
2. **Enforce it in both directions.** Lint fails when a package outside `9-public` is publishable, and when a package inside it is private. Wire into the lint flow and CI beside the existing ratchets.
3. **Sweep internal names out of user-visible text.** `knownInternalNamesInDist` in `packages/0-config/tsdown/shell-testkit.ts` locks a baseline of `@prisma-next/*` strings inside published runtime code. Beyond emitter output roots, these include **diagnostics, config-validation messages, and telemetry identifiers** in `orm-toolchain` and the families. After privatization those strings name packages that no longer exist publicly — an error message pointing a user at nothing. Drive the baseline toward empty and explain whatever remains.
4. **Fix the shim's dependencies.** The `prisma-next` shim mirrors the CLI's runtime deps per ADR 211, so its tarball still declares `@prisma-next/*`. Those must become `@prisma/orm-toolchain`. The drift-lint that enforces the mirror needs to understand the new shape.
5. **Strip the phantom devDependencies.** Shell manifests carry `@prisma-next/*` devDependencies which, after privatization, name packages that do not exist on npm. `check-publish-deps.mjs` exempts devDependencies today; either strip them at pack time or extend the check.
6. **Decide `sql-runtime`'s `./test/utils`** ([TML-3141](https://linear.app/prisma-company/issue/TML-3141)). It reaches the never-published `test-utils`. Cheapest correct answer is likely for the family shell simply not to map that subpath, leaving the workspace export intact for in-repo consumers — confirm before assuming.
7. **Prove a decomposed install.** ADR 242 promises facades are decomposable. Build the proof: an app depending on platform packages directly, with one component replaced, that runs. This is a project-DoD item and the only one with no coverage yet.
8. **Record upgrade instructions** for the published-name change, per `.agents/skills/record-upgrade-instructions/SKILL.md`. This is a real user-facing rename; the entry must state what a reader does, not that nothing is needed.

## Done when

- A publish dry-run lists exactly the ADR 242 packages and nothing else.
- Lint fails a publishable package outside `9-public` and a private package inside it — both directions asserted by test, not by inspection.
- No `@prisma-next/*` string reaches user-visible output: not imports, not diagnostics, not telemetry identifiers, not shim or shell manifests.
- A packed-tarball install works per family, and a decomposed install with a replaced component works.
- Upgrade instructions recorded; repo CI green including the Coverage job.

## Risks

- **A half-applied flip is the dangerous state.** Privatizing without repointing the publish list means the next release ships nothing; repointing without privatizing means it ships everything. Keep them in one commit.
- **The internal-name sweep touches user-facing message text**, which tests often assert on. Expect snapshot churn and read each change — a message that stops naming a package may also stop being useful.
- **`test:integration`'s `relation-mode-gh-*` suites are unstable** ([TML-3140](https://linear.app/prisma-company/issue/TML-3140)) and sometimes hang. Do not read them as signal; report what you see.
