# Brief: D9 preservation audit and slice gate

## Task

Synchronize TML-3061 onto current `origin/main` now that predecessor PR #1023 is merged, then perform the complete preservation audit and final slice validation. Fetch origin and rebase only commits after the old stacked head `4557df26d9514ecb5afe8d9de4abe207df8c186b` onto current `origin/main`; do not replay predecessor commits. Prove the rebased diff contains only target descriptor foundations, built-in/extension adoption, coherent PostgreSQL/SQLite composition, fixture corrections, documentation, and upgrade guidance; prove codec JSON, metadata, rendered JSON SQL, generated contracts, fixtures, and later-slice behavior remain unchanged; and run the plan’s package, workspace, integration, end-to-end, dependency, upgrade, docs, and hygiene gates.

## Scope

**In:** `git fetch origin`; clean `GIT_EDITOR=true git rebase --onto origin/main 4557df26d9514ecb5afe8d9de4abe207df8c186b`; evidence-based conflict resolution limited to TML-3061 intent; target/adapter/extension builds/tests/typechecks/lints; root build/typecheck/package/integration/e2e tests; docs/skills/manifests/dependency/cast/throw/upgrade gates; fixture/contract no-drift; exact descriptor contribution/registry audit with bounded `rg`; raw generic/wrong-target/duplicate and composition-path scans; JSON hook dormancy and codec representation parity; long-lived `projects/codec-json-projections` reference scrub; prototype patch/stash preservation checks without stash operations; DCO/diff/worktree hygiene; final reviewer evidence.

**Out:** New production behavior; fixing unrelated main failures; regenerating changed fixtures/contracts; canonical JSON or ORM projection work from TML-3063; aggregate work; metadata removal; codec-ID branches; compatibility exports; force-pushing or opening the PR before final reviewer verdict; any `git stash*` command.

## Completed when

- [ ] The branch is cleanly rebased onto fetched `origin/main` with merge-base equal to current main, only post-`4557df26...` TML-3061 commits replayed, every commit DCO-signed, and no predecessor duplication or unrelated conflict resolution.
- [ ] Bounded `rg`/git audits prove every PostgreSQL/SQLite built-in and migrated extension canonical array is target-typed; runtime/control/bare paths use complete coherent immutable registries with intended ordering and char/varchar behavior; raw generic/malformed/wrong-target paths reject before lowering; no query-time target cast, JSON-hook renderer invocation, metadata removal, codec-ID branch, aggregate/prototype code, generated drift, or long-lived project-path reference exists.
- [ ] Exact current behavior remains pinned: PostgreSQL native casts and numeric/int8/bytea/vector/PostGIS/arktype codec JSON; SQLite BLOB/base64, bigint safe-number, structured JSON; byte-identical JSON object/array SQL; factory/column/application/contract typing; generated contracts and fixtures.
- [ ] All final plan gates pass: target PostgreSQL/SQLite build/test/typecheck/lint; adapter PostgreSQL/SQLite test/typecheck/lint; pgvector/PostGIS/arktype-json test/typecheck/lint; `pnpm build`; root typecheck if available; `pnpm test:packages`; `pnpm test:integration`; `pnpm test:e2e`; `pnpm lint:manifests`; `pnpm lint:deps`; `pnpm lint:casts`; `pnpm lint:throws`; `pnpm lint:skills`; `pnpm lint:docs`; `pnpm check:upgrade-coverage --mode pr`; `pnpm fixtures:check`; `git diff --check`. If an unrelated main/resource flake occurs, rerun focused once, classify with evidence, and report honestly rather than changing unrelated code.
- [ ] Worktree is clean; the preserved prototype patch still exists with decompressed SHA-256 `0ed2afae20a3824dad79ebbf27f9dace730b5d729a626a4888414a98be4e3e7a`; no `git stash*` command was run; the final report names every command/result and any CI-deferred risk. No implementation commit is required if the rebase and audit produce no source changes.

## Standing instruction

This is a preservation gate, not an invitation to improve adjacent code. Never accept fixture/contract drift by regeneration. Do not use the old stacked branch as the new base after #1023’s merge; rebase the TML-3061 commit range directly onto current `origin/main`. Do not rewrite or squash the slice’s logical commits beyond the necessary rebase. If current main introduces a semantic conflict with the settled descriptor design, halt with the exact conflict rather than choosing a new architecture silently.

## References

- Slice spec: `projects/codec-json-projections/slices/02-target-codec-descriptor-foundations/spec.md` — done conditions and non-goals.
- Slice plan: `projects/codec-json-projections/slices/02-target-codec-descriptor-foundations/plan.md` § Dispatch 9 and Final slice gate.
- Predecessor PR: `https://github.com/prisma/prisma-next/pull/1023`, merged as `6afaca04ebbc9d06050f0146cd53933ea6e8eb3a`.
- Old stacked head/cutoff: `4557df26d9514ecb5afe8d9de4abe207df8c186b`.
- Upgrade entry required in PR body: `skills/extension-author/prisma-next-extension-upgrade/upgrades/0.16-to-0.17/`.
- Prototype patch: `projects/codec-json-projections/assets/postgres-numeric-prototype.patch.gz`; do not inspect via stash.
- Current review artifact: `projects/codec-json-projections/reviews/code-review.md` — AC-1/2/3/5 PASS, AC-4/6/7 pending final audit.
- Harness constraint: built-in search/grep/glob/find-path tools are forbidden. Use bounded terminal/bash `rg` and targeted `sed`/`cat` only.

## Operational metadata

- **Model tier:** persistent implementer/thorough — history synchronization, broad validation, and preservation classification require repository-level judgment.
- **Time-box:** 150 minutes wall clock. Return a precise gate matrix and handoff at context/tool ceiling rather than silently skipping commands.
- **Halt conditions:** Rebase conflicts reveal a semantic design conflict; predecessor commits would be duplicated; fixture/contract or codec JSON/SQL drift appears; required gate exposes an in-scope regression that cannot be fixed without new design; prototype checksum changes; current main has an unrelated deterministic failure blocking required validation; any destructive Git or `git stash*` action.
