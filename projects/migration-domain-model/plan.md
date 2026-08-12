# Migration CLI restructure — plan

**Spec:** [`spec.md`](./spec.md)
**Audit:** [`cli-audit.md`](./cli-audit.md)
**Vocabulary:** [`domain.md`](./domain.md)
**Linear:** [TML-2546](https://linear.app/prisma-company/issue/TML-2546/review-migration-cli-commands-and-vocabulary) for shaping; per-milestone tickets are created when each milestone starts.

## Summary

Seven milestones, seven PRs. Milestones M2 through M6 are independent and could land in any order or in parallel (one PR each); M1 is foundational and must land first; M7 is close-out. The work is sized by how much it changes the user-facing CLI surface and how heavily the journey suite exercises the affected verbs.

```
M1 ── foundation ──────────────────────────────┐
                                               ▼
       M2 (migrate)   M3 (ref)   M4 (status split)   M5 (sign args)   M6 (check)
                                               │
                                               ▼
                                            M7 ── close-out (docs + cleanup)
```

The dominant per-milestone cost is **journey-test rewrite, not implementation**. Every milestone that renames or moves a verb touches `test/integration/test/cli-journeys/*.e2e.test.ts` and the helpers in `test/integration/test/utils/journey-test-helpers.ts`. We size each milestone accordingly.

`migration preflight` is out of scope here ([spec § Non-goals](./spec.md#non-goals)); a separate project will design and ship it.

## Cross-project dependencies

None. The CLI is downstream of every framework subsystem this work doesn't touch (planner, runner, verifier, marker / ledger). The journey suite already exercises every path this project changes.

## Risk surface (principal engineer's read)

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| **Journey test churn** | High | Per-milestone PR review burden | Each milestone owns its journey-test updates atomically. No transitional aliases means tests rewrite once, not twice. |
| **Reference resolver bugs** in M1 land everywhere downstream | Medium | Test failures appear in M2+ PRs and look like rename bugs | M1 ships with unit tests covering every grammar form, every ambiguity rule, every error path (including the wrong-grammar diagnostic matrix in [spec FR5](./spec.md#functional-requirements)). Errors are localised to the resolver, not the consuming command. |
| **`migration check` exit-code drift** | Low | Scripts pinned to the wrong code | M6 lands the exit-code module (`commands/migration-check/exit-codes.ts`) as part of the PR and references it from spec FR6's table. |
| **Vocabulary drift in subsystem docs** | Medium | Docs reference removed verbs (`migration apply`, `migration ref`) and confuse future readers | M7 grep-sweeps `docs/` for the old names; the close-out PR is the gating point. |
| **Internal helper renames are opportunistic, then forgotten** | Low | Internal naming carries the rejected "applied" past close-out | The opportunistic rule is documented in the spec's Non-goals; a follow-up Linear ticket captures the residual sweep. |

## Milestones

### M1 — Reference-resolver foundation (FR5)

**Goal:** the contract-reference and migration-reference grammars are implemented as resolvers consumed by every command that takes a `<contract>` or `<migration>` argument. The existing flag *names* don't change yet; their argument grammars broaden.

**Architectural shape.** Two resolvers, two types:

- `ContractRef` is a parsed-and-resolved value carrying the storage hash plus provenance (which grammar form produced it). `parseContractRef(input, ctx)` reads the file system / refs index and either returns a `ContractRef` or a structured error.
- `MigrationRef` is the parallel type for the `<migration>` grammar (directory name or hash).
- Both resolvers live next to the existing migration-tools code (`packages/1-framework/3-tooling/migration/src/refs/` is the obvious neighbour to `refs.ts`).

The resolver yields one error type with cases for each failure mode in the spec's AC2 / FR5 — `NotFound`, `Ambiguous` (with candidate list), `WrongGrammar` (passed a `<contract>` reference where a `<migration>` was expected), `InvalidFormat`.

**Tasks (TDD; tests first):**

- [ ] Unit-test the contract-reference resolver covering all five grammar forms, all ambiguity cases, and all error paths. The test fixture builds a small on-disk graph (a few hashes, a few refs, a couple of migration directories with deliberately hex-shaped names to exercise ambiguity).
- [ ] Implement `parseContractRef` + `parseMigrationRef`.
- [ ] Update existing CLI commands to use the resolver for the *argument* they already accept (not yet renamed):
  - `migration plan --from <hash>` → underlying parse goes through `parseContractRef`.
  - `migration apply --ref <name>` → underlying parse goes through `parseContractRef`. (Keeps the `--ref` flag name; the broader grammar is M2's surface concern.)
  - `db update --to <hash>` → broaden to full grammar.
  - `migration ref set <name> <hash>` → broaden.
  - `migration status --ref <name>` → broaden.
  - `migration show <dir-name>` → already accepts a directory name; route through `parseMigrationRef` so other forms work.
- [ ] Add the help text for each command's argument noting it accepts the full grammar (one-line description, link to a help topic).
- [ ] Journey tests that pass hashes / ref names where the resolver should accept either continue to pass.

**Validation.** AC2 verified by unit test. `pnpm test:journeys` passes unchanged. No surface rename has happened yet — every command in the current surface still exists and accepts its current flag names.

**Why this first.** Every subsequent milestone takes the resolver as a given. Landing it as a self-contained foundation means M2–M6 are pure verb-surface changes that don't also have to re-derive the grammar.

---

### M2 — Top-level `migrate --to <contract>` (FR1)

**Goal:** the bare-verb form for advancing the live database is `prisma-next migrate --to <contract>`. The old `prisma-next migration apply [--ref X]` is gone.

**Tasks (TDD; tests first):**

- [ ] Update the journey-test helper: `runMigrationApply(ctx, ['--ref', X])` → `runMigrate(ctx, ['--to', X])`. Rename the helper; update every call site (~10 journeys).
- [ ] Update journey-test assertions referencing the verb name in error messages (e.g., `migration-apply-edge-cases.e2e.test.ts` — assertions on "no path" error text).
- [ ] Add `packages/1-framework/3-tooling/cli/src/commands/migrate.ts` implementing the new top-level verb. Implementation is the existing `migration-apply.ts` body with the flag renamed, the resolver from M1 wired in, and the help text rewritten.
- [ ] Register the new command in `cli.ts`. Remove the `migrationApplyCommand` registration. Delete `migration-apply.ts`.
- [ ] Update the help text and error envelopes in `cli.ts` "Unknown command" handler — running `prisma-next migration apply ...` now triggers an unknown-command error with a candidate-suggestion pointing at `migrate`.
- [ ] Update `docs/architecture docs/subsystems/7. Migration System.md` for every reference to `migration apply`. (Scope: only the references that exist; the larger doc rewrite is M7.)
- [ ] **Add `--to <contract>` flag to `db update`.** The intended-surface diagram in the spec shows `db update [--to <contract>]`, but no milestone owned the addition; M1's implementer surfaced this gap. The flag is structurally identical to `migrate --to`: argument routes through the M1 resolver; when present, the verb advances the database to the named contract instead of auto-resolving to the emitted one. Implementation slots cleanly alongside the new `migrate` command in M2's commit cluster. Help text + a single journey-test assertion for the new flag round it out.

**Validation.** AC1 (no `migration apply` in `--help`), AC8 (journey suite green). Manual verification: `prisma-next migrate --to <hash>`, `prisma-next migrate --to production`, `prisma-next migrate --to ./other/contract.json`, and `prisma-next db update --to <hash>` all do the right thing on a live test DB.

**Why before M3–M6.** This is the highest-leverage rename and the one most disruptive to the journey suite. Landing it first makes M3–M6's helper renames smaller deltas against a settled base.

---

### M3 — Top-level `ref` namespace (FR2)

**Goal:** `prisma-next ref *` replaces `prisma-next migration ref *`. The `get` sub-verb is dropped; the new surface is `set` / `list` / `delete`.

**Tasks (TDD; tests first):**

- [ ] Update `runMigrationRef(ctx, ['set', name, hash])` → `runRef(ctx, ['set', name, hash])` in `journey-test-helpers.ts`. Update every call site (~5 journeys, predominantly `ref-routing` and `divergence-and-refs`).
- [ ] Add `packages/1-framework/3-tooling/cli/src/commands/ref.ts` (or `commands/ref/` for the three subcommands) hosting `set`, `list`, `delete`. Implementation copies from `migration-ref.ts`; the previous `get` body is deleted (callers who want to inspect one ref use `ref list` and filter by name). The `<contract>` argument goes through the M1 resolver.
- [ ] Register the new top-level `ref` command in `cli.ts`. Remove the `migrationRefCommand` mounting under `migrationCommand`. Delete `migration-ref.ts`.
- [ ] Update help text and unknown-command-suggestion paths.

**Validation.** AC1 (no `migration ref` in `--help`), AC8 (journey suite green).

---

### M4 — Split `migration status` into five verbs (FR3)

**Goal:** `migration status`, `migration log`, `migration list`, `migration graph` are four separate verbs, each answering one question. The old multi-flag `status` is gone.

**Architectural shape.** The current `migration-status.ts` (~1100 lines) houses four interrogative responses behind flag combinations. The split:

- `migration status` retains the path/pending question. New flag surface: `--to <contract>` / `--from <contract>`. Reads marker + computes path.
- `migration log` reads the ledger and renders the executed-migrations history.
- `migration list` enumerates `migrations/<space>/*` on disk, topologically ordered.
- `migration graph` renders the graph (ASCII tree by default, `--json` / `--dot` for other formats).

The split is a mechanical extraction of the four response-rendering paths inside `migration-status.ts` into four sibling commands. Shared helpers (the renderer fragments) move to a shared module.

**Tasks (TDD; tests first):**

- [ ] In `journey-test-helpers.ts`:
  - Update `runMigrationStatus` to use `--to` instead of `--ref`.
  - Add `runMigrationLog`, `runMigrationList`, `runMigrationGraph`.
- [ ] Update journey tests:
  - `migration status --ref X` → `migration status --to X` (~6 journeys).
  - `migration status --all` callers (if any) → `migration log` or `migration list` per intent.
  - `migration status --graph` callers (if any) → `migration graph`.
- [ ] Extract the response renderers to `commands/migration-status/renderers/`.
- [ ] Add `commands/migration-log.ts`, `commands/migration-list.ts`, `commands/migration-graph.ts`. Each is a thin entry point that calls the relevant renderer.
- [ ] Slim `commands/migration-status.ts` down to the path/pending question + `--to`/`--from` flags. Remove `--ref`, `--graph`, `--all`, `--limit`.
- [ ] Register the three new commands in `cli.ts`.
- [ ] **Discoverability — See also** (per spec FR3 / AC7): add `setCommandSeeAlso(command, refs: readonly { verb: string; oneLiner: string }[])` in `utils/command-helpers.ts`, parallel to the existing `setCommandExamples`. Render it in `utils/formatters/help.ts` immediately under the Examples section. Wire it up on all four verbs (`status`, `log`, `list`, `graph`) cross-referencing the other three plus `show`.
- [ ] **Discoverability — removed-flag hints** (per spec FR3 / AC7): when `migration status` receives `--graph`, `--all`, or `--ref`, the unknown-flag handler emits a `fix:` line naming the right replacement verb. Implement once in the status command's option parser (these flags are no longer declared, so commander.js will reject them as unknown — intercept and rewrite the error envelope). One assertion per flag in the milestone's journey-test set.

**Validation.** AC1, AC3, AC7, AC8. Manual verification of each new verb's stdout against the previous all-in-one shape; manual verification of the removed-flag hints by running each old invocation.

---

### M5 — `db sign` contract argument (FR4)

**Goal:** `db sign` accepts an optional contract argument (positional or `--contract`). With no argument, the current behavior (sign with `contract.json`) is preserved exactly.

**Tasks (TDD; tests first):**

- [ ] Extend `runDbSign` to accept extra args.
- [ ] Add a journey test (extend `brownfield-adoption.e2e.test.ts` or add a small new journey) exercising:
  - `db sign` (no arg, default) — current behavior, regression-protected.
  - `db sign <hash>` (positional, hash prefix).
  - `db sign --contract <ref>` (explicit, ref name).
- [ ] Extend `db-sign.ts`: positional `[<contract>]` argument and `--contract <contract>` flag. The two are equivalent; mutually exclusive at the parse step (CLI usage error if both are supplied). Argument goes through the M1 resolver.
- [ ] Update help text.

**Validation.** AC4. Smallest and most contained of the surface changes; could land in parallel with any other milestone.

---

### M6 — `migration check [<m>]` (FR6)

**Goal:** the artifact / graph integrity verb exists. With a `<m>` argument, checks one migration. Without, checks the graph.

**Architectural shape.** `migration check` is read-only over the filesystem. The per-migration check recomputes the migration's hashes from its on-disk artifacts and compares to the stored manifest; it validates the `ops.json` matches its declared shape. The graph-wide check additionally walks every edge and verifies the `from` / `to` contracts referenced exist on disk and connect to neighbouring migrations correctly, and walks the refs index verifying every ref's target hash exists in the graph.

The functions for hash recomputation already exist (used by `migration plan`'s manifest emission); this verb wraps them in an interrogative shape.

**Exit codes (per spec FR6).** `0` (`OK`), `2` (`PRECONDITION`, CLI-wide), `4` (`INTEGRITY_FAILED`, command-specific). The numeric code groups outcomes for shell-level branching; per-failure PN codes (`PN-MIG-CHECK-001` through `005`) discriminate precisely within the integrity-failed bucket.

**Tasks (TDD; tests first):**

- [ ] Add `commands/migration-check/exit-codes.ts` exporting named constants for `OK = 0`, `PRECONDITION = 2`, `INTEGRITY_FAILED = 4` per the Style Guide's reserved-code rules.
- [ ] Adversarial-fixture journey tests covering AC5:
  - Clean graph passes (exit `0`).
  - Hand-mutated `ops.json` (hash mismatch) → exit `4`, PN code `PN-MIG-CHECK-001 HASH_MISMATCH`.
  - Corrupted manifest (missing files) → exit `4`, `PN-MIG-CHECK-002 MANIFEST_INCOMPLETE`.
  - Orphan migration (no graph-connecting edge) → exit `4`, `PN-MIG-CHECK-003 ORPHAN_MIGRATION`.
  - Dangling ref (target hash absent) → exit `4`, `PN-MIG-CHECK-004 DANGLING_REF`.
  - Mismatched edge → exit `4`, `PN-MIG-CHECK-005 EDGE_MISMATCH`.
  - Non-existent named migration → exit `2`, `PRECONDITION`.
- [ ] Add `commands/migration-check.ts`. Per-migration and graph-wide code paths share a result type carrying a list of `{ pnCode, where, why, fix }` entries; the renderer formats them into the standard human / JSON envelopes.
- [ ] Register in `cli.ts`.
- [ ] Add to `journey-test-helpers.ts` as `runMigrationCheck`.

**Validation.** AC5.

---

### M7 — Close-out (docs)

**Goal:** docs match the surface; vocabulary lives in canonical locations. The project directory is **retained** through PR review + QA — see § Operating-context note below — so the spec, plan, audit, domain map, and reviews are available to the reviewer + QA runner. A separate close-out task after the PR merges will delete the directory once QA artefacts have been migrated.

**Tasks:**

- [ ] Promote `domain.md`'s settled vocabulary into `docs/glossary.md` (or fold and replace; depends on what's there).
- [ ] Update `docs/architecture docs/subsystems/7. Migration System.md` for the full new verb taxonomy. Remove references to `migration apply`, `migration ref`, `migration status --ref/--graph/--all`. Add `migration check`. Note `migration preflight` as the next-vocab gap pending a separate project. Update the Git-inspired analogy section to use the resolved vocabulary (contract / migration / ref distinctions).
- [ ] Update `docs/CLI Style Guide.md` for the new top-level subjects (`migrate`, `ref`).
- [ ] **Grep-sweep is wider than the original plan called for.** In addition to `docs/` and `packages/*/README.md` / `DEVELOPING.md`, sweep `**/SKILL.md` files and non-CLI source-file comments (especially `packages/0-shared/skills/skills/prisma-next-debug/SKILL.md`, `packages/1-framework/1-core/framework-components/src/control/control-capabilities.ts`, `packages/3-mongo-target/1-mongo-target/src/core/control-target.ts`, `packages/2-mongo-family/9-family/src/core/schema-verify/canonicalize-introspection.ts`). Rationale recorded in `wip/unattended-decisions.md § 7`. After the sweep, `rg 'migration apply|migration ref |migration status --ref|--graph|--all|--limit' packages/ docs/` should produce zero hits outside the project directory itself (which is retained for review per the operating-context note).
- [ ] File the follow-up Linear ticket for the `migration preflight` project (carries the design questions: sandbox lifecycle, initial-state strategy, Postgres + Mongo flavors).
- [ ] File a follow-up Linear ticket for the residual internal renames (`MigrationApplied` event, `control-api/operations/` → `commands/`, etc.) that this project explicitly carries as non-goals.
- [ ] File a follow-up Linear ticket (or reuse TML-2546) tracking the eventual deletion of `projects/migration-domain-model/` once QA artefacts are migrated. Do NOT delete the directory in this PR.

**Validation.** AC1, AC9. `pnpm fixtures:check` and `pnpm lint:deps` pass. `pnpm test:journeys` and `pnpm test:all` are green.

**Operating-context note (orchestrator amendment, see `wip/unattended-decisions.md § 8`).** The plan originally specified deleting `projects/migration-domain-model/` in M7. The user has directed during execution that the project directory must be retained through PR review + QA so the reviewer and QA runner have access to the spec, plan, audit, domain map, references, and reviews. M7 therefore stops at the docs migration; the directory deletion is deferred to a post-merge cleanup task tracked separately.

#### M7 R2 — Forward-compatible doc-framework alignment (orchestrator amendment)

**Why this exists.** The project produced substantial modeling work (`domain.md`, `established-conventions.md`, vendor research under `references/`) that would otherwise be lost when the project directory is eventually deleted. The user directed mid-execution that this content must be preserved in durable homes, *forward-compatible with the `docs-framework` skill's `docs/design/` layout but without wholesale framework adoption.* Rationale recorded in `wip/unattended-decisions.md § 10`.

**Goal.** Port the modeling work into `docs/design/` paths that match the framework's expected layout exactly, so a future framework-adoption project lays in the missing slots without moving migration content a second time. No other framework slots are created.

**Tasks:**

- [ ] Port `projects/migration-domain-model/domain.md` → `docs/design/10-domains/migration/README.md`. Rename to `README.md` per the framework's per-slot convention. Strip project-artefact references (workspace rule: durable docs do not reference `projects/<x>/...`, milestone IDs, AC IDs, etc.). Align vocabulary with `docs/glossary.md` as updated by M7 R1 — any drift between `domain.md`'s wording and the glossary resolves toward the glossary.
- [ ] Port `projects/migration-domain-model/established-conventions.md` → `docs/design/04-inspirations/migrations/established-conventions.md`. Strip project-artefact references.
- [ ] Port `projects/migration-domain-model/references/atlas.md` → `docs/design/04-inspirations/migrations/atlas.md`.
- [ ] Port `projects/migration-domain-model/references/active-record.md` → `docs/design/04-inspirations/migrations/active-record.md`.
- [ ] Write `docs/design/README.md` — a slim entry doc that honestly frames the partial state: "this directory uses the `docs-framework` skill's layout. Currently populated: `04-inspirations/migrations/`, `10-domains/migration/`. Other framework slots (`00-purpose/`, `01-principles/`, `03-domain-model/`, `05-infrastructure/`, `06-operations/`, `90-decisions/`, `99-process/`) are not yet created; they will be added when there is content for them. Wholesale framework adoption is a separate, future decision."
- [ ] Write a brief `docs/design/04-inspirations/migrations/README.md` framing the inspirations (which systems, what we took from each).
- [ ] Write a brief `docs/design/10-domains/migration/README.md` introduction — actually, **rename** the ported `domain.md` directly into this slot. There is no separate intro file; the ported domain content *is* the README.
- [ ] Cross-link: `docs/architecture docs/subsystems/7. Migration System.md` gets a header note pointing at `docs/design/10-domains/migration/` for the conceptual domain reference. The domain doc has a complementary pointer at the bottom to the subsystem doc for implementation details.
- [ ] Update TML-2553 (the project-directory deletion ticket) to reflect that the keeper content has been migrated — the post-merge close-out is now a pure delete, no migration step needed.

**Tasks explicitly NOT in this round:**

- Do NOT create `docs/design/00-purpose/`, `01-principles/`, `03-domain-model/`, `05-infrastructure/`, `06-operations/`, `90-decisions/`, or `99-process/`. Empty scaffolds imply false completeness.
- Do NOT move `docs/glossary.md` into `docs/design/03-domain-model/glossary.md`. M7 R1 just landed clean content there; it stays canonical. The glossary location inversion is a separate, future decision.
- Do NOT migrate ADRs from `docs/architecture docs/adrs/`. The framework explicitly says "keep existing ADR system."
- Do NOT trim the subsystem doc's "Mental model" section even though it now duplicates the domain doc. That trim is a separate, deliberate edit; deferring keeps blast radius small.
- Do NOT delete `projects/migration-domain-model/`. The user-override on retention still applies.

**Validation.** AC9. `pnpm lint:deps` passes. `pnpm test:journeys` and `pnpm test:all` are green (modulo pre-existing Postgres infra-noise per M7 R1's documented baseline). The M7 R1 grep-sweep gate (`rg 'migration apply|migration ref |migration status --(ref|graph|all)|--limit' packages/ docs/ -g '!projects/**'`) must still produce zero hits — the port must NOT reintroduce stale verbs.

#### M7 R3 — QA-driven fix round (orchestrator amendment)

**Why this exists.** The first `drive-qa-run` pass (commit `793ec58a3`) returned ❌ Fail with two ⚠️ High findings and seven 📝 Follow-ups. Per the orchestrator's small-PR policy (decision §11 in `wip/unattended-decisions.md`), every finding is folded into this round rather than ticketed. After this round, the QA pass is re-run; the project is shippable when QA returns ✅ Pass (with or without follow-ups).

**Goal.** Both Highs fixed (AC5 and AC6 promises restored); cheap Follow-ups landed; QA script updated to match. No tickets filed for any finding.

**Tasks:**

- [ ] **F-1 (High) — `migration show` reachability.** In `packages/1-framework/3-tooling/cli/src/commands/migration-show.ts`, defer the aggregate-loader's pgvector-layout check until after `parseMigrationRef` resolves the input. The wrong-grammar diagnostic must reach the user even when the contract space hasn't been materialised yet. Add a journey test that exercises this path (invalid migration ref against a canonical-demo-state contract space without prior `migrate`) and asserts the diagnostic + exit code.
- [ ] **F-2 (High) — `migration check <m>` PN-005 false negative.** In `packages/1-framework/3-tooling/cli/src/commands/migration-check.ts`, lift the per-migration snapshot-consistency check (currently only invoked on the graph-wide path) into a shared helper called from both the graph-wide and per-migration branches. Add an adversarial fixture test for `migration check <m>` with planted PN-005 corruption (parallels the existing graph-wide test). Asserts exit 4 + `PN-MIG-CHECK-005`.
- [ ] **F-3 (Follow-up) — help ordering.** Reorder the top-level verb-family listing in `cli.ts`'s root-help formatter to match the spec's intended-surface diagram: `db` family, `migration` family, `migrate`, `ref`, then `init`. Currently `init` is at the bottom and `migrate` lands between `migration` and `ref`.
- [ ] **F-4 (Follow-up) — `migrate --help` lists 4/5 forms.** The `--to` help text in `commands/migrate.ts` is missing two of the five contract-reference forms (`<dir>^` and `./path`). Reproduce the full grammar in the help text.
- [ ] **F-5 (Follow-up, script) — wrong corruption recipe.** Update `projects/migration-domain-model/manual-qa.md` Scenario 4's "plant the corruption" recipe: the current recipe mutates `migration.json`'s hash (triggers PN-001), not `end-contract.json`'s `storageHash` (which triggers PN-005). Once F-2 lands, the per-migration recipe also becomes verifiable.
- [ ] **F-6 (Follow-up) — hash-prefix minimum length drift.** Domain doc at `docs/design/10-domains/migration/README.md` says 8+; glossary + implementation say 6+. Reconcile by updating the domain doc to match the implementation (6+). Search for any other doc that mentions hash-prefix length and align.
- [ ] **F-7 (Follow-up) — `migration graph --dot` shadowed by auto-JSON.** In `commands/migration-graph.ts`, the output-format resolver currently lets non-TTY auto-JSON detection win over an explicit `--dot` flag. Reverse the precedence: explicit `--dot` always produces DOT. Update the help text if it suggests anything to the contrary.
- [ ] **F-8 (Follow-up) — `where` field format inconsistent.** In `migration-check.ts`, normalise the `where` field across PN codes. Today PN-001's `where` is a full path (`migrations/<dir>/migration.json`); PN-005's `where` is a short dirname. Pick one (the full relative path is more useful for the user); apply consistently across all 5 PN codes.
- [ ] **F-9 (Follow-up, script) — pre-flight tree-cleanliness.** Update `projects/migration-domain-model/manual-qa.md` Pre-flight: the tree-cleanliness expectation must acknowledge two known-intentional uncommitted items (the `plan.md` amendment + `wip/unattended-decisions.md` updates). Either instruct the runner to commit them first (orchestrator does, in practice), to stash, or to acknowledge them as expected.

**Validation.** All 9 ACs PASS. `pnpm lint:deps` + `pnpm test:journeys` + `pnpm test:packages` clean modulo documented Postgres baseline. After implementer + reviewer pass, **re-run `drive-qa-run`** (resume the runner agent) against the updated script. QA must return ✅ Pass or ✅ Pass-with-follow-ups (no ⚠️ High or 🛑 Blocker). Once QA passes, push to remote + verify CI.

## Implementation rules (apply to every milestone)

- **Tests first.** Per the workspace rules — write the journey-test changes (the assertion against the new verb name / shape) *before* the implementation. The journey suite is the spec; failing tests pin the new shape down.
- **No transitional aliases.** Each rename is atomic. If a milestone leaves the journey suite red on its own PR boundary, the milestone hasn't landed.
- **Opportunistic internal renames only.** If a milestone touches `apply-aggregate.ts` and renaming it costs an extra five minutes, rename it. If the rename spans untouched files, it goes on the follow-up ticket.
- **One PR per milestone.**
- **Update `journey-test-helpers.ts` atomically.** Helpers follow the new verb names; callers update in the same PR. Don't leave helper names lagging behind the verbs.
- **Help text and error envelopes are part of the rename.** The CLI's "Unknown command" suggestion engine should already help when somebody runs the old name; verify in each milestone that the suggestion lands on the right new verb. The "See also" cross-references introduced in M4 (FR3) apply to every multi-verb cluster — wire them up wherever applicable in M2 (`migrate`), M3 (`ref *`), M4 (status split), and M6 (`migration check`).

## Linear tracking

Per the workspace rules, Linear issues exist for visibility, not for project bookkeeping. The intended cadence:

- One Linear issue per milestone (M1–M7). Branch names and PR titles carry the issue ID so the GitHub-Linear integration auto-transitions issues on merge.
- TML-2546 (the audit ticket) gets closed when M7 merges and the project directory is deleted.

Issues are created when a milestone starts, not up-front, to avoid stale tickets sitting around if the plan shifts.
