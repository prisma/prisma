# Brief: D8 — address PR #891 review round 2 (engine simplification)

> Fresh implementer. On the slice-1 PR branch `tml-2956-typed-attribute-parsers`. These are the operator's (and CodeRabbit's) **unresolved** review comments — all to be addressed. The 509-test psl-parser suite + the SQL suites are your safety net; keep them green and update them where the reshape demands. Do NOT push or touch GitHub.

## Context
- Engine + types: `packages/1-framework/2-authoring/psl-parser/src/attribute-spec/` — `interpret.ts`, `types.ts`, `optional.ts`, `combinators/one-of.ts`. Tests under the package's `test/`.
- The SQL `@relation` consumer: `packages/2-sql/2-authoring/contract-psl/src/psl-relation-resolution.ts` (the `sqlRelation` spec + `interpretRelationAttribute` wrapper) and its call sites in `interpreter.ts`.
- Parity bar (operator-amended): contract output + diagnostic **codes** identical; **spans** no-coarser; **messages** may change.

## Tasks

### T1 — Single-pass engine (`interpret.ts`) — operator's main note
The engine currently does one pass over positional args, one over named args, then a third `resolveKey` merge pass. Rewrite `interpretAttribute` as **a single pass that builds one output map and reports duplicates as it goes**:
- Walk the attribute's args in source order. A positional arg binds to the next unconsumed positional slot's `key`; a named arg binds to its `key`.
- Maintain one `output` map + a `seen` set. If a key is already `seen` when you go to set it (whether from positional-then-named alias, or a repeated named key), emit the duplicate/conflict diagnostic **inline** and skip — this subsumes the old alias-conflict and duplicate-named handling (already operator-confirmed: reject duplicates regardless of value equality).
- Unknown named key → diagnostic; excess positional (no slot left) → diagnostic.
- After the pass: apply `optional` defaults for absent keys; emit missing-required diagnostics; then run `refine`.
- Delete the now-dead `positionalParsed`/`namedParsed`/`resolveKey` machinery. The behaviour (codes, spans, the set of diagnostics for each error path) must stay within the parity bar; keep all engine + relation tests green.

### T2 — Reuse shared type helpers (`types.ts:8,10`)
`Simplify` and `UnionToIntersection` are redefined locally but exist in ~7 places across the repo with no canonical home. **Centralize** them in `@internal/utils` (psl-parser already depends on it — add a small `types` module/export there, e.g. `@internal/utils/types`) and import them in `attribute-spec/types.ts`; do not keep the local redefinitions. Scope: just centralize + import here — do NOT migrate the other 6 copies (out of scope; note as a possible future cleanup). If `@internal/utils` is the wrong home per `lint:deps` layering, surface the finding rather than forcing a bad dependency.

### T3 — Remove variadic positional support (`types.ts:85`)
No attribute uses a variadic positional (`@@index([a,b])` is a single positional bound to a `list`, not a variadic; `@@base(Base, "v")` is two fixed positionals). Remove `PositionalParam.variadic`, the variadic branch in `PosEntryObject`/`PosOut`, and the engine's variadic handling. YAGNI — re-add only when a real variadic attribute appears.

### T4 — `optional` is an `ArgType` (`optional.ts:8`)
Model `optional(t)` as an `ArgType`, not a separate `OptionalParam`/`Param` union member. Target shape: an `OptionalArgType<T> extends ArgType<T>` carrying `{ optional: true; hasDefault: boolean; defaultValue?: T }`, so `Param<T>` collapses to just `ArgType<T>` (an optional param is a flavoured `ArgType`). The engine detects optionality via the marker on the `ArgType`; `NamedOut`/`PosOut` key their optional-property mapping off `OptionalArgType` instead of `OptionalParam`. Keep `optional(t)` / `optional(t, default)` call-shape and inferred types unchanged for consumers (`sqlRelation` must still type-check identically and infer the same output union).

