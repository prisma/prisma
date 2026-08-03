# Manual QA — TML-2536 (contract deserializer seam)

> **Be the user.** The bug was discovered by `cd`-ing into the demo and running real `prisma-next` CLI commands. This script does the same: every scenario operates the demo (or a stand-in extension package) through its actual CLI / source surface and observes what a developer using Prisma Next would see.
>
> **Out of scope of this script.** Re-running the unit tests, e2e tests, `migration:plan:check`, or `lint:no-contract-cast` against today's clean tree. Those run in CI; passing them again here proves nothing a real user would catch. The scenarios that touch the strict deserializer, the lint, the CI gate, and the upgrade codemods all use **negative controls** or **journey reproductions** (plant a violation or revert to a pre-fix substrate, prove the gate fires or the codemod transforms cleanly, restore) — that's the only legitimate way to exercise a gate from the user's seat.
>
> **Spec:** `projects/tml-2536-contract-deserializer-seam/spec.md`
> **Plan:** `projects/tml-2536-contract-deserializer-seam/plans/plan.md`
> **PR:** <https://github.com/prisma/prisma-next/pull/533>
> **Branch:** `tml-2536-contract-deserializer-seam-v2`

## What this script is testing

**The bug.** `prisma-next migration plan` against `examples/prisma-8-demo` crashed with `PN-CLI-4999`. The predecessor snapshot's polymorphic `storage.types` entries (`Embedding1536` codec-instance, `user_type` postgres-enum) were read directly from disk via `JSON.parse(...) as Contract`, bypassing the family `ContractSerializer`. The planner then tried to dispatch on a `kind` discriminator that was never stamped onto the parsed entries, and threw. The bug shipped because no automated test exercised a snapshot read with polymorphic types, and the demo — the only checked-in artefact in tree that triggers the bug — wasn't in CI.

**The fix.** Four changes in one PR:

1. Every on-disk contract read in the CLI (`migration plan`, `migration new`, `migrate`, `migration show`, `db verify`) now routes through `familyInstance.validateContract` instead of `JSON.parse(...) as Contract`.
2. `normaliseTypeEntry` in the SQL family core no longer silently re-stamps untagged codec triples — its permissive fallthrough was removed, and an untagged entry now throws a diagnostic naming the offending entry and its missing/unknown `kind`. The deserializer is strict for every code path simultaneously.
3. The test-coverage gap is closed: per-`kind` snapshot-read fixtures (`codec-instance`, `postgres-enum`), a workspace lint (`pnpm lint:no-contract-cast`) that rejects `as Contract` in production code, a `.cursor/rules/` rule pair documenting the seam and the smell, and a new CI job (`Demo `migration plan` (no-op)`) that runs the demo's `migration:plan:check` against its checked-in history.
4. Both upgrade-instruction skills (`prisma-next-upgrade` for end users; `prisma-8-extension-upgrade` for extension authors) ship a `0.9-to-0.10/` entry with a codemod (`stamp-storage-types-kind.ts`) that stamps the `kind` discriminator on every committed `*-contract.json` snapshot. This is a breaking change for any project (app or extension package) with committed migration history under 0.9; the codemod is the only supported path forward.

**Why manual QA matters here.** The scripted fixtures + lint + CI job catch regressions of *the shapes the authors anticipated*. They don't catch: (a) whether real artefacts like the demo behave the way the synthetic fixtures suggest under the strict deserializer; (b) whether the strict-throw diagnostic is actually actionable when a human reads it cold; (c) whether the rule rewrites read coherently to a fresh developer or have stale "the validator does NOT normalize" language left behind; (d) whether the lint catches a planted regression in a real production file; (e) whether the literal CLI flow from the original bug report now succeeds; (f) whether the upgrade-instruction skills + codemods actually transform a real project's substrate correctly from the consumer's point of view (end-user app and extension package). Every scripted scenario below targets one of those gaps, and the exploratory charter probes the broader diagnostic surface for unknown unknowns.

## Table of contents

| # | Scenario | What it proves | Isolation | Covers |
| - | -------- | -------------- | --------- | ------ |
| 1 | Greenfield init + schema verification | A developer can init a fresh DB from the demo contract and every status command reports healthy | workspace | AC-1, AC-4, AC-5 |
| 2 | Schema-evolution journey (the daily developer loop) | Plan → new → apply → status → verify all round-trip through the serializer cleanly when the user edits the schema | workspace | AC-1, AC-5 |
| 3 | Replay the original-bug surface against checked-in history | The literal CLI flow from the original bug report now succeeds end-to-end | workspace | AC-1, AC-4 |
| 4 | Strict deserializer fires loudly on a corrupted on-disk shape **(negative control)** | A `storage.types[*]` entry with no `kind` produces a clear diagnostic at the deserializer boundary, not a downstream crash | workspace | AC-3 |
| 5 | Repo lint gate catches a freshly-planted `as Contract` cast **(negative control)** | The lint would reject a future PR re-introducing the bypass, not just pass against today's clean tree | workspace | AC-2, AC-8 |
| 6 | Rules read coherently to a fresh developer **(judgement)** | The two `.cursor/rules/*.mdc` files name the serializer seam and the `as Contract` smell unambiguously to a cold reader | read-only | AC-6, AC-7 |
| 7 | Demo CI gate is wired into PR checks | The `Demo `migration plan` (no-op)` job runs on every PR, so future demo-rot is caught before merge | external | AC-10 |
| 8 | Demo app boots and serves against a signed database **(judgement)** | The runtime contract-load path still works — we didn't accidentally break the product to fix the CLI | workspace | AC-4 (indirect) |
| 9 | Exploratory: probe the contract-read diagnostic surface **(exploratory, charter)** | Surfaces unanticipated degradation modes and judges diagnostic quality across them | workspace | (no specific AC; charter) |
| 10 | End-user upgrade journey via `prisma-next-upgrade` 0.9→0.10 entry | A real user with committed migration history under 0.9 can apply the codemod and successfully advance to 0.10 | workspace | (upgrade-instructions intent — end users) |
| 11 | Extension-author upgrade journey via `prisma-8-extension-upgrade` 0.9→0.10 entry | An extension author can apply the codemod to seed migrations AND apply the source-level rules without their build / tests breaking | workspace | (upgrade-instructions intent — extension authors) |

