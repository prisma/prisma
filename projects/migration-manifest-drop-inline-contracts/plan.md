# Plan — Drop inlined contracts from `migration.json`

Spec: [spec.md](./spec.md). Linear: [TML-2512](https://linear.app/prisma-company/issue/TML-2512).

## Test cases (derived from acceptance criteria)

These are the concrete behaviours the implementation must satisfy. Tasks below are sequenced to make these green.

| # | Behaviour | Verified by |
|---|---|---|
| TC1 | `MigrationMetadata` type has no `fromContract` / `toContract` field. | Compile-time: removing the fields breaks all reads/writes of them; everywhere fixed. |
| TC2 | `MigrationMetadataSchema` rejects manifests carrying `fromContract` / `toContract`. | New unit test in `io.test.ts`. |
| TC3 | `migration plan` writes a manifest without the inlined contracts. | Update existing `migration-plan.test.ts`; assertion on serialised JSON keys. |
| TC4 | `migration new` writes a manifest without the inlined contracts. | Update existing `migration-new.test.ts` (or equivalent). |
| TC5 | `migrationHash` is byte-identical before and after the type change for every committed migration in the repo. | One-shot verification during cutover; documented in PR description. (Hash already excludes the fields by `computeMigrationHash`.) |
| TC6 | `migration plan` against a project with prior migrations reads the predecessor's `end-contract.json` from disk and feeds the planner a typed `Contract` value. | Update `migration-plan.test.ts` to assert the read happens; add a failure-mode test when the file is missing (structured CLI error). |
| TC7 | `migration apply` succeeds against a migration directory whose `start-contract.json`, `end-contract.json`, and `*-contract.d.ts` files have all been deleted. | New integration test under `packages/3-targets/6-adapters/postgres/test/migrations/` (or the SQL family's test home). |
| TC8 | `materialiseMigrationPackage(dir, pkg)` writes only `migration.json` + `ops.json`; no per-package `contract.json`. | Update `materialise-migration-package.test.ts`. |
| TC9 | All committed `migration.json` files in the repo (examples + extension seeds + test fixtures) load cleanly with the strict schema. | `pnpm test:packages` end-to-end. |
| TC10 | Migration System subsystem doc reflects the new file layout and documents the runner-independence property. | Manual review. |

## Reasoning checkpoints

Three points in the plan where the implementing agent should pause and ask the operator to upgrade reasoning effort to **high** for a careful review of the work-so-far before continuing. These are the moments where a missed implication is hardest to undo later.

- **Checkpoint A — After T5** (all code changes complete; before repo-wide manifest regen).
  Why high reasoning: this is where every reader and writer of the inlined fields has been touched. A missed consumer at this stage means a regenerated manifest later fails to round-trip, or a runtime path silently breaks. The operator should re-read the diff with fresh attention before authorising the regen pass.
- **Checkpoint B — After T8** (runner-independence test in place).
  Why high reasoning: the new durable property — "runner only needs `migration.json` + `ops.json`" — is being locked in by a test. The test's setup is what defines the property. If the setup hides a hidden dependency (e.g. an emit-time side effect that quietly recreates a `*-contract.json` file), the property is weaker than it looks. Operator review confirms the test exercises what we say it does.
- **Checkpoint C — Before T10 close-out** (everything green; PR description being written).
  Why high reasoning: the final pass over the spec's acceptance criteria. Confirms each AC is genuinely covered, not just plausibly covered. Also the right moment to confirm that the Cipherstash heads-up has gone out before merge.

The implementing agent should explicitly request "please upgrade me to high reasoning effort" at each checkpoint and stop until the operator confirms.

## Sequencing

Each task is intended as one focused commit. Tests-before-implementation per repo policy.

### T1 — Add `'reject unknown fields'` regression test for the new manifest shape

- Add a unit test in `packages/1-framework/3-tooling/migration/test/io.test.ts` that constructs a manifest object containing `fromContract` or `toContract` and asserts `MigrationMetadataSchema` rejects it.
- The test will fail today (the schema requires those fields). It anchors TC2 and pins behaviour for the rest of the work.

### T2 — Remove the fields from `MigrationMetadata` and the arktype schema

- `packages/1-framework/1-core/framework-components/src/control/control-migration-types.ts` — delete `fromContract` and `toContract` from `MigrationMetadata`.
- `packages/1-framework/3-tooling/migration/src/io.ts` — delete the same fields from `MigrationMetadataSchema`. Keep `'+': 'reject'`.
- `packages/1-framework/3-tooling/migration/src/hash.ts` — remove the now-redundant `fromContract: _fromContract, toContract: _toContract` strip lines in `computeMigrationHash` (the fields no longer exist on the input).
- This will not compile: every producer and consumer that currently references the fields needs to be updated. T3–T5 do that.
- T1's test goes green here.

### T3 — Update CLI producers (`migration plan`, `migration new`)

- `packages/1-framework/3-tooling/cli/src/commands/migration-plan.ts` — drop `fromContract` and `toContract` from `baseMetadata`.
- `packages/1-framework/3-tooling/cli/src/commands/migration-new.ts` — same.
- Update assertions in `migration-plan.test.ts` and `migration-new.test.ts` (and `migration-e2e.test.ts`) that currently assert on `pkg.metadata.fromContract` / `pkg.metadata.toContract` — switch to asserting on the sibling files. TC3 / TC4.

### T4 — Switch predecessor-contract lookups to `end-contract.json`

- Both `migration-plan.ts` and `migration-new.ts` currently read `predecessorPackage.metadata.toContract` when resolving the new plan's `fromContract`. Switch to:
  ```ts
  const fromContractRaw = await readFile(
    join(predecessorPackage.dirPath, 'end-contract.json'),
    'utf-8',
  );
  fromContract = JSON.parse(fromContractRaw) as Contract;
  ```
  Wrap in a structured `CliStructuredError` if the file is missing, naming the path and pointing the user at re-emitting from the source.
- Update `migration-plan.test.ts` to cover the read and the failure-mode error. TC6.
- The planner interface (`MigrationPlanner.plan({ fromContract, ... })`) is unchanged — it stays file-I/O-free. The CLI continues to be the I/O boundary.

### T5 — Clean up `migration-base.ts` and `materialiseMigrationPackage`

- `packages/1-framework/3-tooling/migration/src/migration-base.ts`:
  - `buildAttestedMetadata`: drop the `fromContract` / `toContract` fields from the assembled metadata. Remove the contract-stub synthesis.
  - Delete `assertBookendsMatchMeta` and its call site.
- `packages/1-framework/3-tooling/migration/src/errors.ts` — remove `errorStaleContractBookends` and its `PN-MIG-...` code (audit the codebase for any references first).
- `packages/1-framework/3-tooling/migration/src/io.ts:materialiseMigrationPackage` — drop the `await writeFile(join(dir, 'contract.json'), ...)` line. Update its JSDoc.
- Update `materialise-migration-package.test.ts` to assert the per-package `contract.json` is **not** written. TC8.
- Update `migration-base.test.ts` to remove or rewrite the bookend-staleness tests.

### T6 — Update test fixtures

- `packages/1-framework/3-tooling/migration/test/fixtures.ts:createTestMetadata` — drop `fromContract` / `toContract` from the synthesized metadata.
- Walk every test file under `packages/` and `examples/` that constructs `MigrationMetadata` literals; remove the two fields from each.

### T7 — Repo-wide manifest regeneration

- Write a one-shot script `scripts/strip-inline-contracts-from-manifests.mjs` that walks the repo, finds every `migration.json`, strips `fromContract` and `toContract`, and writes back with a trailing newline (matching the writer's convention). Since the hash excludes both fields by design, `migrationHash` is unchanged.
- Run it. Verify with `git diff` that:
  - Only `fromContract` / `toContract` keys disappear from each `migration.json`.
  - No `migrationHash` value changes.
- Add a check to the script: re-hash each manifest after the strip and confirm against the stored `migrationHash`; fail loudly on any mismatch. TC5.
- The script lives in `scripts/` for now; it can be deleted in a follow-up cleanup once every consumer of this repo has regenerated.

### T8 — Add runner-independence regression test

- New integration test (postgres adapter, mirroring the existing `db-init-update.cli.integration.test.ts` pattern) that:
  1. Sets up a project with one applied migration.
  2. Deletes `start-contract.json`, `end-contract.json`, `start-contract.d.ts`, `end-contract.d.ts`, and `migration.ts` from the migration directory.
  3. Adds a second migration via `materialiseMigrationPackage` (which only writes `migration.json` + `ops.json`).
  4. Runs `migration apply` to a fresh database against the directory; asserts success and final marker state.
- Same test for the SQLite adapter under its existing test home, to lock in target-independence.
- This is TC7 and the durable contract for the runner-independence property.

### T9 — Documentation

- Update `docs/architecture docs/subsystems/7. Migration System.md`:
  - Remove `fromContract` / `toContract` references from the "File Layout" section.
  - Add a paragraph (probably under "Runner") that states explicitly: the runner reads only `migration.json` + `ops.json` per package; `*-contract.json` files are an authoring-time convenience for `migration plan` and for typed access inside `migration.ts`, never an apply-time dependency.
- Sanity-check that no other doc still references the inlined fields (rg over `docs/` for `fromContract` / `toContract` / `migration.json`). TC10.

### T10 — Close-out

- `pnpm build`, `pnpm typecheck`, `pnpm lint:deps`, `pnpm test:packages`, `pnpm test:integration`, `pnpm test:e2e` all green.
- PR description summarises the gotcha, links the spec, calls out the runner-independence property, and lists the regenerated artefacts.
- Notify the Cipherstash extension maintainer of the shape change.
- Delete `projects/migration-manifest-drop-inline-contracts/` as part of the close-out PR (or this same PR — the spec is short-lived).

## Risk register

- **Risk:** Hand-authored extension seed manifests (pgvector, postgis, cipherstash, paradedb) drift from their `migration.ts` after the strip if their `migration.ts` files still reference the old shape. **Mitigation:** T7's verification step re-hashes after strip. T6 audits test fixtures. None of the extension `migration.ts` files reference `fromContract` / `toContract` in code (only in comments — checked).
- **Risk:** Cipherstash extension's published version still reads `metadata.toContract`. **Mitigation:** Out-of-band communication (per the design discussion).
- **Risk:** A consumer in the codebase reads `metadata.toContract` somewhere I missed. **Mitigation:** Type removal in T2 makes this a compile error; every reader surfaces.
