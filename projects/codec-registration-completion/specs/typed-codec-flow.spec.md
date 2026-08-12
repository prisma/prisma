# Spec — Typed `Codec` flow through `CodecDescriptor` (TML-2357 prerequisite)

> **Status: SUPERSEDED.** This spec was authored around the interface-form `defineCodec` redesign (Shape A vs Shape B). The Pattern E spike on `spike/class-based-codecs` proved a different design — class-based descriptors + per-codec helpers — better satisfies the same problem. The current source of truth is [`class-based-codec-design.spec.md`](class-based-codec-design.spec.md) (implementation) and [`factory-defined-codec-types.spec.md`](factory-defined-codec-types.spec.md) (goal). This file survives as historical context for the M2 R4 rollback and the design iteration that followed; do not implement against it.

> **Pivotal precondition for the rest of TML-2357.** Surfaced during M2 R4 (see [`wip/unattended-decisions.md` Decision #11](../../../wip/unattended-decisions.md)) when deleting the legacy `mkCodec`-call-result typed instances broke `<Contract, TypeMaps>` derivation downstream. The bug is a TML-2229 regression that should have been caught before merge. **No part of TML-2357's downstream codec migration (AC-1, AC-2, AC-3, AC-7) can land cleanly without this fix first.**

## Decision

`defineCodec({...})` MUST return a descriptor type that preserves the four codec generics its `spec` argument inferred (`Id`, `TTraits`, `TWire`, `TInput`) in addition to `TParams`. The factory's return type IS the resolved codec's type; consumers of a descriptor record (e.g. `PgDescriptors`, `SqlDescriptors`, `PgvectorDescriptors`) recover the typed `Codec<Id, TTraits, TWire, TInput>` directly from the descriptor's type — no `mkCodec`-call-result instance kept alive in parallel as a "type carrier."

After this fix, the typed flow runs end-to-end through descriptors only:

```
defineCodec({...})                              ── author site, codec generics inferred
  → PgDescriptors / SqlDescriptors / ...        ── per-package typed descriptor records
  → defineContract({target, family, packs}, ..) ── contract-ts builder reads typed records
  → field.uuidv4() / field.text() / ...         ── typed field specs
  → typeof contract                             ── carries per-column codec types
  → sqlBuilder<typeof contract>({context})      ── propagates types to query expressions
  → sql.user.where((f, fns) => fns.eq(f.id, x)) ── x must be string for a uuid column
```

In the emit path (`pnpm emit`), the same descriptor records drive `contract.d.ts` text generation; the typed `CodecTypes`/`TypeMaps` entries in the emitted file are derived from the descriptor types. Both paths converge on descriptor-resident typed factories as the single source of truth for the typed-codec flow.

## Why

The codec-registry-unification work ([TML-2229](https://linear.app/prisma-company/issue/TML-2229)) introduced `defineCodec` / `CodecDescriptor` as the unified registration shape but kept `mkCodec`-produced typed `Codec` instances alive in parallel, accidentally serving as the source of typed flow into `CodecTypes`/`TypeMaps`. This conflated two concerns:

1. **Codec registration** — a runtime/contributor-protocol concern, solved by descriptors flowing through the unified `codecs:` slot.
2. **Typed `Codec` flow into user code** — a TypeScript-type concern. Only relevant in (i) the no-emit authoring path (`field.uuidv4()` typing) and (ii) emit-path `contract.d.ts` generation (typed `CodecTypes` entries). Solved accidentally by keeping typed `mkCodec`-result instances alive.

When TML-2357 M2 R4 attempted to delete the legacy typed instances (the `mkCodec` factory and its callers), the type flow collapsed because:

- `defineCodec` declares its return as `CodecDescriptor<TParams>` (see [`packages/2-sql/4-lanes/relational-core/src/ast/codec-types.ts:587-593`](../../../packages/2-sql/4-lanes/relational-core/src/ast/codec-types.ts) at HEAD), dropping the `Id`, `TTraits`, `TWire`, `TInput` parameters its `spec` argument inferred.
- Per-target descriptor records (`PgDescriptors`, `SqliteDescriptors`, `PgvectorDescriptors`) carry `CodecDescriptor<void>` per descriptor, not the typed shape.
- `ReturnType<ReturnType<D['factory']>>` collapses to base `Codec` because `D extends CodecDescriptor<infer P>` widens `D` to the unparameterized interface declaration before extraction.

Concrete failure shapes observed in M2 R4 ([`wip/unattended-decisions.md` Decision #11](../../../wip/unattended-decisions.md)):

- `sql-builder/test/playground/select.test-d.ts`: `SqlQueryPlan` constraint `{table: never; ...}` failures because `<Contract, TypeMaps>`-parameterized types lost per-codec-id specificity.
- `sql-builder/test/runtime/builders.test.ts`: `CodecExpression<"pg/int4@1", boolean, ...>` — `boolean` (default fallback) where `number` (`TypeMaps['pg/int4@1'].input`) was required.
- `sqlite/test/codecs.test.ts`: `result` typed as `unknown` instead of `Date`.

The variance failure was diagnosed as a real TS-type design problem, not an implementation bug. Two M2 R4 implementer subagents crashed iterating on workarounds; the orchestrator rolled back the entire commit chain to the M2 R3 HEAD (`a29e06245`).

This bug should have been caught and fixed in TML-2229. TML-2357 was scoped as "downstream codec migration"; it cannot complete its scope without first landing the type-flow fix.

## Cases that pin the design

These four cases anchor the acceptance criteria. If any can't be expressed cleanly under the typed-flow design, the design is wrong.

### Case U — Non-parameterized codec, no-emit query author types end-to-end

**Setup.** `pgUuidv4Descriptor` is defined in `packages/3-targets/3-targets/postgres/src/core/codecs.ts` via `defineCodec({factory: () => () => buildSqlCodec({typeId: 'pg/uuid@1', encode: (s: string) => uuidParse(s), decode: (b: Buffer) => uuidStringify(b), traits: ['equality']})})`. A no-emit author writes `field.id.uuidv4()` in `prisma/contract.ts`.

**Expected behavior.** `sql.user.where((f, fns) => fns.eq(f.id, '550e8400-e29b-41d4-a716-446655440000'))` typechecks. Substituting `1234` (number) fails to compile with a clear TS error pointing at the codec mismatch.

**What this pins.**
- `defineCodec`'s return preserves all five codec generics inferred from `spec`.
- `PgDescriptors['uuidv4']`'s type is rich enough that downstream `field.uuidv4()` returns a typed field spec carrying `Codec<'pg/uuid@1', readonly ['equality'], Buffer, string>`.
- The contract-ts `field` proxy propagates the typed shape through `defineContract({...}, ({field}) => ...)`.

### Case V — Parameterized codec (vector), typed flow under params validation

**Setup.** `pgVectorDescriptor` is defined with `paramsSchema: lengthSchema`, `factory: ({length}) => (ctx) => buildSqlCodec({typeId: 'pg/vector@1', encode: (arr: number[]) => packVector(arr, length), decode: (b: Buffer) => unpackVector(b, length), traits: []})`. A no-emit author writes `type.pgvector.Vector(1536)`, then a column references it.

**Expected behavior.** The column's effective codec type is `Codec<'pg/vector@1', readonly [], Buffer, number[]>`. Query expressions like `vectorCol.eq([1.2, 3.4, ...])` typecheck; passing `'string'` fails.

**What this pins.**
- Parameterized descriptors preserve typed codec generics through `paramsSchema` validation.
- The typed codec at the materialization site (`descriptor.factory(params)(ctx)`) carries the same generics as the factory's declaration.

### Case E — Emit-path `contract.d.ts` typed `TypeMaps` derivation

**Setup.** `pnpm emit` runs against `examples/prisma-8-demo`. The emitter walks the descriptors registered through the unified `codecs:` slot, derives per-codec-id `{input, output, traits}` shapes, and writes them into `contract.d.ts`'s `TypeMaps` projection.

**Expected behavior.** Generated `TypeMaps` projection has correct per-codec-id shapes:
```typescript
type TypeMaps = {
  'pg/int4@1':  { input: number;   output: number;   traits: ... };
  'pg/uuid@1':  { input: string;   output: string;   traits: 'equality' };
  'pg/vector@1':{ input: number[]; output: number[]; traits: ... };
  // ...
};
```

`pnpm fixtures:check` passes across all fixture pairs.

**What this pins.**
- The emit-path `TypeMaps` derivation reads from typed descriptors (no shadow `mkCodec`-result instance map needed).
- Demo emit output is byte-identical to the post-TML-2229 baseline.

### Case D — Heterogeneous descriptor storage at the registration boundary

**Setup.** Postgres adapter's contributor protocol returns `codecs: () => ReadonlyArray<AnyCodecDescriptor>` (per AC-2 of the parent spec). `Object.values(pgDescriptors)` flattens the typed record into a generic descriptor array for runtime registration.

**Expected behavior.** The runtime registration path (`@internal/sql-runtime` → `CodecLookup.descriptorFor(codecId)`) accepts the heterogeneous array. The framework treats each entry as base `CodecDescriptor` (or `AnyCodecDescriptor`); typed-codec generics are not required at runtime — they served their purpose at the no-emit authoring boundary and at emit time.

**What this pins.**
- The variance erasure point is bounded to the *registration boundary* — type-flow ergonomics survive at the descriptor-record-of-typed-descriptors level (where it matters); the framework runtime continues to consume codecs as black boxes (where it shouldn't matter).

## Acceptance criteria

### AC-0.1. `defineCodec` preserves typed factory return

`defineCodec({...})`'s return type carries enough generic information for the typed `Codec<Id, TTraits, TWire, TInput>` to flow into per-package descriptor records. Two equivalent implementation shapes admissible (decision deferred to plan-time):

- **Shape A** (parameterize `CodecDescriptor`): `CodecDescriptor<Id, TTraits, TWire, TInput, TParams>`. Verbose but explicit.
- **Shape B** (intersection return): `CodecDescriptor<TParams> & { codecId: Id; traits: TTraits; factory: (p: TParams) => (ctx: SqlCodecInstanceContext) => Codec<Id, TTraits, TWire, TInput> }`. Less invasive at the interface level; consumers extract structurally.

The key constraint: extracting the typed `Codec` from the descriptor's type must NOT route through `D extends CodecDescriptor<infer P>` (which discards generics). Either the interface carries them as type parameters (Shape A), or the `defineCodec` return intersects in the typed factory (Shape B).

**Verification.** A negative type test in `packages/2-sql/4-lanes/relational-core/test/`:
```typescript
const d = defineCodec({factory: () => () => buildSqlCodec({typeId: 'pg/int4@1' as const, encode: (n: number) => Buffer.from([n]), decode: (b: Buffer) => b[0]!})});
type C = ResolvedCodec<typeof d>; // however we name the extractor
expectTypeOf<C>().toEqualTypeOf<Codec<'pg/int4@1', readonly [], Buffer, number>>();
```

### AC-0.2. Per-target descriptor records carry typed shape

Per-package descriptor records preserve each entry's full descriptor type by inference:
- `packages/3-targets/3-targets/postgres/src/core/codecs.ts` — `PgDescriptors`.
- `packages/3-targets/3-targets/sqlite/src/core/codecs.ts` — `SqliteDescriptors`.
- `packages/3-extensions/pgvector/src/core/codecs.ts` — `PgvectorDescriptors`.
- `packages/2-sql/4-lanes/relational-core/src/ast/sql-codecs.ts` — `SqlDescriptors`.
- `packages/3-extensions/arktype-json/src/core/arktype-json-codec.ts` — `ArktypeJsonDescriptors`.

`PgDescriptors['uuidv4']` is *not* `CodecDescriptor<void>`; it carries the descriptor's full inferred shape from which `Codec<'pg/uuid@1', readonly [...], Buffer, string>` is recoverable.

**Verification.** Negative type tests in each package's `test/` directory.

### AC-0.3. No-emit authoring chain types end-to-end

The no-emit authoring chain (using `examples/prisma-8-demo/prisma/contract.ts` + `prisma-no-emit/context.ts` as the reference shape) types every step:

- `field.uuidv4()` returns a field spec whose codec generic is `Codec<'pg/uuid@1', ..., Buffer, string>`.
- `defineContract({target: postgresPack, family: sqlFamily, extensionPacks: {pgvector}}, ...)` produces a contract type carrying per-column codec types (e.g. `User.fields.id` → `pg/uuid@1` codec; `Post.fields.embedding` → `pg/vector@1` codec).
- `sqlBuilder<typeof contract>({context})`-produced query expressions accept correctly-typed parameters and reject incorrectly-typed ones.

**Verification.** A `*.test-d.ts` constructive test in the no-emit chain. Both positive (correct types compile) and negative (wrong types fail) cases.

### AC-0.4. Emit-path `contract.d.ts` typed `TypeMaps` derivation works

The emitter, given a descriptor record, produces a `contract.d.ts` whose `TypeMaps` projection has correct per-codec-id `{input, output, traits}` shapes. Generated text matches the post-TML-2229 baseline byte-for-byte.

**Verification.** `pnpm fixtures:check` passes across all fixture pairs.

### AC-0.5. Forcing function — every parallel typed-instance path deleted

This is the AC that *proves* AC-0.1–AC-0.4 hold in fact and not just nominally. Without an explicit deletion of every parallel typed-instance carrier, M0 could ship while the typed flow is still being load-borne by the legacy instance map and we'd never know. The only way to verify the typed flow runs through descriptors is to delete every other path that could be carrying it and confirm the chain still works.

**Required deletions inside M0:**

1. **`mkCodec` public export** from `@internal/sql-relational-core/ast`. The factory may persist as an *internal* helper inside the package (rename to `buildSqlCodec` to make the role explicit; it's the codec-instance builder called inside `defineCodec` factory closures). External callers must reach typed codecs via descriptors.

2. **`CodecDefBuilder` and `CodecDefBuilderImpl`** from `packages/2-sql/4-lanes/relational-core/src/ast/codec-types.ts`. The instance-keyed builder has no remaining role; descriptor-keyed `CodecDescriptorBuilder` (line 709-) absorbs every consumer. Delete the legacy `defineCodecGroup()` factory function exported in parallel.

3. **`ExtractCodecTypes` (relational-core, line 292)** — the instance-keyed projection. The descriptor-keyed `ExtractDescriptorCodecTypes` (line 688) takes its place. **Rename `ExtractDescriptorCodecTypes` → `ExtractCodecTypes`** so there's one canonical name for the projection. Note: the contract-level `ExtractCodecTypes<T>` at `packages/2-sql/1-core/contract/src/types.ts:239` is a different type with a different role and stays as-is.

4. **`byScalar` and `dataTypes` exports** from target/extension packages (`packages/3-targets/3-targets/postgres/src/core/codecs.ts:570`, `packages/3-targets/3-targets/sqlite/src/core/codecs.ts:120`, `packages/3-extensions/pgvector/src/core/codecs.ts:73`, `packages/2-sql/4-lanes/relational-core/src/ast/sql-codecs.ts:198`'s `sqlCodecDefinitions`). Migrate adapter consumers (`adapter-postgres/src/core/adapter.ts:42`, `adapter-sqlite/src/core/adapter.ts:53`) to receive codecs through the unified `codecs:` contributor protocol slot — not by importing data structures from the target package. Migrate test consumers (`target-postgres/test/codecs.test.ts`, `target-sqlite/test/codecs.test.ts`, `pgvector/test/codecs.test.ts`) to construct codec instances at the test site via `descriptor.factory(undefined)(ctx)`. **This work absorbs [TML-2393](https://linear.app/prisma-company/issue/TML-2393)** (filed earlier as a follow-up; now consolidated into M0 because the deletion is the forcing function for AC-0).

5. **Legacy renamed factories** `defineCodecGroup` and `defineCodecBundle` — redundant once `CodecDefBuilder` is deleted and `CodecDescriptorBuilder` is the only builder.

**Closing-grep set.** After M0 lands, every symbol below MUST return zero hits across `packages/`, `test/`, `examples/`, `docs/`:

- `mkCodec` (factory; `buildSqlCodec` is the internal-only replacement and is fine)
- `defineCodecGroup`
- `defineCodecBundle`
- `CodecDefBuilder`
- `CodecDefBuilderImpl`
- `ExtractDescriptorCodecTypes` (renamed to `ExtractCodecTypes`)
- `byScalar`
- `dataTypes` (the target-codecs export, distinct from any unrelated framework concept)
- `sqlCodecDefinitions`
- `codecDescriptorDefinitions` (the dual-shape parallel export retired alongside `byScalar`)

The contract-level `ExtractCodecTypes<T>` in `sql/1-core/contract/src/types.ts` is a different identifier in a different file and stays.

**Why this is the forcing function.** With every parallel typed-instance carrier deleted, the only remaining type-flow path is descriptor → `descriptor.factory` → typed `Codec`. If `defineCodec` doesn't preserve generics, every codec round-trip test (`postgres/test/codecs.test.ts` calls `byScalar.timestamp.codec.encode(value, ctx)` today; after migration, `pgTimestampDescriptor.factory(undefined)({}).encode(value, ctx)`) fails to compile because `value` types as `unknown`. Mechanical, observable, impossible to bypass.

**Verification.**
- Closing-grep returns zero for every symbol in the set.
- Every gate in AC-0.6 green.
- Negative type tests in AC-0.1, AC-0.2, AC-0.3 prove the typed flow is intact at the unit-test level.

### AC-0.6. Validation gates green throughout

- `pnpm typecheck`, `pnpm lint:deps`, `pnpm fixtures:check`, `pnpm test:packages`, `pnpm test:e2e`, `pnpm build` all green at every commit boundary.
- No new type casts in production code. No `any`. No `@ts-expect-error` outside negative type tests. No `@ts-nocheck`. No biome suppressions.
- Demo emit byte-identical against the post-TML-2229 baseline (`origin/main`).

## Non-goals

- **Heterogeneous descriptor storage ergonomics.** Whether `AnyCodecDescriptor` becomes 5-arg (under Shape A) or stays 1-arg (under Shape B) is the implementation choice. Both shapes are admissible for AC-0.1.

- **Mongo type flow.** Mongo doesn't use this descriptor record pattern at HEAD; its wire-dispatch path is reshaped under [TML-2324](https://linear.app/prisma-company/issue/TML-2324). Out of scope.

- **Renaming `defineCodec` / `CodecDescriptor`.** Names stay; only the type signatures change. (`mkCodec` *is* renamed to `buildSqlCodec` per AC-0.5, but only because it's transitioning from public to internal.)

## References

- [TML-2229](https://linear.app/prisma-company/issue/TML-2229) — codec-registry-unification (parent project where this regression was introduced).
- Parent spec: [`spec.md`](../spec.md) — TML-2357 canonical spec; this sub-spec is a precondition for AC-1 / AC-2 / AC-3 / AC-7.
- [`wip/unattended-decisions.md` Decision #11](../../../wip/unattended-decisions.md) — diagnosis of the M2 R4 type-system failure that surfaced this problem.
- [`packages/2-sql/4-lanes/relational-core/src/ast/codec-types.ts:587-593`](../../../packages/2-sql/4-lanes/relational-core/src/ast/codec-types.ts) — current `defineCodec` declaration, where the variance erasure happens.
- [`examples/prisma-8-demo/prisma/contract.ts`](../../../examples/prisma-8-demo/prisma/contract.ts), [`examples/prisma-8-demo/src/prisma-no-emit/context.ts`](../../../examples/prisma-8-demo/src/prisma-no-emit/context.ts) — reference no-emit authoring chain.
