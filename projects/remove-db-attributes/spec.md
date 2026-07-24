# remove-db-attributes

## Purpose

Give PSL exactly one way to name a column's storage type: the type position. Today an author writes an approximate base scalar and corrects it with a `@db.*` attribute (`String @db.Uuid`); after this project the storage type is a first-class scalar type (`Uuid`, `VarChar(191)`), and the `@db.*` attribute channel — a Prisma-classic inheritance that ADR 231 had to carve out as "not really an attribute" — is gone.

## At a glance

Before:

```prisma
types {
  Id     = String @db.Uuid
  Slug   = String @db.VarChar(191)
  Amount = Decimal @db.Numeric(10, 2)
}

model Event {
  id   Id @id
  slug Slug
}
```

After:

```prisma
types {
  Id     = Uuid
  Slug   = VarChar(191)
  Amount = Numeric(10, 2)
}

model Event {
  id   Id @id
  slug Slug
}
```

`@db.Type` becomes the bare scalar type `Type`; `@db.Type(param)` becomes the parameterized type `Type(param)`. The new names resolve anywhere a scalar type resolves today — named-type declarations **and** model field position (`slug VarChar(191)`), which `@db.*` never supported (it was gated to named-type declarations via `allowDbNativeType`).

The emitted contract is unchanged for twelve of the thirteen current `@db.*` mappings (`db.VarChar`, `db.Char`, `db.Uuid`, `db.Inet`, `db.SmallInt`, `db.Real`, `db.Numeric`, `db.Timestamp`, `db.Timestamptz`, `db.Date`, `db.Time`, `db.Timetz` — see `NATIVE_TYPE_SPECS` in `packages/2-sql/2-authoring/contract-psl/src/psl-column-resolution.ts`): each keeps its codec id, native type, and type-params shape under the new spelling. The one deliberate semantic change is JSON (settled 2026-07-09): bare **`Json` now means native `json` (`pg/json@1`)** — absorbing the old `@db.Json` — and a new bare type **`Jsonb` means `pg/jsonb@1`**, which was previously what bare `Json` defaulted to. Existing schemas using `Json` for jsonb storage must migrate to `Jsonb`.

No parser work is required for the new syntax: the PSL grammar already parses bare and parameterized type constructors in both positions (`Embedding = Vector(1536)` and `embedding Vector(1536)` resolve onto `typeConstructor` today). The work lives in the type-resolution channel unification (see Cross-cutting requirements), the SQL-family interpreter, the postgres target's PSL inference/printing, and the in-repo consumers of the old syntax.

## Non-goals

- **No contract-format change.** `contract.json` / `contract.d.ts` storage-type entries keep their `{ codecId, nativeType, typeParams }` shape; the runtime plane is untouched.
- **No native-type expansion beyond parity plus `Jsonb`.** Every existing `@db.Type` mapping, including `@db.Inet`, gains the corresponding bare `Type`; unrelated Postgres types such as `Bit` remain out of scope.
- **No TypeScript-builder surface change.** `varcharColumn(191)` et al. in the postgres adapter's `column-types` exports stay as they are.
- **No mongo semantic change.** `@db.*` was SQL-family-only. The mongo adapter and interpreter migrate **mechanically** to the unified contribution channel (its six scalars become zero-arg type constructors); mongo contract emission stays byte-identical, and no mongo authoring syntax changes.
- **No implementation of ADR 231's combinator kit.** This project removes the surface ADR 231 excluded; it does not advance the declarative-attribute-spec design itself.
- **No deprecation window.** Prototype policy: the old syntax is removed outright; migration help is a diagnostic, not a compatibility mode.

## Place in the larger world

