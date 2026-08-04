# Implementer resume — D2 R1

## Resume — `facade-import-surface-completion`, D2 R1

> You are being resumed. You retain your full prior transcript including everything you did in D1 R1/R2 (the postgres facade `/migration` re-export, the `defineContract` wrap, the `ModelLike` lift in `sql-contract-ts`, the test design lessons). Trust your prior transcript.

D1 is SATISFIED (commits `5058518f2`, `9ff5d1533`, `588e31092`). D2 opens. Six files of background you've already absorbed during D1 give you most of the context you need; D2's specifics are below.

## Context (one paragraph)

D2 is the Mongo equivalent of D1, plus three additional changes: bring `MongoConfigOptions` to parity with Postgres (`extensions`, `migrations.dir`); add `@internal/mongo/control` exporting `createMongoControlClient`; add `@internal/mongo/bson` carrying the BSON value constructors that currently leak through the `"."` barrel; **drop the `"."` barrel entirely** (delete `src/exports/index.ts` and remove `"."` from `package.json` exports). Wrap `defineContract` in `@internal/mongo/contract-builder` to pre-bind family + target. Mongo does **not** get a `/migration` subpath in this slice — declarative-migration surfaces don't have the same user-facing shape as SQL.

## Intent (1-3 sentences)

Close the mongo half of the façade gap so users can author a complete Mongo app importing only from `@internal/mongo/*` subpaths — no reach-ins to `@internal/{adapter-mongo,driver-mongo,family-mongo,target-mongo,cli,config}` — and so all imports stay on tree-shakeable subpaths (no top-level barrel). Anti-corruption: do **not** touch the renderer, the example apps' configs, or the docs — those are D4/D5/D6 work.

## Critical design judgments — read before writing code

### Mongo's `defineContract` is structurally simpler than SQL's

You already know SQL's `defineContract` shape from D1 (four `const` type params: `Types`, `Models`, `ExtensionPacks`, `Capabilities`; constraint on `Models` is `ContractModelBuilder` with contravariant `attributesFactory`; the fix was `ModelLike` and threading all four params).

Mongo's `defineContract` (read `packages/2-mongo-family/2-authoring/contract-ts/src/contract-builder.ts` L1545–L1620) has a fundamentally different shape:

- **Overload 1 (definition form):** single `const Definition extends ContractDefinition<...>` param; return type `MongoContractResult<Definition>`. Model-shape inference flows automatically through `Definition['models']` — no separate `Models` type param needed.
- **Overload 2 (factory form):** `const Definition extends ContractScaffold<...>` plus `const Built extends { models?, valueObjects?, roots? }`; return type `MongoContractResult<Definition & Built>`.
- **`ModelBuilder`** (L179–L211) has covariant properties only (`__kind`, `__name`, `__fields`, `__relations`, `__indexes`, `__collectionOptions`, `__collection`, `__owner`, `__base`, `__storageRelations`, `__discriminator`, `__variants`, plus `ref()` whose param is `keyof Fields & string` — covariant in `Fields`). **There is no `attributesFactory`-shaped contravariance trap.** The SQL `ModelLike` lift workaround is **not needed** here.

The mongo wrap is therefore structurally simpler:

- Take `const Definition extends Omit<ContractDefinition<MongoFamilyPack, MongoTargetPack, …>, 'family' | 'target'>` on overload 1.
- Take `const Definition extends Omit<ContractScaffold<MongoFamilyPack, MongoTargetPack, …>, 'family' | 'target'>` on overload 2.
- Pre-bind family + target in the impl: `const full = { family: mongoFamilyPack, target: mongoTargetPack, ...definition }`.
- Return `MongoContractResult<Definition & { family: MongoFamilyPack; target: MongoTargetPack }>` (or equivalent) with the literal pinning intersection if `target`/`targetFamily` literal types degrade.

**Do not** copy the `Omit<ReturnType<...>> & { target: ...; targetFamily: ... }` intersection pattern from D1 verbatim — try the simpler shape first and only reach for the intersection if a positive type assertion fails.

### Test design — bake in the lessons from D1 R1→R2

Your `test/contract-builder/define-contract.test-d.ts` from the **first round** must include:

- `@ts-expect-error` cases rejecting `{ family: ... }` and `{ target: ... }` in the input (mirror of D1).
- Positive literal-type assertions: `expectTypeOf(result.target).toEqualTypeOf<'mongo'>()` and `expectTypeOf(result.targetFamily).toEqualTypeOf<'mongo'>()` (or whatever the mongo family-ID is — verify against `@internal/family-mongo/pack`).
- **Positive model-shape inference assertion** — at minimum: `defineContract({ models: { User: model('User', { ... }) } })` returns a contract where `result.models.User.not.toBeNever()`. This is the assertion D1 R1 omitted; don't repeat that.
- Optional but recommended: a factory-form assertion that mirrors the definition-form one.

