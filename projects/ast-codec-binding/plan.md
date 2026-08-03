# Plan — AST-bound codec resolution (TML-2456)

> Implementation plan for [`spec.md`](spec.md). Single branch, milestones land as separate commits, ships as one PR. Each commit is independently reviewable; tests precede or accompany implementation.

## Sequencing rationale

The spec calls out two independent dimensions:

1. **Substitution** — `codec: CodecRef` replaces `codecId + refs` on AST nodes; resolver replaces triangulation.
2. **Deletion** — eight heuristic artifacts retire.

The temptation is to do (1) additively first, then (2) as cleanup. Rejected: the additive interim leaves both paths live, which means every consumer site is doing both lookups during the transition, and the deletion PR touches the same files again. Worse, the additive version provides no forcing function — any consumer that still reads the legacy fields silently keeps working, and we discover the omission at PR review time or later.

Instead: **the AST shape change and the heuristic deletion land together at M3**, gated by tests added in M1–M2 that exercise the new resolver against the legacy AST shape. The legacy fields exist only in M1–M2 (so tests can be written against the old shape, then re-pointed at the new shape in M3). This shrinks the "two paths live" window to two commits and forces every consumer site to migrate at M3.

## Milestones

### M1 — `CodecRef`, `canonicalizeJson`, `AstCodecResolver` skeleton

**Scope.** Add the new types and resolver as standalone artifacts; no AST changes, no consumer migration. Pure addition.

**Files added.**

- `packages/1-framework/1-core/framework-components/src/codec-types.ts` — append `CodecRef` interface to existing exports.
- `packages/1-framework/1-core/framework-components/src/utils/canonicalize-json.ts` — lifted from `migration/src/canonicalize-json.ts` (copy verbatim; `migration` re-imports from new home in same commit).
- `packages/2-sql/5-runtime/src/codecs/ast-codec-resolver.ts` — `AstCodecResolver` interface + `createAstCodecResolver` factory. Wraps `descriptorFor(codecId).factory(typeParams)(ctx)` with content-keyed memoization. Constructor takes `CodecDescriptorRegistry` + a `SqlCodecInstanceContext` factory (so callers control `name` / `usedAt` for AST-supplied refs).
- `packages/2-sql/5-runtime/test/ast-codec-resolver.test.ts` — unit tests for the resolver:
  - cache hit returns same `Codec` reference
  - cache miss validates `typeParams` via `paramsSchema['~standard'].validate(...)`
  - invalid `typeParams` throws `RUNTIME.TYPE_PARAMS_INVALID`
  - non-parameterized codec keys as `${codecId}:undefined` and is shared
  - `canonicalizeJson` makes `{a:1, b:2}` and `{b:2, a:1}` cache-equivalent

**Tests precede implementation.**

**Validation gate.**

- `pnpm typecheck` — workspace-wide; M1 touches `framework-components` (foundation; many consumers).
- `pnpm test:packages` — workspace-wide for cross-package safety; M1 adds new exports from `framework-components` that downstream consumers will reference in M2.
- `pnpm lint:deps` — validate no layering violations from `framework-components/utils/canonicalize-json` move and `migration` re-import.

**Acceptance.** All gates green; new types/resolver compile and tests pass; no behavioral changes outside the new files.

### M2 — Pre-populate resolver from contract walk; introduce `codecRefForColumn`

**Scope.** Replace `byColumn` and `byCodecId` Maps in `buildContractCodecRegistry` with a single `byCodecRef` cache pre-populated from the contract walk. `descriptors.codecRefForColumn(table, column)` derives the canonical `CodecRef` from contract storage. `forColumn` becomes a thin wrapper.

**Files changed.**

- `packages/2-sql/5-runtime/src/sql-context.ts` — `buildContractCodecRegistry` augmented (additive on the runtime side; M3c does the collapse):
  - One pass over `storage.tables[].columns[]`: for each column, derive `CodecRef` (resolving `typeRef` to `storage.types[ref].typeParams`); call `resolver.forCodecRef(ref)` to populate the `byCodecRef` cache.
  - `byColumn` (Codec-valued, per-column ctx) **stays unchanged in M2** — collapsing it onto `forCodecRef(byColumn.get(...))` would change per-column ctx semantics that existing tests still assert; M3c does that flip together with deleting the legacy heuristics.
  - `byCodecId`, `parameterizedRepresentatives`, `ambiguousCodecIds`, `forCodecId`, and the codec-id consistency check **all stay in M2** and delete in M3c. M2 is the parallel-surface setup; M3c is the swap.