- **ADR 231 — Declarative attribute specifications** explicitly scoped `@db.*` out because it is an attribute on a named-type declaration, not on a field/model. Removing `@db.*` closes that carve-out; the ADR's "Out of scope" section must be amended at close-out so it doesn't describe a surface that no longer exists.
- **PSL parser** (`packages/1-framework/2-authoring/psl-parser`): grammar unchanged. Dotted attribute names remain valid syntax (extension attributes use them); `@db.*` simply stops being recognized by the SQL interpreter. Parser tests that use `@db.VarChar` as a generic namespaced-attribute example may stay as grammar tests or be re-pointed at a neutral namespace.
- **SQL-family interpreter** (`packages/2-sql/2-authoring/contract-psl`): owns `NATIVE_TYPE_SPECS`, `resolveDbNativeTypeAttribute`, and the `allowDbNativeType` gate in named-type resolution — the heart of the removal. Field/named-type constructor resolution (`resolveFieldTypeDescriptor`, `resolvePslTypeConstructorDescriptor`) over the unified `AuthoringContributions.type` namespace is the single channel the bare types move into.
- **Framework control stack & config** (`packages/1-framework/1-core/framework-components/src/control/control-stack.ts`, `packages/1-framework/1-core/config/src/contract-source-types.ts`): own the `scalarTypeDescriptors` channel being retired — `ComponentMetadata.scalarTypeDescriptors`, `assembleScalarTypeDescriptors`, `validateScalarTypeCodecIds`, and `ContractSourceContext.scalarTypeDescriptors` all go or re-derive from the unified type namespace.
- **Language server** (`packages/1-framework/3-tooling/language-server`): consumes `controlStack.scalarTypes` (names only) for completions and semantic tokens; re-derives them from the unified namespace's top-level entries.
- **Mongo family & adapter** (`packages/2-mongo-family/2-authoring/contract-psl`, `packages/3-mongo-target/2-mongo-adapter`): the mongo interpreter resolves field codecs through the scalar map today; both migrate mechanically to the unified channel with byte-identical output.
- **Postgres target PSL inference** (`packages/3-targets/3-targets/postgres/src/core/psl-infer/`): `postgres-type-map.ts` maps live-schema native types onto `db.*` attribute names for printing; the family printer contract (`PslNativeTypeAttribute` in `packages/2-sql/9-family/src/core/psl-contract-infer/printer-config.ts`) exists to carry them. Both must print bare types in type position instead.
- **In-repo consumers of the old syntax:** `examples/prisma-next-demo/src/prisma/contract.prisma` (+ its committed migration snapshot), `examples/supabase/src/contract.prisma`, `packages/3-extensions/supabase/src/contract/contract.prisma`, psl-parser format fixtures, language-server semantic-token tests, and the contract-psl interpreter test suites.
- **Runtime comment debt:** `packages/2-sql/5-runtime/src/sql-context.ts` documents typeParams-canonicalization behavior in terms of "`@db.X` named types" — wording to update when the concept goes.

## Cross-cutting requirements

