# Slice: SQL JSON projection AST foundations

_(Parent project: `projects/codec-json-projections/`. This slice gives target descriptors and ORM planning a target-neutral, type-safe AST vocabulary without changing existing query results.)_

## At a glance

Replace bare JSON object/array values with an explicit frozen projection algebra—codec, native scalar, or JSON document—and add the function/cast/case/function-source vocabulary needed to express target projections compositionally. Existing JSON-producing call sites become explicit `NativeJsonValueProjection`s and continue rendering byte-equivalent SQL; executable codec/document transformations remain later slices.

## Chosen design

### JSON value projection algebra

The relational AST exports one class/visitor union:

```ts
interface JsonValueProjectionVisitor<R> {
  codec(projection: CodecJsonValueProjection): R;
  native(projection: NativeJsonValueProjection): R;
  document(projection: JsonDocumentProjection): R;
}

class CodecJsonValueProjection {
  readonly kind = 'codec';
  constructor(readonly value: ProjectionExpr, readonly codec: CodecRef) {}
}

class NativeJsonValueProjection {
  readonly kind = 'native';
  constructor(readonly value: ProjectionExpr) {}
}

class JsonDocumentProjection {
  readonly kind = 'document';
  constructor(readonly value: ProjectionExpr) {}
}

type AnyJsonValueProjection =
  | CodecJsonValueProjection
  | NativeJsonValueProjection
  | JsonDocumentProjection;
```

The exact abstract-base visibility and helper method names follow the repository's established AST conventions, but these semantics are fixed:

- Concrete variants are exported frozen classes with `accept(visitor)`; the abstract base is not the consumer type.
- Every variant owns one `ProjectionExpr`; the codec variant also owns a defensively copied/frozen `CodecRef`, including `typeParams` and `many`.
- Rewriting reconstructs the same concrete variant around the rewritten expression and preserves codec metadata; folding reaches the wrapped expression.
- No plain-object variant, raw JavaScript `JsonValue` variant, or shallow-spread reconstruction is introduced.

`JsonObjectExpr` entries remain keyed records, but their value is `AnyJsonValueProjection`. `JsonArrayAggExpr` owns `AnyJsonValueProjection` as its element projection. Existing constructors and every current ORM/test call site must choose `new NativeJsonValueProjection(expression)` explicitly; there is no overload that silently wraps a bare expression as native.

PostgreSQL and SQLite renderers dispatch projections through `JsonValueProjectionVisitor`. During this foundation slice all three new variants are structural pass-throughs that render their wrapped expression exactly as current JSON constructors do, and no production planner constructs codec/document variants yet. TML-3063 replaces those transitional visitor arms with target-owned codec/document behavior after target registries exist. Existing queries therefore retain byte-equivalent SQL while all future projection sites must carry explicit intent.

### Typed expression vocabulary

The same AST family gains frozen expression classes for the compositions already selected by the project design:

- `FunctionCallExpr`: function name plus frozen argument list; rewrites/folds every argument and renders as a scalar function call.
- `CastExpr`: wrapped expression plus target-owned SQL type spelling; rewrites/folds the expression and renders standard `CAST(value AS type)` syntax.
- `CaseExpr`: one or more searched `WHEN condition THEN value` branches plus an optional `ELSE`; branches and expressions are defensively frozen, rewritten, folded, and rendered compositionally.

Each class joins `AnyExpression`, `ExprVisitor`, exhaustive expression switches, rewrite/fold/column/parameter collection, atomic-expression classification where semantically appropriate, public exports, kind-discriminant tests, and both target renderers. This slice adds only searched CASE; simple `CASE value WHEN …` is out of scope because the selected projection algorithms do not need it.

### Function source aliases and ordinality

`FunctionSource` retains its current `of(fn, args, alias?)` construction compatibility and gains immutable configuration for returned-column aliases and `WITH ORDINALITY`. The model enforces that returned-column aliases require a table alias and preserves argument rewriting/folding/parameter collection.

PostgreSQL renders the compositional shape needed by array lifting:

```sql
unnest(input) WITH ORDINALITY AS "u"("element", "ord")
```

SQLite preserves all existing function-source rendering and fails clearly if asked to render PostgreSQL-only ordinality or returned-column-alias syntax it cannot support. This slice does not build the array-lifting subquery itself.

### Authoritative `ProjectionItem.codec`

`ProjectionItem.codec` is documented and tested as the codec of any known projected result, not only a direct contract column. Generic AST rewrites already preserve it; every SQL ORM projection wrapper is audited, and `wrapWithRowNumberDedup` forwards the codec when projecting a ranked derived-table value. Tests use a parameterized/many codec ref so shallow or partial preservation cannot pass accidentally.

### Typesafety on touched production files

No new bare `as` casts are permitted. Existing bare casts encountered in production files touched by this slice are eliminated through narrowing, `satisfies`, `castAs`, or a narrowly reasoned `blindCast` only after the `no-bare-casts` decision tree. Tests remain exempt.

## Coherence rationale