- `packages/2-sql/4-lanes/relational-core/src/codec-descriptor-registry.ts` — add `codecRefForColumn(table, column): CodecRef | undefined` to `CodecDescriptorRegistry` interface. Implementation walks `contract.storage.tables[].columns[].typeRef`/`typeParams`.
- `packages/2-sql/5-runtime/src/codecs/encoding.ts` — `resolveParamCodec` rewritten to consult resolver. Path narrows to: `if (paramRef.refs) → forColumn(refs.table, refs.column)` (legacy path, M3 deletes). The codec-id consistency check stays in M2 (still needed because legacy AST shape still in play); deletes in M3.
- `packages/2-sql/5-runtime/test/sql-context.codec-context.test.ts` — augment existing tests with `byCodecRef` cache assertions; preserve all current `byColumn`/`forCodecId` assertions (some delete in M3).

**Validation gate.**

- `pnpm typecheck` — workspace-wide; M2 changes the `ContractCodecRegistry` shape (adds `forCodecRef` / `codecRefForColumn`).
- `pnpm test:packages` — workspace-wide; the `sql-context` rewrite is consumer-visible from `sql-orm-client`, `sql-builder`, `pgvector`, `postgres-target`.
- `pnpm lint:deps` — validate that `codecRefForColumn`'s contract walk doesn't introduce a layering violation.

**Acceptance.** All gates green. All existing tests pass. New `codecRefForColumn` and `byCodecRef` cache exercised. The codec-id consistency check still runs (its deletion is M3c).

### M3 — AST shape change + heuristic deletion (the core change)

**Scope.** This is the substantive milestone. AST nodes get `codec: CodecRef | undefined`; eight heuristics retire; every builder site migrates. **Lands as three sub-commits** within M3 for review tractability:

- **M3a** — Descriptor honesty + `vectorColumn` retirement (AC-5):
  - `PgVectorDescriptor.factory(params: VectorParams)` reads `params.length` directly; defensive `(params as VectorParams | undefined)?.length` cast deletes.
  - `PgVectorCodec.length` narrows from `number | undefined` to `number`.
  - **Public API breaking change**: `vectorColumn` (undimensioned) deletes from `packages/3-extensions/pgvector/src/exports/column-types.ts` (and from the `column-types` barrel re-export if any). The undimensioned form has no honest representation under `forCodecRef` once the representative-codec hack retires (`forCodecRef({ codecId: 'pg/vector@1', typeParams: undefined })` would throw `RUNTIME.TYPE_PARAMS_INVALID`). Users migrate to `vector(N)`.
  - Internal consumer migration: `packages/3-extensions/sql-orm-client/test/fixtures/contract.ts:25` switches from `field.column(vectorColumn).optional()` to `field.column(vector(1536)).optional()`.
  - Test deletions: the `vectorColumn (static)` describe block in `packages/3-extensions/pgvector/test/column-types.test.ts` deletes; the `factory(undefined)` representative-codec test in `packages/3-extensions/pgvector/test/codecs.test.ts` deletes (behavior under test is gone in M3c; M3a removes its sole consumer).
  - Breaking change communicated via the conventional-commit `!` marker on the M3a commit subject + migration paragraph in the commit body. Repo has no `CHANGELOG.md` convention; the close-out PR description rolls up the breaking change.
  - Reviewable as a standalone descriptor cleanup; the rest of the pgvector path keeps passing because the runtime still calls `factory({length})` with real params (the representative-codec call site goes away in M3c).
