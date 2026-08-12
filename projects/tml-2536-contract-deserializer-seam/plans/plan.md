# Slice plan: Route on-disk contract reads through the serializer seam

Authored under `projects/drive-domain-model/` methodology. Decomposes the slice into a dispatch sequence sized at the M-cap, with each dispatch carrying DoR/DoD/edge-cases/inputs at the per-dispatch level.

**Spec:** [`../spec.md`](../spec.md)
**Methodology:** [`projects/drive-domain-model/model.md`](../../drive-domain-model/model.md), principles under [`projects/drive-domain-model/principles/`](../../drive-domain-model/principles/)
**Calibration:** [`projects/drive-domain-model/calibration/prisma-next.md`](../../drive-domain-model/calibration/prisma-next.md)

## Slice DoR check (run by orchestrator at slice-initiation time)

- [x] Slice spec exists ([`../spec.md`](../spec.md)); slice-DoD section appended per § Slice DoD
- [x] Slice plan exists (this file); dispatches decomposed below
- [x] Every dispatch sized ≤ M (table in § Dispatch sequence)
- [x] Outcome fits in one PR — borderline (logged for slice-closure retro; user-committed at re-cut triage)
- [x] Calibration entries linked — § 4.1 (dual-shape relocated), § 4.4 (feature-sized dispatch), § 4.5 (destructive git in subagents), § 5.3 (project-artefact-leak grep) all threaded into the relevant dispatches below
- [x] Spike dependencies resolved — upstream-overlap investigation captured in `wip/upstream-overlap-investigation.md` (worktree `tml-2536-bug-snapshot-contracts-on-disk-are-read-without`)
- [x] Design calls settled — validation-by-execution path chosen as **Option A** (in-place stamp of demo via codemod, not regenerate-from-scratch)
- [N/A] In-project: orphan slice with project-folder persistence (no parent project Linear unit) — slight model deviation; logged for slice-closure retro

## Collaborators

| Role | Person / agent | Context |
|---|---|---|
| Project owner | — (orphan slice) | n/a |
| Implementer (slice + dispatches D1, D2, D4, D7) | Operator (Will) + orchestrator agent | Design-heavy work; not delegable cleanly |
| Implementer (dispatches D3, D5, D6) | Implementer subagents | Mechanical work with tight briefs |
| Reviewer | Reviewer subagent + operator at PR | Per [`roles-and-personas.md`](../../drive-domain-model/principles/roles-and-personas.md), reviewer is a different actor from implementer |
| Related ticket | TML-2537 | Family-core layering cleanup; out of scope here |
| Related ticket | TML-2515 | Back-compat policy; this slice assumes "no back-compat" |

## Shipping strategy

Single PR. The change is intertwined enough that splitting leaves the demo broken in an intermediate state: stripping `normaliseTypeEntry`'s fallthrough invalidates the old `end-contract.json` files immediately, so demo regen (via codemod) has to land together. Commits sequenced so each individual commit leaves typecheck green; the demo CI job is added last so it doesn't fail until the substrate is consistent.

## Acceptance criteria ↔ test cases ↔ dispatch coverage

AC list is in [`../spec.md`](../spec.md) § Acceptance Criteria. TC ↔ dispatch coverage:

| AC | TC | Test case | Type | Covered by |
|---|---|---|---|---|
| AC-1 | TC-1 | `readPredecessorEndContract` return type is the hydrated `Contract`; no `as Contract` in its body | Type-level + grep | D1 |
| AC-2 | TC-2 | `JSON.parse(...) as Contract` absent from `packages/**/src/**` | Grep gate | D1 + D5 (lint guard) |
| AC-2 | TC-3 | All five CLI sites route through `familyInstance.validateContract` | Code review + grep for `validateContract` calls | D1 |
| AC-3 | TC-4 | `normaliseTypeEntry` rejects untagged codec triple with diagnostic | Unit (already landed in cherry-pick `dd054f651` / commit 2) | ✅ Phase 1 |
| AC-3 | TC-5 | `normaliseTypeEntry` still accepts tagged `codec-instance` + `postgres-enum` | Unit | ✅ Phase 1 |
| AC-4 | TC-6 | `pnpm prisma-next migration plan` against demo is a no-op (does not crash) | E2E / CI gate | D2 (substrate change) + D5 (CI gate) |
| AC-5 | TC-7 | Demo `start-/end-contract.json` validate under the strict serializer | Snapshot validation | D2 (codemod application) |
| AC-6 | TC-8 | `contract-normalization-responsibilities.mdc` accurately describes the serializer seam | Doc review | ✅ Phase 1 (commits `a918547ae`, `ed21bdcb9`) |
| AC-7 | TC-9 | A rule declares `as Contract` a serializer-bypass smell + review skills reference it | Doc review | ✅ Phase 1 (commits `a918547ae`, `ed21bdcb9`) |
| AC-8 | TC-10 | Workspace script greps for `as Contract\b` / `as Contract<` outside allowlist | Harness | D5 (lint guard cherry-pick + path-glob update) |
| AC-9 | TC-11 | One fixture per polymorphic-slot `kind` exists; exercises the snapshot-read seam | Unit | ✅ Phase 1 (commit `7dbbfe609`) |
| AC-10 | TC-12 | CI job invokes the demo's `migration plan` against checked-in history; fails on non-zero | CI config | D5 |
| AC-11 | TC-13 | `pnpm typecheck`, `pnpm test:packages`, `pnpm lint:deps`, `pnpm lint:no-contract-cast` all green | Harness | D7 (validation pass) |