- **Contract-emission parity (except JSON).** A schema migrated mechanically from `@db.*` to bare types emits a byte-identical contract (same codec ids, native types, type params). Fixtures/tests prove this for the twelve non-JSON mappings, including `Inet`. The JSON exception is deliberate: `Json` re-binds to `pg/json@1` and `Jsonb` (new) carries `pg/jsonb@1`; schemas that used bare `Json` for jsonb must say `Jsonb` — tests prove the new bindings on both names.
- **Uniform resolution.** The new scalar names resolve wherever scalar types resolve: named-type declarations and field type position, with the same precedence rules (enum → named type → scalar) that exist today.
- **Migration diagnostic.** Any remaining `@db.*` usage produces a clear, actionable diagnostic naming the bare-type replacement (e.g. `@db.VarChar(191) is no longer supported; use VarChar(191) in type position`), not a generic "unsupported attribute" error.
- **Round-trip integrity.** PSL inferred from a live schema prints the new syntax, and that output re-parses and re-emits to the same contract (`pnpm fixtures:check` and the psl-infer print tests are the gates).
- **One unified type-contribution channel (settled 2026-07-09).** A scalar type **is** a zero-arg type constructor. The `scalarTypeDescriptors` map channel (`ComponentMetadata.scalarTypeDescriptors` → `assembleScalarTypeDescriptors` → `ContractSourceContext.scalarTypeDescriptors`) is **retired**; every target (postgres, sqlite, mongo) contributes all its scalar types — base scalars and native types alike — as `AuthoringTypeConstructorDescriptor` entries in `AuthoringContributions.type`. Resolution is uniform: bare `T` resolves as the zero-arg instantiation `T()`; `T(args)` instantiates with declaratively-validated args; `output.nativeType` stays optional with the codec-derived default (`codecLookup.targetTypesFor(codecId)[0]`) preserving today's map behavior. The language server's `scalarTypes`, the symbol table's scalar list, and codec-id validation re-derive from the unified namespace. The end state has no `pg/*`-specific native-type table in `packages/2-sql/**`; `NATIVE_TYPE_SPECS` is deleted, not renamed in place.
- **Native types are target-contributed (settled 2026-07-09; inventory corrected 2026-07-23).** The twelve non-JSON parameterized/no-arg postgres native types, including `Inet` (plus `Jsonb`), are contributed by the postgres target pack as top-level (un-namespaced) constructor descriptors; the family layer resolves names generically.
- **`Date` pins its codec explicitly (updated 2026-07-23 by TML-3086).** `Date` pins `{ codecId: 'pg/date@1', nativeType: 'date' }`, matching the dedicated Postgres date codec now used by `@db.Date`.
- **JSON re-binding (settled 2026-07-09).** On the postgres target, `Json` = `pg/json@1` (native `json`) and `Jsonb` = `pg/jsonb@1` (native `jsonb`), always. The postgres scalar-descriptor entry for `Json` changes accordingly; every in-repo schema that used bare `Json` for jsonb storage migrates to `Jsonb` as part of the consumer-migration slices.
- **Storage is decided only in type position (settled 2026-07-15, operator).** `@default(<generator>)` never mutates a column's storage: the generator storage override (`generatedColumnDescriptor` / `resolveGeneratedColumnDescriptor` in `@prisma-next/ids`, the override in SQL field resolution, and the transitional `baseScalar` marker) is retired. `String @default(uuid())` emits the target's `String` storage with generated uuid values; users wanting uuid or char(36) storage say `Uuid` / `Char(36)` in type position. TS field presets are unaffected — they bundle storage explicitly by name. Breaking change; carried by an upgrade-instructions entry.

## Transitional-shape constraints

- Channel unification lands **before** the native-type contribution slices: the unified resolution path is the substrate the new types are registered into (avoid registering into the map channel only to move them again).
- The map channel and the unified namespace may coexist mid-project (the map folded into or shadowed by the namespace) so long as every intermediate state resolves each type name through exactly one authoritative entry; the map's removal completes before project close.
- Bare-type support lands **before** `@db.*` recognition is removed; both syntaxes may coexist on `main` mid-project so consumers migrate green.
- The removal slice lands only after every in-repo consumer (examples, supabase extension contract, fixtures, tests) is migrated.
- Every slice keeps CI green on `main` (inherited, restated only because the coexist-then-remove ordering is the mechanism that makes it possible here).

## Contract impact

No change to the contract format or the contract surface packages. `document.types` / `storage.types` entries remain `codec-instance` shapes with unchanged codec ids and type params; downstream consumers of `contract.json` need no migration. The impact is confined to the PSL authoring surface that *produces* contracts.

## Adapter impact

- **postgres** (target + adapter): psl-infer type map and printer stop emitting `db.*` attributes; base scalars (`createPostgresScalarTypeDescriptors`) and the native types all become type-constructor contributions.
- **sqlite**: base scalars (`createSqliteScalarTypeDescriptors`) migrate mechanically to constructor contributions; sqlite contributes no parameterized types of its own in this project.
- **mongo**: base scalars (`mongoAdapterDescriptor.scalarTypeDescriptors`, six entries incl. `ObjectId`) migrate mechanically to constructor contributions; the mongo interpreter's codec resolution re-points at the unified namespace. No authoring-syntax or emission change.

## ADR pointer

- Amend ADR 231 § "Out of scope: `@db.*` native types" at close-out — the carve-out it describes ceases to exist.
- Author an ADR for the unified type-contribution channel ("a scalar type is a zero-arg type constructor"; retirement of `scalarTypeDescriptors`) as part of close-out — this is a durable framework-level architectural decision.