> Scenarios marked **(negative control)** plant a violation, observe the gate fire, then restore. Scenarios marked **(judgement)** require runner evaluation against an explicit oracle that no test can assert. Scenarios marked **(exploratory)** are time-boxed charters with no scripted steps. Scenarios 10 and 11 are **upgrade-journey** reproductions — they exercise the breaking-change-mitigation surface (the codemods + prose) from the consumer's point of view.
>
> The **Isolation** column tells the runner how to schedule the scenario in parallel: `tmpdir` (own scratch dir, shared read-only clone), `workspace` (own `git worktree`; also for scenarios that mutate the demo DB), `read-only` (no isolation needed), or `external` (network-bound; rate-limit-aware). DB-mutating scenarios are tagged `workspace` because they mutate state at the workspace path (the demo's local Postgres reachable via the demo's `.env`).

## Pre-flight

1. Checkout + build the branch from repo root:
   ```bash
   git checkout tml-2536-contract-deserializer-seam-v2
   pnpm install --frozen-lockfile
   pnpm build
   ```
2. Confirm a local Postgres is reachable and the demo's `.env` is set:
   ```bash
   cd examples/prisma-8-demo
   cat .env   # expect DATABASE_URL=postgres://...
   ```
   If `.env` is missing, copy/edit one before continuing — every DB-touching scenario below needs it.
3. Confirm `git status` is clean. Several scenarios mutate the tree; each ends with an explicit restore + `git status` check. A pre-clean baseline makes "did I restore everything" obvious.
4. The CLI binary in this workspace lives at `packages/1-framework/3-tooling/cli/dist/cli.js`. Several scenarios invoke it. Use this canonical command from inside the demo:
   ```bash
   CLI="node ../../packages/1-framework/3-tooling/cli/dist/cli.js"
   ```
   Set that once in your shell so every demo-rooted scenario reads naturally.

---

## Scenario 1 — Greenfield init + schema verification

**What you're proving from the user's seat:** a developer on a fresh machine can take the demo's checked-in contract, initialise the database from it, and have every CLI status command report "healthy" without crashes or surprising diagnostics. This exercises the same deserialization seam that TML-2536 broke (the read of `end-contract.json` during init + status), with the demo's *real* contract — which contains both polymorphic shapes (`Embedding1536` codec-instance and `user_type` postgres-enum).

This scenario falls under the litmus-test bucket "end-to-end developer-journey smoke".

**Covers:** AC-1, AC-4, AC-5