### T5 — Remove the `map`→`constraintName` rename wrapper (`psl-relation-resolution.ts:217`)
`interpretRelationAttribute`'s output mapping only renames `name`→`relationName` and `map`→`constraintName`. Remove that renaming layer and consume `interpretAttribute`'s result **directly**: align the downstream shape with the spec output keys (`name`, `map`, `fields`, `references`, `onDelete`, `onUpdate`) — update `ParsedRelationAttribute` (rename its `relationName`→`name`, `constraintName`→`map`, or drop it in favour of `SqlRelationOutput`) and the downstream field accesses across `interpreter.ts`. Keep the genuinely-needed plumbing (`findRelationAttributeNode`, `InterpretCtx` assembly) — inline or as small helpers — but no value-renaming pass. (The "same for Mongo" note is slice 3 — Mongo isn't migrated yet; ignore here.) **Halt and surface** if the downstream `relationName`/`constraintName` consumers fan out further than the relation path expects.

### T6 — `oneOf` requires ≥1 alternative (`one-of.ts:19`)
Make the rest parameter a non-empty tuple so `oneOf()` (zero args) is a **compile error**: `oneOf<Alts extends readonly [ArgType<unknown>, ...ArgType<unknown>[]]>(...alts: Alts)`. Keep the union-output typing.

## Orchestrator decision on the remaining CodeRabbit comment (do NOT re-add)
CodeRabbit `psl-relation-resolution.ts:89` asks to restore `PSL_UNSUPPORTED_REFERENTIAL_ACTION`. **Decision: do not restore it.** The operator deliberately moved referential-action validation into `oneOf(identifier(...))` (D6); a bad action now reports the attribute's `PSL_INVALID_RELATION_ATTRIBUTE` at parse, which is consistent with the operator's simplification and the amended parity bar. Restoring the specific code would re-add downstream validation or a per-argument code override — exactly the special-casing being removed. Leave as-is; do not change the test assertion back.

## Completed when
- [ ] Engine is single-pass; `resolveKey`/`positionalParsed`/`namedParsed` gone (`rg "resolveKey\|positionalParsed\|namedParsed"` zero).
- [ ] `Simplify`/`UnionToIntersection` imported from a shared home; not redefined in `attribute-spec/types.ts`.
- [ ] `variadic` removed everywhere (`rg variadic packages/1-framework/2-authoring/psl-parser` zero).
- [ ] `optional` returns an `ArgType`; `OptionalParam`/`Param`-union collapsed; `sqlRelation` infers the same output type.
- [ ] `interpretRelationAttribute` renaming layer gone; downstream uses the spec output keys; relation suites green.
- [ ] `oneOf()` with zero args is a compile error.
- [ ] Gates: `pnpm --filter @internal/psl-parser typecheck && test && lint`; `pnpm --filter @internal/sql-contract-psl test`; `pnpm fixtures:check`; after `pnpm --filter @internal/psl-parser build` (and `@internal/utils` build if you added an export there), workspace `pnpm typecheck`; `pnpm lint:deps` (T2 adds a dependency edge — verify it's clean).

## Constraints
No `any`; no bare `as` (narrow `blindCast`/`castAs` with reason, or types that avoid it); no file-ext imports; no reexport outside `exports/`; tests-first for the reshaped surfaces. Explicit-staging commits (one per task or coherent group), no amend, **no push**. Read-only on `projects/**/reviews/**`, `spec.md`, plan files. Transient-ID scan on the `+` diff. Do NOT post to GitHub or resolve threads.

## Operational metadata
- **Model tier:** thorough (core-engine reshape + cross-package consumer change).
- **Halt conditions:** T4 (optional-as-ArgType) can't preserve the inferred output types without `any`/broad casts; T5 downstream renaming fans out beyond the relation path; T2 reuse would force a layering violation; any task changes contract output (not just diagnostics).

Return the structured report per § Return shape: per-task (T1–T6) results, the single-pass + optional-as-ArgType designs you landed, confirmation `sqlRelation` infers the same output, the CodeRabbit:89 disposition restated, and commit SHAs.