- **M3b** — AST shape + builder migration: `ParamRef` and `ProjectionItem` carry `codec: CodecRef | undefined`; legacy `codecId`/`refs` fields delete in the same commit; every builder construction site migrates. Atomic by necessity — partial migration would leave the AST in a half-shape state. Includes the column-ref ProjectionItem stamping change (every column-bound projection populates `codec`, including bare `column-ref` expressions).
- **M3c** — Heuristic deletion: `validateParamRefRefs`, `alias-resolver.ts`, codec-id consistency check, `byCodecId`, `parameterizedRepresentatives`, `ambiguousCodecIds`, `forCodecId`, `factory.bind(descriptor)` all delete. The encode/decode dispatch collapses to `resolver.forCodecRef(node.codec)`.

**Tests precede implementation.** Before changing AST shape, augment AST tests in `packages/2-sql/4-lanes/relational-core/test/ast.test.ts` with `codec: CodecRef` shape assertions; rewrite `validate-param-refs.test.ts` to a deletion-marker test (asserts the file is gone after M3).

**Files changed.**

AST + builder layer (relational-core, sql-builder):

- `packages/2-sql/4-lanes/relational-core/src/ast/types.ts`:
  - `ParamRef`: replace `codecId?` and `refs?` with `codec?: CodecRef`. Update `static of`, constructor, `rewrite`, `fold`.
  - `ProjectionItem`: replace `codecId?` and `refs?` with `codec?: CodecRef`. Update `static of`, `withCodecId` (renamed `withCodec`), `rewrite` paths.
  - `ParamRefBindingRefs` interface deleted.
- `packages/2-sql/4-lanes/relational-core/src/ast/validate-param-refs.ts` — **deleted**.
- `packages/2-sql/4-lanes/relational-core/src/ast/util.ts` — `collectOrderedParamRefs` callers now read `codec?.codecId` instead of `codecId`.
- `packages/2-sql/4-lanes/relational-core/src/expression.ts` — `toExpr` helper: when column-bound, populate `codec` from `descriptors.codecRefForColumn(...)` instead of `refs`.
- `packages/2-sql/4-lanes/sql-builder/src/runtime/mutation-impl.ts` — INSERT VALUES / UPDATE SET binding sites populate `codec`.

ORM layer:

- `packages/3-extensions/sql-orm-client/src/query-plan-mutations.ts` — populate `codec` at mutation binding sites.
- `packages/3-extensions/sql-orm-client/src/where-binding.ts` — populate `codec` at WHERE binding.
- `packages/3-extensions/sql-orm-client/src/types.ts` — ORM param descriptor construction populates `codec`.

Runtime layer (the heuristic deletion):

- `packages/2-sql/5-runtime/src/codecs/encoding.ts`:
  - `resolveParamCodec` rewritten to single `if (paramRef.codec) return resolver.forCodecRef(paramRef.codec)`. Codec-id consistency check deleted. Alias-resolver call deleted.
  - `ParamMetadata.refs` field deleted (now `codec?: CodecRef`).
- `packages/2-sql/5-runtime/src/codecs/decoding.ts` — analogous changes for projection-side dispatch (read `projectionItem.codec` directly).
- `packages/2-sql/5-runtime/src/codecs/alias-resolver.ts` — **deleted**.
- `packages/2-sql/5-runtime/src/sql-context.ts` — `buildContractCodecRegistry`:
  - `byCodecId` Map deleted.
  - `parameterizedRepresentatives` Map deleted.
  - `ambiguousCodecIds` Set deleted.
  - `forCodecId` method removed from returned `ContractCodecRegistry` interface; interface narrows to `forColumn` + `forCodecRef`.
  - `factory.bind(descriptor)` calls deleted (descriptors are called as methods, not detached).
  - `factory(undefined as unknown as ...)` representative-codec materialization deleted.
- `packages/2-sql/4-lanes/relational-core/src/ast/codec-types.ts`:
  - `ContractCodecRegistry` interface narrows: `forCodecId` removed; `forCodecRef` added.

Descriptor-side honesty (AC-5):

- `packages/3-extensions/pgvector/src/core/codecs.ts`:
  - `PgVectorDescriptor.factory(params: VectorParams)` reads `params.length` directly. Defensive `(params as VectorParams | undefined)?.length` cast deleted.
  - `PgVectorCodec.length` field type narrows from `number | undefined` to `number` (matches the now-honest signature).
  - "Representative codec" doc paragraph deleted.