**Isolation:** `workspace` (mutates the demo's local Postgres reachable via `.env`; multiple DB-touching scenarios cannot share a single DB instance concurrently).

**Oracle:** the demo's tip-of-branch contract state. After `db init` against the demo's current `contract.prisma`:
- `migration status` should report the latest checked-in migration (`20260518T1701_namespaces_bookend`) as the current head.
- `migration plan` should propose zero operations (the live DB matches the contract that produced the head migration's `end-contract.json`).
- `db verify` should report "in sync".

If any of those disagree, either the deserializer is silently coercing shapes (the bug) or the demo's history has drifted from its `contract.prisma` (unrelated, but worth surfacing).

**Preconditions:**
- Pre-flight complete; demo `.env` set; local Postgres reachable.
- `git status` clean.
- No prerequisite scenarios.

### Steps

```bash
cd examples/prisma-8-demo
pnpm db:drop                       # nukes public + prisma_contract schemas
pnpm emit                          # regenerates contract.json (should be no diff)
$CLI db init                       # creates schema + signs marker
$CLI db verify                     # marker + schema match
$CLI migration status              # current marker, no pending
$CLI migration plan                # should be a no-op (history matches contract)
```

### What you should see

- `pnpm emit` finishes silently and `git status src/prisma/` is clean. (If `contract.json` changed, contract emission has drifted — unrelated to TML-2536 but worth raising.)
- `db init` reports it created tables/types and wrote a marker. Watch for `Embedding1536` (pgvector `vector(1536)`) and the `user_type` enum being created without complaint.
- `db verify` exits 0 with an "in sync" / "marker matches" summary.
- `migration status` reports `20260518T1701_namespaces_bookend` (the head) as the current state.
- `migration plan` reports a no-op (no proposed operations).

### Failure modes

- Any `PN-CLI-4999`, `PN-CLI-49xx`, `PN-CLI-4003`, or "failed to deserialize" / "missing kind" error from any of the commands above.
- Any command throws an unhandled exception instead of a structured envelope.
- `migration plan` proposes operations against a freshly-initialised DB whose contract matches the demo head.
- `pnpm emit` mutates `src/prisma/contract.json` (drift between contract-builder output and what's checked in).

### Restore

No tree mutation. Database state stays initialised for Scenario 2 or 8 if you chain them, or re-baseline with `pnpm db:drop` before moving on. Confirm `git status` is clean.

---

## Scenario 2 — Schema-evolution journey (the daily developer loop)

**What you're proving:** a developer editing the schema, planning, authoring, and applying a new migration walks through the CLI without hitting the bug class TML-2536 fixed. Every step reads or writes an on-disk `end-contract.json` or `contract.json`; every read crosses the serializer seam, and the writer must emit the strict tagged shape for the next read to succeed.

This scenario falls under the litmus-test bucket "end-to-end developer-journey smoke".

**Covers:** AC-1, AC-5

**Isolation:** `workspace` (mutates `src/prisma/contract.prisma`, adds a new `migrations/app/<timestamp>_…/` directory, mutates the demo DB).

**Oracle:** the strict-shape contract schema (the same one the deserializer validates against): every `storage.types[*]` entry written by `migration new` must carry an explicit `kind` discriminator that the strict deserializer accepts on the next read. If `migration new` regressed to writing untagged entries, the next `migration plan` / `apply` would now throw at the strict deserializer (post-fix) — that's the round-trip falsifier. The polymorphic types in scope today are `Embedding1536` (`kind: 'codec-instance'`) and `user_type` (`kind: 'postgres-enum'`).

**Preconditions:**
- Pre-flight complete.
- Scenario 1 completed (database is initialised and verified against the demo's current contract).
- `git status` clean apart from pending DB state.

### Steps

1. Edit `src/prisma/contract.prisma`. Make a small, safely-additive change — for example, add a nullable column to `User`:
   ```diff
    model User {
      id          String    @id @default(uuid())
      email       String
   +  nickname    String?
      displayName String
   ```
2. Re-emit and plan:
   ```bash
   pnpm emit
   $CLI migration plan
   ```
   You should see the new column proposed as an additive operation, and *no* deserialization-flavoured errors.
3. Scaffold the migration directory:
   ```bash
   $CLI migration new
   ```
   This creates a new `migrations/app/<timestamp>_…/` directory with `migration.json`, `migration.ts`, `end-contract.json`, etc.
4. Inspect the freshly-written `end-contract.json`:
   ```bash
   NEW=$(ls -dt migrations/app/*/ | head -1)
   python3 -c "
   import json
   d = json.load(open('$NEW/end-contract.json'))
   for k, v in d.get('storage', {}).get('types', {}).items():
       print(f'{k}: kind={v.get(\"kind\")!r}')
   "
   ```
   **Expect** both entries to carry `kind`:
   - `Embedding1536: kind='codec-instance'`
   - `user_type: kind='postgres-enum'`
5. Apply it:
   ```bash
   $CLI migration apply
   $CLI migration status
   $CLI db verify
   $CLI migration show $(basename "$NEW")
   ```

### What you should see

- `migration plan` (step 2) succeeds and proposes a single additive operation. The output references the polymorphic types (`Embedding1536`, `user_type`) without complaint.
- `migration new` (step 3) writes the migration directory cleanly.
- `end-contract.json` (step 4) carries the `kind` discriminator on *every* `storage.types[*]` entry. The fact that the writer emits the strict tagged shape is the structural proof that the strict deserializer round-trips correctly.
- `migration apply`, `migration status`, `db verify`, `migration show` all succeed.

### Failure modes

- Any `end-contract.json` written by `migration new` whose `storage.types[*]` entries are missing `kind`. That would mean the writer regressed and would re-introduce TML-2536 on the next read.
- `migration show` chokes on the new directory.
- `db verify` reports a mismatch after a clean apply.
- Any command produces a deserialization-flavoured diagnostic (`PN-CLI-4999`, `PN-CLI-4003`, "failed to deserialize", "missing kind", etc.).

### Restore

```bash
rm -rf "$NEW"
git checkout -- src/prisma/contract.prisma
pnpm emit
git status   # must be clean
```

Optional: `pnpm db:drop && $CLI db init` to re-baseline the DB on the original schema before moving on.

---

## Scenario 3 — Replay the original-bug surface against checked-in history

**What you're proving:** the exact CLI flow that the user originally ran when discovering TML-2536 — operating against the demo's *checked-in* migration history — now succeeds end-to-end. This is the closest re-enactment of the bug report.

This scenario falls under the litmus-test bucket "re-enacts the originally-failing user flow".

**Covers:** AC-1, AC-4

**Isolation:** `workspace` (mutates the demo DB via `db:drop` + `migration apply`).

**Oracle:** the pre-bug expected behaviour — `migration apply` against the demo's checked-in history should run cleanly, `migration plan` should report a no-op, and `migration show` should print each migration's bookend contracts without error. Pre-fix, this exact sequence produced `PN-CLI-4999`; post-fix it must match the pre-bug-introduction behaviour. The checked-in migrations *are* the artefacts that originally triggered the bug, so re-running this flow against them is the bug-report-fidelity check.

**Preconditions:**
- Pre-flight complete; demo `.env` set; local Postgres reachable.
- Any prior scenario state restored; `git status` clean.
- No prerequisite scenarios (this scenario does its own `db:drop`).

### Steps

```bash
cd examples/prisma-8-demo
pnpm db:drop
pnpm emit
$CLI migration apply                                # applies the full checked-in history
$CLI migration status
$CLI migration plan                                 # no-op
$CLI migration show 20260518T1701_namespaces_bookend  # head migration
$CLI migration show 20260422T0720_initial            # initial migration (the literal artefact from the original bug)
$CLI db verify
```

### What you should see

- `migration apply` runs the full checked-in history cleanly — including `20260422T0720_initial` (which carries the polymorphic `storage.types` entries that originally triggered TML-2536) and `20260518T1701_namespaces_bookend` (the head). It reads each migration's `end-contract.json` from disk — the exact code path TML-2536 broke.
- `migration status` reports the head as up-to-date with the bookend migration.
- `migration plan` reports a no-op.
- Both `migration show` invocations print operations + contract bookends without errors.
- `db verify` passes.

### Failure modes

- Any `PN-CLI-4999` or deserialization error from `migration apply`, `migration plan`, `migration status`, or either `migration show`. That *is* TML-2536 reproducing.
- An unhandled exception (rather than a structured envelope) from any of those commands.
- `migration plan` proposes operations against the freshly-applied head (would indicate either contract drift or a deserialization-induced false diff).

### Restore

No tree mutations; DB state can stay (Scenario 8 depends on it) or be re-baselined as needed.

---

## Scenario 4 — Strict deserializer fires loudly on a corrupted on-disk shape (negative control)

**What you're proving:** the strict `normaliseTypeEntry` actually behaves the way the spec describes — a `storage.types[*]` entry missing the `kind` discriminator now produces a clear diagnostic at the deserializer boundary instead of silently slipping past and crashing the planner later. This is the *behavioural* proof of AC-3 from a user vantage point, not a unit-test re-run.

This scenario falls under the litmus-test bucket "negative control for a guardrail".

**Covers:** AC-3

**Isolation:** `workspace` (mutates a tracked `end-contract.json` in the demo's migration tree; restored at end).

**Coverage boundary.** This scenario proves the strict deserializer fires on **one** specific corruption: a known codec-instance entry (`Embedding1536`) with its `kind` field stripped from the demo's head-migration `end-contract.json`, read via `migration plan` and `migration show`. It does **not** prove every possible malformed `storage.types` shape is rejected, every `kind` value is covered, every command that reads a snapshot rejects it, or that the diagnostic is well-formed under arbitrary mutation. The exploratory charter (Scenario 9) probes broader degradation modes; the unit tests for `normaliseTypeEntry` and the per-kind snapshot-read fixtures (AC-9) own the per-kind invariant.

**Oracle:** the spec's stated behaviour for AC-3 — "an untagged codec triple input throws an exception with a diagnostic naming the entry (e.g. `Embedding1536`) and the missing/unknown `kind`". A well-formed diagnostic should let a developer reading it cold locate the offending file (path printed), the offending entry (name printed), and the offending field (`kind` named). Pre-fix, this same corruption would either silently re-stamp the entry or crash much later in the planner with a generic dispatch error.

**Preconditions:**
- Pre-flight complete.
- `git status` clean in `examples/prisma-8-demo/migrations/app/`.
- Demo DB state from Scenario 1 or 3 is fine (this scenario reads on-disk artefacts, not the DB).
- No prerequisite scenarios.

### Steps

1. From the demo dir, with a clean tree, pick the head-migration `end-contract.json` (the predecessor read for `migration plan`) and back it up:
   ```bash
   cd examples/prisma-8-demo
   END=migrations/app/20260518T1701_namespaces_bookend/end-contract.json
   cp "$END" "$END.bak"
   ```
2. Hand-corrupt one polymorphic entry by stripping its `kind`:
   ```bash
   python3 -c "
   import json
   p = '$END'
   d = json.load(open(p))
   types = d['storage']['types']
   target = 'Embedding1536'   # codec-instance kind today
   assert target in types, f'expected {target} in storage.types'
   removed = types[target].pop('kind', None)
   json.dump(d, open(p, 'w'), indent=2)
   print(f'removed kind={removed!r} from storage.types[{target!r}]')
   "
   ```
3. Re-run any command that reads the snapshot:
   ```bash
   $CLI migration plan          # expect: clear error envelope
   echo "exit=$?"
   ```
4. Try a different command for a second data point:
   ```bash
   $CLI migration show 20260518T1701_namespaces_bookend
   echo "exit=$?"
   ```

### What you should see

- Both commands in steps 3–4 exit non-zero.
- The error envelope (or thrown diagnostic) clearly mentions:
  - the offending `storage.types` entry name (`Embedding1536`), **and**
  - the missing `kind` discriminator (or the unrecognised one),
  - and ideally points at one of `'codec-instance'` / `'postgres-enum'` / `toStorageTypeInstance(...)` so a developer reading the diagnostic cold has a fighting chance of fixing it.
- The path of the corrupted `end-contract.json` is named in the diagnostic (so the reader knows *which file* to fix).

### Failure modes

- Either command *succeeds* on the corrupted file — the fallback re-stamping is back and TML-2536 has structurally regressed.
- Either command throws an unhandled exception with no entry name in the diagnostic (the throw is correct but the diagnostic is unactionable).
- The diagnostic names the entry but not the file path (partial regression on actionability).

### Restore

```bash
mv "$END.bak" "$END"
git status                   # must be clean
git diff -- "$END"           # must be empty
```

---

## Scenario 5 — Repo lint gate catches a freshly-planted `as Contract` cast (negative control)

**What you're proving:** the `lint:no-contract-cast` gate isn't just passing because today's tree happens to be clean — it would actively *reject* a future PR that re-introduced the bypass pattern.

This scenario falls under the litmus-test bucket "negative control for a guardrail".

**Covers:** AC-2 (the cast pattern is absent — verified by exercising the gate that enforces its absence), AC-8 (the lint script + CI gate).

**Isolation:** `workspace` (mutates a tracked production file; restored at end).

**Coverage boundary.** This scenario proves the lint detects **one** planted instance of `as Contract` in one specific CLI command file. It does **not** prove the lint detects `as Contract<…>` generic-form variants, casts split across lines, casts in newly-added files outside the existing `packages/**/src/**` glob, or casts in any allowlisted location (where suppression is by design — the lint is supposed to skip those). The lint's own allowlist + regex are the spec; this scenario only proves the gate's gate-ness for the canonical violation shape.

**Oracle:** the spec's AC-8 — "A workspace script greps for `as Contract\b` and `as Contract<` in `packages/**/src/**`, fails on any hit outside the allowlist, and runs as part of the CI lint gate." A planted cast in a non-allowlisted production file under `packages/**/src/**` must (a) cause `pnpm lint:no-contract-cast` to exit non-zero and (b) produce output naming the planted file and the offending line.

**Preconditions:**
- Pre-flight complete.
- `git status` clean at the repo root.
- The target file (`packages/1-framework/3-tooling/cli/src/commands/migration-plan.ts`) is unmodified relative to `HEAD`.
- No prerequisite scenarios.

### Steps

1. From repo root, plant a violation in a real production file:
   ```bash
   cd "$(git rev-parse --show-toplevel)"
   FILE=packages/1-framework/3-tooling/cli/src/commands/migration-plan.ts
   cp "$FILE" "$FILE.bak"
   printf '\n// QA-PLANTED\nconst _bypass = JSON.parse("{}") as Contract;\n' >> "$FILE"
   ```
2. Run the lint:
   ```bash
   pnpm lint:no-contract-cast
   echo "exit=$?"
   ```
3. Restore + reconfirm:
   ```bash
   mv "$FILE.bak" "$FILE"
   pnpm lint:no-contract-cast
   echo "exit=$?"
   git status   # must be clean
   ```

### What you should see

- Step 2: non-zero exit; output names the planted file and points at the line containing `as Contract`.
- Step 3: exit 0; `git status` clean.

### Failure modes

- Step 2 exits 0 (lint is blind to the violation — gate is not actually gating).
- Step 2 exits non-zero but the output doesn't name the file or line (gate works but diagnostic is unactionable).
- Step 3 fails after restore (lint is flagging something it shouldn't, or the restore wasn't clean — both worth raising).

### Restore

Performed in step 3. Confirm `git status` and `git diff -- "$FILE"` are both empty before moving on.

---

## Scenario 6 — Rules read coherently to a fresh developer (judgement)

**What you're proving:** the durable record of the decision lives in two `.cursor/rules/*.mdc` files. A developer hitting an `as Contract` cast in a future PR should be able to read those rules and immediately understand both *why* it's a smell and *what* to do instead, without going back to TML-2536. The review skills should also surface the smell in the reviewer's lane.

This scenario falls under the litmus-test bucket "human read of durable docs / rule files".

**Covers:** AC-6, AC-7

**Isolation:** `read-only` (opens files for reading; no mutation).

**Oracle:** the rule's *intent* as stated in the spec's AC-6 and AC-7 — the serializer (`familyInstance.validateContract` / `ContractSerializer.deserializeContract`) is the single normalisation seam; the validator validates *and* normalises; `as Contract` is a serializer-bypass smell with a named replacement idiom. Read each rule as if you are a developer who has never touched this codebase: would you (a) understand the seam and (b) know what to do if you encountered the smell? If "no" on either, the rule has a comprehension gap.

**Preconditions:**
- Working copy of the branch checked out so the rule files are accessible.
- No environment dependencies.
- No prerequisite scenarios.

### Steps

1. Open `.cursor/rules/contract-normalization-responsibilities.mdc`. Read it as if you've never seen this codebase. Ask yourself:
   - Does it identify the single normalisation seam by name (`familyInstance.validateContract` / `ContractSerializer.deserializeContract`)?
   - Does it say the validator hydrates into class instances (i.e. validation and normalisation are the same step)?
   - Is there any leftover language claiming "the validator does NOT normalize" or that normalisation lives somewhere outside the serializer? If so, that's stale.
2. Open `.cursor/rules/as-contract-cast-smell.mdc`. Ask:
   - Is the smell stated unambiguously (`as Contract` / `as Contract<…>` in production code)?
   - Is the replacement idiom spelled out (`validateContract<Contract>(JSON.parse(raw) as unknown)`)?
   - Is there a pointer to the broader serializer rule or to `validate-contract-usage.mdc`?
3. Spot-check the review-skill cross-references exist:
   ```bash
   grep -nR "as-contract-cast-smell\|as Contract" \
     .agents/skills/drive-code-review \
     .agents/skills/drive-pr-local-review 2>/dev/null
   ```
   Open whichever file matches and confirm the mention is in the "what to flag" / smell-detection part of the skill, not buried in unrelated commentary.

### What you should see

- Both rule files exist, read coherently, and match current behaviour (no leftover legacy stance).
- At least one review-skill file references the smell or the rule file by name in a section a reviewer would actually consult.

### Failure modes

- A rule that contradicts what the code actually does (would mislead future developers reading it cold).
- A rule that names the smell but not the replacement (or vice versa).
- No review-skill reference — the rule exists but the review process doesn't surface it, so it can't catch the next instance.
- Stale "validator does NOT normalize" language anywhere in either rule file.

### Restore

No state mutated.

---

## Scenario 7 — Demo CI gate is wired into PR checks

**What you're proving:** the regression gate added by this PR actually runs on every pull request — so a future PR that re-broke `migration plan` against the demo couldn't merge silently.

This scenario falls under the litmus-test bucket "end-to-end developer-journey smoke" applied to the CI pipeline (observe the live PR's check list, not just the workflow yaml).

**Covers:** AC-10

**Isolation:** `external` (hits the GitHub API via `gh`; rate-limit aware).

**Oracle:** the spec's AC-10 — "A CI job runs `pnpm prisma-next migration plan` against `examples/prisma-8-demo`. The job fails when the demo workflow fails." The job must be (a) defined in `.github/workflows/ci.yml`, (b) wired into the events that fire on PRs (no `if: false`, no branch filter that would skip PR runs), and (c) actually appearing in PR #533's check list.

**Preconditions:**
- `gh` CLI authenticated and able to read PR #533.
- Working copy of the branch with `.github/workflows/ci.yml` at the tip of the PR.
- No prerequisite scenarios.

### Steps

```bash
gh pr checks 533 | grep -iE "demo|migration plan"
gh workflow view "CI (PR)" 2>&1 | grep -iE "demo|migration plan"
```

Open `.github/workflows/ci.yml` and confirm:

- A job named `demo-migration-plan` with display name `Demo `migration plan` (no-op)` exists.
- It's a top-level job under `jobs:`, not gated behind any conditional that would skip PR runs.
- Its final step runs `pnpm --filter prisma-8-demo migration:plan:check` (or equivalent).

### What you should see

- `gh pr checks 533` lists a check named `Demo `migration plan` (no-op)` (or similar — match the workflow's `name:`).
- The workflow definition unconditionally runs the demo regression script on every PR.

### Failure modes

- Job missing from `ci.yml`.
- Job present but marked `if: false`, gated behind a branch filter that excludes PR runs, or skipped via `paths:` filter that wouldn't match a future regression PR.
- Job present in the workflow but not appearing in `gh pr checks 533` output (something is preventing the live run).
- Job runs something other than the demo regression script.

### Restore

No state mutated.

---

## Scenario 8 — Demo app boots and serves against a signed database (judgement)

**What you're proving:** the contract deserializer change didn't just keep CLI commands working — the *runtime* code path that loads `contract.json` to drive the live ORM still works too. (This is the "did we accidentally break the product" sanity check.)

This scenario falls under the litmus-test buckets "end-to-end developer-journey smoke" + "observable-quality judgement" (read the seed and demo runtime output for surprise).

**Covers:** AC-4 (indirect — the runtime ORM contract-load shares the same serializer entry point as the CLI snapshot reads).

**Isolation:** `workspace` (uses the demo DB initialised by Scenario 1 or 3).

**Oracle:** the demo runtime's expected behaviour as documented in its `package.json` scripts and `src/main.ts`. `pnpm seed` should insert seed data without runtime contract errors. `pnpm start -- users` (or the equivalent canonical demo entry point) should execute the demo's runtime flow and print results. `pnpm dev` should serve the Vite dev server without browser-console errors that originate in contract loading. No startup-time "contract validation failed" or marker-mismatch errors.

**Preconditions:**
- Scenario 1 or 3 completed (DB initialised, marker written, history matches contract).
- `git status` clean.

### Steps

```bash
cd examples/prisma-8-demo
pnpm seed
pnpm start -- users    # or whichever command the demo's main.ts exposes
```

In a second terminal, optionally:

```bash
pnpm dev               # vite dev server, if you want to click around
```

### What you should see

- `pnpm seed` inserts seed data without runtime contract errors.
- `pnpm start -- users` (or equivalent) runs through the demo's runtime flow and prints results — no startup-time "contract validation failed" or marker-mismatch errors.
- `pnpm dev` (optional) serves the demo without errors in the browser console.

### Failure modes

- The runtime fails to load the contract on startup.
- A marker / hash mismatch surfaces between the CLI signing and the runtime loading the same contract.
- Seed insertion errors that name contract/IR types (suggests a hydration mismatch between the runtime and what was signed).

### Restore

No tree mutations. DB state can stay or be re-baselined as needed.

---

## Scenario 9 — Exploratory: probe the contract-read diagnostic surface (charter)

**Charter.** *Explore the CLI's behaviour when on-disk contract files are degraded in ways the scripted negative controls don't enumerate. With the demo's `migrations/app/20260518T1701_namespaces_bookend/` (head) and `migrations/app/20260422T0720_initial/` (the literal artefact from the original bug report) as substrates, mutate `end-contract.json` / `start-contract.json` in shapes the script didn't anticipate — structurally-valid but semantically wrong (rename a type; swap a `kind` value to a typo like `'codec_instance'`; delete `storage.types` entirely; truncate the JSON mid-object; inject duplicate keys; symlink to `/dev/null`; `chmod 000` the file) — and run the CLI commands a developer would naturally reach for (`migration plan`, `migration show`, `migration status`, `migration apply`, `db verify`). For each variant, capture (a) which command, (b) what diagnostic surfaced (verbatim), and (c) your judgement of whether a developer reading the diagnostic cold could (i) locate the offending file, (ii) reason about the cause, and (iii) know what to do next.*

**Covers:** (no specific AC; surfaces unknowns the scripted scenarios skip).

**Isolation:** `workspace` (mutates files inside `examples/prisma-8-demo/migrations/app/`; may also `chmod` a file).

**Time budget:** 30 minutes. Stop when the timer rings even if you have ideas left — log uncovered ideas as candidate scenarios for a future round (or as new negative controls if a clear gap emerges).

**Preconditions:**
- Pre-flight complete.
- `git status` clean in `examples/prisma-8-demo/migrations/app/`.
- A copy of the intact `migrations/app/` somewhere outside the repo (or a `git stash`) so restoration after any mutation is one command.

**Notes capture.** Write what you tried, what surprised you, and anything that "felt off" but you can't yet name (e.g. "the diagnostic was technically correct but I didn't realise which file it meant until I re-read it"). Findings from this charter are categorised the same way scripted-scenario findings are; the runner's report owns their classification in runtime context.

**Restore.** After the time-box, `git checkout -- examples/prisma-8-demo/migrations/app/` (or `git stash pop`) and confirm `git status` is clean. If you `chmod`-ed a file, also restore permissions.

---

## Scenario 10 — End-user upgrade journey via `prisma-next-upgrade` 0.9→0.10 entry

**What you're proving from the user's seat:** an end user with a 0.9 app and committed migration history can read the user-facing upgrade-skill entry, apply the `0.9-to-0.10/stamp-storage-types-kind` codemod, and successfully end up with a project whose strict deserializer accepts every snapshot — the precise breaking-change scenario this PR ships.

This scenario falls under the litmus-test buckets "end-to-end developer-journey smoke" + "negative control for a guardrail" (revert to pre-codemod substrate, prove the strict deserializer rejects it, run the codemod, prove the rejection goes away).

**Covers:** the upgrade-instructions intent — that the codemod transforms a real consumer's substrate end-to-end, not just synthetic fixtures.

**Isolation:** `workspace` (rewrites the demo's tracked `migrations/app/**/*.json` files; uses `git stash` for revert/restore).

**Coverage boundary.** This scenario proves the codemod and prose work on **one** specific end-user substrate (the in-tree `examples/prisma-8-demo`, treated as a stand-in for a real 0.9 consumer). It does **not** prove the codemod handles every conceivable user shape (custom contract-emit configurations, hand-edited snapshots, repositories with deeply nested `migrations/` directories, etc.). The unit-style detection in the codemod (look-for-codecId, dispatch-on-codecId) and its idempotency are the structural invariants; this scenario only proves it works under a representative real configuration.

**Oracle:** the substrate after `--apply` must equal the PR-branch state of `examples/prisma-8-demo/migrations/app/**`. Concretely:
- `git diff examples/prisma-8-demo/migrations/` is empty after the codemod runs against a reverted pre-codemod state.
- Re-running the codemod (any flag) is a no-op (the script outputs `OK …  (already stamped)` for every snapshot).
- `migration plan` against the demo is a clean no-op (`ok: true`, `noOp: true`, empty `operations`). The TML-2521 namespaces drift is closed by the `20260518T1701_namespaces_bookend` migration in this PR, so no `PN-CLI-4020` should surface either.

**Preconditions:**
- Pre-flight complete.
- `git status` clean.
- No prerequisite scenarios.

### Steps

1. From repo root, revert the demo's migrations to the pre-codemod state so you can re-run the codemod:
   ```bash
   cd "$(git rev-parse --show-toplevel)"
   git stash push examples/prisma-8-demo/migrations/ -m "tml-2536-qa-pre-codemod"
   ```

   The `stash push` only captures tracked-file modifications; you'll need to revert the post-codemod state to the pre-codemod state first. The simplest way is to check out a pre-codemod commit's `migrations/` tree, then re-stash, then check out the post-codemod state again. If your local layout lets you target the pre-codemod state directly, do that; otherwise, plant the pre-stamped shape by hand on one snapshot (strip `kind` from each `storage.types[*]` entry) and confirm `migration plan` reproduces the deserializer failure in step 2 below — the rest of the scenario still proves the codemod's `--check` / `--apply` / idempotency contract under a representative violation.

2. Confirm the pre-codemod state surfaces TML-2536 cleanly under the strict deserializer:
   ```bash
   cd examples/prisma-8-demo
   node ../../packages/1-framework/3-tooling/cli/dist/cli.js migration plan --json
   ```
   You should see a `PN-CLI-4003 Contract validation failed` envelope naming a specific `end-contract.json` path and listing both `Embedding1536` and `user_type` as having `kind` undefined. This is the regression vector the codemod exists to mitigate.

3. Read the user-skill entry's prose as if you have just been pointed at it for the first time:
   ```bash
   $EDITOR skills/upgrade/prisma-next-upgrade/upgrades/0.9-to-0.10/instructions.md
   ```
   As a developer reading this cold, can you (a) understand *why* the change is required, (b) know *which files* will be touched, (c) know what to do if the codemod throws on an entry it doesn't recognise?

4. Run the codemod in `--check` mode first (the dry-run path your CI gate would use):
   ```bash
   cd "$(git rev-parse --show-toplevel)/examples/prisma-8-demo"
   tsx ../../skills/upgrade/prisma-next-upgrade/upgrades/0.9-to-0.10/stamp-storage-types-kind.ts --check
   echo "exit=$?"
   ```
   Expect non-zero exit and a list of `WOULD FIX` lines naming each affected snapshot.

5. Apply the codemod:
   ```bash
   tsx ../../skills/upgrade/prisma-next-upgrade/upgrades/0.9-to-0.10/stamp-storage-types-kind.ts
   echo "exit=$?"
   ```
   Expect zero exit and `FIXED` lines naming each snapshot with the per-file stamp count.

6. Confirm the substrate now equals the PR-branch state:
   ```bash
   cd "$(git rev-parse --show-toplevel)"
   git diff examples/prisma-8-demo/migrations/
   ```
   Expect empty output (the codemod reproduced the PR state exactly).

7. Idempotency check — re-run the codemod and confirm it's a no-op:
   ```bash
   cd examples/prisma-8-demo
   tsx ../../skills/upgrade/prisma-next-upgrade/upgrades/0.9-to-0.10/stamp-storage-types-kind.ts
   echo "exit=$?"
   ```
   Expect zero exit and every line `OK … (already stamped …)`.

8. Confirm the deserializer crash is gone and the plan is a clean no-op:
   ```bash
   node ../../packages/1-framework/3-tooling/cli/dist/cli.js migration plan --json | head -20
   ```
   You should see `"ok": true, "noOp": true, "operations": []` (or the equivalent envelope) and **no** `PN-CLI-4003` / `PN-CLI-4020` / `PN-CLI-4999` errors.

### What you should see

- Step 2: a clean reproduction of TML-2536 under the strict deserializer.
- Step 3 (judgement): the prose reads coherently; you can answer all three questions above without referencing other documents.
- Step 4: `--check` correctly identifies every affected snapshot without modifying anything.
- Step 5: `--apply` stamps every entry and reports the per-file count.
- Step 6: the substrate post-codemod is byte-identical to the PR-branch state.
- Step 7: re-running is a no-op (idempotency).
- Step 8: the deserializer no longer rejects the substrate; `migration plan` is a clean no-op envelope.

### Failure modes

- Step 2 doesn't reproduce the bug (means the revert didn't actually downgrade the shape, or the strict deserializer is silently re-stamping — TML-2536 has structurally regressed).
- Step 3 surfaces a comprehension gap in the user-facing prose (the user's first line of defence when the codemod throws or behaves unexpectedly).
- Step 4 misses an affected snapshot (the codemod's glob or detection rules are wrong).
- Step 5 throws on a snapshot the codemod's dispatch rules don't anticipate (either the codemod needs broader dispatch, or the snapshot is hand-edited and needs explicit prose guidance).
- Step 6 shows non-empty diff (the codemod's output diverges from the PR-branch state — validation-by-execution failed).
- Step 7 reports any `FIXED` (the codemod is not idempotent and would oscillate on repeat runs).
- Step 8 still shows `PN-CLI-4003` (codemod missed a structural case the strict deserializer rejects), or shows `PN-CLI-4020` / a non-empty `operations` array (the namespaces-bookend regression or another drift surfaced).

### Restore

```bash
cd "$(git rev-parse --show-toplevel)"
git checkout -- examples/prisma-8-demo/migrations/
git stash drop                     # drop the pre-codemod stash if it's still around
git status                         # must be clean
```

If you reverted via a different mechanism in step 1, restore accordingly — the end state must be byte-identical to the tip-of-branch substrate.

---

## Scenario 11 — Extension-author upgrade journey via `prisma-8-extension-upgrade` 0.9→0.10 entry

**What you're proving from the extension author's seat:** an extension author with a 0.9 extension package — one that ships seed migrations under `packages/<extension>/migrations/` AND constructs `SqlStorage` instances programmatically in source — can read the extension-skill's prose, apply the codemod to seed migrations AND apply the source-level rules to their TypeScript, and end up with an extension whose typecheck + tests pass against 0.10.

This scenario falls under the litmus-test buckets "end-to-end developer-journey smoke" + "human read of durable docs" (the extension-author prose is what the consumer reads cold).

**Covers:** the upgrade-instructions intent for the extension-author audience.

**Isolation:** `workspace` (may mutate `packages/3-extensions/pgvector/` source for the optional structural-falsifier step; restored at end).

**Coverage boundary.** This scenario uses `packages/3-extensions/pgvector/` as the substrate stand-in for a real third-party extension package. It does **not** prove the codemod handles every extension's seed-migration layout, every shape of source-level `SqlStorage` construction, or every test fixture an extension might carry. The structural invariants live in the source-rule list itself; this scenario proves the rules read coherently against a representative real extension and that following them produces a working build.

**Oracle:** after applying the codemod + source rules to the pgvector extension, `pnpm --filter @internal/extension-pgvector typecheck && pnpm --filter @internal/extension-pgvector test` should pass. If the source rules are incomplete (e.g. miss a construction shape the extension uses), one of these gates fails with a `SqlStorage` constructor diagnostic that names the offending entry — that's the structural falsifier.

**Preconditions:**
- Pre-flight complete.
- `git status` clean.
- pgvector extension's typecheck + tests are green on the branch tip (sanity baseline — if they're failing on the branch tip, this scenario can't isolate the upgrade-skill's effects).
- No prerequisite scenarios.

### Steps

1. From repo root, locate the pgvector extension's source surface:
   ```bash
   cd "$(git rev-parse --show-toplevel)"
   find packages/3-extensions/pgvector -name "*.ts" -path "*/src/*" -not -path "*/node_modules/*" \
     | xargs rg -l 'storage.types|new SqlStorage|codecId' 2>/dev/null | head -10
   ```
   Note any files that construct `SqlStorage` programmatically or carry `storage.types` literals. (Most extensions only have a few — pgvector's surface is small.)

2. Read the extension-skill entry's prose:
   ```bash
   $EDITOR skills/extension-author/prisma-8-extension-upgrade/upgrades/0.9-to-0.10/instructions.md
   ```
   As an extension author reading this cold, can you (a) tell which files the JSON codemod will touch in your extension, (b) recognise the source-code shapes the rules describe (object-literal vs spread vs destructuring vs `new SqlStorage(...)` vs `new PostgresEnumType(...)`), (c) know what to do for an edge case the rules don't enumerate?

3. Confirm pgvector's tests are green on the current branch as the baseline:
   ```bash
   pnpm --filter @internal/extension-pgvector typecheck 2>&1 | tail -5
   pnpm --filter @internal/extension-pgvector test 2>&1 | tail -5
   ```
   Both should pass. If they don't, stop — this scenario can't isolate the upgrade-skill's effects, and the failure is a baseline issue worth surfacing separately.

4. Spot-check the codemod's behaviour against the pgvector extension's seed migration tree (if any):
   ```bash
   find packages/3-extensions/pgvector -path "*/migrations/*-contract.json" 2>/dev/null
   ```
   If the extension ships seed migrations, run the codemod with `--check` against the extension package root and confirm the dry-run output:
   ```bash
   cd packages/3-extensions/pgvector
   tsx ../../../skills/extension-author/prisma-8-extension-upgrade/upgrades/0.9-to-0.10/stamp-storage-types-kind.ts --check
   echo "exit=$?"
   ```
   If pgvector ships no seed snapshots that need stamping, this is a no-op (exit 0, all `OK …`). That's expected for an extension that doesn't yet have committed migration history in the old shape.

5. Source-rule audit: open each file from step 1 and confirm none of them carry the pre-strict shape (untagged `{ codecId, nativeType, typeParams }` literals or naked `{ codecId: 'pg/enum@1', ... }` enum literals). If any do, the source-rule guidance must produce a clear fix for that file's shape.

6. (Optional structural falsifier — only if you have time.) Plant a deliberate violation in pgvector's source (e.g. add a test fixture that constructs `SqlStorage` with an untagged codec triple), run `pnpm --filter @internal/extension-pgvector test`, and confirm the `SqlStorage` constructor's diagnostic fires with the entry name and the `toStorageTypeInstance(...)` recommendation. Restore the planted change before moving on:
   ```bash
   git diff packages/3-extensions/pgvector | head -50   # review the plant
   # run the test, observe failure
   git checkout -- packages/3-extensions/pgvector
   ```

### What you should see

- Step 1: a manageable list of files (pgvector's surface is small).
- Step 2 (judgement): the prose reads coherently; the source-code shapes it enumerates (object-literal, spread, destructure, `new SqlStorage(...)`) cover what pgvector actually has.
- Step 3: baseline pgvector typecheck + tests pass.
- Step 4: the JSON codemod operates correctly against pgvector's tree (no-op if no seed snapshots; otherwise stamps them and re-running is idempotent).
- Step 5: pgvector's current source is already 0.10-compliant (since this is a tip-of-branch check) OR a clear violation surfaces and the source-rule guidance prescribes a clean fix.
- Step 6 (optional): planted violation produces a structured `SqlStorage` constructor diagnostic naming the entry; restoring brings tests back to green.

### Failure modes

- Step 2: the source-rule guidance doesn't cover a shape that exists in pgvector's tree (rule prose is incomplete from the extension author's vantage point).
- Step 3: pgvector baseline fails (out of scope for this PR but blocks verifying the extension audience end-to-end).
- Step 4: the codemod fails to stamp a snapshot pgvector ships (the codemod's glob or dispatch is wrong for extension layouts).
- Step 5: pgvector source carries a shape the source-level rules don't cover.
- Step 6 (optional): the `SqlStorage` constructor diagnostic doesn't name the offending entry, or doesn't point at `toStorageTypeInstance(...)` (diagnostic could be more actionable).

### Restore

If you ran step 6, `git checkout -- packages/3-extensions/pgvector` and confirm `git status` is clean. If you ran the codemod in step 4 with `--apply`, also restore those files (the dry-run via `--check` shouldn't have touched anything).

```bash
git status   # must be clean
```

---

## Scenarios deliberately not in this script

| AC | Why it's not a manual-QA scenario |
| --- | --------------------------------- |
| AC-9 (per-`kind` snapshot fixtures exist) | Pure unit-test infrastructure. A QA pass that re-ran them would be re-running our own tests — the antithesis of manual QA. CI covers this. If you want to spot-check, `ls packages/3-targets/3-targets/postgres/test/fixtures/snapshot-read-shapes/` should show `codec-instance.json` and `postgres-enum.json`. |
| AC-11 (`pnpm typecheck && test && lint:deps && lint:no-contract-cast` all pass) | CI runs these on every push. Re-running locally proves only your machine matches CI; it doesn't probe anything user-facing. Scenario 5 is the gate-of-gate version for `lint:no-contract-cast`. |
| "Lint over today's tree is clean" (the static-pass half of AC-2 / AC-8) | Same — re-running the lint against the current branch only proves CI did its job. Scenario 5 is the user-meaningful version (does the gate gate?). |

---

## Sign-off coverage map

| AC ID  | Scenario(s) covering it       |
| ------ | ----------------------------- |
| AC-1   | 1, 2, 3                       |
| AC-2   | 5 (gate-of-gate); static-pass half deliberately excluded — see above |
| AC-3   | 4                             |
| AC-4   | 1, 3, 8                       |
| AC-5   | 1, 2                          |
| AC-6   | 6                             |
| AC-7   | 6                             |
| AC-8   | 5                             |
| AC-9   | (CI; not manual-QA scope) — see "Scenarios deliberately not in this script" |
| AC-10  | 7                             |
| AC-11  | (CI; not manual-QA scope) — see "Scenarios deliberately not in this script" |
| (upgrade-instructions intent — end-user audience)       | 10 |
| (upgrade-instructions intent — extension-author audience) | 11 |

The upgrade-journey scenarios (10, 11) don't map to a numbered AC because they cover the *upgrade-instructions intent*: that the breaking change introduced by AC-3 is mitigable from both consumer audiences. The calibration document's manual-QA section (`projects/drive-domain-model/calibration/prisma-next.md` § 9.1) requires the script to name both prisma-next audiences when shipping a breaking change; these two scenarios are how that requirement is honoured here.

The runner's report (`drive-qa-run`) owns per-scenario results and the overall verdict. Findings are classified there in runtime context; this script intentionally enumerates only failure-mode *categories*.
