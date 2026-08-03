# Slice: sql-default — Dispatch plan

**Slice spec:** `projects/typed-attribute-parsers/slices/sql-default/spec.md`

D1–D4 migrated `@default` onto **static** specs (kit; non-enum; enum; legacy-parser deletion). D5–D7 then evolve those static specs into **dynamically composed** per-field specs — **still within this PR (#938)**, per operator direction + review. `@default` is one PR; both lowering paths migrate and both end up dynamically composed.

### D1 — Kit: `scalarLiteral()` + `funcCall()` combinators
- **Outcome:** two new leaf combinators in `@internal/psl-parser`, each unit-tested in isolation:
  - `scalarLiteral()` → `ArgType<string | number | boolean>`: a `StringLiteralExprAst` / `NumberLiteralExprAst` / `BooleanLiteralExprAst` → its decoded `.value()`. Rejects anything else with a kit leaf diagnostic. (Array defaults reuse the existing `list(scalarLiteral())` — no new list combinator.)
  - `funcCall()` → `ArgType<ParsedCall>`: a `FunctionCallAst` → a structured call `{ name, args: [{ text, span }], span }`. **Registry-agnostic** — no name validation, so the kit does not import any SQL type. Use `FunctionCallAst.name()` (the `QualifiedNameAst` — reuse `isSimpleName`/`identifier()` structurally, no stringify) and `.args()`; render each argument's source text via the AST's decoded value / `printSyntax` (text is a legitimate output here — the SQL registry re-parses arg strings downstream).
- **Design point to resolve in this dispatch:** where the parsed-call output type lives. The SQL registry consumes `ParsedDefaultFunctionCall` (`{ name, raw, args: [{ raw, span }], span }`). Either (a) `funcCall()` emits a generic framework-level parsed-call shape and D2 adapts it to `ParsedDefaultFunctionCall` at the call site, or (b) relocate/alias `ParsedDefaultFunctionCall` to a framework type `funcCall()` can emit directly. Pick whichever keeps layering clean (framework must not depend on SQL); surface the choice in the report.
- **Builds on:** the merged attribute-spec kit + slice-2 combinators.
- **Gate:** psl-parser build + typecheck + test; `lint:framework-vocabulary` (bump threshold to the new count if the two combinators move it); `lint:deps`.

### D2 — Migrate `@default`; delete the three string parsers
- **Outcome:** `fieldAttribute('default', { positional: [{ key: 'value', type: oneOf(scalarLiteral(), list(scalarLiteral()), funcCall()) }] })` added to `sql-attribute-specs.ts`; `lowerDefaultForField` (`psl-column-resolution.ts`) rewritten to interpret via the generic `interpretFieldAttribute` wrapper and switch on the `oneOf` output by runtime shape — **primitive → literal default, array → list default, object (parsed call) → registry path**. Every semantic rule stays: `isList` + `PSL_LIST_DEFAULT_NOT_ARRAY`, `lowerDefaultFunctionWithRegistry` + `PSL_UNKNOWN_DEFAULT_FUNCTION`, generator applicability + codec matching + preset-only guard (`PSL_INVALID_DEFAULT_APPLICABILITY`), and exactly-one-positional (now enforced by the spec's single positional param — confirm the engine's "too many positional / missing" diagnostics read acceptably, else keep an interpreter guard).
- **Deletions:** `parseDefaultLiteralValue`, `parseDefaultFunctionCall`, `parseListDefaultExpression`, plus their private helpers (`decodeLiteralElement`, the `ListDefaultParse` type) once `rg` confirms zero callers. Retain `lowerDefaultFunctionWithRegistry`, the registry, and `ParsedDefaultFunctionCall`.
- **Behaviour parity:** contract output identical; `pnpm fixtures:check` clean. `@default(garbage)` (no valid arm) now emits `PSL_INVALID_ATTRIBUTE_SYNTAX` instead of `PSL_INVALID_DEFAULT_VALUE` (operator: Option A) — update the asserting test(s). Semantic default codes unchanged. `interpreter.defaults.test.ts` (24 cases) green with only the intentional code-shift edits.
- **Builds on:** D1.
- **Gate:** psl-parser build (D1 changed the kit); sql-contract-psl typecheck + test (`interpreter.defaults.test.ts`); `pnpm fixtures:check`; `rg` gates for the three deleted helpers; `lint:framework-vocabulary`; `lint:deps`.

### D3 — Kit `bareIdentifier()` + migrate the enum `@default` path
- **Outcome:** a `bareIdentifier()` leaf combinator in `@internal/psl-parser` (bare `IdentifierAst` → its text; neutral label "an identifier"; no validation), unit-tested. `enumDefaultSpec = fieldAttribute('default', { positional: [{ key: 'member', type: bareIdentifier() }] })` added to `sql-attribute-specs.ts`; `lowerEnumDefaultForField` (`psl-field-resolution.ts`) rewritten to interpret via the generic `interpretFieldAttribute` wrapper and match the extracted member name against `enumHandle.enumMembers`.
- **Deletions:** the inline `isQuotedString` / `isFunctionCall` regex checks + the exactly-one-positional guard in `lowerEnumDefaultForField` (now spec-enforced). Keep the `enumHandle.enumMembers` matching + `PSL_ENUM_UNKNOWN_DEFAULT_MEMBER`.
- **Behaviour parity:** enum-member defaults resolve to the same value; `pnpm fixtures:check` clean. `@default("x")` / `@default(fn())` on an enum field now emit `PSL_INVALID_ATTRIBUTE_SYNTAX` instead of `PSL_ENUM_DEFAULT_MUST_BE_MEMBER_NAME` (operator: Option A) — find + update the asserting tests (in `interpreter.enum.test.ts`; `rg` for `PSL_ENUM_DEFAULT_MUST_BE_MEMBER_NAME`). `PSL_ENUM_UNKNOWN_DEFAULT_MEMBER` unchanged.
- **Builds on:** D1 (kit pattern), D2 (the `defaultSpec` plumbing + interpret wiring it mirrors).
- **Gate:** psl-parser build + test (new combinator); sql-contract-psl typecheck + test (enum-default cases); `pnpm fixtures:check`; `rg` gates; `lint:framework-vocabulary`; `lint:deps`.

### D4 — Delete the legacy `parseDefaultFunctionCall` string parser
- **Outcome:** `parseDefaultFunctionCall` + its exclusive support chain (`splitTopLevelArgs`, `createSpanFromBase`, `resolveSpanPositionFromBase`, `DefaultFunctionArgument`) deleted from `default-function-registry.ts` (dead once `funcCall` replaced it); the registry-lowering tests refactored to build `ParsedDefaultFunctionCall` inputs via a local `call()` helper. Retain `lowerDefaultFunctionWithRegistry` + `formatSupportedFunctionList`.
- **Builds on:** D2.
- **Gate:** sql-contract-psl typecheck + test; `fixtures:check`; `rg` zero for the deleted helpers; `lint:*`.

---

_The dispatches below evolve the static specs above into dynamically-composed per-field specs (operator direction + #938 review). Resolve **Open Question 1** in the slice spec (do `PSL_UNKNOWN_DEFAULT_FUNCTION` / `PSL_ENUM_UNKNOWN_DEFAULT_MEMBER` shift to `PSL_INVALID_ATTRIBUTE_SYNTAX`) before D5._

### D5 — `funcCall(name)` + `num()` + dynamic non-enum `@default` spec
- **Kit:** `funcCall` becomes name-pinned (`funcCall(name)`, parallel to `identifier(name)`) — matches a call with that callee, still captures raw args. Add a general `num()` number-literal atom (any number incl. floats — `int()` is integer-only and would regress `Float @default(1.5)`). Both unit-tested.
- **Outcome:** `buildDefaultSpec({ isList, registry })` composes `oneOf(str(), num(), bool(), …(isList ? [list(oneOf(str(), num(), bool()))] : []), ...registry.keys().map(funcCall))`. `lowerDefaultForField` builds it per field; the `isList` shape-switch collapses (list arm present ⇔ list field). Unknown-function-name and array-on-scalar become grammar failures (`PSL_INVALID_ATTRIBUTE_SYNTAX`), retiring the interpreter's `PSL_UNKNOWN_DEFAULT_FUNCTION` emission + the array-on-scalar branch (per OQ1). Function **arg** validation stays in the registry (`PSL_INVALID_DEFAULT_FUNCTION_ARGUMENT` unchanged).
- **Builds on:** D2.
- **Grounding:** the `ControlMutationDefaultRegistry` key/entry accessor; `oneOf` discriminated-output typing.
- **Gate:** psl-parser build + test; sql-contract-psl typecheck + test (update unknown-function / array-on-scalar assertions); `fixtures:check`; `lint:*`.

### D6 — Dynamic enum `@default` spec
- **Outcome:** `buildEnumDefaultSpec(members)` = `oneOf(...members.map((m) => identifier(m.name)))` (add a `list(...)` wrapper only if enum-list defaults exist — verify). `lowerEnumDefaultForField` builds it from `enumHandle.enumMembers`; member-validity becomes a grammar failure, retiring the interpreter's `PSL_ENUM_UNKNOWN_DEFAULT_MEMBER` emission (per OQ1). `bareIdentifier()` loses its last caller.
- **Builds on:** D3, D5.
- **Gate:** sql-contract-psl typecheck + test (`interpreter.enum.test.ts` member-validity assertions shift); `fixtures:check`; `lint:*`.

### D7 — Remove the superseded combinators
- **Outcome:** delete `scalar-literal.ts` + `bare-identifier.ts` (+ exports + unit tests) once `rg` confirms zero callers. Per OQ2, amend ADR 231 (§ "Alternatives and function calls": `funcCallFrom` dropped for `oneOf(funcCall(name))`; `matchingScalarLiteral` deferred) or record the deviation as agreed.
- **Builds on:** D5, D6.
- **Gate:** psl-parser build + test; sql-contract-psl typecheck + test; `fixtures:check`; `rg` zero for `scalarLiteral`/`bareIdentifier`; `lint:framework-vocabulary` (removing combinators may move the count — adjust threshold if so); `lint:deps`.

_(As-shipped target: `@default` composed dynamically per field from atomic combinators; `funcCallFrom`/`bareIdentifier`/`scalarLiteral` gone; function-name + enum-member validity in the grammar; literals and function-args still flexible (codec/registry-validated). All within PR #938. The language-server autocomplete payoff rides on top in a later, LS-scoped slice.)_