**Tests.**

- Update every `ParamRef.of(value, { codecId, refs })` test-site to `ParamRef.of(value, { codec: { codecId, typeParams } })`.
- Augment `packages/2-sql/5-runtime/test/sql-context.codec-context.test.ts`: assert `forCodecId` removed from registry; assert content-keyed dispatch.
- Add tests for self-join case (Case S in spec): two `ParamRef`s in a self-join carry identical `CodecRef`s; encode produces one resolver lookup per ref, no alias resolution.

**Validation gate (per sub-commit).**

- **M3a gate**: `pnpm typecheck` (workspace — mandatory because M3a deletes a public export `vectorColumn` from `@internal/extension-pgvector/column-types`; package-scoped typecheck cannot catch downstream consumers in other workspace packages), `pnpm --filter @internal/extension-pgvector test`, `pnpm --filter @internal/sql-orm-client test`, `pnpm --filter @internal/extension-pgvector build`, `pnpm lint:deps`. Cross-package grep before declaring M3a done: `rg 'vectorColumn'` across `packages/`, `test/`, and `examples/` — any production hit (non-doc, non-history) is a regression.
- **M3b gate**: `pnpm typecheck` (workspace), `pnpm test:packages` (workspace), `pnpm lint:deps`, `pnpm build`. M3b changes the AST shape consumer-visible everywhere; the workspace gate is mandatory.
- **M3c gate**: `pnpm typecheck`, `pnpm test:packages`, `pnpm test:integration`, `pnpm test:e2e`, `pnpm lint:deps`, `pnpm fixtures:check`. M3c retires public exports (`forCodecId`, `parameterizedRepresentatives`, `validateParamRefRefs`, `alias-resolver.ts`); the cross-package + integration + e2e gate is mandatory per the SKILL § cross-package gates rule.

Cross-package grep before declaring M3c done: `rg 'forCodecId|parameterizedRepresentatives|ambiguousCodecIds|validateParamRefRefs|alias-resolver' packages/ examples/` — any production hit is a regression.

**Acceptance.** All gates green per sub-commit. Demo emit byte-identical against `origin/main` baseline. Real-Postgres e2e (vector encode/decode) green at M3c.

### M4 — Refs-less raw SQL hard fail

**Scope.** Tighten the build path: refs-less `ParamRef` construction without an explicit `codec` argument throws at build time naming the value site.

**Files changed.**

- `packages/2-sql/4-lanes/sql-builder/src/...` — wherever `sql.value(value)` and `sql.raw\`...${value}\`` construct `ParamRef`s, validate that `codec` is supplied (or the construction site can derive one from a column-bound context).
- New diagnostic: `runtimeError('RUNTIME.PARAM_REF_CODEC_REQUIRED', ...)`. (No `BUILD.*` error namespace exists in the codebase today; sql-builder errors use bare `throw new Error(...)` or `runtimeError(...)`. We pick `runtimeError` for the structured envelope; the diagnostic message names the value site and the JS type.)
- Tests: `packages/2-sql/4-lanes/sql-builder/test/raw-sql-codec-required.test.ts` — explicit codec passes, missing codec throws.

**Validation gate.**

- `pnpm typecheck` (workspace) — M4 adds a new error code used by the sql-builder; workspace check ensures no downstream breakage.
- `pnpm test:packages` (workspace) — raw-SQL tests exist across sql-builder + sql-runtime + sql-orm-client.
- `pnpm lint:deps`

**Acceptance.** All gates green. Existing tests of raw-SQL paths that relied on silent fallback either pass an explicit codec or the test's intent moves to a different surface.

### M5 — Retired (originally `dataTransformAst` op + round-trip fixture)

