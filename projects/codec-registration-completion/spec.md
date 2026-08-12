# Spec — Codec registration completion (TML-2357)

> Follow-up to [codec-registry-unification](https://linear.app/prisma-company/issue/TML-2229) (merged to main; [ADR 208](../../docs/architecture%20docs/adrs/ADR%20208%20-%20Higher-order%20codecs%20for%20parameterized%20types.md)). Completes the registration-side migration the parent work deliberately deferred.

## Decision

Foundational precondition surfaced during M2 R4: `defineCodec`'s declared return type drops the codec generics its `spec` argument inferred, so per-target descriptor records carry `CodecDescriptor<void>` and the typed `Codec` flow into no-emit authoring (`field.uuidv4()`) and emit-path `contract.d.ts` `TypeMaps` derivation collapses. Without fixing this, AC-1 / AC-2 / AC-3 / AC-7 below cannot land cleanly. **See [`specs/typed-codec-flow.spec.md`](specs/typed-codec-flow.spec.md) for the full statement; AC-0 below refers to it.**

Every codec contributor in the framework ships native `CodecDescriptor`s. The synthesis bridge that auto-lifts legacy `Codec` instances at context-construction (`synthesizeNonParameterizedDescriptor`) deletes; the `parameterizedCodecs:` registration slot deletes; the legacy SQL adapter `CodecParamsDescriptor` shape deletes; the `JsonSchemaValidatorRegistry` workaround deletes. The runtime `Codec` instance type narrows to a back-referenced behavior shape — it keeps `id` (the descriptor's `codecId`, set by the factory) and the four conversion methods (`encode`, `decode`, `encodeJson`, `decodeJson`); it loses the codec-id-keyed static metadata (`traits`, `targetTypes`, `meta`) and the build-time `renderOutputType?` shim, all of which live only on the descriptor. The emit path consults `descriptorFor(codecId).renderOutputType` directly; no per-library "emit-only Codec" stub is needed (today's `arktypeJsonEmitCodec` retires).

`ParamRef` gains a structural invariant: every `ParamRef` whose `codecId` resolves to a parameterized descriptor (`P` non-`void`) must carry `refs: { table, column }`. Refs are populated from every column-bound construction site in the SQL builder and the ORM client. Encode-side dispatch goes `forColumn(refs.table, refs.column)` for column-bound params and `descriptor.factory(undefined)(syntheticInstanceCtx)` for non-parameterized refs-less params. The legacy `forCodecId` fallback (the AC-5-deferred carve-out parent project left in place) retires for parameterized codec ids.

The postgres target's `aliasCodec` helper retires in favor of `aliasDescriptor(base, { codecId, targetTypes, meta })`, which composes at the descriptor level. The alias's factory delegates to the base descriptor's factory and rewrites the resolved codec's `id`.

After this work, the codec registration model is uniform: one descriptor per codec id, one registration slot, no parameterized/non-parameterized branching at any read or registration site, no per-codec emit-shim or runtime-fallback workarounds.

## Why

Parent project `codec-registry-unification` (TML-2229; merged to main as commits `3d650b312` … `3194eb81d` plus the post-merge Phase E refactors `6cbfaa5a1` and `977ae8fbf`) shipped the read-surface unification — `descriptorFor(codecId)` and `forColumn(table, column)` resolve through one descriptor map without branching on parameterization. It explicitly deferred the registration-side migration to TML-2357 and lists six concrete defects that survived its merge:

1. **Parameterized codec ids without column refs depend on `forCodecId` fallback.** The encode-side path resolves through `forCodecId(codecId)` when the call site doesn't carry a column ref. For non-parameterized codec ids this is harmless (the codec is a singleton). For parameterized codec ids it works by coincidence — the descriptor's factory is reachable through the synthesis bridge, but the encode wire format must be parameter-independent for the result to be correct. Today only pgvector hits this path, and its wire format happens to be length-independent. Any future parameterized codec whose encode depends on its parameters would silently produce malformed wire values. Comments in `relational-core/ast/codec-types.ts` and `sql-runtime/codecs/encoding.ts` already mark this as a TML-2357 retirement target.

2. **Codec-id-keyed metadata lives in two places.** The descriptor is the source of truth at the read surface (after the parent work), but the runtime `Codec` instance still carries `id`, `targetTypes`, `traits`, and the `renderOutputType?` build-time hook. Several consumer sites still read these fields off the resolved codec instead of consulting the descriptor. The duality reintroduces the very drift the parent set out to retire.

3. **`arktypeJsonEmitCodec` is a workaround for the emit-path.** A `Codec` instance registered through the legacy `codecs:` slot purely so the emit-path renderer can find its `renderOutputType` via `forCodecId('arktype/json@1')`. The instance's `encode`/`decode` reject at runtime — they're stubs. The shim exists because the emit path consults the codec registry (not the descriptor map) for `renderOutputType`. Same shape as point 1, different reason: a placeholder codec on the legacy slot to serve a single read site.

4. **The `parameterizedCodecs:` adapter slot is parallel to `codecs:`.** Contributors ship through both slots — non-parameterized through `codecs:`, parameterized through `parameterizedCodecs:`. Both flow into the unified descriptor map at context-construction. The slot duality is mechanical-but-real: every contributor declares a `parameterizedCodecs(): []` even when they ship none.

5. **`CodecParamsDescriptor` is the legacy compile-time shape** that the SQL `Adapter.parameterizedCodecs()` surface still returns. The runtime `RuntimeParameterizedCodecDescriptor` already migrated to the unified `CodecDescriptor<P>` shape; the adapter shape lags. The codec-types.ts comment block in relational-core explicitly tracks this as TML-2357 T3.5.4.

6. **`JsonSchemaValidatorRegistry` is a vestige.** Per-instance JSON-Schema validator state lives in a parallel data structure rather than on the resolved codec's `decode` body. Parent's Phase C ships `arktypeJsonCodec` with inline validation (its `factory` builds the validator inside the closure and references it from `decode`) — the precedent for the future deletion. The `'json-validator'` `CodecTrait` is explicitly tagged "Retirement target" under TML-2357 in `framework-components/src/shared/codec-types.ts`.

These six defects share a root cause: the registration model was only partially unified. The descriptor map is the read-surface source of truth; the registration model still ships codecs through a parallel slot, an instance-level metadata duplicate, an emit-path shim, a legacy adapter-level descriptor shape, and a parallel per-instance-state registry. Closing the loop requires every contributor to ship descriptors directly through one slot, every consumer to read static metadata from descriptors, the emit path to consult `descriptorFor(codecId).renderOutputType` directly, and per-instance state to live where the descriptor's factory puts it.

## Glossary

| Term | Meaning |
|---|---|
| **CodecDescriptor** | The registration record (defined by parent project). One per codec id. Carries `codecId`, `traits`, `targetTypes`, `meta`, `paramsSchema`, optional `renderOutputType`, and `factory`. |
| **Codec (runtime instance)** | The behavior-bearing object returned by `descriptor.factory(params)(ctx)`. After this work, carries only `id` (back-reference to descriptor's `codecId`) and the four conversion methods. `encode` and `decode` remain `Promise`-returning per [ADR 204](../../docs/architecture%20docs/adrs/ADR%20204%20-%20Single-Path%20Async%20Codec%20Runtime.md); they take a per-call `CodecCallContext` (signal, family-extended with `column?` for SQL). |
| **`CodecInstanceContext`** | Family-agnostic per-instance context the framework supplies to `descriptor.factory(params)(ctx)`. Carries `name` (the materialization-site identity). Family-specific extensions (e.g. `SqlCodecInstanceContext`) augment with column-set metadata (`usedAt`). |
| **`CodecCallContext`** | Family-agnostic per-call context the runtime supplies on every `encode`/`decode` invocation. Carries `signal?` for cancellation. SQL-family extension `SqlCodecCallContext` adds `column?: SqlColumnRef`. Out of scope to reshape here. |
| **Synthesis bridge** | `synthesizeNonParameterizedDescriptor(codec)` — the helper parent project introduced so legacy non-parameterized codecs auto-lift into descriptors at context-construction. Deletes when every contributor ships descriptors natively. |
| **`parameterizedCodecs:` slot** | The contributor slot parent left in place alongside the legacy `codecs:` slot for parameterized descriptors. Deletes when both shapes consolidate under a single `codecs: () => ReadonlyArray<CodecDescriptor>` slot. |
| **`CodecParamsDescriptor`** | The legacy SQL adapter parameterized-descriptor shape (`paramsSchema` + optional `init` hook). Adapter-level only; the runtime descriptor migrated. Deletes alongside the `parameterizedCodecs:` slot. |
| **`forCodecId` fallback** | The encode/decode dispatch fallback on `ContractCodecRegistry` for sites that don't carry a column ref. Retires for parameterized codec ids once `ParamRef.refs` is plumbed. |
| **`arktypeJsonEmitCodec`** | The placeholder `Codec` instance arktype-json registers on the legacy `codecs:` slot purely so emit-path `renderOutputType` lookup via `forCodecId('arktype/json@1')` works. Deletes after emit consults `descriptorFor(codecId).renderOutputType` directly. |
| **`JsonSchemaValidatorRegistry`** | The parallel data structure that today holds per-column JSON-Schema validators. Deletes; validation moves into the resolved codec's `decode` body (matching the arktype-json pattern parent's Phase C established). |
| **`aliasCodec`** | The postgres-target helper that composes a derived codec from a base codec by copying its `encode` / `decode` / `traits` and overlaying a new `id` / `targetTypes` / `meta`. Replaced by `aliasDescriptor`, which composes at the descriptor level. |
| **`ParamRef.refs`** | New optional field on the `ParamRef` AST node carrying `{ table, column }` for column-bound DSL params. Required (validator-pass enforced) whenever the param's codec id is parameterized. |

## Cases that pin the design

These three cases drive the structural decisions; if any can't be expressed cleanly under the unified registration shape, the design is wrong.

### Case T — Text codec migration (non-parameterized, native registration)

`pg/text@1` ships from the postgres target package as a `CodecDescriptor<void>` directly: no `codec({ ... })` factory consumed by `synthesizeNonParameterizedDescriptor`, just a hand-rolled descriptor whose factory closes over a shared `pgTextCodec` instance. The descriptor's `paramsSchema` is `voidParamsSchema`; its `traits` are `['equality', 'order', 'textual']`; its `meta` carries `db.sql.postgres.nativeType: 'text'`. The legacy `codecs:` slot in the postgres runtime adapter (currently lists `pgTextCodec` and ~21 siblings) deletes; everything ships through the unified `codecs: () => ReadonlyArray<CodecDescriptor>` slot.

What this case pins:

- Every non-parameterized codec contributor ships a descriptor through the unified `codecs:` slot — no synthesis happens at runtime.
- The contributor authoring surface is uniform: a `defineCodecDescriptor` helper (or inline construction) for both parameterized and non-parameterized codecs.
- The narrowed runtime `Codec` instance still carries `id` (the descriptor's `codecId`); the descriptor's `factory` is responsible for setting it. This keeps decode-error messages and dispatch-site debugging unchanged.

### Case V — Vector codec encode (parameterized; refs always required)

A SQL builder constructs a query with `vectorCol.eq([1.2, 3.4, ...])` against `Document.embedding` (a `vector(1536)` column). The encode-side path constructs a `ParamRef` for the `[1.2, 3.4, ...]` value with `codecId: 'pg/vector@1'`. Because `pg/vector@1` is parameterized, the AST validator pass enforces `refs: { table: 'Document', column: 'embedding' }`; the SQL builder populates them from the `vectorCol` reference. At encode time, dispatch goes `forColumn('Document', 'embedding')`, which resolves through the per-instance `pg/vector@1` codec materialized for that column's `typeParams: { length: 1536 }`. The `forCodecId` fallback is never consulted for `pg/vector@1`.

What this case pins:

- `ParamRef.refs` is the primary encode-side dispatch input for column-bound params.
- The validator-pass invariant — `descriptor.paramsSchema is non-void → refs !== undefined` — is enforced before encode runs, so the builder fails fast if a column-bound site forgot to plumb refs.
- The encode-side `forCodecId` fallback survives only for non-parameterized codec ids (where `descriptor.factory(undefined)(syntheticInstanceCtx)` returns the shared singleton). For parameterized codec ids without refs, the validator refuses to admit the AST.

### Case J — JSON-with-schema decode (parameterized; validator inline; emit via descriptor)

A row containing `{ active: true }` arrives over the wire for a `Product.metadata` column typed as `arktypeJson(ProductSchema)`. The decode path calls `forColumn('Product', 'metadata').decode(wire, callCtx)` and the resolved codec's `decode` body parses the JSON, runs the arktype validator, and returns the typed value. There is no `JsonSchemaValidatorRegistry` lookup; the validator was compiled inside the descriptor's `factory({ expression, jsonIr })` closure and is referenced from `decode` directly.

When the emitter runs `pnpm emit`, it walks the contract's models, looks up `arktype/json@1` via `descriptorFor('arktype/json@1')`, and calls `descriptor.renderOutputType(typeParams)` to produce the TypeScript output type. No `arktypeJsonEmitCodec` shim on the legacy `codecs:` slot is consulted.

What this case pins:

- Per-instance state (compiled validators, derived keys, etc.) lives on the resolved codec where the descriptor's factory put it. No parallel registry.
- The emit path's `renderOutputType` consultation routes through `descriptorFor(codecId)`, not through the codec registry. The per-library emit shim retires.
- The `'json-validator'` `CodecTrait` retires once no consumer reads it — its only purpose was to gate the structural cast through which `JsonSchemaValidatorRegistry` was consulted. The trait is already explicitly tagged "Retirement target" in framework-components.
- The descriptor's `paramsSchema` runs validation at the JSON boundary (`contract.json` → runtime), guaranteeing the params the factory closes over are well-formed before any decode path runs.

## Acceptance criteria

### AC-0. Typed `Codec` flow through `CodecDescriptor` (precondition)

- `defineCodec({...})` returns a descriptor type that preserves the codec generics inferred from its `spec` argument (`Id`, `TTraits`, `TWire`, `TInput`, `TParams`).
- Per-target descriptor records (`PgDescriptors`, `SqliteDescriptors`, `PgvectorDescriptors`, `SqlDescriptors`, `ArktypeJsonDescriptors`) carry each entry's full descriptor type by inference.
- The no-emit authoring chain types end-to-end: `field.uuidv4()` returns a typed field spec; `defineContract({...}, ...)` produces a typed contract; `sqlBuilder<typeof contract>({context})`-produced query expressions type-check correctly-typed parameters and reject incorrectly-typed ones.
- Emit-path `contract.d.ts` `TypeMaps` projection has correct per-codec-id `{input, output, traits}` shapes; `pnpm fixtures:check` passes.
- **Forcing-function deletion.** Every parallel typed-instance carrier deleted within M0 (closing-grep zero across `packages/ test/ examples/ docs/` for: `mkCodec`, `defineCodecGroup`, `defineCodecBundle`, `CodecDefBuilder`, `CodecDefBuilderImpl`, `ExtractDescriptorCodecTypes` (renamed to `ExtractCodecTypes`), `byScalar`, `dataTypes`, `sqlCodecDefinitions`, `codecDescriptorDefinitions`). Absorbs [TML-2393](https://linear.app/prisma-company/issue/TML-2393) (the `byScalar` antipattern cleanup).
- Negative type tests assert the typed-flow chain at `defineCodec` round-trip, per-target descriptor record entries, and the no-emit authoring chain.

Full statement: [`specs/typed-codec-flow.spec.md`](specs/typed-codec-flow.spec.md). AC-0 must land before AC-1, AC-2, AC-3, AC-7 can complete.

### AC-1. Every codec ships as a `CodecDescriptor`

- Every codec in the SQL families (postgres target/adapter, sqlite target/adapter, sql-relational-core base codecs, pgvector extension, arktype-json extension) ships as a `CodecDescriptor` through the unified `codecs:` slot.
- The synthesis bridge `synthesizeNonParameterizedDescriptor` is unused in production code; the function and its export delete.
- `arktypeJsonEmitCodec` and the `pack-meta.ts` `codecInstances: [arktypeJsonEmitCodec]` registration delete.

**Excluded**: Mongo codec migration. Folded into [TML-2324](https://linear.app/prisma-company/issue/TML-2324) (Mongo runtime `forColumn` plumbing).

### AC-2. Single registration slot

- `SqlStaticContributions.codecs` returns `ReadonlyArray<CodecDescriptor>` (not `Codec`); the legacy `codecs: () => CodecRegistry` shape gone from the contributor protocol.
- `parameterizedCodecs:` slot deleted from `SqlStaticContributions`, `Adapter`, `RuntimeAdapter`, `RuntimeTarget`, `ControlAdapter`, every contributor's runtime/control descriptors, and `cli/src/control-api/contract-enrichment.ts`'s destructure.
- `CodecParamsDescriptor` deletes from `@internal/sql-relational-core`; the adapter-level `parameterizedCodecs():` collapses into the unified `codecs():` slot.

### AC-3. Runtime `Codec` instance narrowed

- The `Codec` interface in `@internal/framework-components/codec` declares only `id` and the four conversion methods (`encode`, `decode`, `encodeJson`, `decodeJson`). **(M1)**
- `traits`, `targetTypes`, `meta`, and `renderOutputType?` are removed from the base interface in M1, and from every family-specific extension (SQL `Codec`, Mongo `MongoCodec`) in M2 alongside the synthesis-bridge deletion. The two-stage shape is intentional: M1 narrows the *framework* surface and migrates every framework-side consumer; family extensions retain optional transitional fields through M1 so the synthesis bridge (`synthesizeNonParameterizedDescriptor`) and `aliasCodec` keep working until M2 deletes both alongside the per-library descriptor migration. **(M1 framework / M2 family extensions)**
- `encode`/`decode` retain their async signature with `CodecCallContext` per ADR 204; this work doesn't reshape the call surface.
- Every consumer of the removed fields migrates to read them from `descriptorFor(codecId)`. Concrete sites (verified by grep on the post-merge baseline):
  - `packages/1-framework/1-core/framework-components/src/control/control-stack.ts` — `codec.id` reads stay; any `targetTypes`/`traits` consultation routes through descriptors.
  - `packages/2-sql/2-authoring/contract-psl/src/provider.ts` — `descriptorFor(codecId).targetTypes[0]`.
  - `packages/2-mongo-family/2-authoring/contract-psl/src/derive-json-schema.ts` — analogous.
  - `packages/2-sql/4-lanes/relational-core/src/ast/codec-types.ts` — `CodecRegistryImpl.register`, `hasTrait`, `traitsOf`, `defineCodecs` builder.
  - `packages/2-sql/5-runtime/src/codecs/decoding.ts` — `codec.id` reads stay; any read of `codec.traits` / `codec.targetTypes` rewires to descriptor reads.
  - `packages/3-targets/3-targets/postgres/src/core/codecs.ts` — `aliasCodec` deletes (replaced by `aliasDescriptor`).
  - `packages/3-targets/6-adapters/postgres/src/core/{adapter,descriptor-meta}.ts` — `Object.values(codecDefinitions)` mappings consult descriptors.
  - The emit path's `renderOutputType` consultation routes through `descriptorFor(codecId).renderOutputType` (retiring the per-library emit shim).
  - `packages/2-mongo-family/1-foundation/mongo-codec/src/codec-registry.ts` — `codec.id`-keyed registration stays; Mongo's full migration is TML-2324.

### AC-4. `aliasDescriptor` replaces `aliasCodec`

- `aliasDescriptor(base: CodecDescriptor<P>, overrides: { codecId, targetTypes, meta? }): CodecDescriptor<P>` exists in the postgres target package (or as a shared helper in framework-components if Mongo would benefit later).
- The alias's `factory` delegates to `base.factory`, producing a new resolved codec whose `id` matches the alias's `codecId` and whose behavior is the base's behavior.
- Every `aliasCodec(...)` call site in `packages/3-targets/3-targets/postgres/src/core/codecs.ts` migrates to `aliasDescriptor(...)`.

### AC-5. `ParamRef.refs` plumbed and validator-pass enforced

- `ParamRef` carries an optional `refs?: { table: string; column: string }` field on the AST node.
- A builder-pipeline validator pass enforces: if the descriptor map indicates `codecId` is parameterized (i.e. `descriptorFor(codecId).paramsSchema` validates a non-`void` shape), `refs` MUST be present. Refs-less parameterized-codec-id `ParamRef`s throw a clear diagnostic naming the codec id and the binding site at build time.
- Refs are populated at every column-bound construction site:
  - `packages/2-sql/4-lanes/relational-core/src/expression.ts:75` (the `toExpr` helper threads refs when the column is known)
  - `packages/2-sql/4-lanes/sql-builder/src/runtime/mutation-impl.ts:43,47` (INSERT VALUES / UPDATE SET binding)
  - `packages/3-extensions/sql-orm-client/src/query-plan-mutations.ts:50,96` (ORM mutation binding)
  - `packages/3-extensions/sql-orm-client/src/where-binding.ts:125` (ORM WHERE binding)
  - `packages/3-extensions/sql-orm-client/src/types.ts:293` (ORM param descriptor construction)
  - Any other production site found by grep before implementation starts.
- Encode-side dispatch consults `paramRef.refs` when present and resolves through `forColumn(refs.table, refs.column)`. The `forCodecId` fallback survives only for non-parameterized codec ids; the validator-pass invariant guarantees this is the only case it can hit.

### AC-6. `JsonSchemaValidatorRegistry` deleted; validation inline

- `JsonSchemaValidatorRegistry` and `buildJsonSchemaValidatorRegistry` deleted from `@internal/sql-relational-core` and `@internal/sql-runtime`.
- The `jsonSchemaValidators?` slot on `ExecutionContext` deleted.
- Every JSON-with-schema codec (`arktype/json@1` is the only production case today) bakes validation into the resolved codec's `decode` body — already the case for `arktypeJsonCodec` per parent's Phase C; this AC formalizes it as the only path.
- The `'json-validator'` `CodecTrait` deletes if no consumer remains; persists as a structural marker only if a consumer still requires it (audit before deletion).
- `packages/2-sql/5-runtime/src/codecs/json-schema-validation.ts` deletes.

### AC-7. Validation gates green

- `pnpm typecheck`, `pnpm lint:deps`, `pnpm test:packages`, `pnpm test:e2e`, `pnpm build` all green.
- Demo emit byte-identical against the post-merge `origin/main` baseline. This work is registration + AST + runtime; emit-path output is unchanged.
- Real-Postgres e2e tests pass for vector encode/decode (parameterized; refs path), JSON-with-schema encode/decode (parameterized; inline-validator path), and non-parameterized columns.

## Non-goals

- **Mongo registration migration.** Folded into [TML-2324](https://linear.app/prisma-company/issue/TML-2324). The Mongo runtime's wire-dispatch path differs from SQL's; reshaping it just for codec-registration symmetry would conflict with TML-2324.
- **Mongo runtime `forColumn` plumbing.** TML-2324's scope.
- **Renaming `Codec`** — the type name stays; only the field set narrows.
- **Reshaping the async codec runtime** ([ADR 204](../../docs/architecture%20docs/adrs/ADR%20204%20-%20Single-Path%20Async%20Codec%20Runtime.md)) or `CodecCallContext` ([ADR 207 — codec call context](../../docs/architecture%20docs/adrs/ADR%20207%20-%20Codec%20call%20context%20per-query%20AbortSignal%20and%20column%20metadata.md)) — both are baselines this work composes with.
- **Other codec interface fields** (`bulkEncode`, `preferParam`, redaction traits) — out of scope.
- **`pgEnumCodec` placeholder factory audit** (referenced in ADR 208 § Future work) — separate ticket.
- **Mongo control-plane parameterized-codecs slot** — separate ticket.

## Non-functional constraints

- **Zero new type casts** in production code. The descriptor migration unifies what the legacy registration was special-casing; if the consolidation requires a cast, the type design is wrong.
- **No backward-compat shims**: the synthesis bridge, `parameterizedCodecs:` slot, legacy `codecs: () => CodecRegistry` shape, `CodecParamsDescriptor`, `arktypeJsonEmitCodec`, and `JsonSchemaValidatorRegistry` all delete in this work; contributors that ship through them must migrate.
- **No `any`, no `@ts-expect-error` outside negative type tests, no `@ts-nocheck`, no biome suppressions.**
- **Demo emit byte-identical against `origin/main`.** Parent's Phase A fixed the typeRef emit-path bug; subsequent work must not regress.
- **Layering**: `CodecDescriptor` and `aliasDescriptor` (if shared) live in `framework-components`. Family-specific descriptors live in their target/adapter/extension packages. `pnpm lint:deps` passes throughout.

## Project base

Branched from `origin/main` (currently at `1d8b70943`, post-TML-2229 merge). Single branch (`tml-2357-codec-registration-model-complete-the-unified`); milestones land as separate commits with a pause-for-review checkpoint between each. If the diff per milestone is small enough, all milestones land in a single PR; otherwise the milestone boundaries become PR boundaries (the Linear ticket pre-suggests a 4-PR split if needed).

## Outcomes

- One descriptor per codec id; one registration slot; no parameterized/non-parameterized branching anywhere in the registration or read paths.
- The `forCodecId` fallback for parameterized codec ids retires; encode-side dispatch is column-aware end-to-end.
- Runtime `Codec` instance narrowed to behavior + back-reference; static metadata and emit-path renderer live only on the descriptor.
- `CodecParamsDescriptor`, `arktypeJsonEmitCodec`, and `JsonSchemaValidatorRegistry` deleted; legacy adapter shape, per-library emit shim, and per-instance validator-state workarounds retire for good.
- The codec model documented in [ADR 208](../../docs/architecture%20docs/adrs/ADR%20208%20-%20Higher-order%20codecs%20for%20parameterized%20types.md) matches the implementation byte-for-byte: the registration shape, the read shape, the emit shape, and the per-instance lifecycle all describe the same artifact.

## Forward-looking work captured but out of scope

- **TML-2324** — Mongo runtime `forColumn` plumbing (and Mongo codec registration migration, folded in).
- **Future per-library JSON extensions** (zod, valibot) when each has a clean serialize/rehydrate story.
- **`pgEnumCodec` placeholder factory audit** — its factory is a placeholder (enum values aren't parameterized in the curried-factory sense). Documented in ADR 208 § Future work; separate ticket.
- **Mongo control-plane `parameterizedCodecs:` slot** — Mongo's control descriptor doesn't carry the slot today; the Mongo `vector(N)` factory is exported and tested but cannot register through control until the slot lands. Mongo demos don't use parameterized codecs, so the gap is authoring-time only.

## References

- [ADR 208 — Higher-order codecs for parameterized types](../../docs/architecture%20docs/adrs/ADR%20208%20-%20Higher-order%20codecs%20for%20parameterized%20types.md). The codec model this work completes the registration side of.
- [ADR 204 — Single-Path Async Codec Runtime](../../docs/architecture%20docs/adrs/ADR%20204%20-%20Single-Path%20Async%20Codec%20Runtime.md). Establishes the async `Codec` baseline this work composes with.
- [ADR 207 — Codec call context per-query AbortSignal and column metadata](../../docs/architecture%20docs/adrs/ADR%20207%20-%20Codec%20call%20context%20per-query%20AbortSignal%20and%20column%20metadata.md). Establishes `CodecCallContext` and the family-specific extension pattern this work preserves.
- [TML-2229](https://linear.app/prisma-company/issue/TML-2229). The parent project (merged to main) — read-surface unification (descriptor map, `descriptorFor`, `forColumn`, synthesis bridge) and per-library JSON extension scaffold.
- [TML-2324](https://linear.app/prisma-company/issue/TML-2324). Mongo runtime `forColumn` plumbing (parallel work; absorbs Mongo codec registration migration).
- [TML-2357](https://linear.app/prisma-company/issue/TML-2357). This project's Linear ticket.

## Open questions

None remaining for spec-time. Implementation-time questions documented in `plan.md` per milestone.
