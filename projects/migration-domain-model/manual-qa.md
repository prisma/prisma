# Manual QA — TML-2546 (Migration CLI restructure)

> **Be the user.** You are a developer who already knows `prisma-next` from before the restructure. You're going to type the new verbs, type some of the old ones, read the help, read the docs, and judge whether the new surface reads, behaves, and explains itself the way the spec promises.
>
> **Out of scope of this script.** Do **not** re-run `pnpm test:packages`, `pnpm test:journeys`, `pnpm typecheck`, or `pnpm lint:deps` against the clean tree — CI and the reviewer have already verified those (see the M7 R2 review notes in `reviews/code-review.md`). Do **not** re-run the M7 R1 grep-sweep gate against `packages/ docs/` — it's a static property of the diff, also already verified.
>
> **Spec:** [`spec.md`](./spec.md)
> **Plan:** [`plan.md`](./plan.md)
> **Reviewer notes:** [`reviews/code-review.md`](./reviews/code-review.md) (§ M7 R2 round, "For QA")
> **PR:** (link when opened)

## What this script is testing

**The change.** This PR restructures the `prisma-next` CLI surface to align with the resolved migration vocabulary. Six user-visible changes land: (1) `migration apply` is gone — the verb is now top-level `migrate --to <contract>`; (2) `ref` becomes a top-level subject with `set` / `list` / `delete` (the `get` inspect-one verb is dropped); (3) `migration status` is split into five purpose-specific verbs (`status`, `log`, `list`, `graph`, `show`); (4) `db sign` gains a positional / `--contract` argument; (5) a single contract-reference grammar (hash, prefix, ref name, migration dir, `<dir>^`, filesystem path) now spans every place a contract is named; (6) a new `migration check [<m>]` verb performs read-only filesystem integrity checks over the migration graph with five PN codes (`PN-MIG-CHECK-001` through `005`). Removed verbs (`migration apply`, `migration ref`, the removed `migration status` flags) intercept-and-redirect with exit `2` and a `fix:` line naming the replacement. Durable design docs land under `docs/design/10-domains/migration/` (domain reference) and `docs/design/04-inspirations/migrations/` (vendor research), with a cross-link from the subsystem doc.

**The fix / what changed**, in five user-mental-model bullets:

1. The forward-execution verb is `prisma-next migrate --to <contract>` everywhere — same in dev, staging, production. There is no `migrate dev` / `migrate deploy` split.
2. Refs are top-level: `prisma-next ref set production abc…`, `prisma-next ref list`, `prisma-next ref delete production`. There is no `migration ref` namespace and no `ref get`.
3. Asking the system what's going on uses purpose-specific verbs: `migration status` for path/pending, `migration log` for executed history, `migration list` for what's on disk, `migration graph` for topology, `migration show <m>` for one migration's details, `migration check` for integrity. None of `--graph`, `--all`, `--limit`, `--ref` survives on `status`; invoking them redirects.
4. Everywhere you name a contract — `migrate --to`, `db update --to`, `db sign --contract`, `migration plan --from`, `migration status --to/--from`, `ref set <name> <contract>` — the same five reference forms work: storage hash, hash prefix, ref name, migration directory name, `<dir>^`.
5. The conceptual reference for the migration system now lives at `docs/design/10-domains/migration/README.md`. The subsystem doc at `docs/architecture docs/subsystems/7. Migration System.md` cross-links it and focuses on implementation.

**Why manual QA matters here.** CI proves the surface parses, the resolvers resolve, the journey suite stays green, and the grep-sweep gate finds no stale verbs in source. CI does *not* judge whether the new surface **reads** like the domain ("does `prisma-next --help` look like the intended-surface diagram in the spec?"), whether the **redirect messages** are useful to a stuck user, whether the **wrong-grammar diagnostics** point at the right verb in prose that helps rather than confuses, whether the **`See also` cross-references** form a navigable network for someone discovering verbs by accident, or whether the **durable design docs** read as natural permanent homes rather than as content placed there transiently for one project. Those judgements are this script's job.

