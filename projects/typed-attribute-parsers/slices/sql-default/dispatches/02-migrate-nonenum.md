# Brief: D2 — fix `funcCall` (reject namespaced) + migrate the non-enum `@default` path

> Fresh implementer. Slice `sql-default`, branch `tml-2956-sql-default`. Do NOT push or touch GitHub. Commit everything as ONE signed commit.

## ⛔ ABSOLUTE TOOLING RULE (operator standing order for dispatches in this environment)
**NEVER call the regex/codebase-search MCP tool — it HANGS and deadlocks the run.** This has already killed three dispatches; do not become the fourth. (This is the operator's standing instruction for how work is dispatched here — not a committed project rule.)
**This brief is search-free: every path, line number, and code snippet you need is below. You should NOT need to search at all.** If you nonetheless think you must look something up, use `rg`/`grep` in the **terminal** only — never a non-terminal search tool. If you feel you need to search to complete the task, STOP and report that the brief was under-specified.

## Part A — fix `funcCall()` to reject namespaced callees
File: `packages/1-framework/2-authoring/psl-parser/src/attribute-spec/combinators/func-call.ts`. Current line 22 is:
```ts
      const name = arg.name()?.identifier()?.token()?.text;
```
`QualifiedNameAst.identifier()` returns the segment AFTER a dot, so `foo.now()` wrongly yields `now` (a real registry entry) and `temporal.updatedAt()` yields `updatedAt`. Replace lines 22–25 with a guard that rejects a namespaced (or absent) name:
```ts
      const qname = arg.name();
      if (qname === undefined || qname.dot() !== undefined || qname.colon() !== undefined) {
        return notOk([leafDiagnostic(ctx, arg, 'Expected a function call')]);
      }
      const name = qname.identifier()?.token()?.text;
      if (name === undefined) {
        return notOk([leafDiagnostic(ctx, arg, 'Expected a function call')]);
      }
```
(`dot()` / `colon()` are existing getters on `QualifiedNameAst` — no stringify, no `.path().join()`.)
Then add a test case in `packages/1-framework/2-authoring/psl-parser/test/attribute-spec-combinators.test.ts` inside the existing `describe('funcCall', …)` block: a namespaced call `temporal.updatedAt()` (and/or `foo.now()`) is REJECTED (`result.ok === false`). Keep the existing `now()` / `dbgenerated("…")` cases passing.
Rebuild: `pnpm --filter @internal/psl-parser build` before the SQL typecheck.

## Part B — migrate the non-enum `@default` path
### B1. Add the spec — `packages/2-sql/2-authoring/contract-psl/src/sql-attribute-specs.ts`
Its imports from `@internal/psl-parser` already include `oneOf`, `list`, `str`, `fieldAttribute`. Add `scalarLiteral` and `funcCall` to that import block (both are exported from `@internal/psl-parser` — shipped in D1). Then add near the other field specs:
```ts
export const defaultSpec = fieldAttribute('default', {
  positional: [{ key: 'value', type: oneOf(scalarLiteral(), list(scalarLiteral()), funcCall()) }],
});
```
`oneOf` output type: `string | number | boolean | (string | number | boolean)[] | ParsedDefaultFunctionCall`.

### B2. Rewrite `lowerDefaultForField` — `packages/2-sql/2-authoring/contract-psl/src/psl-column-resolution.ts` (currently starts line 937)
- Change its input: add `readonly field: FieldSymbol`, `readonly model: ModelSymbol`, `readonly sourceFile: SourceFile`. You may drop the current `defaultAttribute: ResolvedAttribute` param (the node is located via the field). Keep `modelName`/`fieldName` (used in messages), `columnDescriptor`, `generatorDescriptorById`, `sourceId`, `defaultFunctionRegistry`, `diagnostics`, `isList`.
- Body:
  ```ts
  const node = findFieldAttributeNode(field, 'default');
  if (node === undefined) return {};
  const value = interpretFieldAttribute({ node, spec: defaultSpec, model, field, sourceFile, sourceId, diagnostics });
  if (value === undefined) return {};
  ```
  (`findFieldAttributeNode` + `interpretFieldAttribute` are exported from `./sql-attribute-specs` — import them.)
- Shape-switch on `value`:
  - `Array.isArray(value)` → **array default**. If `isList`: `return { defaultValue: { kind: 'literal', value: [...value] } };`. If NOT `isList`: push `PSL_INVALID_DEFAULT_VALUE` with message `` `Unsupported default value "${...}"` `` (ruling: keep this exact code+message for array-on-scalar) and `return {}`. For the message's interpolated text, render the value however the old `PSL_INVALID_DEFAULT_VALUE` branch did — a readable form of the array is fine.
  - else if `typeof value === 'object'` (a `ParsedDefaultFunctionCall`) → **function default**. Feed it to the existing registry call: `lowerDefaultFunctionWithRegistry({ call: value, registry: defaultFunctionRegistry, context: { sourceId, modelName, fieldName, columnCodecId: columnDescriptor.codecId } })`, then the existing `if (!lowered.ok) …`, storage-vs-generated branch, and the three generator-applicability/codec checks — **verbatim** from the current code (lines ~1009–1061). (The list-execution-default guard lives in the caller and is unchanged.)
  - else (primitive `string | number | boolean`) → **scalar literal**. If `isList`: push `PSL_LIST_DEFAULT_NOT_ARRAY` (message unchanged) and `return {}`. Else `return { defaultValue: { kind: 'literal', value } };`.
- **Remove** the hand-rolled exactly-one-positional check at the top of the current function (the `namedEntries.length > 0 || positionalEntries.length !== 1` block emitting `PSL_INVALID_DEFAULT_FUNCTION_ARGUMENT`). The spec's single positional param now enforces arity via the engine (`PSL_INVALID_ATTRIBUTE_SYNTAX` on missing/extra/named args). This case is untested; no test edit expected for it.
- **Preserve verbatim**: `PSL_UNKNOWN_DEFAULT_FUNCTION`, `PSL_INVALID_DEFAULT_APPLICABILITY`, `PSL_LIST_DEFAULT_NOT_ARRAY`, and the registry/codec/applicability logic.

### B3. Update the call site — `packages/2-sql/2-authoring/contract-psl/src/psl-field-resolution.ts` line 479
The `lowerDefaultForField({...})` call is inside `collectResolvedFields`, where `model`, `field`, and `input.sourceFile` are in scope. Pass `field`, `model`, `sourceFile: input.sourceFile`; drop `defaultAttribute` if you removed that param. Leave the sibling `lowerEnumDefaultForField(...)` call (line ~471) untouched.

### B4. Delete the dead parsers (after confirming zero callers with `rg` in the TERMINAL)
- `psl-column-resolution.ts`: `parseDefaultLiteralValue` (line 884), `parseListDefaultExpression` (918), `decodeLiteralElement` (911), and the `ListDefaultParse` type (906).
- `default-function-registry.ts`: `parseDefaultFunctionCall` (line 123) — and `splitTopLevelArgs` (line 62) if it has no other caller. **RETAIN** `lowerDefaultFunctionWithRegistry`, the registry, and `ParsedDefaultFunctionCall`.

## Test edits (exact — do NOT over-shift)
Only these change:
- **AC5g** — `packages/2-sql/2-authoring/contract-psl/test/interpreter.defaults.test.ts` line 946 (`rejects @default(temporal.updatedAt()) …`). With Part A, `funcCall` rejects the namespaced call → the kit's `PSL_INVALID_ATTRIBUTE_SYNTAX`. Change the asserted `code` (line 969) to `'PSL_INVALID_ATTRIBUTE_SYNTAX'`, drop the `message: stringContaining('temporal.updatedAt()')` line (the kit message won't contain the source text), and update the test title/comment to say it's rejected as invalid attribute syntax.
- **These MUST stay unchanged** (they are registry / semantic, NOT the arg-count guard): the `PSL_INVALID_DEFAULT_FUNCTION_ARGUMENT` assertions at lines ~277/282/287 (registry rejecting `uuid`/`nanoid`/`dbgenerated` args) and ~315 (optional-field execution default). Do NOT touch them — the migration does not change those code paths (a one-positional `@default(uuid(2))` still reaches the registry, which still emits `PSL_INVALID_DEFAULT_FUNCTION_ARGUMENT`).