## Dispatch sequence

7 dispatches. All sized ≤ M. Phase 1 (6 cherry-picks already landed on the v2 branch) is treated as D0 — a spike-flavoured scaffolding dispatch whose artefact is "the v2 branch with clean cherry-picks." That work is recorded for the historical trail but not re-decomposed here.

| # | Dispatch | Size | Tier | Implementer | Reviewer | Sequencing |
|---|---|---|---|---|---|---|
| ✅ D0 | Phase 1 — worktree spin + 6 cherry-picks (spec, strict throw, fixtures, rules ×3) | (completed) | (mixed) | shell subagent + orchestrator | orchestrator | DONE |
| D1 | CLI seam re-implementation against post-restructure file layout | M | Opus | orchestrator | reviewer subagent | First — foundation for D2 + D5 |
| D2 | Upgrade-instructions entry + codemod (user-skill side, applied to demo) | M | Opus | orchestrator | reviewer subagent | After D1 |
| D3 | Mirror codemod entry to extension-skill side | S | Sonnet | implementer subagent | reviewer subagent | After D2 |
| D4 | Manual-QA script revision with upgrade-journey scenarios | S | Sonnet | implementer subagent OR orchestrator | reviewer subagent | After D1; parallel to D2/D3 |
| D5 | Fixups bundle: lint guard (path-glob update) + demo CI gate + test hygiene | M | Sonnet | implementer subagent | orchestrator | After D2 (substrate must be stable) |
| D6 | Rationale-comments re-author (the original commit-5 `b4d829858` against post-seam shapes) | S | Sonnet | implementer subagent | orchestrator | After D1 |
| D7 | Validation + PR open + close PR #520 | S | Opus | orchestrator | n/a | Last |

**M-cap compliance.** No dispatch is L or XL. Two M dispatches (D1, D2) carry the design judgment and stay at the orchestrator's tier. The four S dispatches are mechanical with tight briefs; cheaper tier is safe because the gates carry the risk per [`decomposition-and-cost.md`](../../drive-domain-model/principles/decomposition-and-cost.md).

## Per-dispatch DoR/DoD seeds

Each dispatch's full brief is assembled at delegation time per [`brief-discipline.md`](../../drive-domain-model/principles/brief-discipline.md). The seeds below carry the dispatch-specific items the brief expands.

### D1 — CLI seam re-implementation

**Outcome.** Every on-disk contract read in `packages/1-framework/3-tooling/cli/src/commands/**.ts` routes through `familyInstance.validateContract`. Targets: `migrate.ts` (post-rename from `migration-apply.ts`), `migration-plan.ts` (both sites: `readPredecessorEndContract` + `toContractJson`), `migration-show.ts`, `migration-new.ts`, `db-verify.ts`. Folds in the predecessor error envelope from the original commit `92b3c647b`.

**Scope (out).** `b4d829858`'s rationale comments (deferred to D6); lint guard (D5); CI gate (D5); upgrade-instructions (D2/D3).

**Edge cases.**

| Edge case | Disposition |
|---|---|
| Upstream's `createControlStack` / `familyInstance` plumbing already wraps some reads | Re-route through the existing plumbing rather than introducing a parallel seam — calibration § 4.1 (dual-shape relocated) |
| A site has been refactored such that `JSON.parse` no longer appears verbatim | Read carefully; the cast pattern may have shifted to `as Contract` on an already-parsed object — same anti-pattern, same fix |
| `db-verify.ts` family-internal re-validation IS the seam crossing | Document with a comment naming the seam-of-record; no refactor needed |
| Destructive git operations (subagent dispatches only) | Forbidden without orchestrator approval per calibration § 4.5 — N/A here (orchestrator implements) but propagate to all subagent briefs |

**Done when.**

