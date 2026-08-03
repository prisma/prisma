# Summary

Route every on-disk contract read in the CLI through the family `ContractSerializer` (`familyInstance.validateContract`), strip the SQL family's silent shape-coercion in `normaliseTypeEntry` so the deserializer is strict, and close the test-coverage gap that let the demo's migration history rot without any CI alarm. No backwards compatibility for old on-disk contract shapes; the demo's `end-contract.json` / `start-contract.json` files are regenerated under the new strict deserializer. Closes TML-2536 (`prisma-next migration plan` against `examples/prisma-8-demo` crashes with `PN-CLI-4999` because the predecessor snapshot's polymorphic `storage.types` entries bypass the serializer and the planner dispatches on a `kind` discriminator that was never stamped).

# Description

## Background

The SQL family ships a `ContractSerializer` SPI at `packages/1-framework/1-core/framework-components/src/control/contract-serializer.ts` whose explicit purpose is to be the single seam between on-disk JSON and in-memory IR. The SQL family base (`packages/2-sql/9-family/src/core/ir/sql-contract-serializer-base.ts`) composes the pipeline: arktype structural validation → `hydrateSqlStorage` (constructs `SqlStorage` and friends) → target-specific construction hook. `familyInstance.validateContract(json)` is the single named entry point that callers use to cross the seam.

Multiple CLI commands skip the seam by casting `JSON.parse(raw) as Contract` directly. Because `Contract` in `packages/1-framework/0-foundation/contract/src/contract-types.ts` is a structural `interface`, the cast compiles cleanly and looks innocent in review. The bypass sites are:

- `packages/1-framework/3-tooling/cli/src/commands/migration-plan.ts:72-87` — `readPredecessorEndContract` returns `JSON.parse(raw) as Contract`. This is the snapshot-read path TML-2512 consolidated into one helper after dropping the inlined `fromContract` / `toContract` from `migration.json`. The TML-2536 ticket flagged this as the natural home for the fix.
- `packages/1-framework/3-tooling/cli/src/commands/migration-plan.ts:186-196` — the current `toContractJson` is cast before being passed to the planner. Validation happens *later* via `familyInstance.validateContract(toContractJson)` on a separate path; the seam isn't enforced at the read.
- `packages/1-framework/3-tooling/cli/src/commands/migration-new.ts:92-102`.
- `packages/1-framework/3-tooling/cli/src/commands/migration-apply.ts:159-178`.
- `packages/1-framework/3-tooling/cli/src/commands/migration-show.ts:281-289`.
- `packages/1-framework/3-tooling/cli/src/commands/db-verify.ts:265-280` — casts to `Record<string, unknown>` rather than `Contract`, then hands to a family method that re-validates internally. Functionally OK today but the same cast-at-the-boundary pattern that should also route through the seam for consistency.

These bypasses were silent — and still appear correct in tests — because the in-memory `SqlStorage` constructor calls `normaliseTypeEntry` in `packages/2-sql/1-core/contract/src/ir/sql-storage.ts:100-130`, which silently stamps `kind: 'codec-instance'` on untagged codec triples via the fallthrough at line 129. Every code path that goes through the deserializer (i.e. through `new SqlStorage(...)`) silently absorbs the legacy untagged shape. Only the snapshot-read path that bypasses the deserializer *and* dispatches on raw `entry.kind` ever sees the untagged shape and crashes — and the demo is the only checked-in artefact in tree where that combination triggers.

The demo isn't in CI. No fixture in `packages/1-framework/3-tooling/cli/test/commands/migration-e2e.test.ts` builds a contract with a polymorphic `storage.types` entry. The bug went undetected end-to-end.

## Why the obvious fixes are the wrong shape

