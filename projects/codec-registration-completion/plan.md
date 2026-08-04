# Plan — Codec registration completion (TML-2357)

> Milestones for the [spec](spec.md). Each milestone is one cohesive change that ends in a green-gates checkpoint and a pause-for-review with the user. If milestone diffs grow large enough, milestone boundaries (or Phase boundaries inside a milestone) become PR boundaries.

## Status

| Milestone | State |
|---|---|
| **M0** — Class-based codec migration (per-codec helpers + `CodecImpl`/`CodecDescriptorImpl` + Strength 3 deletion) | **Active.** Phase A **LANDED** (commits `0515acd1f`, `625c59020`, `ea67cc5bc`, `588cf319e`, `89d27c25a`). Phase B1 starts next. |
| **M1** — Narrow runtime `Codec` instance + descriptor-keyed metadata reads | **LANDED** (commits `3c9338fef`, `1be7564c4`). Re-verify post-M0. |
| **M2** — Native descriptor migration (interface form), bridge deletion, `aliasDescriptor`, `arktypeJsonEmitCodec` deletion | **Mostly LANDED** (R1–R3, T2.1–T2.6, Phase A, Phase B). M2 R4 (legacy-API deletion) was rolled back — its intent is absorbed into M0 Phase C. The remaining M2 surface (R4 retry) is **subsumed** by M0; no separate M2 R4 retry milestone. The function-form `aliasDescriptor` is **already deleted** (commit `89d27c25a`); class-based aliases are the only form going forward. |
| **M3** — `ParamRef.refs` plumbing + encode-side `forColumn` + `forCodecId` retirement | Pending; runs after M0. |
| **M4** — `JsonSchemaValidatorRegistry` deletion + `'json-validator'` trait retirement | Pending; runs after M0. |

`AC-7` (validation gates) is checked at the end of every milestone.

### Why M0 was redesigned (Pattern E)

M2 R4 attempted to delete the parallel typed-instance carriers (`mkCodec`-produced instances kept alive solely to drive `CodecTypes`/`TypeMaps` derivation). It rolled back because the typed-flow chain through the existing interface-form `CodecDescriptor` couldn't preserve the codec generics through TypeScript's variance rules. Three design iterations followed:

1. **Shape A vs Shape B spike** (interface form, parameterized `CodecDescriptor` vs intersection at `defineCodec`'s return) — partially solved the deletion problem but landed in a place that conflicted with the goal "the descriptor's factory IS the type-level source of truth." Documented in `wip/m0-shape-spike.md`.
2. **Mode C goal spec** — `factory-defined-codec-types.spec.md` framed the design goal independent of the implementation: the descriptor's factory is the single type-level source of truth for codec types; column helpers are derivative.
3. **Class-based design + Pattern E spike** — `class-based-codec-design.spec.md` proposed an abstract-class hierarchy. A TypeScript playground proof (`wip/m0-class-variance-proof.md`) falsified the polymorphic-column-helper approach and surfaced **Pattern E** (per-codec helpers + `satisfies`). The spike on `spike/class-based-codecs` validated all six AC-CB-* end-to-end.

Pattern E is the locked design. M0 below describes how to migrate the codebase to it, which absorbs both the M2 R4 deletion intent and the typed-flow precondition `typed-codec-flow.spec.md` was authored around. **`typed-codec-flow.spec.md` is superseded** by `class-based-codec-design.spec.md` + `factory-defined-codec-types.spec.md`; it survives in the project as historical context for the rollback.

## Validation gates (every milestone)

All must be green before declaring a milestone done:

- `pnpm typecheck`
- `pnpm lint:deps`
- `pnpm test:packages`
- `pnpm test:e2e` (postgres real-DB)
- `pnpm build`
- `pnpm fixtures:check` (all fixture pairs byte-identical against `origin/main` baseline)

## Milestone M0 — Pattern E migration

**Goal**: Replace the interface-form `Codec`/`CodecDescriptor` with the class-based hierarchy + per-codec helper functions. Migrate every codec in the SQL families. Delete every legacy carrier (`mkCodec`, `defineCodec`, `defineCodecGroup`, `defineCodecBundle`, `CodecDefBuilder*`, `byScalar` maps, `ExtractCodecTypes` instance-keyed, `aliasDescriptor` function form if replaced by class extension, etc.). Add negative type tests proving the typed `Codec` flow runs end-to-end through descriptor classes.

**Spec ACs addressed**: AC-0 (typed flow), AC-1 (every codec ships as a `CodecDescriptor`), AC-4 (alias by descriptor extension), and partial AC-3 (instance narrowed — already landed in M1; M0 confirms the class form preserves the narrow shape).

**Specs**: [`specs/class-based-codec-design.spec.md`](specs/class-based-codec-design.spec.md) (implementation-approach), [`specs/factory-defined-codec-types.spec.md`](specs/factory-defined-codec-types.spec.md) (goal). Absorbs [TML-2393](https://linear.app/prisma-company/issue/TML-2393).

### Phase A — Framework class hierarchy + per-codec helper machinery — **LANDED**

The framework-level scaffolding shipped across five commits. The shape that landed differs in important ways from the original spike sketch — review feedback drove a consolidation. Final state:

- `packages/1-framework/1-core/framework-components/src/shared/codec.ts` — `interface Codec<Id, TTraits, TWire, TInput>` (canonical consumer surface) + `abstract class CodecImpl<...> implements Codec<...>` (codec-author base). Class constructor takes `descriptor: CodecDescriptor<any>` (variance-erased); `id` getter proxies through `descriptor.codecId`; `encode` / `decode` / `encodeJson` / `decodeJson` are abstract. Runtime instance does **not** carry `traits` (the `Codec` interface declares only a phantom `[codecTraitsPhantom]?: TTraits` carrier; consumers needing the runtime trait set read `codec.descriptor.traits`).
- `packages/1-framework/1-core/framework-components/src/shared/codec-descriptor.ts` — `interface CodecDescriptor<TParams>` (canonical consumer surface) + `abstract class CodecDescriptorImpl<TParams> implements CodecDescriptor<TParams>` (codec-author base) + `AnyCodecDescriptor` variance-erased alias. The function-form `aliasDescriptor` is **deleted** (the spread had a prototype-stripping bug; aliases are now class-based).
- `packages/1-framework/1-core/framework-components/src/shared/column-spec.ts` — `ColumnTypeDescriptor` (relocated from `@internal/contract-authoring` to layer 1 alongside the codec types — codec base types are essential framework concepts and shouldn't sit at layer 2) + `interface ColumnSpec<R, P> extends ColumnTypeDescriptor` (real `extends`, no structural mirror) + the `column(codecFactory, codecId, typeParams)` packager + `ColumnHelperFor<D>` / `ColumnHelperForStrict<D>` shapes.
- `packages/1-framework/1-core/framework-components/src/shared/codec-types.ts` — reduced to support types only: `CodecTrait`, `CodecCallContext`, `CodecInstanceContext`, `CodecMeta`, `CodecLookup`, `voidParamsSchema`, `emptyCodecLookup`.
- `packages/1-framework/1-core/framework-components/src/exports/codec.ts` — single consolidated barrel. The `class-based-codec` subpath barrel is deleted.
- `packages/1-framework/1-core/framework-components/test/codec.types.test-d.ts` — framework-level type tests using inline fixtures; covers literal preservation through direct `descriptor.factory(...)` calls, `column()` packaging, `ResolvedCodec` / `ColumnInputType` extraction, `ColumnHelperFor` / `ColumnHelperForStrict` `satisfies` discipline (positive + negative), and heterogeneous-storage variance erasure.

The reviewer-driven changes from the spike sketch:
- **Naming**: `Codec` and `CodecDescriptor` stayed as the interface names (consumer surface); the abstract classes use `Impl` suffix (`CodecImpl`, `CodecDescriptorImpl`) matching existing repo convention (`SelectQueryImpl`, `MongoDriverImpl`, etc.). No name collisions; consumers depend on the interface, authors extend the class.
- **`ColumnTypeDescriptor` moved** from contract-authoring (layer 2) to framework-components (layer 1). All ten cross-package import sites updated (`contract-ts`, `contract-psl`, `pgvector`, `arktype-json`, `postgres` adapter, `ids`, `test/utils`, etc.). `ColumnSpec` now `extends ColumnTypeDescriptor` directly — no structural mirror.
- **`aliasDescriptor` deleted** from the framework. Independent reviewer caught a prototype-stripping bug in the spread (`{ ...baseCodec, id }` strips inherited methods on class-based codecs). Postgres's four use sites (`pgCharDescriptor`, `pgVarcharDescriptor`, `pgIntDescriptor`, `pgFloatDescriptor`) were rewritten as inline `class extends CodecDescriptorImpl<P>` declarations using a small file-local `aliasCodec()` helper that derives codec instances via `Object.create(Object.getPrototypeOf(baseCodec))` + `Object.assign` + `Object.defineProperty(_, 'id', ...)` — works for both plain-object base codecs (today) and class-instance bases (post-Phase B).

### Phase B — Per-codec migration

PR boundaries by package. Each sub-phase ends with a green checkpoint.

#### B1. sql-relational-core base codecs (+ defensive Postgres legacy-alias rework)

**Expanded scope**: B1 also rewrites the four legacy `pgXxxCodec` *codec instance* aliases at `packages/3-targets/3-targets/postgres/src/core/codecs.ts:135-153` (`{ ...sqlCharCodec, id: PG_CHAR_CODEC_ID }` etc.) so they survive the SQL base codec migration. Today's pattern works because base codecs are plain-object `mkCodec` outputs; once SQL bases produce `CodecImpl` subclass instances, the spread silently strips prototype methods. Eliminating the transitional bug window.

5. **T0.B1.1 — Audit base codecs.** ~6 codecs in `packages/2-sql/4-lanes/relational-core/src/ast/sql-codecs.ts` (char, varchar, int, float, text, timestamp). Each has:
   - Today: `defineCodec({...})` producing an interface-form descriptor + `mkCodec({...})` producing a plain-object `Codec` instance.
   - Class-based target: `class XCodec extends CodecImpl<...>` (concrete codec class) + `class XDescriptor extends CodecDescriptorImpl<...>` (concrete descriptor class) + `xColumn = (...) => column(xDescriptor.factory(...), xDescriptor.codecId, typeParams)` (per-codec column helper) + `xColumn satisfies ColumnHelperFor<XDescriptor>` (or `ColumnHelperForStrict<XDescriptor>` when the codec's resolved type is well-defined).

6. **T0.B1.2 — Reshape one codec end-to-end (text).** Confirms the migration pattern works against real consumers (sql-relational-core has internal callers). Type tests + runtime tests + green gates.

7. **T0.B1.3 — Reshape the remaining base codecs.** char, varchar, int, float, timestamp. Each gets the same quadruple (codec class, descriptor class, per-codec column helper, `satisfies` clause). Existing `defineCodec(...)` and `mkCodec(...)` exports stay until Phase C — coexistence keeps the build green.

8. **T0.B1.4 — Defensive rework: Postgres legacy `pgXxxCodec` instances.** Replace the four `{ ...sqlXxxCodec, id }` patterns in `packages/3-targets/3-targets/postgres/src/core/codecs.ts:135-153` (`pgCharCodec`, `pgVarcharCodec`, `pgIntCodec`, `pgFloatCodec`) with calls to the existing file-local `aliasCodec()` helper (introduced for the descriptor-level aliases in commit `89d27c25a`). After this task, *no* code in the codebase relies on object-spread codec aliasing. Phase C deletes these legacy `Codec` instances entirely; in the interim, the prototype-preserving derivation keeps SQLite's direct `sqlCharCodec` consumers and Postgres's spread-aliased consumers both correct. SQLite's `sqlCharCodec` etc. usage in `packages/3-targets/3-targets/sqlite/src/core/codecs.ts` is direct (no spread); confirmed safe without changes for B1 — gets handled in Phase C alongside the SQL base codec deletions.

9. **T0.B1.5 — B1 validation checkpoint.** Postgres + SQLite + relational-core pass `pnpm typecheck && pnpm test`; repo-wide `pnpm lint:deps` and `pnpm test:packages` green.

#### B2. postgres target codecs

10. **T0.B2.1 — Audit postgres codecs.** ~18 remaining codecs in `packages/3-targets/3-targets/postgres/src/core/codecs.ts` (text, int4, int2, int8, float4, float8, numeric, bool, enum, json, jsonb, uuid, bytea, timestamptz, timestamp, date, time). The four char/varchar/int/float aliases already migrated to class form in B1's prerequisite (commit `89d27c25a`). Each remaining codec has:
   - Today: `mkCodec({...})` instance + `defineCodec({...})` descriptor in parallel; `byScalar` and `dataTypes` parallel exports keyed by scalar.
   - Class-based target: `class PgXCodec extends CodecImpl<...>` + `class PgXDescriptor extends CodecDescriptorImpl<...>` + per-codec column helper + `satisfies ColumnHelperFor<PgXDescriptor>`.

11. **T0.B2.2 — Reshape one postgres codec end-to-end (int4).** Same pattern as B1.2.

12. **T0.B2.3 — Reshape the remaining postgres codecs.** Batched into reasonable commit chunks (numeric/scalar codecs together, JSON together, etc.).

13. **T0.B2.4 — B2 validation checkpoint.**

#### B3. sqlite target codecs

13. **T0.B3.1 — Reshape sqlite codecs.** ~10 codecs in `packages/3-targets/3-targets/sqlite/src/core/codecs.ts`. Same pattern as B2.

14. **T0.B3.2 — B3 validation checkpoint.**

#### B4. Extension codecs

15. **T0.B4.1 — Reshape pgvector.** `packages/3-extensions/pgvector/src/core/codecs.ts`. Already has the class form on `spike/class-based-codecs`; lift the pattern (without the `*CB` suffix).

16. **T0.B4.2 — Reshape arktype-json.** `packages/3-extensions/arktype-json/src/core/arktype-json-codec.ts`. Method-level generic over `S extends Type<unknown>` per the spec § Case 3.

17. **T0.B4.3 — Reshape any other extension codecs** (cipherstash etc., as they exist).

18. **T0.B4.4 — B4 validation checkpoint.**

#### B5. Adapter / contributor wiring

19. **T0.B5.1 — Update postgres adapter** `packages/3-targets/6-adapters/postgres/src/core/adapter.ts`. Today consumes `Object.values(byScalar)` to register codecs. Migrate to consume the new descriptor classes through the unified `codecs:` slot. The descriptors-by-codec-id map gets populated from the class-form descriptor list.

20. **T0.B5.2 — Update sqlite adapter** analogously.

21. **T0.B5.3 — Update extension contributor wiring.** pgvector / arktype-json contributor packs ship the class-form descriptors through the unified `codecs:` slot.

22. **T0.B5.4 — B5 validation checkpoint.**

### Phase C — Strength 3 forcing-function deletion

PR boundary. The deletion is the proof that the Pattern E migration is complete: zero legacy callers remain.

23. **T0.C.1 — Delete `mkCodec` (and rename to `buildSqlCodec` if any internal carryover survives).** Audit grep `mkCodec`; sites should be zero in production after Phase B.

24. **T0.C.2 — Delete `defineCodec`** (`packages/2-sql/4-lanes/relational-core/src/ast/codec-types.ts:587-693`). Zero callers after Phase B.

25. **T0.C.3 — Delete `defineCodecGroup`** factory function and its export.

26. **T0.C.4 — Delete `defineCodecBundle`** factory function and its export. (If renamed during Phase B, delete the renamed form.)

27. **T0.C.5 — Delete `CodecDefBuilder` / `CodecDefBuilderImpl`**.

28. **T0.C.6 — Delete `ExtractCodecTypes` (instance-keyed, line 292)**. Rename `ExtractDescriptorCodecTypes` → `ExtractCodecTypes` (canonical now). Confirm the contract-level `ExtractCodecTypes<T>` in `packages/2-sql/1-core/contract/src/types.ts:239` is untouched (different file, different role; preserved).

29. **T0.C.7 — Delete `byScalar` and `dataTypes` from target / extension packages.** Sites:
   - `packages/3-targets/3-targets/postgres/src/core/codecs.ts:570`
   - `packages/3-targets/3-targets/sqlite/src/core/codecs.ts:120`
   - `packages/3-extensions/pgvector/src/core/codecs.ts:73`
   - `packages/2-sql/4-lanes/relational-core/src/ast/sql-codecs.ts:198` (`sqlCodecDefinitions`)
   - Delete the dual-shape parallel exports `codecDescriptorDefinitions` (postgres/sqlite/pgvector).
   - Delete `byScalar` getter from `CodecDescriptorBuilder` if no other consumers.

30. **T0.C.8 — Delete the legacy `pgXxxCodec` / `sqlXxxCodec` `Codec` instances.** After all consumers consume codecs through `descriptor.factory(...)(ctx)`, the legacy plain-object `Codec` instance exports (`sqlCharCodec`, `sqlIntCodec`, `pgCharCodec` (post-B1 prototype-preserving form), etc.) delete. SQLite's direct consumption pattern updates to consume through descriptors at this point. **Note**: the function-form `aliasDescriptor` was already deleted (commit `89d27c25a`); no separate task needed. The interface form of `Codec` / `CodecDescriptor` is preserved (it's the canonical consumer surface; the abstract classes implement it).

31. **T0.C.9 — Migrate any remaining test consumers** of legacy carriers. Sites that call `byScalar.timestamp.codec.encode(...)` migrate to `pgTimestampDescriptor.factory(undefined)({}).encode(...)` or use a small per-test helper. Already audited under M2 R4: ~50 test sites across postgres/sqlite/pgvector test fixtures + adapter test fixtures.

32. **T0.C.10 — Mark `typed-codec-flow.spec.md` as superseded** (already done — links point to `class-based-codec-design.spec.md` + `factory-defined-codec-types.spec.md`).

### Phase D — Constructive type tests + closing-grep + validation

PR boundary with Phase C if diff is small enough; otherwise its own.

35. **T0.D.1 — Negative type tests at the descriptor round-trip layer.** `packages/2-sql/4-lanes/relational-core/test/typed-codec-flow.test-d.ts` — assertions like `expectTypeOf<ResolvedCodec<typeof pgInt4Descriptor>>().toEqualTypeOf<Codec<'pg/int4@1', readonly ['equality', 'order', 'numeric'], number, number>>()`.

36. **T0.D.2 — Negative type tests at the per-target descriptor record layer.** `packages/3-targets/3-targets/postgres/test/typed-descriptor-flow.test-d.ts` (and analogous in sqlite/pgvector). Assert each descriptor record entry's full type.

37. **T0.D.3 — Negative type tests at the no-emit authoring chain.** `examples/prisma-8-demo/test/no-emit-typed-flow.test-d.ts`. `field.uuidv4()` returns typed field spec; query expression typechecks; `fns.eq(f.id, 1234: number)` fails.

38. **T0.D.4 — Closing-grep verification.** Zero hits across `packages/ test/ examples/ docs/` (excluding `projects/**` and `wip/**`) for: `mkCodec`, `defineCodec\(`, `defineCodecGroup`, `defineCodecBundle`, `CodecDefBuilder`, `CodecDefBuilderImpl`, `ExtractDescriptorCodecTypes`, `byScalar`, `dataTypes` (the target-codec export — disambiguate by context), `sqlCodecDefinitions`, `codecDescriptorDefinitions`. The deletion is the forcing function.

39. **T0.D.5 — `pnpm fixtures:check`.** Confirm zero drift across all fixture pairs.

40. **T0.D.6 — Full validation checkpoint** (`pnpm typecheck`, `pnpm lint:deps`, `pnpm test:packages`, `pnpm test:e2e`, `pnpm build`, `pnpm fixtures:check`) and **pause for review**.

### Risks

- **Per-codec helper boilerplate.** ~40 helpers across the codebase. Mitigated by `defineSimpleCodec` shorthand per spec § Risks for cases that don't need class state.
- **Adapter-level descriptor consumption.** Phase B5 changes the adapter registration loops. The contributor protocol's unified `codecs:` slot must accept class-form descriptors; verify the slot's shape on first attempt; if a friction surfaces, lift the change into the contributor protocol.
- **Test fixture diff volume.** ~50 test sites migrating from `byScalar.X.codec.encode(...)` to typed factory calls. Mechanical but bounded.
- **`override` keyword discipline.** `noImplicitOverride` requires `override` on every concrete-subclass member touching an inherited member; codec authors must remember. Mechanical but catches mistakes.
- **`CodecDescriptorImpl.factory` return-type widening.** The abstract base declares `factory` to return `(ctx) => Codec<string, readonly CodecTrait[], unknown, unknown>`. Concrete subclasses returning a typed `Codec<Id, TTraits, TWire, TInput>` are subtype-assignable, but consumer-side type extraction (`ReturnType<ReturnType<D['factory']>>`) reads the abstract base's widened return. Per-codec column helpers preserve precise types via *direct* invocation at the call site (the load-bearing variance discipline of Pattern E); the type-test fixtures verify this. Phase B may surface ergonomic friction worth revisiting; if so, an alternative is making the abstract `factory` generic over the concrete codec type. Defer until first encountered.
- **Phase ordering.** Phase A → B1 → B2 → B3 → B4 → B5 → C → D. Phase A is purely additive (LANDED). Each Phase B sub-phase keeps the build green (legacy interface form survives alongside until Phase C). Phase C is the deletion sweep that exposes any latent dependency.

### Estimated diff

| Phase | Production files | Test files | LoC scope |
|---|---|---|---|
| A | ~6 (framework class hierarchy + barrel + ColumnTypeDescriptor relocation + Postgres descriptor-level alias rework) | ~1 | ~600 (LANDED) |
| B1 | ~3 (relational-core base codecs) + 1 (Postgres legacy `pgXxxCodec` defensive rework) | ~3 | ~500 |
| B2 | ~3 | ~5 | ~1500 |
| B3 | ~3 | ~3 | ~600 |
| B4 | ~4 | ~4 | ~500 |
| B5 | ~5 (adapters + contributor wiring) | ~5 | ~400 |
| C | ~15 (deletions + barrel reconciliation) | ~50 (test migration) | ~1500 |
| D | ~3 new test-d files | ~5 | ~500 |
| **Total** | **~40 production files** | **~75 test files** | **~6100 LoC** |

Comparable to (or larger than) the original combined M0+M2 estimate. Six PR boundaries (A, B1, B2, B3, B4, B5+C, D) keep individual reviews tractable.

## Milestone M1 — Narrow runtime `Codec` instance + descriptor-keyed metadata reads

**Status: LANDED** (commits `3c9338fef`, `1be7564c4`).

Re-verify post-M0:

- The class-based `Codec` abstract class declares only `id` getter (proxied through descriptor) + the four conversion methods.
- No instance-level `traits` / `targetTypes` / `meta` / `renderOutputType` slots.
- All consumer sites read static metadata from descriptors.

If post-M0 any regressions surface, file a follow-up. No re-implementation expected.

## Milestone M2 — Native descriptor migration

**Status: ABSORBED into M0.**

M2 R1–R3 landed (interface-form descriptor migration, synthesis bridge deletion, `aliasCodec` retirement, `arktypeJsonEmitCodec` deletion, narrowed `Codec` shape). M2 R4 (legacy-API deletion) was rolled back. M0's Phase B + Phase C absorb M2 R4's intent — the migration to the class form IS the native descriptor migration; the deletion of `mkCodec` / `defineCodec` / `byScalar` IS what M2 R4 was attempting. There is no separate M2 R4 retry milestone.

## Milestone M3 — `ParamRef.refs` plumbing + encode-side `forColumn` + `forCodecId` retirement

**Goal**: Every `ParamRef` constructed at a column-bound site carries `refs: { table, column }`. A builder-pipeline validator pass enforces refs-required for parameterized codec ids. Encode-side dispatch goes through `forColumn(refs.table, refs.column)`. The `forCodecId` fallback retires for parameterized codec ids.

**Spec ACs addressed**: AC-5.

### Tasks

1. **T3.1 — Audit refs-less encode-side call sites.** Grep for every `ParamRef.of(...)` and `new ParamRef(...)` in production. For each, determine: column-bound (refs available)? targets a parameterized codec id today? Sites identified on `origin/main`:
   - `packages/2-sql/4-lanes/relational-core/src/expression.ts:75`
   - `packages/2-sql/4-lanes/sql-builder/src/runtime/mutation-impl.ts:43,47`
   - `packages/3-extensions/sql-orm-client/src/query-plan-mutations.ts:50,96`
   - `packages/3-extensions/sql-orm-client/src/where-binding.ts:125`
   - `packages/3-extensions/sql-orm-client/src/types.ts:293`
2. **T3.2 — Extend `ParamRef` AST node.** Add `refs?: { table: string; column: string }`.
3. **T3.3 — Add a builder-pipeline validator pass.** `validateParamRefRefs(plan, descriptorMap)` walks expressions, identifies `ParamRef`s whose `codecId` is parameterized (`descriptorFor(codecId).paramsSchema` validates non-`void`), asserts `refs !== undefined`. Refs-less parameterized-codec-id `ParamRef`s throw a clear diagnostic naming the codec id and the binding site.
4. **T3.4 — Populate refs at every column-bound site** identified in T3.1.
5. **T3.5 — Encode-side dispatch via `forColumn`.** `encodeParam` in `packages/2-sql/5-runtime/src/codecs/encoding.ts` consults `paramRef.refs` and resolves through `contractCodecs.forColumn(refs.table, refs.column)` when present. Falls back to `descriptorFor(codecId).factory(undefined)(syntheticInstanceCtx)` for non-parameterized codec ids without refs. The `forCodecId` path retires for parameterized codec ids.
6. **T3.6 — Tests.** Validator-pass unit test (refs-less parameterized codec ParamRef → throw). Encode-side dispatch integration test (vector encode goes through `forColumn`, not `forCodecId`). Refs propagation tests for each migrated site.
7. **T3.7 — Validation checkpoint** and **pause for review**.

### Risks

- Refs propagation surface area: the 5 enumerated sites may not be exhaustive; the audit catches more.
- AST rewriters (`Expression.rewrite`) construct new `ParamRef` instances; preserve refs across rewrites.
- Validator-pass ergonomics: refs-less parameterized-codec-id `ParamRef`s exist transiently in the AST; the pass must run before encode.

### Estimated diff

~10 production files + ~5 test files.

## Milestone M4 — `JsonSchemaValidatorRegistry` deletion + trait retirement

**Goal**: JSON-Schema validation lives in the resolved codec's `decode` body (already the case for `arktypeJsonCodec`). The `JsonSchemaValidatorRegistry`, `buildJsonSchemaValidatorRegistry`, the `jsonSchemaValidators?` slot on `ExecutionContext`, and `packages/2-sql/5-runtime/src/codecs/json-schema-validation.ts` all delete. The `'json-validator'` `CodecTrait` retires if no consumer remains.

**Spec ACs addressed**: AC-6.

### Tasks

1. **T4.1 — Audit `'json-validator'` trait consumers.** Grep `'json-validator'` and `extractValidator`.
2. **T4.2 — Verify arktype-json's inline validation path is the only producer of validator state.**
3. **T4.3 — Delete `JsonSchemaValidatorRegistry`** from `packages/2-sql/4-lanes/relational-core/src/query-lane-context.ts`. Delete `buildJsonSchemaValidatorRegistry`.
4. **T4.4 — Delete the `jsonSchemaValidators?` slot** on `ExecutionContext`.
5. **T4.5 — Delete `packages/2-sql/5-runtime/src/codecs/json-schema-validation.ts`** and any callers.
6. **T4.6 — Retire the `'json-validator'` `CodecTrait`** if T4.1 found no consumers.
7. **T4.7 — Tests.** Update / delete `packages/2-sql/5-runtime/test/json-schema-validation.test.ts`. Real-DB e2e: arktype-json roundtrip.
8. **T4.8 — Validation checkpoint** and **pause for review**.

### Risks

- Hidden consumers of the validator registry; the grep audit is the safety net.
- Decode-error diagnostic regression — verify the inline path's error envelope (`RUNTIME.JSON_SCHEMA_VALIDATION_FAILED`) carries equivalent information.

### Estimated diff

~5 production files + ~5 test files.

## Project-wide close-out

Done after M4 lands cleanly. Per [drive-project-workflow](../../.cursor/rules/drive-project-workflow.mdc):

1. **Migrate long-lived docs into `docs/`.** ADR 208 was authored by the parent project to describe the unified model; verify it accurately reflects the post-TML-2357 state under Pattern E (class-based descriptors, per-codec helpers, no `defineCodec`, no `forCodecId` fallback for parameterized codec ids, no emit-shim, no `CodecParamsDescriptor`, narrow runtime `Codec`). Update if needed.
2. **Strip repo-wide references to `projects/codec-registration-completion/**`** (replace with ADR 208 / canonical `docs/` links or remove).
3. **Delete `projects/codec-registration-completion/`** in the close-out commit.
4. **Linear**: TML-2357 auto-closes when the PR(s) merge (issue id in branch name + PR title).

## Open items (deferred)

- **`pgEnumCodec` factory audit** — placeholder factory; documented in ADR 208 § Future work; separate ticket.
- **Mongo registration migration + Mongo runtime `forColumn`** — TML-2324.
- **Mongo control-plane `parameterizedCodecs:` slot** — separate ticket; Mongo demos don't use parameterized codecs, so the gap is authoring-time only.
- **Future per-library JSON extensions (zod, valibot)** — not blocked by this work.
- **`pnpm test:packages` parallel-execution flake** — workspace-parallel test runs intermittently fail in `@internal/sql-orm-client` / `@internal/cli` / `@internal/adapter-postgres`; isolated re-runs pass. Filed as [TML-2402](https://linear.app/prisma-company/issue/TML-2402). Pre-existing; not in scope for TML-2357. Worked around during this project by re-running affected packages in isolation to confirm the failure pattern.
- **Turbo cache-keying gap on transitive AST/type changes** — observed twice (M3 R1, M4 R1): downstream consumers' build caches did not invalidate after a structurally compatible AST change in `@internal/sql-relational-core`, requiring `pnpm build --force`. Filed as [TML-2403](https://linear.app/prisma-company/issue/TML-2403).

## Close-out outcome (post-orchestrator interrupt)

The original plan above (steps 1–4 of the project-wide close-out) was executed with one deviation. Step 3 ("delete `projects/codec-registration-completion/`") was reverted mid-close-out by an orchestrator directive: the project directory is retained in-tree as a historical record rather than removed.

What landed on the close-out branch:

- **Step 1 — doc migration**: ADR 208 rewritten to describe Pattern E (class-form `CodecImpl` + `CodecDescriptorImpl` + per-codec column helper) as the canonical authoring shape; new contributor reference at [`docs/reference/codec-authoring-guide.md`](../../docs/reference/codec-authoring-guide.md); retrospective notes added to ADRs 184/186/202/204/205 explaining that their `defineCodec({...})` examples reflect the prior surface and pointing to ADR 208 + the authoring guide for current practice.
- **Step 2 — reference cleanup (revised)**: project-internal milestone/phase markers (`(TML-2357 M0 Phase B5/C)` etc.) in code comments and docblocks were replaced with the durable Linear ticket id `(TML-2357)`. References that point into this directory remain only inside the directory itself (self-references in `plan.md` and `specs/`); no external file links into `projects/codec-registration-completion/**`.
- **Step 3 — directory deletion**: **NOT executed.** A deletion commit (`aacf58dccf7347d460ae01f02db1b4d2a8d23300`) was created and immediately reverted by `5b0113a5afbdf93a5c03ed6b70c3546aa367d657`. The five tracked spec/plan files in this directory were restored from the prior commit. The gitignored `reviews/` contents (review artifacts created during execution; never tracked by git) are not recoverable; per the original close-out triage they were classified as transient review artifacts.
- **Step 4 — Linear**: TML-2357 will auto-close on PR merge via branch name + PR title link. Two follow-up tickets filed during close-out triage: [TML-2402](https://linear.app/prisma-company/issue/TML-2402) (parallel-execution flake, P3) and [TML-2403](https://linear.app/prisma-company/issue/TML-2403) (turbo cache-keying gap, P4). Both are pre-existing/operational, not regressions introduced by this project.