- [ ] `pnpm typecheck` clean
- [ ] `rg "as Contract\b" packages/1-framework/3-tooling/cli/src/commands/` returns zero hits in non-test files
- [ ] All five CLI commands' existing unit tests pass: `pnpm --filter cli test`
- [ ] WIP-inspection diff-read: no new helper introduced that re-stamps the legacy shape (§ 4.1 check)
- [ ] One commit; commit message references this plan + spec

**Inputs.** Spec; methodology calibration § 4.1 + § 4.4 + § 4.5; upstream-overlap investigation; original commits `594436307` + `92b3c647b` for the intent (not the literal patch — re-implement).

### D2 — Upgrade-instructions entry + codemod (user-skill side, applied to demo)

**Outcome.** New `skills/upgrade/prisma-next-upgrade/upgrades/0.9-to-0.10/instructions.md` with one entry describing the strict-deserializer breaking change for end users. The entry's codemod (file under the same directory) transforms pre-strict on-disk contract snapshots (untagged codec triples) to post-strict shape (tagged `kind: 'codec-instance'`). Apply the codemod to `examples/prisma-8-demo/migrations/app/**/*.json` in-place to produce the demo's PR-branch substrate state. Validation-by-execution: reverting + re-running the codemod reproduces the substrate state.

**Scope (out).** Extension-skill mirror (D3); manual-QA scenarios for the upgrade journey (D4); demo-regen-from-scratch (Option B — explicitly rejected).

**Edge cases.**

| Edge case | Disposition |
|---|---|
| Codemod re-introduces silent shape coercion under a new function name | Refuse + surface — calibration § 4.1 dual-shape failure mode |
| The codemod's `--check` mode diverges from `--apply` output | Refuse + surface — that's a codemod-correctness bug |
| A demo migration has a snapshot the codemod can't transform | Document the unhandled case in the entry's prose; defer to a per-substrate-shape follow-up if it materialises |
| Demo migrations under existing strict shape already (regression-style) | Codemod is a no-op for those; entry prose calls this out |

**Done when.**

- [ ] `skills/upgrade/prisma-next-upgrade/upgrades/0.9-to-0.10/` directory exists with `instructions.md` + codemod
- [ ] Demo migrations under `examples/prisma-8-demo/migrations/app/**/*.json` validate under the strict deserializer
- [ ] `pnpm check:upgrade-coverage --mode pr` exits 0
- [ ] Validation-by-execution: from a clean revert of the demo's untagged shape, running the codemod's `--apply` produces a diff identical to the PR-branch state
- [ ] `pnpm prisma-next migration plan` against the demo is a no-op (TC-6 verified)

**Inputs.** Spec; the `record-upgrade-instructions` skill recipe; the existing `0.8-to-0.9/` entries as reference shape (under `skills/upgrade/prisma-next-upgrade/upgrades/0.8-to-0.9/instructions.md`); calibration § 4.1.

### D3 — Mirror codemod entry to extension-skill side

**Outcome.** New `skills/extension-author/prisma-8-extension-upgrade/upgrades/0.9-to-0.10/instructions.md` mirroring D2's entry with extension-author framing. Codemod transformation is structurally the same; only the prose audience differs (an extension author authoring against `@internal/extension-*` packages, not an end-user with a demo).

**Scope (out).** Substrate application — extension authors have no in-tree demo to stamp.

**Edge cases.**

| Edge case | Disposition |
|---|---|
| Extension audience's shape differs from end-user audience's shape | Surface — D2/D3 split assumed structural equivalence |
| Destructive git operations in dispatch ritual | Forbidden per § 4.5; brief enforces |

**Done when.**

- [ ] Directory + files exist; `pnpm check:upgrade-coverage --mode pr` passes for the extension-skill side
- [ ] Prose audience-aligned (named extension authors, not end users, in motivation + recipe)

**Inputs.** D2's output; the existing `0.8-to-0.9/` extension-skill entries.

### D4 — Manual-QA script revision

**Outcome.** Revise `projects/tml-2536-contract-deserializer-seam/manual-qa.md` to (a) restructure per the new `drive-qa-plan` skill body, (b) add upgrade-journey scenarios for both audiences (end users via the demo; extension authors via `packages/3-extensions/`). Existing scenarios stay; new ones are added.