## Table of contents

| # | Scenario | What it proves | Covers |
|---|---|---|---|
| 1 | Help enumerates the intended surface | A reader of `prisma-next --help` recognises the same shape as the spec's intended-surface diagram | AC1 (judgement) |
| 2 | Removed verbs redirect with a useful `fix:` line | `migration apply`, `migration ref set`, and the three removed `migration status` flags each exit 2 and name the replacement in prose | AC1, AC7 (negative control) |
| 3 | Wrong-grammar diagnostics point at the right verb | Passing a ref name to `migration show` and `<dir>^` to `migration show` produce errors whose `fix:` line distinguishes ref-from-migration and grammar-from-grammar | AC6 (judgement) |
| 4 | `migration check` clean graph + planted corruption | Over a clean graph, exit 0. With one planted within-migration `metadata.to` / `end-contract.json` mismatch, exit 4 + `PN-MIG-CHECK-005` in the JSON envelope. | AC5 (journey smoke + negative control) |
| 5 | `See also` sections cross-link the split verbs | `migration status --help`, `migration log --help`, `migration list --help`, `migration graph --help`, `migration show --help` all include a `See also` block naming the other four | AC7 (judgement) |
| 6 | Docs cross-links resolve and the vocabulary agrees | The four cross-links between subsystem / domain / inspirations / glossary all resolve, and the wording on shared terms is consistent | AC9 (durable-doc read) |
| 7 | `docs/design/` reads as a natural permanent home | A reader unfamiliar with TML-2546 cannot tell from the prose that the content was placed there transiently for one project | AC9 (judgement) |
| 8 | Exploratory: probe the surface for 30 minutes | Surfaces unknown unknowns | (no AC; charter) |

> Scenario 2 is a **negative control** — it plants the old verb (a known violation) and observes the redirect fire. Scenario 4 is **negative control + journey smoke**: clean-graph happy path *plus* a planted corruption. Scenarios 1, 3, 5, 6, 7 are **judgement** — the oracle is "the spec / glossary / domain doc as a fresh-developer would read it", not a structural test. Scenario 8 is **exploratory**.

## Pre-flight

1. **Be on the PR branch.** Check out the branch that contains the TML-2546 changes (the orchestrator branch or the merged-to-main commit).
2. **Refresh bin symlinks and build artifacts.** `pnpm install && pnpm build`. This is mandatory — `pnpm fixtures:check` and the demo's `prisma-next` binary will silently use stale code without it. (The M7 R1 round hit this; the reviewer flagged it for QA.)
3. **`git status` baseline.** A clean tree is the goal, **except for two known-intentional uncommitted items** the orchestrator typically commits before handoff but may still be live when QA starts:
   - `M projects/migration-domain-model/plan.md` — the M7 R3 amendment that records this round'\''s task list.
   - `M wip/unattended-decisions.md` — the orchestrator'\''s ongoing decision record (gitignored content, but `wip/` itself can show in status if any tracked file landed there earlier).

   If `git status` shows **only** those two paths and otherwise nothing else, treat it as clean and proceed. If it shows additional unexpected entries (especially under `packages/`, `docs/`, `test/`, or `examples/`), surface the surprise as a finding before running scenarios — running QA against an unverified tree wastes runner time. If you prefer a strictly-clean tree, stash the two known items (`git stash push -m 'qa-baseline'`) before starting and `git stash pop` when finished.
4. **Tooling versions.** `pnpm --version` ≥ 10; `node --version` matches root `package.json` `engines.node`.
5. **Open the spec.** Have `projects/migration-domain-model/spec.md` open in another tab — Scenario 1 compares the help output against the intended-surface diagram.

## Scenario 1 — Help enumerates the intended surface

**What you're proving from the user's seat:** A developer who runs `prisma-next --help` to learn what's available sees a top-level command list that matches the intended-surface diagram in the spec — and only that. No leftover `migration apply` or `migration ref` references. The verb groupings (`init`, `migrate`, `contract`, `db`, `migration`, `ref`) read in an order that maps onto the domain (top-level acts first, then per-subject namespaces).