This is one reviewable AST-foundation PR: it introduces the complete target-neutral vocabulary, migrates every current consumer to explicit native intent, proves both target renderers preserve existing SQL, and closes the known projection-codec rewrite gap. Splitting any of these across PRs would either ship an unconsumed algebra, leave exhaustive consumers uncompilable, or make later target descriptor work depend on an incomplete AST contract; executable target codec behavior remains a separate coherent hard-cut slice.

## Scope

**In:** relational-core JSON projection classes/visitor and JSON object/array integration; function-call, cast, searched-case expression nodes; function-source returned-column aliases and ordinality; expression/source rewrite, fold, visitor, collection, kind, export, and freezing behavior; PostgreSQL/SQLite rendering and adapter tests for the new vocabulary; explicit native wrappers at existing call sites; `ProjectionItem.codec` semantic documentation and preservation through SQL ORM row-number dedup; conversion of bare production casts in touched files; package and cross-package validation.

**Out:** PostgreSQL/SQLite codec descriptor subclasses, factories, helpers, and registries (TML-3061); descriptor lookup or execution from `CodecJsonValueProjection`; target-specific codec/document transforms, canonical codec JSON changes, array-lift construction, and metadata removal (TML-3063); aggregate descriptors, `aggregateTypes`, aggregate result decoding, public testkits, fixtures, upgrade instructions, and long-lived ADR/docs (TML-3064); a complete SQL grammar; simple CASE; SQLite stored scalar arrays; any hardcoded codec IDs or target branches in target-neutral planners.

## Pre-investigated edge cases

| Edge case | Disposition | Notes |
|---|---|---|
| Class identity lost by object spreading | Construct every projection variant through its class in constructors and rewrites; never spread a node into an entry. | The current `JsonObjectExpr` freezes entry records with `{ ...entry }`; only the keyed record may remain plain, never the projection node itself. |
| Implicit native fallback hides missing intent | Bare-expression JSON constructors are removed rather than overloaded; all current call sites migrate explicitly to `NativeJsonValueProjection`. | TypeScript must identify every existing producer during migration. |
| Codec metadata mutates after construction | Defensively clone/freeze the codec ref and nested `typeParams`; preserve `many`. | Mirror `ProjectionItem`/`ParamRef` integrity behavior and test caller mutation. |
| Projection variant disappears during rewrite | Rewrites reconstruct the same concrete projection kind and preserve codec identity. | Test all three variants through JSON object and array rewrite/fold paths. |
| Function-source ordinality syntax is target-specific | PostgreSQL renders it; SQLite rejects the unsupported new configuration rather than emitting invalid SQL. | Existing SQLite function-source SQL remains unchanged. |
| Existing prototype stash is repository-global | Implementers and reviewers must not run `git stash`, `git stash pop`, `git stash drop`, or `git stash clear`; base verification uses a temporary worktree if needed. | Preserves the named PostgreSQL numeric evidence stash per failure mode F22. |
| Touched renderers contain existing bare casts | Convert on contact without broad unrelated cleanup. | The no-bare-casts skill applies to production files. |

## Slice-specific done conditions

- [ ] Every JSON object/array construction site compiles only after choosing an explicit projection variant, and every pre-existing rendering assertion remains byte-equivalent under `NativeJsonValueProjection`.
- [ ] The three JSON projection classes and the new expression/source nodes are frozen, exhaustively visited, deeply rewritten/folded, publicly exported, and covered by relational-core plus both target-renderer tests.
- [ ] `wrapWithRowNumberDedup` and every other audited projection wrapper preserve the full `ProjectionItem.codec`; a regression test fails if the codec is dropped.
- [ ] No target descriptor/registry, codec ID branch, codec JSON behavior change, metadata removal, aggregate behavior, fixture change, or prototype implementation hunk enters the diff.
- [ ] Package lint/tests/typechecks, relational-core build followed by downstream typechecks, workspace `pnpm typecheck`, `pnpm test:packages`, and `pnpm lint:deps` pass on the final rebased head.

## Open Questions

None at slice-design altitude. Internal helper names and whether rendering visitors are module-level objects or small functions remain negotiable implementation details as long as the class/visitor semantics, explicit native migration, transitional pass-through behavior, and public AST shape above hold. A need for a fourth projection kind, simple CASE, or raw-SQL built-in path is a stop condition and returns to design discussion.

## References

- Parent project spec: [`../../spec.md`](../../spec.md)
- Project design: [`../../design-notes.md`](../../design-notes.md)
- Project plan: [`../../plan.md`](../../plan.md)
- Linear issue: [TML-3062](https://linear.app/prisma-company/issue/TML-3062/sql-json-projection-ast-foundations)
- Planning PR: [#1013](https://github.com/prisma/prisma-next/pull/1013)
- AST class/visitor rule: `.agents/skills/ast-visitor-pattern/SKILL.md`
- Cast rule: `.agents/skills/no-bare-casts/SKILL.md`
- Relevant failure modes: `drive/calibration/failure-modes.md` F3, F4, F5, F14, F20, F22, F26
