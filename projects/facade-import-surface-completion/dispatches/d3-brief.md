# Implementer resume — D3 R1

## Resume — `facade-import-surface-completion`, D3 R1

> You are being resumed. You retain your full prior transcript from D1 R1/R2 + D2 R1. Trust your prior transcript.

D2 is SATISFIED (4 commits, 6/11 ACs PASS). D3 opens the SQLite façade.

## Calibration items (read before doing anything else)

Two procedural lapses from D2 that must not repeat in D3:

1. **Heartbeat cadence.** D2 R1 wrote exactly two pings (`round start` + `DONE`) across a 14-min round with 4 commits. Persona doc (`agents/implementer.md § Heartbeats`) requires `~5 min cadence + a ping at each commit boundary + before/after long shell calls`. With ~5 commits expected in D3, you owe **at least 8 pings** for this round — round start, before each long-running validation gate, after each, at each commit boundary, every ~5 min during model-side reasoning. The format is `key: value` per line, overwriting `wip/heartbeats/implementer.txt`; one file, not appended. The orchestrator reads these between turns to detect a stuck round.

2. **Structured return on completion.** D2 R1 reported `DONE` to the heartbeat then never returned a structured response (the orchestrator had to verify on disk + run gates locally). Persona doc requires a structured return per `agents/implementer.md § Return shape` as the final tool call of the round — not just a heartbeat write. The structured return is what the orchestrator hands to the reviewer; without it, the reviewer has no implementer-side rationale to triage. **Make the structured return your last action**, after the final commit + final heartbeat + final gate run.

## Context