**Outcome.** Implemented during execution, then **removed in a follow-up commit** after branch review identified the design as a category error. The intended round-trip property — "`CodecRef` survives JSON serialization" — was conflated with an apply-time use case ("re-lower the AST when the migration applies") that violates ADR 192's "no compilation at apply time" invariant. The right shape for SQL post-lowering serialization is a typed driver-AST mirroring Mongo's pattern; that is tracked separately as [TML-2491](https://linear.app/prisma-company/issue/TML-2491) and is independent of CodecRef.

**Removed in close-out.**

- `packages/2-sql/4-lanes/relational-core/src/ast/parse.ts` and its unit test.
- `packages/3-targets/3-targets/postgres/src/core/migrations/operations/data-transform-ast.ts` and its `AST_BOUND_SENTINEL` re-export.
- `packages/3-targets/3-targets/postgres/src/core/migrations/postgres-migration.ts` `dataTransformAst` instance method.
- `runner.ts` `resolveStep` AST-bound branch and the `destinationContract` parameter threading on `runExecuteSteps` / `runExpectationSteps` / `expectationsAreSatisfied`.
- The `examples/prisma-8-demo/migrations/app/20260511T1800_vector-backfill-ast/` demo directory.
- `packages/3-targets/6-adapters/postgres/test/migrations/data-transform-ast.test.ts` and `runner.ast-steps.integration.test.ts`.

**Documented in close-out.**

- ADR 192 — explicit "no compilation at apply time" invariant, target-agnostic, with an Alternatives entry covering the rejected pre-lowering-AST design.
- ADR 028 — the same invariant repeated under § Operation resolution.
- ADR 212 — strike the AST-embedding-in-ops.json paragraph; replace with "CodecRef is a build-time concept; never appears in ops.json".
- `packages/1-framework/3-tooling/migration/README.md` — new "What ops.json does NOT contain" section.

**Lesson recorded.** When proposing AST serialization for any layer, categorise the AST first: pre-lowering (build-time concept; carries codec refs and other compile-time facts) vs post-lowering (apply-time concept; carries wire-format values). ADR 192's "no compilation at apply time" invariant means only post-lowering ASTs may appear in `ops.json`; pre-lowering ASTs stay on the runtime/build side of the boundary. The dual-target instinct ("Mongo serializes AST, why doesn't SQL?") is correct, but the AST in question is the post-lowering driver AST, not the pre-lowering relational AST.

### M6 — Documentation

**Scope.** Update ADR 208 + related docs to reflect AST-bound resolution; no code changes.

**Files changed.**

- **New ADR** — assign next free number (find by `ls "docs/architecture docs/adrs/" | sort` at commit time; today the highest is 211). Title: "AST-bound codec resolution". Single-page; documents the eight-heuristic dissolution as structural justification; references ADR 208 (codec model — composes with), ADR 192 (`ops.json` migration contract — round-trip relevance), ADR 207 (call context — composes with). Adds itself to the Resolves-section of ADR 208's `ParamRef.refs` trade-off paragraph.
- `docs/architecture docs/adrs/ADR 208 - Higher-order codecs for parameterized types.md` — amend "How it composes § 4. Runtime materialization and dispatch" to describe `byCodecRef` content-keyed cache and `AstCodecResolver`. Update "Consequences § Trade-offs" to note `forCodecId` retired and the structural reasons (refs is the wrong fact); link forward to the new ADR. Mark `ParamRef.refs`-related paragraphs superseded with retrospective note pointing to the new ADR.
- `packages/2-sql/4-lanes/relational-core/DEVELOPING.md` — create if missing; document the `CodecRef` invariant for AST authors: every codec-bearing AST node carries `codec: CodecRef | undefined`; refs-less raw-SQL paths require explicit codec at call site.

**Acceptance.** Docs reflect the implemented behavior.

### M7 — Validation gates + final sweep

**Scope.** Run all gates; fix any holdouts; close-out.

- `pnpm typecheck` — green.
- `pnpm lint:deps` — green (verify no layering violations from `framework-components/utils/canonicalize-json` move).
- `pnpm test:packages` — green.
- `pnpm test:e2e` — green.
- `pnpm test:integration` — green.
- `pnpm fixtures:check` — green; demo emit byte-identical against `origin/main`.
- `pnpm build` — green.
- Grep sweep for stale references: `validateParamRefRefs`, `forCodecId`, `alias-resolver`, `ambiguousCodecIds`, `parameterizedRepresentatives`, `ParamRefBindingRefs`, `byCodecId`, `factory.bind(descriptor)` — all zero.
- Linear ticket closes via PR merge integration (PR title or branch contains `tml-2456` so Linear's GitHub integration auto-transitions).

## Risks and open questions per milestone

### M1

- **Q.** Should `canonicalizeJson` move to `framework-components/utils` or live in a smaller new package? **A.** Move to `framework-components/utils`. Migration's existing import becomes a re-export from the new home; `pnpm lint:deps` validates layering (migration depends on framework-components already).

### M2

- **R.** `byCodecRef` cache pre-population now does N descriptor materializations where N = total columns + storage.types entries. Today it's roughly the same N, just split across two maps. Net-zero overhead. **Mitigation.** Benchmark `createExecutionContext` time on the demo contract pre/post-M2.

### M3

- **R.** The "two paths live in M2, both die at M3" approach means the M3 milestone is large. **Mitigation.** Sub-commits M3a/M3b/M3c (specified above). Each sub-commit reviewable independently; M3a is a pure cleanup, M3b is the atomic shape change, M3c is pure deletion.
- **Q.** When `ParamRef.codec` is `undefined`, what does `resolveParamCodec` return? **A.** `undefined` (param flows through driver as-is). Same as today's behavior when both `codecId` and `refs` were undefined.
- **Q.** Column-ref ProjectionItem stamping: today `column-ref` projections leave `refs` undefined and decode reads `forColumn(item.expr.table, item.expr.column)`. After M3, do we stamp `codec` on these projections too? **A.** Yes (per spec AC-3 clarification). Every codec-bearing ProjectionItem carries `codec: CodecRef`; the decode path has one read shape (`item.codec → forCodecRef`). The marginal builder cost is one cache-hit lookup per projection item; the win is single-path decode.

### M4

- **R.** Existing tests may be using raw `sql.value(...)` without codec, relying on silent fallback. **Mitigation.** Grep first; either supply explicit codec or refactor test to use a column-bound builder path.

### M5 (retired)

The questions and risks below were resolved during the M5 implementation phase, but the milestone itself was retired during branch review (see § M5 retirement above and [TML-2491](https://linear.app/prisma-company/issue/TML-2491) for the correct successor design). Kept here for historical context.

- **Realization.** "Embed the pre-lowering AST in `ops.json` and re-lower at apply time" is the wrong layer. The right shape for SQL is a **post-lowering** typed driver-AST mirroring Mongo's pattern — kind-discriminated commands, arktype-validated parser, runner dispatches on rehydrated class instances. Codec resolution belongs on the emit side; `ops.json` carries only post-lowering wire shape.
- **Q.** Does the retired `dataTransformAst` participate in invariant-aware routing? **A.** Moot — the op was deleted during close-out. The retained `dataTransform` op (which lowers eagerly) carries `invariantId?` and routes correctly.

### M6

- **Decision.** New ADR (next free number, currently 212+). The change is structural enough (AST carries codec identity; runtime dispatch dissolves) to warrant its own decision record. ADR 208 stays the codec-model authority; new ADR supersedes the dispatch-side details only.

## PR sizing check

Estimated diff:

- M1: +200 LoC (mostly tests)
- M2: +100/-150 LoC (cache reshape)
- M3: +400/-700 LoC (the substantive change; deletions outnumber additions)
- M4: +50/-100 LoC
- M5: +300 LoC (new op + fixture + tests)
- M6: +150 LoC (docs)
- M7: cleanup, near-zero LoC

Total: ~1200/-950 LoC, ~2150 LoC of churn. Comfortably one PR. If review feedback demands a split, the natural cut is between M4 and M5: M1–M4 are the substitution+deletion (the core change); M5–M7 are the round-trip op + docs (additive, lower risk).

## Out of scope (re-stating from spec)

- Default-codec ergonomics for refs-less paths
- Mongo family AST-bound resolution (TML-2442)
- `pgEnumCodec` factory audit
- Reshaping `CodecDescriptor`, `Codec`, `CodecCallContext`, `CodecInstanceContext`
- Symmetric SQL post-lowering driver-AST + serializer (TML-2491)
