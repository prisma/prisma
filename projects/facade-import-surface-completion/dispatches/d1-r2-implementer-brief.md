# Implementer resume — D1 R2

## Resume — `facade-import-surface-completion`, D1 R2

> You are being resumed. You retain your full prior transcript including every commit you made (`5058518f2` `/migration` re-export + `9ff5d1533` `defineContract` wrap), every file you read, and every decision you exercised this dispatch. Trust your prior transcript; reconcile only where the restated context below diverges from your memory.

The reviewer issued **ANOTHER ROUND NEEDED** on D1 R1. One must-fix finding (F1) blocks FR11. The full reviewer round notes live at `projects/facade-import-surface-completion/reviews/code-review.md § Round notes` and the finding body at § Findings log F1 — both are read-only for you; read them in full before starting R2.

## Findings to address this round

- **F1** (must-fix): `type PostgresBaseResult = ReturnType<typeof baseDefineContract<SqlFamily, PostgresPack>>` (define-contract.ts L46-47) fixes only `Family`/`Target` and lets `Types`, `Models`, `ExtensionPacks`, `Capabilities` fall to defaults. The result: a `defineContract({ models: { User: ... } }, factory)` call returns a contract whose TypeScript type carries no models. FR11's "preserves inference" bar fails.

  **Resolution required:** Thread the additional type parameters through the wrap so the call-site inferred `Types`/`Models`/`ExtensionPacks`/`Capabilities` flow into the return type. The reviewer's recommended action: add `Models` and `Types` as `const` type params to both overloads, return `SqlContractResult<ContractDefinition<SqlFamily, PostgresPack, Types, Models, ExtensionPacks, Capabilities>>` (using defaults for `Naming`/`StorageHash`/`ForeignKeyDefaults`). Extend `define-contract.test-d.ts` with a positive type assertion that proves model-shape inference flows through (e.g. `defineContract({ models: { User: { ... } as const } }, factory)` returns a type where `result.models.User` matches the input shape, and an `extensionPacks`-with-capabilities case where capability gates surface in the result type).

## Pushback gate — read before writing code

The reviewer surfaced a non-finding for the orchestrator: the 2-param approach in R1 may have been chosen to dodge a TS compiler constraint (cyclical type, instantiation depth, variance issue, etc.). **Before re-implementing**, attempt the full-params signature and run the package's typecheck + test:

- If the full-params signature compiles cleanly and the positive type assertions pass — proceed as F1 directs. R2 lands the fix.
- If the full-params signature hits a compiler error you cannot trivially resolve — **stop, document the error precisely (the failing TS error code + message, plus the minimal reproducer), and escalate via your return shape** (`§ Surprising findings` / `§ Pushback`). Do not commit a degraded signature with a TODO; the orchestrator will route to `drive-discussion` to design around the constraint.

This is a real fork. Either path is acceptable as long as the choice is informed by evidence on disk, not by prior round momentum.

## Decisions standing from prior rounds (do not relitigate)

- The `family`/`target` drop from the input type is correct and verified by R1's `@ts-expect-error` cases. Keep that exactly as it stands.
- The runtime implementation (the `full = { family: sqlFamilyPack, target: postgresPack, ...scaffold }` shape and the `factory !== undefined` branch) is correct. Don't refactor it; only the type signatures around it need lifting.
- The two-commit shape from R1 stays. R2's fix is one additional commit: `fix(@internal/postgres): preserve Types/Models/ExtensionPacks/Capabilities inference in defineContract wrap` (or close to it — your call on the exact subject).
- All other contract-builder re-exports (`field`, `model`, `rel`, type re-exports) and the `/migration` re-export are SATISFIED — do not touch them.
- README updates from R1 stay; only update them if the new test assertion makes the example clearer.

## Items the orchestrator has triaged out of scope for this round

- Mongo, SQLite, examples, docs sweep — all D2/D3/D5/D6 work, untouched in R2.
- The codec-types/.d.ts flip — confirmed out of scope at spec time.
- Adding a `validateContract<Contract>`-flavored round-trip type test — out of scope; R2 stays focused on the wrap's compile-time inference.

## Validation gates (re-run before reporting done)

- `pnpm build --filter @internal/postgres`
- `pnpm typecheck --filter @internal/postgres`
- `pnpm test:packages --filter @internal/postgres` (the new positive assertions land in `define-contract.test-d.ts`)
- `pnpm lint:deps` (no new deps; should stay clean)
- Workspace `pnpm typecheck` if any of the above are anywhere near a transitive consumer (the postgres facade is consumed by examples and other extension packs)

## Anything that has changed in your operating context

- The reviewer subagent is now persistent and has full memory of R1's verdict. Your structured report in R2 lands as a follow-up message in their transcript, so be terse — they don't need re-statement of what R1 delivered, only what changed in R2 and how F1 was resolved (or why it couldn't be).

## Constraints (reminder, terse)

- Explicit-staging commits; no amend; no push.
- One additional commit for R2 (the fix). Don't squash with R1's commits.
- Heartbeats to `wip/heartbeats/implementer.txt` per `.claude/skills/drive-build-workflow/agents/implementer.md § Heartbeats` (at round start, before/after long shell calls, at commit boundary, every ~5 min otherwise).
- Return shape per `.claude/skills/drive-build-workflow/agents/implementer.md § Return shape` — terse, structured. If you took the escalation fork, your structured report's `§ Surprising findings` / `§ Pushback` carries the TS error + reproducer.

Begin.