D3 is the SQLite façade. SQLite shares the SQL family with Postgres (so the `ModelLike` lift from D1 R2 already applies — `ModelLike` is publicly exported from `@internal/sql-contract-ts/contract-builder` and you'll use it the same way the Postgres wrap does). The dispatch adds **four new subpaths in one go**: `/config`, `/contract-builder`, `/control`, `/migration`. Each is a thin composition or re-export file mirroring the Postgres precedent. The bundle stays M-sized because each individual file is small and follows the same pattern. No renderer change yet — that's D4.

## Intent (1-3 sentences)

Close the SQLite half of the façade gap so users can author a complete SQLite app importing only from `@internal/sqlite/*` subpaths — no reach-ins to `@internal/{cli,family-sql,sql-contract-*,target-sqlite,adapter-sqlite,driver-sqlite}`. Mirror the Postgres + Mongo precedent set in D1 + D2; do not improvise SPI shapes. Anti-corruption: do **not** flip the SQLite renderer, do **not** migrate example apps, do **not** sweep docs — those are D4/D5/D6.

## Critical design judgments — read before writing code

### `defineContract` wrap — copy D1's pattern verbatim (SQL family)

SQLite is in the SQL family, so the contract-builder shape is identical to Postgres:

- Base `defineContract` is `@internal/sql-contract-ts/contract-builder`'s `defineContract` — same overloads, same `ContractModelBuilder` constraint with its contravariant `attributesFactory`, same fix.
- Use `ModelLike` (now public from `sql-contract-ts/contract-builder` since D1 R2) for the models constraint.
- Use the **D1 R2 shape**, not the D1 R1 shape: thread all 4 `const` type params (`Types`, `Models`, `ExtensionPacks`, `Capabilities`) through `PostgresBaseScaffold`-equivalent + `PostgresResult`-equivalent. Use the `Omit<ReturnType<...>> & { target/targetFamily }` intersection trick to preserve literal pinning for `'sqlite'`/`'sql'`.

Pack imports:

```ts
import sqlFamilyPack from '@internal/family-sql/pack';
import sqlitePack from '@internal/target-sqlite/pack';
```

The SQLite `contract-builder` wrap is mechanically `s/postgres/sqlite/g` + `s/PostgresPack/SqlitePack/g` of D1's wrap. Resist the urge to "improve" the shape; consistency across SQL facades is the goal.

### Test design — same three-lesson baseline as D2

Your `test/contract-builder/define-contract.test-d.ts` must from round 1 carry:

- `@ts-expect-error` cases for `{ family: ... }` and `{ target: ... }`.
- Positive `expectTypeOf(result.target).toEqualTypeOf<'sqlite'>()` + `expectTypeOf(result.targetFamily).toEqualTypeOf<'sql'>()` literal assertions.
- Positive `withModel.models['<key>'].not.toBeNever()` model-shape inference assertions for both definition AND factory forms.

Mirror D1 R2's test exactly with the SQLite identifiers.

### `MongoConfigOptions`-style parity

`packages/3-extensions/sqlite/src/config/define-config.ts` is **new** — no prior file to extend. Build it as a mirror of `packages/3-extensions/postgres/src/config/define-config.ts`: same options shape (`connection`, `contract`, `db`, `extensions`, `migrations.dir`), same threading to `coreDefineConfig`. Re-export the option type from `src/exports/config.ts`.

### `createSqliteControlClient` SPI

Mirror of `createMongoControlClient` (D2) which itself mirrored `createPostgresControlClient`. Same shape: optional `connection`, optional `extensionPacks`. Compose against SQLite descriptors. Test mirrors `create-mongo-control-client.test.ts`.

### `/migration`

One-liner: `export * from '@internal/target-sqlite/migration';`. Parity test mirrors D1's postgres parity test (key-equality plus per-symbol identity checks).

## Files in play (from slice plan D3 section)

- `packages/3-extensions/sqlite/src/config/define-config.ts` (new — mirror of postgres).
- `packages/3-extensions/sqlite/src/exports/config.ts` (new — re-exports).
- `packages/3-extensions/sqlite/src/contract/define-contract.ts` (new — wrapped `defineContract` per § Critical design judgments).
- `packages/3-extensions/sqlite/src/exports/contract-builder.ts` (new — exports wrapped `defineContract` + re-exports `field`/`model`/`rel`/types from `@internal/sql-contract-ts/contract-builder`; mirror D1's structure).
- `packages/3-extensions/sqlite/src/exports/control.ts` (new — mirror of postgres `control.ts` + D2 mongo `control.ts`).
- `packages/3-extensions/sqlite/src/exports/migration.ts` (new — one-line `export *`).
- `packages/3-extensions/sqlite/package.json` (add `./config`, `./contract-builder`, `./control`, `./migration` to `exports`; add 5 new deps to `dependencies`: `@internal/cli`, `@internal/config`, `@internal/sql-contract-psl`, `@internal/sql-contract-ts`, `pathe`).
- `packages/3-extensions/sqlite/tsdown.config.ts` (add entries for config, contract-builder, control, migration).
- `packages/3-extensions/sqlite/test/config/define-config.test.ts` (new — mirror of mongo's `define-config.test.ts`).
- `packages/3-extensions/sqlite/test/contract-builder/define-contract.test.ts` (new — runtime; mirror D1 + D2 wrap-shape tests).
- `packages/3-extensions/sqlite/test/contract-builder/define-contract.test-d.ts` (new — type-level; mirror D1 R2's tests).
- `packages/3-extensions/sqlite/test/control/create-sqlite-control-client.test.ts` (new — mirror of mongo's).
- `packages/3-extensions/sqlite/test/migration/re-export.test.ts` (new — named-export parity, mirror D1's postgres parity test).
- `packages/3-extensions/sqlite/README.md` — rewrite to mirror Postgres's README structure (subpath-per-section).
- `architecture.config.json` — add four new entries; planes match Postgres's mirror entries (config = shared, contract-builder = shared, control = migration, migration = migration).

## "Done when" gates

- [ ] `pnpm install` clean after the new deps land in `package.json` (lockfile delta is expected).
- [ ] `pnpm build --filter @internal/sqlite` clean.
- [ ] `pnpm typecheck --filter @internal/sqlite` clean.
- [ ] `pnpm test --filter @internal/sqlite` clean.
- [ ] `pnpm lint:deps` clean (additive deps; should stay clean — verify with `@internal/cli`-as-facade-dep precedent from D2 mongo).
- [ ] No deps cycle introduced (D0 noted: SQLite façade can add `@internal/cli` + `@internal/config` per the existing dep graph; the postgres + mongo facades already do this).
- [ ] Intent-validation: diff confined to `packages/3-extensions/sqlite/**` + `architecture.config.json` + `pnpm-lock.yaml`. No renderer change, no example touches, no docs sweep, no postgres/mongo touches.

## Edge cases (from slice spec, D3's portion)

- **SQLite-specific config options:** `PostgresConfigOptions` has `connection?: string`. Verify whether SQLite needs the same field or whether SQLite's connection-string semantics warrant a different name (e.g. `filename`, `database`). Mirror Postgres unless a substantive SQLite-specific reason emerges — surface the decision in your structured return if you deviate.
- **Targeting the right adapter package:** the SQLite adapter package path may have a different layout than mongo/postgres adapters. Verify against `packages/3-targets/6-adapters/sqlite/` (or wherever it lives) before importing.
- **`@internal/cli/control-api` import:** `createSqliteControlClient` will need this. The dep addition is fine (already proven safe by D2 mongo).

## Failure modes to avoid

- **F1-equivalent regression:** Do not write the wrap with degraded generic params. Carry forward D1 R2's full-params shape verbatim. Bake positive model-shape inference assertions into the type test from round 1.
- **Heartbeat lapse (procedural):** Per § Calibration items above, write ≥ 8 heartbeat pings this round.
- **Missing structured return (procedural):** Per § Calibration items above, final tool call of the round is the structured return per persona doc § Return shape.
- **Scope creep into D4/D5/D6:** No renderer flip, no example migrations, no docs.
- **Improvised SPI shapes:** Mirror postgres + mongo precedent on `defineConfig`, `createSqliteControlClient`, and the wrap. Improvisation here causes user-facing inconsistency across the three facades.

## Out of scope (this dispatch)

- Renderer source + `TARGET_MIGRATION_MODULE` flip (D4).
- `examples/*/prisma-next.config.ts` + `examples/*/prisma/contract.ts` migrations (D5).
- Docs / skills / READMEs outside the SQLite facade (D6).
- Postgres or Mongo facade changes (D1 + D2 closed those).

## Constraints (reminder, terse)

- Explicit-staging commits; no amend; no push.
- **Commit shape (preferred):** 6 atomic commits — `feat(@internal/sqlite): add dependencies for facade subpaths`, `feat(@internal/sqlite): add /config subpath`, `feat(@internal/sqlite): add /contract-builder subpath with wrapped defineContract`, `feat(@internal/sqlite): add /control subpath`, `feat(@internal/sqlite): add /migration re-export with parity tests`, `docs(@internal/sqlite): rewrite README to mirror Postgres structure`. Lump if structural overlap forces it; your call on exact subjects.
- Heartbeats to `wip/heartbeats/implementer.txt` per § Calibration items above.
- Final tool call is the structured return per § Return shape.
- Read-only on `spec.md`, `plan.md`, `code-review.md`, and the D3 brief itself.

Begin.