## Constraints
No `any`; no bare `as` (use `blindCast`/`castAs` from `@internal/utils/casts`, narrowed — narrow on `Array.isArray(value)` then `typeof value === 'object'`; the primitive branch is the remaining `string|number|boolean`); no file-ext imports; never suppress biome; tests-first for the funcCall guard. `git commit -s` (DCO), explicit staging, no amend, **no push**. Read-only on `projects/**`, `.agents/**`. Do NOT touch GitHub. Do NOT touch the enum path `lowerEnumDefaultForField`.

## Gates (all must pass, in order)
1. `pnpm --filter @internal/psl-parser build`
2. `pnpm --filter @internal/psl-parser typecheck` and `pnpm --filter @internal/psl-parser test`
3. `pnpm --filter @internal/sql-contract-psl typecheck` and `pnpm --filter @internal/sql-contract-psl test`
4. `pnpm fixtures:check` — clean
5. `pnpm lint:framework-vocabulary`; `pnpm lint:deps`

Report: the funcCall guard + its new test; the `defaultSpec` + shape-switch + `lowerDefaultForField`'s new signature; confirmation via terminal `rg` that the four/five deleted helpers have zero callers (and registry retained); the AC5g edit; explicit confirmation you did NOT touch the registry/optional-field `PSL_INVALID_DEFAULT_FUNCTION_ARGUMENT` tests; all gate results; and the commit SHA. If anything is not covered by this brief, STOP and report — do NOT search with a non-terminal tool.
