# Spec — AST-bound codec resolution (TML-2456)

> Follow-up to [codec-registration-completion](../codec-registration-completion/spec.md) (TML-2357). The predecessor unified the registration model behind `CodecDescriptor`; this work moves codec identity *onto the AST* and dissolves the runtime dispatch heuristics that exist only because the AST records the wrong fact.

## Decision

Every codec-bearing AST node carries a serializable **`CodecRef`** populated at AST construction time. Runtime resolves it once via `descriptorFor(codecId).factory(typeParams)(ctx)`, memoized per `(codecId, canonicalizeJson(typeParams))`. The runtime dispatch surface — column-aware lookup, alias resolution, codec-id consistency check, ambiguous-id rejection, refs-less fallback, representative-codec hack — collapses into one content-keyed lookup.

```ts
// packages/1-framework/1-core/framework-components/src/codec-types.ts
export interface CodecRef {
  readonly codecId: string;
  readonly typeParams?: JsonValue;
}
```

`ParamRef` and `ProjectionItem` carry `codec: CodecRef | undefined` (replacing today's `codecId?: string` plus `refs?: { table; column }`). The optional shape preserves the legitimate "no codec known" case (refs-less raw SQL today, expression-level computed projections); the validator-pass invariant changes from "refs required when codecId is parameterized" to "no validator pass — type system + builder construction sites enforce by construction".

## Why

[ADR 208](../../docs/architecture%20docs/adrs/ADR%20208%20-%20Higher-order%20codecs%20for%20parameterized%20types.md) defines `CodecDescriptor.factory(params)(ctx) → Codec` as the canonical materialization shape. Today's `ParamRef` records a column reference (`refs: { table; column }`) and the runtime *triangulates* the descriptor's `(params)` from the contract's `storage.tables[table].columns[column]` lookup. That triangulation is the wrong fact: refs are an indirection through the contract, not a property of the value being encoded.

Seven artifacts exist solely because of this indirection:

1. **`ParamRef.refs` itself** — the SQL builder calls `forColumn` to derive refs at build time; the runtime calls `forColumn` again at encode time *using* those refs. Two lookups, one fact.
2. **`alias-resolver.ts`** — exists because `refs.table` points at a *query-local alias* (`p1`, `p2`) for self-joins, not the contract table. The alias resolver maps aliases back to source table names so `forColumn` can hit. Pure workaround for refs being a lossy proxy.
3. **The codec-id consistency check** in `resolveParamCodec` (`if (byColumn.id === metadata.codecId)`) — papers over cases where ORM heuristics (`refsFromLeft` lifting refs out of an `OperationExpr`) attach refs whose codec id disagrees with the column's. Exists only because refs and codec identity are stored separately.
4. **`ambiguousCodecIds` set** + **`forCodecId` fallback** — refs-less ParamRefs hit `forCodecId(codecId)` which scans `byCodecId`. When two columns share a parameterized codec id with distinct typeParams (`vector(1024)` and `vector(1536)`), the codec-id-keyed lookup is ambiguous and must reject. Doesn't exist if dispatch is content-keyed.
5. **`parameterizedRepresentatives` map + `factory(undefined as unknown as VectorParams)` representative-codec hack** — synthesizes a "representative" parameterized codec for refs-less fallback by passing `undefined` to a factory whose signature requires real params. Works today only because pgvector's wire format happens to be dimension-independent. Any future parameterized codec whose wire depends on its params would silently produce malformed wire values.
6. **`PgVectorDescriptor.factory` lying about its signature** — declared `factory(params: VectorParams)` but reads `(params as VectorParams | undefined)?.length` defensively because the runtime calls it with no params (point 5).
7. **`factory.bind(descriptor)`** — `this`-binding workaround at two call sites because descriptors are pulled out of the registry and called free of `this` context.

Plus the AST-validity backstop:

8. **`validateParamRefRefs`** — runtime pass that rejects refs-less `ParamRef`s targeting parameterized codec ids. Enforces what the type system can't because `refs?:` is structurally optional. Doesn't exist if `codec: CodecRef` is the single fact and the type system rejects parameterized-codec construction without typeParams at the build-site call.

All eight share one root cause. Recording `(codecId, typeParams)` directly on the AST node is the structural fix; the heuristics dissolve.

## Glossary

| Term | Meaning |
|---|---|
| **`CodecRef`** | Serializable `(codecId, typeParams?)` pair carried by every codec-bearing AST node. Replaces `codecId + refs` on `ParamRef` and `ProjectionItem`. Lives in `framework-components/codec` (family-agnostic). |
| **`canonicalizeJson(value)`** | Sorted-keys recursive `JSON.stringify`. Today at `packages/1-framework/3-tooling/migration/src/canonicalize-json.ts`; lifted to `framework-components/utils` for runtime use. |
| **Content-keyed cache (`byCodecRef`)** | Map keyed by `${codecId}:${canonicalizeJson(typeParams)}` → `Codec`. Replaces `byCodecId`, `parameterizedRepresentatives`, and the `ambiguousCodecIds` discriminator. Pre-populated from the contract walk; grows lazily for AST-supplied refs not seen at contract-load time. |
| **`forColumn(table, column)`** | Survives. Build-time helper for the SQL builder to look up the canonical `CodecRef` for a contract column (added: `codecRefForColumn`). Runtime convenience wrapper `forColumn(table, column) → Codec` continues to work, internally `forCodecRef(codecRefForColumn(...))`. |
| **`forCodecId`** | Retires entirely. Content-keyed lookup is the only dispatch path. Codecs without typeParams (non-parameterized) key as `${codecId}:undefined` → one shared instance. |
| **`AstCodecResolver`** | Per-`ExecutionContext` resolver. Wraps `descriptorFor(codecId).factory(typeParams)(ctx)` with content-keyed memoization. Exposes `forCodecRef(ref) → Codec`. |

## Cases that pin the design

### Case V — Vector encode (parameterized; AST-bound)

Builder construction:

```ts
db.sql.document.where(({ embedding }) => embedding.eq([1.2, 3.4, ...]))
```

The builder constructs the `ParamRef` for `[1.2, 3.4, ...]` at the column-bound site. It looks up the `CodecRef` for `Document.embedding` via `descriptors.codecRefForColumn('Document', 'embedding')` → `{ codecId: 'pg/vector@1', typeParams: { length: 1536 } }` and stamps it onto the new node:

```ts
new ParamRef(value, { codec: { codecId: 'pg/vector@1', typeParams: { length: 1536 } } })
```

At encode time, `encodeParam` calls `resolver.forCodecRef(paramRef.codec)`. The resolver hits its `byCodecRef` cache (pre-populated from the contract walk) and returns the canonical `pg/vector@1` codec materialized for `{length: 1536}`. No alias resolution, no `forColumn` lookup, no `forCodecId` fallback, no ambiguity check.

### Case S — Self-join (alias-resolver deletes)

```ts
db.sql.post.as('p1').innerJoin(
  db.sql.post.as('p2'),
  ({ p1, p2 }) => cosineDistance(p1.embedding, p2.embedding).lt(0.5),
)
```

Today: both `ParamRef`s carry `refs: { table: 'p1' or 'p2', column: 'embedding' }`. The runtime alias-resolver maps `p1` → `post`, then `forColumn('post', 'embedding')` resolves the codec. Two indirections.

After: both `ParamRef`s carry `codec: { codecId: 'pg/vector@1', typeParams: { length: 1536 } }` directly (the builder resolved it at construction-time using the *underlying* table reference, not the alias). The `< 0.5` comparison gets `codec: { codecId: 'pg/float8@1' }` from the operation's `returns: ParamSpec`. No alias resolution. `alias-resolver.ts` deletes.

### Case M — In-memory AST is JSON-safe (diagnostics, cache keying)

`CodecRef.typeParams` is structurally `JsonValue`-safe (descriptors register `paramsSchema` that rejects non-JSON-safe values). This is useful for in-memory uses: stable cache keys via `canonicalizeJson`, diagnostic dumps of AST nodes, and in-process round-trips during testing.

It is **not** a license to embed the pre-lowering AST in `ops.json`. `CodecRef` is a build-time concept; the lowerer consumes it during `migration plan` / `migration emit` and the encoded wire value lands in `params[]`. By the time anything reaches `ops.json` for SQL, every parameter is a JSON-safe wire value and no codec metadata appears anywhere. See [ADR 192 § "No compilation at apply time"](../../docs/architecture%20docs/adrs/ADR%20192%20-%20ops.json%20is%20the%20migration%20contract.md) and [ADR 212](../../docs/architecture%20docs/adrs/ADR%20212%20-%20AST-bound%20codec%20resolution.md).

What this case pins:

- `CodecRef.typeParams` MUST be `JsonValue`-safe. Descriptors whose params shape includes non-JSON-safe values (functions, classes, symbols, BigInts, Dates) cannot register. `paramsSchema` enforces this structurally — if it accepts the value at the JSON boundary, the value is JSON-safe by construction.
- The resolver is the canonical in-memory dispatch path. Pre-population via the contract walk warms the cache for the common case; refs not in the contract walk are materialized lazily on first `forCodecRef` call.
- Bringing SQL `ops.json` into structural symmetry with Mongo's typed driver-AST + serializer pattern (so the runner deserializes typed commands instead of trusting a `(sql, params)` literal) is tracked as [TML-2491](https://linear.app/prisma-company/issue/TML-2491). It is independent of this project: this project's CodecRef change does not depend on it, and the post-lowering driver-AST design does not require any change to CodecRef or this project's resolver.

### Case R — Refs-less raw SQL (caller declares codec)

```ts
sql.value(42, pgInt8Codec)            // explicit codec, OK
sql.value(42)                         // hard fail at build time
sql.raw`SELECT * WHERE id = ${42}`    // hard fail at build time
```

Refs-less paths require an explicit codec at the call site. No JS-type-keyed default, no silent fallback, no runtime guessing. The diagnostic at the call site names the value type and points to the family adapter's codec exports for ergonomic resolution. (Default-codec ergonomics are out of scope; tracked as a follow-up.)

What this case pins:

- The build path has no fallback. Every `ParamRef` constructed without an explicit `codec` and without a column-bound resolution either is non-encoding (the codec is genuinely unknown and the param flows through the driver as-is) OR throws at build time. The runtime never *guesses*.
- `forCodecId` retires entirely. There is no codec-id-keyed lookup anywhere in the dispatch path.

## Acceptance criteria

### AC-1. `CodecRef` type and AST node migration

- `CodecRef` interface exists in `framework-components/codec` exports: `{ codecId: string; typeParams?: JsonValue }`.
- `ParamRef` carries `codec: CodecRef | undefined` (replacing `codecId` and `refs`).
- `ProjectionItem` carries `codec: CodecRef | undefined` (replacing `codecId` and `refs`).
- `ParamRefBindingRefs` type deletes from `relational-core/ast`.

### AC-2. Content-keyed resolver

- `AstCodecResolver` interface exposes `forCodecRef(ref: CodecRef): Codec` and is consumed by encode/decode.
- Memoization keyed by `${codecId}:${canonicalizeJson(typeParams)}`. Cache hit returns the same `Codec` reference; cache miss validates `typeParams` via `descriptor.paramsSchema['~standard'].validate(...)` and materializes once.
- `canonicalizeJson` lives at `framework-components/utils/canonicalize-json` (lifted from `migration/src`); `migration` re-imports from the new home.
- The contract walk pre-populates the cache for every column and every `storage.types` entry — first runtime `forCodecRef` for a contract-known ref is a cache hit.
- `byCodecId` Map and `parameterizedRepresentatives` Map delete from `buildContractCodecRegistry`.

### AC-3. `forColumn` survives as build-time helper; runtime dispatch is `CodecRef`-keyed only

- `descriptors.codecRefForColumn(table, column): CodecRef | undefined` — new build-time helper. Derives the canonical `CodecRef` from `contract.storage.tables[table].columns[column]` (resolving `typeRef` to its `storage.types` entry's `typeParams` when present).
- `ContractCodecRegistry.forColumn(table, column): Codec | undefined` — convenience wrapper retained as public API. Internally `forCodecRef(codecRefForColumn(table, column))`. Not consulted by the runtime encode/decode hot path (every AST node carries `codec: CodecRef` directly); preserved for external consumers (debugging tools, custom dispatchers, future ad-hoc lookups).
- **Every codec-bearing AST node — including `column-ref`-expression projections — carries `codec: CodecRef`** populated at build time. The decode path reads `projectionItem.codec` directly; it does not call `forColumn(item.expr.table, item.expr.column)` for column-ref projections. This unifies the decode-side dispatch into a single path: `node.codec → resolver.forCodecRef(node.codec)`.
- The `aliasResolver` parameter and `alias-resolver.ts` module delete (AC-4).

### AC-4. Heuristics deleted

Every artifact below is removed:

- `validateParamRefRefs` and the file `packages/2-sql/4-lanes/relational-core/src/ast/validate-param-refs.ts`.
- `packages/2-sql/5-runtime/src/codecs/alias-resolver.ts` (and its caller in `encoding.ts`).
- The codec-id consistency check (`if (byColumn.id === metadata.codecId)`) in `resolveParamCodec`.
- `ambiguousCodecIds` set and the `RUNTIME.TYPE_PARAMS_INVALID` rejection branch in `forCodecId`.
- `forCodecId` from `ContractCodecRegistry`. (The interface narrows to `forColumn` + `forCodecRef`.)
- `parameterizedRepresentatives` map.
- `factory.bind(descriptor)` at both call sites in `buildContractCodecRegistry`.
- `factory(undefined as unknown as VectorParams)` representative-codec materialization.
- The "representative codec" doc paragraph on `PgVectorDescriptor.factory`.

### AC-5. Honest descriptor signatures

- `PgVectorDescriptor.factory(params: VectorParams)` reads `params.length` directly. The `(params as VectorParams | undefined)?.length` defensive cast deletes.
- `PgVectorCodec.length` narrows from `number | undefined` to `number` (matches the now-honest factory signature).
- The runtime `as unknown as` cast widening void-factory params to `unknown` deletes.
- No descriptor's factory receives `undefined` as an unsigned proxy for "no params known". Non-parameterized factories still receive `undefined` (which matches their `P = void` declared signature); parameterized factories receive validated `P` always.

**Breaking change: undimensioned `vectorColumn` retires.**

The pgvector extension currently exports two column-type helpers from `@internal/extension-pgvector/column-types`:

- `vector(N)` — dimensioned vector with `typeParams: { length: N }`.
- `vectorColumn` — undimensioned vector with no `typeParams`. Today's runtime serves this column shape via the `parameterizedRepresentatives` cache + the `factory(undefined)` representative-codec hack.

Once that hack retires (this AC), an undimensioned `vectorColumn` produces `CodecRef = { codecId: 'pg/vector@1', typeParams: undefined }`; the resolver tries `paramsSchema.validate(undefined)` and throws `RUNTIME.TYPE_PARAMS_INVALID`. There is no honest signature for `factory` that supports both dimensioned and undimensioned use without re-introducing the defensive cast.

**Resolution.** `vectorColumn` is removed in M3a together with the descriptor honesty changes:

- `vectorColumn` deletes from `packages/3-extensions/pgvector/src/exports/column-types.ts`.
- The barrel re-export in `packages/3-extensions/pgvector/src/exports/index.ts` (if any) deletes.
- The `vectorColumn (static)` test block in `packages/3-extensions/pgvector/test/column-types.test.ts` deletes.
- The `factory(undefined)` representative-codec test in `packages/3-extensions/pgvector/test/codecs.test.ts` deletes (the behavior under test is gone).
- The internal consumer in `packages/3-extensions/sql-orm-client/test/fixtures/contract.ts:25` migrates from `field.column(vectorColumn)` to `field.column(vector(1536))`.
- The breaking change is communicated via the conventional-commit `!` marker in the M3a commit subject (e.g. `feat(pgvector)!: ...`) and a complete migration paragraph in the commit body. The repo does not maintain a `CHANGELOG.md` today; the project close-out PR description serves as the breaking-change rollup for the project. No new CHANGELOG file is introduced as part of TML-2456.

This is acceptable scope for TML-2456 because the only usable wire shape is dimension-known (the codec needs `length` to validate `assertVector`); the undimensioned form was a workaround for the representative-codec hack that this project deletes. No other column shape (parameterized-codec-without-params) is shipped in this codebase.

### AC-6. Builder construction sites populate `CodecRef`

Every column-bound `ParamRef` / `ProjectionItem` construction site stamps `codec` from `descriptors.codecRefForColumn(...)`:

- `packages/2-sql/4-lanes/relational-core/src/expression.ts` (`toExpr` helper)
- `packages/2-sql/4-lanes/sql-builder/src/runtime/mutation-impl.ts` (INSERT VALUES / UPDATE SET binding)
- `packages/3-extensions/sql-orm-client/src/query-plan-mutations.ts` (ORM mutation binding)
- `packages/3-extensions/sql-orm-client/src/where-binding.ts` (ORM WHERE binding)
- `packages/3-extensions/sql-orm-client/src/types.ts` (ORM param descriptor construction)
- Any other production site found by grep before milestone M3 starts.

Refs-less call sites (raw SQL, transient builder paths) either accept an explicit `codec: CodecRef` argument or throw at build time naming the value site (no silent fallback).

### AC-7. `CodecRef` does not survive lowering (rescoped)

This AC was originally framed as "ship a `dataTransformAst` op that embeds the serialized AST in `ops.json` and re-lowers at apply time, demonstrating that `CodecRef` survives JSON round-trip". During branch review we identified that framing as a category error: it would have placed compilation (codec resolution + AST lowering) on the apply side of `ops.json`, violating ADR 192's "no compilation at apply time" invariant. See [discussion in ADR 192](../../docs/architecture%20docs/adrs/ADR%20192%20-%20ops.json%20is%20the%20migration%20contract.md) and the rewritten [Case M](#case-m--in-memory-ast-is-json-safe-diagnostics-cache-keying) above.

Rescoped acceptance:

- The lowerer consumes `paramRef.codec` and produces a post-lowering `(sql_template, params[])` where every `params[i]` is a JSON-safe wire value. `CodecRef` does not appear in the lowered output. This is exercised in the existing `dataTransform` op (which lowers eagerly and writes `(sql, params)` into `ops.json`).
- No SQL `ops.json` artifact in the repository contains a `codec`, `codecId`, or `typeParams` field anywhere in its JSON. This is verified by inspection of all committed `ops.json` fixtures plus the regenerated outputs from `pnpm fixtures:emit`. (A cross-cutting invariant test is a follow-up — out of scope for this project; tracked alongside the symmetric driver-AST work in [TML-2491](https://linear.app/prisma-company/issue/TML-2491).)
- The misframing is removed from the codebase: `dataTransformAst`, `parseAnyQueryAst`, the demo migration that exercised them, and the apply-time AST-parse branch in the Postgres migration runner are all deleted in this project.

### AC-8. Validation gates

- `pnpm typecheck`, `pnpm lint:deps`, `pnpm test:packages`, `pnpm test:e2e`, `pnpm test:integration`, `pnpm build`, `pnpm fixtures:check` all green.
- Demo emit byte-identical against `origin/main` baseline. This work changes runtime dispatch and the AST shape; emit-path output (`contract.json` + `contract.d.ts`) is unchanged.
- Real-Postgres e2e tests (where present) pass for vector encode/decode (parameterized via `CodecRef`), JSON-with-schema encode/decode (parameterized via `CodecRef`), and non-parameterized columns.

## Non-functional constraints

- **Zero new type casts** in production code. Removing the runtime triangulation means removing the `as unknown as` casts that mediated it.
- **No backward-compat shims**. The legacy `codecId + refs` shape on `ParamRef` and `ProjectionItem` deletes outright. There is no shipped SQL migration today carrying serialized `ParamRef` data (postgres `dataTransform` lowers to `{sql, params}` before serialization), so no on-disk artifacts need a reader.
- **No `any`, no `@ts-expect-error` outside negative type tests, no `@ts-nocheck`, no biome suppressions.**
- **Demo emit byte-identical** against `origin/main` baseline.
- **Layering**: `CodecRef` and `canonicalizeJson` live in `framework-components`. `AstCodecResolver` lives in `sql-runtime` (consumes `framework-components` + `sql-relational-core`). `pnpm lint:deps` passes throughout.
- **Mongo non-impact**: `mongo-codec/src/codec-registry.ts` is a separate registry independent from SQL's `ContractCodecRegistry`. Removing `forCodecId` from the SQL registry interface does not affect the Mongo path. Mongo's AST-bound migration is TML-2442; this work intentionally lands `CodecRef` in family-agnostic `framework-components/codec` so Mongo can adopt it without redesign.

## Non-goals

- **Default-codec ergonomics for refs-less raw SQL.** Caller is required to declare codecs explicitly. Ergonomic improvements (JS-type defaults on family adapter, `sql.tag` helpers) are out of scope; tracked separately.
- **Mongo family AST-bound codec resolution.** Folded into [TML-2442](https://linear.app/prisma-company/issue/TML-2442) or its own follow-up; structurally compatible because `CodecRef` lives in family-agnostic `framework-components/codec`.
- **`pgEnumCodec` factory audit.** Deferred from TML-2357; separate ticket.
- **Reshape of `CodecDescriptor`, `Codec`, `CodecCallContext`, `CodecInstanceContext`** — all baselines this work composes with (ADRs 207, 208).
- **Op-type / driver-AST reshape for SQL `ops.json`** — the symmetric typed driver-AST + serializer mirroring Mongo is tracked as [TML-2491](https://linear.app/prisma-company/issue/TML-2491) and is independent of CodecRef.

## Project base

Branched from `origin/main` after TML-2357 merges. Single branch (`tml-2456-ast-bound-codec-resolution-replace-paramrefrefscodecid`); milestones land as separate commits within the branch and ship as one PR. Estimated diff ~1500–2500 LoC, deletions outnumbering additions.

If size or sequencing pushes us off one PR, the natural split point is between M4 and M5: M1–M4 are the substitution + heuristic deletion (the core change); M5–M7 are the round-trip op + docs + gates (additive, lower risk). The plan's M3 sub-commit decomposition (M3a/M3b/M3c) keeps the substantive milestone reviewable even within a single PR.

## Outcomes

- One fact about a codec, one location: `paramRef.codec: CodecRef`. Encode/decode is `resolver.forCodecRef(node.codec)`. No triangulation.
- Eight artifacts (the seven heuristics + `validateParamRefRefs`) deleted in one cohesive change.
- The lowerer consumes `paramRef.codec` and produces a JSON-safe `(sql, params)` post-lowering form. CodecRef is a build-time concept; nothing in `ops.json` references codecs.
- `CodecRef` lives in `framework-components`, ready to be consumed by Mongo's parallel work (TML-2442) without redesign.

## Forward-looking work captured but out of scope

- **Default-codec ergonomics** — when raw SQL/`sql.value(...)` calls don't carry explicit codecs, the build fails today (per Case R). Future ergonomics: family adapter advertises a `defaultCodecForJsType` table, builder consults it at the call site, AST records the resolved `CodecRef`. Separate ticket.
- **Mongo AST-bound resolution** — TML-2442 or its own follow-up.
- **Symmetric SQL post-lowering driver-AST + serializer** — bring SQL `ops.json` into structural symmetry with Mongo (typed `kind`-discriminated commands, arktype-validated parser, runner dispatches on rehydrated class instances). Tracked as [TML-2491](https://linear.app/prisma-company/issue/TML-2491). The current SQL `(sql, params)` shape satisfies ADR 192's invariant; this work adds the structural symmetry and the parse-time validation surface.

## References

- [TML-2456](https://linear.app/prisma-company/issue/TML-2456). This project's Linear ticket.
- [TML-2357 — Codec registration completion](../codec-registration-completion/spec.md). Predecessor; introduced the seven heuristics this work dissolves.
- [TML-2229 — Codec registry unification](https://linear.app/prisma-company/issue/TML-2229). Grandparent; established `descriptorFor(codecId)` and the unified read surface.
- [TML-2442 — Mongo parameterized codecs](https://linear.app/prisma-company/issue/TML-2442). Sibling project; consumes `CodecRef` for Mongo family.
- [ADR 208 — Higher-order codecs for parameterized types](../../docs/architecture%20docs/adrs/ADR%20208%20-%20Higher-order%20codecs%20for%20parameterized%20types.md). The codec model this work composes with; defines `factory(params)(ctx)`.
- [ADR 204 — Single-Path Async Codec Runtime](../../docs/architecture%20docs/adrs/ADR%20204%20-%20Single-Path%20Async%20Codec%20Runtime.md). Async `Codec` baseline.
- [ADR 207 — Codec call context per-query AbortSignal and column metadata](../../docs/architecture%20docs/adrs/ADR%20207%20-%20Codec%20call%20context%20per-query%20AbortSignal%20and%20column%20metadata.md). Per-call ctx baseline.
- [ADR 192 — `ops.json` is the migration contract](../../docs/architecture%20docs/adrs/ADR%20192%20-%20ops.json%20is%20the%20migration%20contract.md). Migration serialization contract; relevant to AC-7.

## Open questions

None remaining for spec-time. Implementation-time questions documented per milestone in `plan.md`.