**Scope (out).** Running the QA (that's a different skill — `drive-qa-run`); the report (also `drive-qa-run`).

**Edge cases.**

| Edge case | Disposition |
|---|---|
| Existing scenarios contradict the new structure | Reshape; preserve substance |
| Manual-QA reveals the codemod can't recreate demo state in practice | Add as 🛑 Blocker scenario for QA runner to surface |

**Done when.**

- [ ] File exists at `projects/tml-2536-contract-deserializer-seam/manual-qa.md`
- [ ] Structurally matches `drive-qa-plan` body (TOC-first; "What this script is testing" block; per-scenario severity rubric)
- [ ] Names both prisma-next audiences (calibration § 9.1)

**Inputs.** Existing untracked `manual-qa.md` draft (in the predecessor worktree); `drive-qa-plan` skill body; calibration § 9.

### D5 — Fixups bundle

**Outcome.** Three cherry-picks landed on v2 with mechanical touch-up:

1. `a6bf08da8` — lint guard. Path-glob update for `migration-apply.ts` → `migrate.ts` rename.
2. `c57bceb6f` + `560b8fd54` — demo CI gate + `--json` fix.
3. `827aed650` + `c2ba02755` — test hygiene (transient task-ID strip + pathe in tests).

**Scope (out).** Anything substantive beyond touch-up.

**Edge cases.**

| Edge case | Disposition |
|---|---|
| Cherry-pick conflicts beyond mechanical | Stop, surface — likely indicates another upstream restructure |
| Lint guard's allowlist needs a new entry | Surface — that's a design decision, not a touch-up |
| Destructive git operations | Forbidden per § 4.5 |

**Done when.**

- [ ] All five cherry-picks landed; commit count expected: ≥ 3 (one per logical group; could be more)
- [ ] `pnpm lint:no-contract-cast` exits 0
- [ ] Demo CI job invoked locally passes
- [ ] Test hygiene unit tests pass

**Inputs.** Spec; the original sha set; current v2 file layout for the lint-guard path-glob.

### D6 — Rationale-comments re-author

**Outcome.** Re-derive the `as unknown as Contract` rationale comments (originally in commit `b4d829858`, deferred due to structural conflict with upstream restructure). Apply against post-D1 file shapes. Drop now-redundant casts (the original commit dropped 2 in `graph-walk.ts` / `synth.ts`).

**Scope (out).** Introducing new casts; broader refactors.

**Edge cases.**

| Edge case | Disposition |
|---|---|
| A site has been deleted by D1 (cast removed entirely) | No comment needed; skip |
| A site has been restructured but the cast still exists | New rationale derived from current code shape |
| Destructive git operations | Forbidden per § 4.5 |

**Done when.**

- [ ] All 10 sites from `b4d829858` revisited; per-site outcome documented in dispatch summary
- [ ] `pnpm typecheck` clean
- [ ] WIP-inspection diff-read confirms no new casts introduced

**Inputs.** Original commit `b4d829858` diff for the *intent* (not the literal patch); current file shapes on v2.

### D7 — Validation + PR open

**Outcome.** Full validation gate pass; PR opened; PR #520 closed with a pointer.

**Scope (out).** Substantive changes.

**Edge cases.**

| Edge case | Disposition |
|---|---|
| A gate fails | Stop, surface to operator — gate-of-record failure, not a touch-up moment |
| Composition drift surfaces (e.g. D2's codemod doesn't satisfy D5's CI gate) | Stop, surface — design discussion trigger |

**Done when.**

- [ ] `pnpm typecheck` clean
- [ ] `pnpm test:packages` passing
- [ ] `pnpm test:integration` passing (where applicable)
- [ ] `pnpm lint:deps` clean
- [ ] `pnpm lint:no-contract-cast` clean
- [ ] `pnpm check:upgrade-coverage --mode pr` clean
- [ ] `pnpm fixtures:check` clean
- [ ] Grep gate from calibration § 5.3 (project-artefact-leak): zero hits outside `projects/`
- [ ] Branch pushed; PR opened with `tml-2536:` title prefix
- [ ] PR #520 closed with pointer comment

**Inputs.** Spec § Acceptance Criteria; calibration § 3.2 + § 5.3; PR template (drive-pr-description).

## Validation gate (full slice)

Run at D7 only — per-dispatch gates run within each dispatch:

```bash
pnpm typecheck
pnpm test:packages
pnpm test:integration            # if changes touch PGlite / PG paths
pnpm lint:deps
pnpm lint:no-contract-cast
pnpm check:upgrade-coverage --mode pr
pnpm fixtures:check              # if IR / emitter / serialiser changes
```

Plus the calibration grep gates that apply (§ 5.3 in particular).

## Open items

- **Demo `migration apply` in CI.** Whether the demo CI job (D5) can run `migration apply` depends on whether a shared Postgres harness is available. Scope to `migration plan` only if not.
- **Pgvector / other extension-contributed `kind` values.** Enumerate during D1; AC-9 says "one fixture per kind shipped in tree."
- **`db-verify.ts` seam shape.** May be a no-op + clarifying comment rather than a refactor; D1's call.
- **Slice-PR-cap retro item.** Logged for slice-closure retro: this slice is at the upper end of the PR-cap. If reviewer feedback indicates the PR is hard to review, calibration § 1 needs a recalibration note.