## Project Definition of Done

- [ ] Team-DoD floor items (inherited; see [`drive/calibration/dod.md`](../../drive/calibration/dod.md)).
- [ ] `rg '@db\.'` over `packages/`, `examples/`, and PSL fixtures returns no live usages (historical docs — release notes, ADR history, planning notes — exempt).
- [ ] All former `@db.*` mappings are authorable as bare types, in both named-type and field position, with contract-emission parity proven by tests for the twelve non-JSON mappings, including `Inet`.
- [ ] `Json` resolves to `pg/json@1` and `Jsonb` to `pg/jsonb@1` on the postgres target (test-covered, including psl-infer printing `Jsonb` for jsonb columns).
- [ ] `@db.*` in a schema produces the migration diagnostic (test-covered).
- [ ] PSL inference prints the new syntax; infer → parse → emit round-trip is test-covered and `pnpm fixtures:check` is clean.
- [ ] All demos and examples (prisma-next-demo, supabase) rewritten to the new syntax, including regenerated migration chains — no `@db.*` remains in any committed example artifact — and run end-to-end.
- [ ] No `pg/*` native-type specs remain hardcoded in `packages/2-sql/**`; the native types are contributed by the postgres target.
- [ ] The `scalarTypeDescriptors` channel is fully retired: `rg 'scalarTypeDescriptors'` over `packages/` returns no hits in production code; postgres, sqlite, and mongo all contribute scalar types through `AuthoringContributions.type`.
- [ ] Mongo and sqlite contract emission is byte-identical before/after the channel migration (test-covered).
- [ ] Language-server completions and semantic tokens for scalar type names work from the unified namespace (test-covered).
- [ ] ADR 231 out-of-scope section amended; unified-channel ADR authored.

## Open Questions

_None. All original questions were resolved by the operator on 2026-07-09 and folded into Cross-cutting requirements (unified type-contribution channel; target-contributed native types; `Date` codec pinning; `Json` = `pg/json@1`, `Jsonb` = `pg/jsonb@1`) and the Project DoD (all demos rewritten, migration chains regenerated; scalar-map channel retired). The operator explicitly chose **full channel unification now** over assembly-time folding with deferred map retirement._

## References

- Linear Project: _to be created at project-DoR (see [`drive/calibration/dor.md`](../../drive/calibration/dor.md))_
- ADR: [`docs/architecture docs/adrs/ADR 231 - Declarative attribute specifications.md`](../../docs/architecture%20docs/adrs/ADR%20231%20-%20Declarative%20attribute%20specifications.md) § Out of scope
- Key surfaces:
  - `packages/2-sql/2-authoring/contract-psl/src/psl-column-resolution.ts` (`NATIVE_TYPE_SPECS`, `resolveDbNativeTypeAttribute`)
  - `packages/2-sql/2-authoring/contract-psl/src/psl-named-type-resolution.ts` (`allowDbNativeType` gate)
  - `packages/3-targets/3-targets/postgres/src/core/psl-infer/postgres-type-map.ts` (print-side `db.*` mapping)
  - `packages/2-sql/9-family/src/core/psl-contract-infer/printer-config.ts` (`PslNativeTypeAttribute`)
  - `packages/3-targets/6-adapters/postgres/src/core/control-mutation-defaults.ts` (`createPostgresScalarTypeDescriptors`)
  - `packages/1-framework/1-core/framework-components/src/shared/framework-authoring.ts` (`AuthoringTypeConstructorDescriptor` — the unified channel's descriptor shape)
  - `packages/1-framework/1-core/framework-components/src/control/control-stack.ts` (`assembleScalarTypeDescriptors`, `assembleAuthoringContributions` — channel assembly)
  - `packages/3-targets/3-targets/postgres/src/core/authoring.ts` (`postgresAuthoringTypes` — existing target type-constructor contributions, e.g. `pg.enum`)
  - `packages/3-mongo-target/2-mongo-adapter/src/exports/control.ts` (mongo scalar map to migrate)