- **Adding a `formatRevision` field on contracts + an upcaster** (TML-2536's original proposal): rejected. The project is in 0.x and `.cursor/rules/no-backward-compatibility.md` is unambiguous — no migration paths, no deprecation, no upcast scaffolding. TML-2515 will define a real back-compat policy later; until then, breaking on-disk shapes is cheaper than carrying versioned shape adapters.
- **Adding tolerant per-consumer dispatch in `contract-to-schema-ir.ts` and `verify-sql-schema.ts`** (TML-2536's "wrong-layer" alternative): rejected for the reasons the ticket itself names — silent miscategorisation; recurring back-compat surface at every consumer.
- **Branding `Contract` so the cast becomes a compile error**: dropped by the user during shaping. Convention + rule + lint are the prevention story instead.

## What this project does

- Routes every on-disk contract read in the CLI through `familyInstance.validateContract`. The four (or five, counting `db-verify`) bypass sites stop casting and start deserialising.
- Strips the fallthrough in `normaliseTypeEntry` so the SQL `SqlStorage` constructor accepts only the strict tagged shape. Format drift becomes a loud throw at the deserializer for every code path simultaneously, including the in-memory authoring path.
- Regenerates the demo's per-package `start-contract.json` / `end-contract.json` snapshots under the new strict deserializer.
- Rewrites `.cursor/rules/contract-normalization-responsibilities.mdc` so it reflects what the serializer actually does, and adds a rule treating `as Contract` (single-step cast, not the `as unknown as Contract` blind-cast pattern already covered by `type-predicates.mdc`) as a serializer-bypass smell. Connects the rule to the review skills so reviewers surface the smell during code review.
- Adds a grep-based CI lint that fails on `as Contract\b` and `as Contract<` outside whitelisted files (test files + the serializer implementation files), so the next bypass site can't merge by accident.
- Closes the test gap that hid this bug: adds one fixture per polymorphic-slot `kind` exercising the snapshot-read path, and adds a CI job that runs the demo's `migration plan` workflow against its checked-in history (so "the demo stops working" is a failed test, not an undetected rot).

# Requirements

## Functional Requirements

- Every on-disk contract read in `packages/1-framework/3-tooling/cli/src/commands/**.ts` (or wherever the bypass sites live after rebases) routes through `familyInstance.validateContract` (or the equivalent family-instance call available at the site).
- The cast pattern `JSON.parse(...) as Contract` no longer appears anywhere in `packages/**/src/**`. The pattern `JSON.parse(...) as unknown` followed by `validateContract<Contract>(...)` is the replacement idiom (per the existing `typed-contract-in-tests.mdc` rule).
- `normaliseTypeEntry` in `packages/2-sql/1-core/contract/src/ir/sql-storage.ts` no longer accepts untagged codec triples. The fallthrough on line 129 is removed; an entry that does not pass `isPostgresEnumStorageEntry` or `isStorageTypeInstance` throws a clear diagnostic naming the entry and its `kind` (or "missing `kind`").
- The demo's `examples/prisma-8-demo/migrations/app/**` per-package `start-contract.json` / `end-contract.json` files are regenerated under the strict deserializer and committed.
- `.cursor/rules/contract-normalization-responsibilities.mdc` is rewritten to match current behaviour: the serializer (`familyInstance.validateContract` / `ContractSerializer.deserializeContract`) is the single normalisation seam; the validator validates *and* normalises (via hydration into class instances); the builder authors contracts but does not own normalisation alone.
- A rule (new file or addition to an existing rule) declares: any cast `as Contract` (or `as Contract<…>`) in production code is a serializer-bypass smell — replace with `validateContract<Contract>(JSON.parse(raw) as unknown)`. The rule links to `validate-contract-usage.mdc` and is referenced from the review skills (`.agents/skills/drive-code-review`, `.agents/skills/drive-pr-local-review`) so reviewers flag it.
- A workspace script (e.g. `pnpm lint:no-contract-cast` or a new step under `pnpm lint:deps`) fails on `as Contract\b` and `as Contract<` outside whitelisted paths: test files (`**/*.test.ts`, `**/*.test-d.ts`), test fixtures, and the serializer implementation files (`packages/2-sql/9-family/src/core/ir/sql-contract-serializer-base.ts` and the concrete subclasses). The script runs in CI.
- A test fixture per polymorphic-slot `kind` currently shipped in tree (`codec-instance`, `postgres-enum`, plus any pgvector-contributed kinds) exercises the snapshot-read path end-to-end through `readPredecessorEndContract` (or the equivalent test seam). Each fixture is committed and named for the kind it pins.
- A CI job runs the demo's CLI workflow: `pnpm prisma-next migration plan` (no-op against the checked-in history) and `pnpm prisma-next migration apply` (against an ephemeral local Postgres or equivalent harness if one exists; otherwise plan-only). Failure of either fails the job.

## Non-Functional Requirements

- **No new public API.** This is internal hygiene + a behaviour-tightening of the deserializer.
- **No code under `packages/**/src/**` retains the cast pattern.** Verified by the new CI lint.
- **No back-compat shims.** The strict deserializer rejects untagged shapes; old fixtures must be regenerated or deleted, not coerced.
- **Layering bleed deferred.** `PostgresEnumStorageEntry` + `PostgresEnumTypeSchema` + Postgres-specific branching in family core is documented as related-but-out-of-scope ([TML-2537 comment](https://linear.app/prisma-company/issue/TML-2537#comment-15f3a0fd)); this project leaves the existing file layout alone.

# Acceptance Criteria

| AC ID | Description |
| --- | --- |
| AC-1 | `readPredecessorEndContract` calls `familyInstance.validateContract` (or `target.contractSerializer.deserializeContract`); its return type is the hydrated `Contract`, not raw JSON. The cast `as Contract` is removed from this function. |
| AC-2 | The `JSON.parse(...) as Contract` cast pattern is absent from `packages/**/src/**` (verified by grep + CI lint). `migration-new.ts`, `migration-apply.ts`, `migration-show.ts`, the second site in `migration-plan.ts`, and the `db-verify.ts` boundary read all route through the serializer or use `as unknown` + `validateContract`. |
| AC-3 | `normaliseTypeEntry` in `sql-storage.ts` no longer has a permissive fallthrough. An untagged codec triple input throws an exception with a diagnostic naming the entry (e.g. `Embedding1536`) and the missing/unknown `kind`. |
| AC-4 | `pnpm prisma-next migration plan` against `examples/prisma-8-demo` does not crash with `PN-CLI-4999` or any other deserialization error. Re-running `migration plan` against the demo's checked-in history is a no-op. |
| AC-5 | The demo's per-package `start-contract.json` / `end-contract.json` files are regenerated under the strict deserializer. The `migration.json` manifest is unchanged (per TML-2512, those bookends are already absent). |
| AC-6 | `.cursor/rules/contract-normalization-responsibilities.mdc` accurately describes the serializer-as-normalisation-seam and explicitly states: the validator hydrates (normalises into class instances); the builder authors; the serializer is the one boundary every on-disk read crosses. References to the now-defunct "validator does NOT normalize" stance are removed. |
| AC-7 | A rule (new file or amendment) declares `as Contract` / `as Contract<…>` a serializer-bypass smell in production code and prescribes the `as unknown` + `validateContract` replacement. The rule is linked from `validate-contract-usage.mdc` and referenced from the review skills. |
| AC-8 | A workspace script greps for `as Contract\b` and `as Contract<` in `packages/**/src/**`, fails on any hit outside the allowlist, and runs as part of the CI lint gate. |
| AC-9 | One fixture per polymorphic-slot `kind` shipped in tree exists under a test package and exercises the snapshot-read seam. Each fixture is named for the kind it pins. The fixture set explicitly covers `codec-instance` and `postgres-enum` at minimum; if pgvector or any other extension contributes additional kinds today, those are covered too. |
| AC-10 | A CI job runs `pnpm prisma-next migration plan` against `examples/prisma-8-demo` (and `migration apply` if the existing test harness has database infrastructure). The job fails when the demo workflow fails. |
| AC-11 | `pnpm typecheck`, `pnpm test:packages`, `pnpm lint:deps`, and the new `as Contract` lint all pass. |

# Out of scope

- **Backwards compatibility for legacy on-disk contract shapes.** Old shapes are rejected, not upcast. TML-2515 owns the policy question.
- **`formatRevision` / `canonicalVersion`-style versioning of contracts.** Rejected during shaping.
- **Branded `Contract` type for compile-time enforcement.** Dropped by user during shaping. Convention + rule + lint is the prevention story for now.
- **Layering cleanup for `PostgresEnumStorageEntry` / `PostgresEnumTypeSchema` in family core.** Real smell; handled by TML-2537 instead. See the [comment posted there](https://linear.app/prisma-company/issue/TML-2537#comment-15f3a0fd).
- **An ADR.** The decision reduces to "use the serializer that already exists for this purpose." That's not a new architectural decision worth recording — it's reinforcing the existing one. The rule rewrite is the durable record.
- **Mongo-family parity.** The Mongo `ContractSerializer` (`packages/2-mongo-family/9-family/src/core/ir/mongo-contract-serializer.ts`) is structurally equivalent and out of scope for this fix unless TML-2536-equivalent bypasses exist in Mongo CLI paths (they don't appear to; verify during execution and add to scope only if found).

# Open Items

- **`db-verify.ts` boundary read.** Functionally OK today because the family `verify` method re-validates internally. Include in the fix for consistency unless rebasing reveals a reason not to.
- **Pgvector / other extension-contributed `kind` values.** Need a sweep during execution to enumerate the actual fixture set required for AC-9.
- **Demo-in-CI harness shape.** `pnpm prisma-next migration plan` is harness-light (no database needed for plan); `migration apply` needs a database. Use whichever test harness `examples/prisma-8-postgis-demo/test/utils/test-database.ts` or similar already provides; if no shared harness exists, scope down to plan-only and file a follow-up for apply coverage.

# Slice DoD

Authored against `projects/drive-domain-model/principles/definition-of-done.md` § Slice DoD template + `projects/drive-domain-model/calibration/prisma-next.md` § 3.2 overlay. The PR is mergeable when:

**Protocol-layer items:**

- [ ] Spec outcome met — every AC above verified against the PR diff
- [ ] All dispatches in `plans/plan.md` have satisfied their dispatch DoD (each closed by orchestrator post-flight check)
- [ ] PR is review-clean — reviewer subagent verdict accept; orchestrator-tier intent-validation pass; findings either addressed or explicitly accepted
- [ ] Intent-validation passes — the orchestrator-tier check confirms the PR delivers spec intent, not just AC-literal compliance (e.g. no codemod that satisfies "stamps `kind`" by re-routing through a new helper that does the same silent-coercion work — the § 4.1 failure mode)
- [ ] No silent spec/plan amendments (I12) — any mid-flight edit to spec.md or plans/plan.md was operator-authorised or design-discussion output
- [ ] Manual QA satisfied — `manual-qa.md` script exists; ≥1 run report exists under `manual-qa-reports/`; no unresolved 🛑 Blocker findings; ⚠️ High findings addressed or accepted; script names both prisma-next QA audiences (extension authors via `packages/3-extensions/`, end users via `examples/`) per `projects/drive-domain-model/calibration/prisma-next.md` § 9.1
- [ ] Scope-deferred candidates recorded (in `deferred.md` if any surface; orchestrator scratch otherwise)
- [ ] Retro fired — at minimum, log the slice-PR-cap borderline-triage call for future calibration; additional retros if learnings surface

**prisma-next overlay (§ 3.2):**

- [ ] Linear issue TML-2536 moved to "Ready to be merged"
- [ ] PR title carries `tml-2536:` prefix
- [ ] PR description follows `drive-pr-description` shape (decision-led, narrative)
- [ ] PR linked to TML-2536 via GitHub integration (auto-close wired)
- [ ] No `projects/` references in long-lived files added by the slice (per doc-maintenance rule; grep gate from calibration § 5.3)

**Close-out** (orthogonal to merge — runs after merge):

- [ ] Strip references to `projects/tml-2536-contract-deserializer-seam/**` from `docs/`, READMEs, comments, durable artefacts. The rule rewrite is the durable record; the project folder is disposable.
- [ ] Delete `projects/tml-2536-contract-deserializer-seam/`.
- [ ] Close PR #520 with a pointer to this PR.