The runtime test (`test/contract-builder/define-contract.test.ts`) should cover both forms + the `extensionPacks: undefined` shape (D1 precedent).

### Pack imports

```ts
import mongoFamilyPack from '@internal/family-mongo/pack';
import mongoTargetPack from '@internal/target-mongo/pack';
```

The mongo facade already re-exports these (`src/exports/family.ts`, `src/exports/target.ts`) — your wrap imports them directly from the internal packs, the existing facade re-exports stay untouched for now (they remain available for users who need them; the wrap simply pre-binds them so users don't *have* to import them).

## Files in play

From the slice plan (D2 section). Re-read the slice plan for the most current list; this brief restates it for the dispatch:

### `MongoConfigOptions` parity (FR2)

- `packages/3-extensions/mongo/src/config/define-config.ts` — extend `MongoConfigOptions` interface to accept `extensions?: readonly ExtensionPackRef<'mongo', string>[]` and `migrations?: { dir?: string }`; thread both through to the underlying `coreDefineConfig` call. **Verify against the Postgres equivalent** (`packages/3-extensions/postgres/src/config/define-config.ts`) — your shape must match Postgres's contract so user-facing surface stays consistent across facades.
- `packages/3-extensions/mongo/src/exports/config.ts` — re-export the extended option type if you added a new exported type alias.
- `packages/3-extensions/mongo/test/config/define-config.test.ts` — add cases proving `extensions` and `migrations.dir` flow through.

### `/control` (FR3)

- `packages/3-extensions/mongo/src/exports/control.ts` (new) — mirror of `packages/3-extensions/postgres/src/exports/control.ts`. Should export `createMongoControlClient` composed against mongo descriptors.
- `packages/3-extensions/mongo/test/control/create-mongo-control-client.test.ts` (new) — assert the client composes the expected mongo descriptors. Use the postgres control-test as your template.

### `/bson` (FR10 first half)

- `packages/3-extensions/mongo/src/exports/bson.ts` (new) — `export { Binary, Decimal128, Long, MongoClient, ObjectId, Timestamp } from 'mongodb';`. Verify the exact set of BSON value constructors by inspecting what the deleted `src/exports/index.ts` currently re-exports — your `/bson` must be a strict superset of what the barrel was carrying so users only need to update the import path, not the import list.
- `packages/3-extensions/mongo/test/bson/re-export.test.ts` (new) — named-export parity against the deleted barrel's surface (mirror D1's `re-export.test.ts` shape).

### Drop the `"."` barrel (FR10 second half)

- `packages/3-extensions/mongo/src/exports/index.ts` — **delete**.
- `packages/3-extensions/mongo/package.json` — remove `"."` from `exports`; add `"./control"`, `"./bson"`. Verify `package.json` `files` field doesn't reference `dist/index.mjs` specifically (the wildcard `dist` is fine).
- `packages/3-extensions/mongo/tsdown.config.ts` — drop the `index` entry; add `control` and `bson` entries. Use D1's `tsdown.config.ts` change as the template.

### `defineContract` wrap (FR11 mongo facet)

- `packages/3-extensions/mongo/src/contract/define-contract.ts` (new) — the wrap. Pattern is the mongo-shape from § Critical design judgments above. Use the D1 file as a stylistic template (file structure, comment shape, two-overload split, runtime impl with explicit cast + comment) but **not** as a type-shape template — the mongo type signature is simpler.
- `packages/3-extensions/mongo/src/exports/contract-builder.ts` — replace the re-exported `defineContract` with the wrapped one (one-line change, mirror of D1).
- `packages/3-extensions/mongo/test/contract-builder/define-contract.test.ts` (new) — runtime assertions per § Test design.
- `packages/3-extensions/mongo/test/contract-builder/define-contract.test-d.ts` (new) — type-level assertions per § Test design.

### Architecture config

- `architecture.config.json` — add entries for `mongo/src/exports/control.ts`, `mongo/src/exports/bson.ts`, `mongo/src/contract/define-contract.ts`. Mirror the planes from Postgres's entries (control = migration plane; bson = shared; contract = shared). Remove the entry for the deleted `index.ts` barrel if present.

### README

- `packages/3-extensions/mongo/README.md` — rewrite to mirror Postgres's README structure: document each subpath (`/config`, `/contract-builder`, `/control`, `/bson`, `/family`, `/runtime`, `/target`) with its purpose + a small example. **Critical user-facing migration note:** call out that `import { ObjectId } from '@internal/mongo'` no longer works and that users must move BSON constructor imports to `@internal/mongo/bson`. This is a user-visible breaking change for any consumer that used the barrel form; the migration is one-line per import.

## "Done when" gates