**Covers:** AC1.

**Oracle:** [`spec.md § Intended surface`](./spec.md#intended-surface-this-project) — the diagram. The help output should enumerate the same verbs, no more, no less. (Internal-only commands like `_meta` or hidden debug verbs may legitimately appear; flag anything else.)

**Preconditions:**
- Pre-flight complete.
- Have the spec's intended-surface diagram open.

### Steps

1. From the repo root: `node packages/1-framework/3-tooling/cli/dist/cli.mjs --help` (or `pnpm --filter examples/prisma-8-demo exec prisma-next --help` from inside the demo).
2. Read the top-level command list.
3. For each top-level entry, run `<verb> --help` and read the subcommand list. Especially:
   - `prisma-next migration --help` — should list `plan`, `new`, `show`, `status`, `log`, `list`, `graph`, `check`. **No `apply`. No `ref`.**
   - `prisma-next ref --help` — should list `set`, `list`, `delete`. **No `get`.**
   - `prisma-next db --help` — should list `init`, `update`, `verify`, `sign`, `schema`.

### What you should see

- The top-level help lists the verb families from the intended-surface diagram: `init`, `migrate`, `contract`, `db`, `migration`, `ref`.
- `migration --help` lists exactly the eight subcommands from the intended-surface diagram.
- `ref --help` lists exactly `set`, `list`, `delete`.
- `migrate --help` shows `--to <contract>` and surfaces the contract-reference grammar in the argument description (it should mention that `<contract>` accepts hashes, ref names, migration directory names, and so on — exact wording is judgement).
- No verb anywhere in the help tree mentions `apply` as the way to advance a database.

### Failure modes (anything matching these = a finding the runner will classify)

- A verb from the spec's intended surface is missing.
- A verb that isn't in the intended surface appears (`apply`, `ref get`, etc.).
- Subcommand description text references a removed verb or removed flag.
- Verb-family ordering reads as random (e.g. `ref` appears before `init` in the top-level list) — a judgement call worth surfacing.
- Help text legibility issues: `<contract>` argument description is hard to parse, examples are missing, line wrapping is broken.

## Scenario 2 — Removed verbs redirect with a useful `fix:` line **(negative control)**

**What you're proving from the user's seat:** A developer with muscle memory for the old verbs gets a targeted suggestion, not a generic "unknown command" error. The replacement verb is named in the error text in prose the user can copy and try.

**Covers:** AC1, AC7. **Coverage boundary:** this scenario covers five specific removed-verb / removed-flag pairs (`migration apply`, `migration ref set`, `migration status --graph`, `migration status --all`, `migration status --ref X`). It does *not* prove that *every* possible removed surface is in the redirect table — only the five spec-named ones. Removed combinations not in the table (e.g. a hypothetical `migration apply --foo`) may produce a generic unknown-command error, which is acceptable.

**Oracle:** The replacement in the spec's intended-surface diagram. The diagnostic must (a) exit code 2, (b) print the replacement verb verbatim as something the user can copy. Empty / generic / shrug diagnostics are findings.

**Preconditions:** Pre-flight complete.

### Steps

For each of the following invocations, run the command and observe stderr + exit code (e.g. `… ; echo "exit=$?"`):

1. `prisma-next migration apply` → expected `Use \`prisma-next migrate --to <contract>\` instead.`
2. `prisma-next migration apply --to production` → same as above (the `--to` arg shouldn't change the redirect target).
3. `prisma-next migration ref set staging abc` → expected `Use \`prisma-next ref set|list|delete\` instead.`
4. `prisma-next migration ref` (no subcommand) → expected `Use \`prisma-next ref set|list|delete\` instead.`
5. `prisma-next migration status --graph` → expected `Use \`prisma-next migration graph\` to view the migration graph.`
6. `prisma-next migration status --all` → expected `Use \`prisma-next migration log --db <url>\` to view the full execution history.`
7. `prisma-next migration status --ref production` → expected `Use \`--to <contract>\` instead of \`--ref\`.`

### What you should see

- Every command exits with `2` (the CLI-wide `PRECONDITION` code).
- Every error line on stderr names the new verb / flag in backticks, in a form the user can copy and run.
- No invocation accidentally executes the new verb on the user's behalf — the redirect is a diagnostic, not a behavioural alias.

### Failure modes

- Any invocation exits `0` (worst case: the old verb still works).
- Any invocation exits `1` or `127` with a generic "unknown command" error and no `fix:` line.
- The replacement verb name is wrong or stale.
- The error wording reads condescendingly or doesn't help (e.g. "use the new verb" without naming it).

## Scenario 3 — Wrong-grammar diagnostics point at the right verb

**What you're proving from the user's seat:** A developer who confuses a contract reference (e.g. `production`) with a migration reference gets a diagnostic that names the distinction in prose — not a generic "not found".

**Covers:** AC6.

**Oracle:** [`spec.md § FR5 — wrong-grammar diagnostics table`](./spec.md#functional-requirements). The error text must distinguish ref-from-migration explicitly in at least one of the test cases below; the `^` test case must call out that `^` is contract-grammar syntax.

**Preconditions:** Pre-flight complete. A ref named `production` (or any ref the demo / fixture has — confirm with `prisma-next ref list`).

### Steps

1. **Ref-name → `<migration>` expected.** `prisma-next migration show production` (or whichever ref name `ref list` shows). Read the error.
2. **`<dir>^` → `<migration>` expected.** `prisma-next migration show 20260422T0720_initial^` (substitute a real migration directory name from the demo). Read the error.
3. **Hash prefix that matches a contract but not a migration → `<migration>` expected.** Pick a contract storage hash prefix from `prisma-next ref list` or `migration graph --json` output, then `prisma-next migration show <that-prefix>`. Read the error.

### What you should see

- Case 1 error names the ref-vs-migration distinction in prose (the diagnostic recognises that `production` is a known ref name and tells the user `migration show` wants a migration directory name or hash, not a ref).
- Case 2 error explicitly mentions that `^` is contract-grammar syntax and doesn't apply to migration references.
- Case 3 error explicitly distinguishes "matched a contract hash but not a migration hash" — not just "not found".
- The `fix:` line in each case names a verb-grammar pair the user can copy.

### Failure modes

- Any case produces a generic "not found" / "unknown reference" error.
- The diagnostic incorrectly identifies the input shape (e.g. claims the ref name is "not a known reference").
- The `fix:` line names the wrong replacement verb or omits the grammar distinction.
- The diagnostic copy is technically correct but reads poorly (e.g. error speaks in implementation jargon rather than user-mental-model terms).

## Scenario 4 — `migration check` clean graph + planted corruption **(journey smoke + negative control)**

**What you're proving from the user's seat:** The new `migration check` verb is the headline genuinely-new behaviour of the PR. Over a clean graph it passes with exit 0. With a planted within-migration corruption (one migration's `metadata.to` disagreeing with its `end-contract.json` snapshot), it exits 4 and the structured `--json` envelope carries `PN-MIG-CHECK-005`. This is the AC5 within-migration scope; cross-migration consistency is explicitly deferred to `migration preflight` per the spec note.

**Covers:** AC5. **Coverage boundary:** this scenario plants exactly one PN-005 corruption. It does not exercise PN-001 (hash mismatch), PN-002 (manifest incomplete), PN-003 (orphan migration), or PN-004 (dangling ref) — those have unit-test coverage at `packages/.../migration-check.e2e.test.ts` and unit-test fixtures. The point here is the **user-observable journey**: clean → run check → all good → plant corruption → run check → useful diagnostic → restore. The other four PN codes are deliberately scenario-skipped.

**Oracle:** Spec FR6 + the [glossary's `migration check` PN code table](../../docs/glossary.md#migration-check). Exit 0 on clean; exit 4 + `PN-MIG-CHECK-005` in the `--json` envelope on the planted corruption.

**Preconditions:**
- Pre-flight complete.
- The demo's migrations directory at `examples/prisma-8-demo/migrations/app/` contains at least two migrations (it does — see `20260422T0720_initial`, `20260422T0742_migration`, `20260422T0748_migration`).

### Steps

1. **Cold check (happy path).** From the demo:
   ```bash
   cd examples/prisma-8-demo
   pnpm exec prisma-next migration check ; echo "exit=$?"
   pnpm exec prisma-next migration check --json | head -40
   ```
   Read the exit code and the human-readable output.

2. **Plant the corruption.** Pick a non-initial migration (e.g. `20260422T0742_migration`). Edit its **`end-contract.json`** (NOT `migration.json`) and replace `storage.storageHash` with an obviously-wrong hash, e.g. `dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd`. Save.

   The recipe must target `end-contract.json` rather than `migration.json` because PN-005 is the *within-migration snapshot-consistency* check — it detects drift between the manifest's `metadata.to` and the recorded snapshot's `storageHash`. Mutating `migration.json` invalidates the `migrationHash` first, which makes the loader throw PN-001 (HASH_MISMATCH) before PN-005 has a chance to fire.

   Concretely:
   ```bash
   # Inspect the original first so you can restore by memory or by git
   cat migrations/app/20260422T0742_migration/end-contract.json | head -20
   # Hand-edit end-contract.json: change "storageHash": "..." to "dddd…"
   ```

3. **Hot check, graph-wide (corruption-positive).**
   ```bash
   pnpm exec prisma-next migration check ; echo "exit=$?"
   pnpm exec prisma-next migration check --json | head -60
   ```
   Read the exit code, the human-readable output, and the JSON envelope.

4. **Hot check, per-migration.** Run `pnpm exec prisma-next migration check 20260422T0742_migration --json | head -60` to confirm the targeted check catches the same corruption. (Per-migration mode used to be a false-negative on PN-005 — fixed in this round; the scenario verifies the fix holds.)

### What you should see

- **Step 1:** exit 0; the human output reports clean / OK; the JSON envelope shows `ok: true` (or whatever the success shape's discriminator is).
- **Step 3:** exit 4; the JSON envelope contains an error entry naming `PN-MIG-CHECK-005` (or whatever wording the spec/glossary fixed for the EDGE_MISMATCH code) and identifies the offending migration by directory name in `where`. The human-readable output reads like a useful diagnostic — names the migration, names the inconsistency, suggests a fix (re-emit). Vague text like "integrity failed" without the migration name is a finding.
- **Step 4:** exit 4 again; per-migration mode reports the same PN-005, scoped to the named migration.

### Failure modes

- Step 1 exits non-zero (clean graph reports failure).
- Step 3 exits 0 (the corruption was not detected) or exits 1/2 (wrong code).
- The JSON envelope on step 3 has no PN code, or names a different PN code (e.g. PN-001 / HASH_MISMATCH when the corruption is purely within-migration metadata vs snapshot).
- The human-readable output is unhelpful — fails to name the offending migration, or buries the diagnostic in implementation jargon.
- Step 4 (per-migration) reports a different result from step 3 (graph-wide).

### Restore

```bash
git checkout -- migrations/app/20260422T0742_migration/end-contract.json
git status   # must be clean — no other files mutated
```

If `git status` shows any other file changed (especially `examples/prisma-8-demo/contract.json` or anything outside `migrations/app/<dir>/`), surface that as a finding — `migration check` is supposed to be read-only.

## Scenario 5 — `See also` sections cross-link the split verbs

**What you're proving from the user's seat:** A developer who lands on one of the split verbs (e.g. `migration status`) and realises they wanted a different one (`migration log`) can discover the right verb from the help text alone — without consulting external docs.

**Covers:** AC7.

**Oracle:** [`spec.md § FR3, Discoverability across the split`](./spec.md#functional-requirements). Every one of the four split verbs (`status`, `log`, `list`, `graph`) plus `show` should cross-reference the other four in a `See also` block immediately after Examples.

**Preconditions:** Pre-flight complete.

### Steps

For each verb in `{ migration status, migration log, migration list, migration graph, migration show }`:

```bash
pnpm exec prisma-next <verb> --help | tail -40
```

Read the `See also` block (if present) and confirm it lists the other four split verbs.

### What you should see

- Every verb's `--help` includes a `See also` section.
- Each `See also` block names the other four verbs in the split, with a one-line description per verb that distinguishes them (a description that just says "see also migration log" without explaining what `log` does is a finding).
- Verbs are named in `backticks` for copy-paste-ability.
- The block is positioned consistently across verbs (e.g. always after Examples, or always at the end of the help).

### Failure modes

- Any verb is missing the `See also` block.
- A verb references the *wrong* other verbs (e.g. `migration status --help` cross-references `migration plan` instead of `migration log`).
- A description is missing or unhelpful.
- The block's position in the help is inconsistent across verbs (a judgement call worth surfacing).

## Scenario 6 — Docs cross-links resolve and the vocabulary agrees

**What you're proving from the user's seat:** A reader navigating between the four docs that describe the migration system — the user-facing glossary, the conceptual domain reference, the implementation subsystem doc, and the inspirations folder — finds working cross-links and consistent vocabulary. None of the four documents references a removed verb or a flag that no longer exists.

**Covers:** AC9.

**Oracle:** [`spec.md § AC9`](./spec.md#acceptance-criteria) + the M7 R2 reviewer note in `reviews/code-review.md`. The four cross-links to verify are:
- Subsystem → domain: `docs/architecture docs/subsystems/7. Migration System.md` (the new header note immediately after the H1) → `docs/design/10-domains/migration/README.md`.
- Domain → subsystem: `docs/design/10-domains/migration/README.md` (the introduction and the "See also" footer) → `docs/architecture docs/subsystems/7. Migration System.md`.
- Inspirations → domain: `docs/design/04-inspirations/migrations/README.md` and the three doc files → `docs/design/10-domains/migration/README.md`.
- Glossary references in either doc (the domain doc's See-also footer; the subsystem doc's PN-005 scope note).

**Preconditions:** Pre-flight complete.

### Steps

1. Open `docs/architecture docs/subsystems/7. Migration System.md`. Confirm the cross-link header just under the H1 resolves (click it or `cat` the target).
2. Open `docs/design/10-domains/migration/README.md`. Confirm the intro paragraph and the See-also footer both reference the subsystem doc with paths that resolve.
3. Open `docs/design/04-inspirations/migrations/README.md` and each of `atlas.md`, `active-record.md`, `established-conventions.md`. Confirm each links back to the domain doc.
4. **Vocabulary spot-checks** (read the glossary entry, then the domain doc entry for the same term, then compare):
   - `Storage hash` — both docs should describe the same `(schemaVersion, targetFamily, target, storage)` hash and call out that bare "hash" means storage hash.
   - `Migration` (the noun) — both docs should describe the same `{ migration.json, ops.json, migration.ts, start-contract.json, end-contract.json }` on-disk shape.
   - `migration check` — both docs should list the same five PN codes (`PN-MIG-CHECK-001` through `005`) and the same three exit codes (0/2/4).
   - `Contract reference` grammar — both docs should describe the same five forms (hash, ref name, migration dir, `<dir>^`, filesystem path with `./` prefix).
5. **Negative spot-check.** `rg 'migration apply|migration ref [^c]|migration status --(ref|graph|all)|--limit' "docs/glossary.md" "docs/architecture docs/subsystems/7. Migration System.md" "docs/design/10-domains/migration/README.md" "docs/CLI Style Guide.md"` — any hits indicate a stale reference.

### What you should see

- Every cross-link resolves (no 404 / broken-link in markdown).
- Vocabulary spot-checks agree between glossary and domain doc.
- Negative spot-check returns no matches.

### Failure modes

- Any cross-link is broken.
- Two docs describe the same term in materially different ways (e.g. one names PN-005 as EDGE_MISMATCH and the other doesn't name a code at all).
- A removed verb / flag appears in any of the four docs.

## Scenario 7 — `docs/design/` reads as a natural permanent home

**What you're proving from the user's seat:** A reader unfamiliar with TML-2546 — opening `docs/design/10-domains/migration/README.md` six months from now — should be able to read it as the canonical domain reference for the migration system, not as content that was placed here transiently for one project. If the prose still carries working-document framing ("working draft", "Phase 2", references to the project's internal files), that's a forward-compatibility leak the M7 R2 port should have stripped.

**Covers:** AC9 (forward-compatibility property called out by the M7 R2 reviewer).

**Oracle:** Read the prose as a fresh-developer would. The doc should read like a permanent reference. Specific signals that something leaked:
- The word "draft", "working", "in progress", "ongoing".
- Milestone IDs (M1–M7, R1, R2) or AC IDs in prose (PN codes like `PN-MIG-CHECK-005` are fine — they're stable user-facing error codes).
- Phase numbers ("Phase 2", "Phase 3 audit").
- Project-internal links (paths starting with `projects/migration-domain-model/`).
- Spec attributions ("per spec", "the spec calls out", "sub-spec § 4").

**Preconditions:** Pre-flight complete. Read the docs with fresh eyes — pretend you've never seen TML-2546.

### Steps

1. Open `docs/design/README.md`. Read it as a first-time visitor to `docs/design/`. Does it explain what the directory is for without forcing you to read TML-2546's spec? Does it honestly frame the partial-population state (only `04-inspirations/` and `10-domains/` are filled in) without implying the other slots are missing?
2. Open `docs/design/10-domains/migration/README.md`. Read the first three paragraphs. Without the project context, do you understand what this doc is, who it's for, and how it relates to the implementation subsystem doc and the glossary?
3. Scan the body for working-draft framing, milestone IDs, phase numbers, or project-internal references. Surface anything you find.
4. Open `docs/design/04-inspirations/migrations/established-conventions.md`. The synthesis here was the most heavily edited during the port (two stale CLI references updated, one ticket-attribution rephrased). Read the "Summary: Adopt / Diverge / Avoid" section's preamble — does it read as a stable description of "what we adopted from the surveyed systems" or as a project-process artefact?

### What you should see

- The three docs read as durable references, not as project artefacts.
- The honest framing in `docs/design/README.md` ("partially populated", "other slots not yet created") reads as deliberate rather than apologetic.
- Cross-references in the domain doc point at durable locations (glossary, subsystem doc, CLI Style Guide) — not at `projects/migration-domain-model/`.

### Failure modes

- Any of the working-document framing terms above appears in the prose.
- A reader has to consult TML-2546 / the project's spec to understand what the docs are for.
- A cross-reference points back at `projects/migration-domain-model/` (the project directory is retained through QA, but it should not be linked from durable docs).

## Scenario 8 — Exploratory: probe the migration CLI surface

**Charter.** Explore the migration CLI surface — `migrate`, `db update`, `db sign`, `ref`, the five `migration` reading verbs, and `migration check` — against the `examples/prisma-8-demo/` demo and / or one of the `migration-fixtures/` snapshots, for **30 minutes**. Discover behaviours that surprise you, diagnostics that read poorly, redirects that misfire, state combinations the scripted scenarios skipped, or any place where the user mental model and the implementation diverge.

**Covers:** (no specific AC; surfaces unknown unknowns).

**Time budget:** **30 minutes**. Stop when the timer rings even if you have ideas left — log them as candidate scenarios for a future round.

**Suggested probe vectors** (use as inspiration, not a checklist):

- **Mixed grammars.** Try every form of `<contract>` against `migrate --to`, `db update --to`, `db sign --contract`, `ref set` — including the unusual ones (`<dir>^`, filesystem path with `./` prefix, ambiguous short prefixes that match more than one hash).
- **Wrong-grammar combinations.** Pass migration directory names where contract refs are expected and vice versa; pass `^`-suffixed forms to `migration show`; pass paths without `./`.
- **`migration graph` output formats.** Try `--json` and `--dot`. Pipe `--dot` into `dot -Tsvg` if you have GraphViz installed — does the graph render?
- **`migration check` adversarial fixtures the scripted scenario skipped.** Plant a PN-001 (hash mismatch), PN-002 (delete `migration.json`), PN-004 (dangling ref) corruption and confirm the right code fires. Restore.
- **Help-text legibility.** Read `--help` on the verbs you don't normally use. Anything that reads like jargon?
- **Cross-namespace confusion.** Does `prisma-next ref --help` confuse a reader who expects `git ref`-style commands? Does `migrate --to` confuse a reader who expects `migrate up` / `migrate down`?
- **`--json` envelope shape.** Pipe several commands through `--json` and inspect: are the success and error shapes consistent? Does the discriminator (`ok: true` / `ok: false` or equivalent) work uniformly?
- **Combinations the scripted scenarios skipped.** Pass `--to` *and* `--from` to `migration status`; pass `--contract` *and* a positional argument to `db sign` (mutually exclusive — does the CLI catch it?); try `migration check` against a fixture-directory that has no contract.

**Notes capture:** In a scratch file (`wip/qa-exploratory-notes.md` is fine — `wip/` is gitignored), capture three columns per observation: what you tried, what surprised you, and whether you can articulate why. Findings classify the same way scripted-scenario findings do, in the runner's report.

**Restore:** Whatever you mutated. End with `git status` clean.

## Scenarios deliberately not in this script

| AC | Why it's not a manual-QA scenario |
|---|---|
| AC2 | Resolves-identically-across-grammar-forms is a parameterised unit test at `packages/1-framework/3-tooling/migration/test/refs/*.test.ts`. CI runs it on every push; manual re-typing each of the five forms five times adds no judgement signal. |
| AC3 | "Each verb queries only its needed data sources" is a static property — `migration list` / `graph` / `show` simply don't take a `--db` flag. The reviewer verifies this by reading the command implementations; a manual run cannot disprove it more strongly than reading the source. |
| AC4 | `db sign` argument-shape parity is covered by the parameterised journey test at `test/integration/test/cli-journeys/db-sign-contract-arg.e2e.test.ts` (added in M5 R2). Manual re-typing the four shapes adds nothing. |
| AC5 (PN-001–004) | Per-code adversarial fixtures are covered by the journey test at `test/integration/test/cli-journeys/migration-check.e2e.test.ts`. The script's Scenario 4 covers PN-005 because it's the spec/impl-aligned check that the M6 R2 reviewer specifically flagged for human eyeballing; PN-001–004 get exploratory coverage in Scenario 8 if the runner takes the suggestion. |
| AC8 | Journey suite green = `pnpm test:journeys` — that IS the CI signal. Re-running it locally proves only your machine matches CI. |
| `pnpm test:packages`, `typecheck`, `lint:deps` | Same — CI gates. |
| The M7 R1 grep-sweep gate | Static property of the diff; the reviewer verified it in M7 R1 and M7 R2. Re-running adds nothing. |

## Sign-off coverage map

| AC ID | Scenario(s) covering it |
|---|---|
| AC1 | 1, 2 |
| AC2 | (CI; not manual-QA scope) — see "Scenarios deliberately not in this script" |
| AC3 | (CI / static reading; not manual-QA scope) |
| AC4 | (CI; not manual-QA scope) |
| AC5 | 4 (PN-005 explicitly; PN-001–004 deferred to Scenario 8 exploratory if runner takes the suggestion) |
| AC6 | 3 |
| AC7 | 2, 5 |
| AC8 | (CI; not manual-QA scope) |
| AC9 | 6, 7 |