- [ ] `pnpm build --filter @internal/mongo` clean.
- [ ] `pnpm typecheck --filter @internal/mongo` clean.
- [ ] `pnpm test:packages --filter @internal/mongo` clean (config parity tests + control test + bson parity test + contract-builder runtime + type tests all pass).
- [ ] `pnpm lint:deps` clean.
- [ ] Mongo example apps' **package-scoped** `pnpm typecheck` (`pnpm typecheck --filter mongo-demo --filter mongo-blog-leaderboard`) — examples that import BSON constructors from the barrel need their imports updated to `@internal/mongo/bson`. **You are authorised to do these import-path updates as part of D2** even though they touch `examples/` — they are unblocked-by-D2 and would otherwise leave `mongo-demo` / `mongo-blog-leaderboard` red until D5. Commit them separately with a scope note (`refactor(mongo-examples): move BSON imports to /bson subpath after barrel drop`). If an example also uses `family:`/`target:` in `defineContract`, do NOT touch that — that's D5's `defineContract` migration sweep.
- [ ] Grep gate: `rg "from '@internal/mongo'(?!/)" packages/ examples/ test/` returns zero hits (or only the deleted barrel file path itself if rg picks up moved/deleted files differently).
- [ ] Intent-validation: diff is confined to `packages/3-extensions/mongo/**`, `architecture.config.json`, and the `examples/mongo-*/` BSON-import updates above. **No** renderer change, no `defineContract` migration in example contracts, no docs sweep, no SQLite/Postgres changes.

## Edge cases (from slice spec, D2's portion)

- **`/control` SPI shape.** The slice spec named `createMongoControlClient` as straight composition. Verify against the Postgres `createPostgresControlClient` pattern before writing — if the mongo control plane needs a different options interface (e.g. driver-specific connection lifecycle), surface that as a design decision in your structured report (don't silently improvise). If it's a clean mirror, no escalation needed.
- **`MongoConfigOptions` extension shape.** The Postgres equivalent's `extensions` array is `readonly ExtensionPackRef<'sql', string>[]`. The mongo equivalent should be `readonly ExtensionPackRef<'mongo', string>[]` — verify the `'mongo'` family-ID matches what `@internal/family-mongo/pack` exports as `familyId`.
- **BSON constructor inventory.** The current `src/exports/index.ts` barrel re-exports specific BSON value constructors. Treat the deleted barrel's surface as the authoritative inventory — your `/bson` subpath must include every symbol the barrel was re-exporting (no more, no less), so the parity test can assert exact equality.
- **Wrapped `defineContract` accepts `extensionPacks`.** D1 R1's test omitted this case for the wrap; bake it in for D2 (one of the four runtime tests).

## Failure modes to avoid (from D1's lessons + drive/plan/README.md)

- **F1-equivalent regression (must avoid):** do not write the wrap with fewer type params than necessary to preserve inference. For mongo this means the `Definition` param must carry the model shape forward to the return type (`MongoContractResult<Definition>` is the natural shape). Verify with a positive `result.models.<key>.not.toBeNever()` assertion in the **first** round.
- **Scope creep into D4/D5/D6:** do not flip the renderer, do not migrate example `defineContract` calls (the `family:`/`target:` drop in user contracts is D5), do not touch docs/skills.
- **Silent BSON omission:** missing one constructor from `/bson` produces a user-visible breakage when they update their imports. Use the deleted barrel's surface as the source of truth; assert parity in the test.
- **`mongo-demo` / `mongo-blog-leaderboard` left red:** unlike examples that use `family:` in `defineContract` (which stay D5 work), examples that import BSON constructors from the barrel can be fixed in D2 by you with a one-line import path change. Do it; don't leave it for D5.

## Out of scope (this dispatch)

- `examples/*/prisma/contract.ts` `family:`/`target:` migrations (D5).
- `examples/*/prisma-next.config.ts` verbose-to-façade migrations (D5).
- Renderer source changes / `TARGET_MIGRATION_MODULE` flip (D4).
- Docs / skills / READMEs outside the mongo facade (D6).
- SQLite façade subpaths (D3).
- Postgres `/control`, `/migration`, or `/contract-builder` changes (D1 closed those).

## Constraints (reminder, terse)

- Explicit-staging commits; no amend; no push.
- **Commit shape (preferred but your call):** 5 atomic commits — `feat(@internal/mongo): extend MongoConfigOptions for extensions + migrations.dir`, `feat(@internal/mongo): add /control subpath`, `feat(@internal/mongo): add /bson subpath and drop "." barrel`, `feat(@internal/mongo): wrap defineContract to pre-bind family and target`, `refactor(mongo-examples): move BSON imports to /bson subpath after barrel drop`. Lump if structural overlap forces it.
- Heartbeats to `wip/heartbeats/implementer.txt` per `.claude/skills/drive-build-workflow/agents/implementer.md § Heartbeats`.
- Return shape per `.claude/skills/drive-build-workflow/agents/implementer.md § Return shape`.
- Read-only on `spec.md`, `plan.md`, `code-review.md`, and the D2 brief itself.

Begin.
