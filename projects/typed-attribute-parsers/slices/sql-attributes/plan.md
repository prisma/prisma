# Slice: sql-attributes — Dispatch plan

**Slice spec:** `projects/typed-attribute-parsers/slices/sql-attributes/spec.md`

Sequential; each dispatch grows the kit just enough for the attributes it migrates, then deletes those attributes' now-dead syntax helpers. `@default` is the long pole and lands last. Target ≤ ~8 dispatches.

### D1 — Kit: `modelAttribute` + model-level plumbing (+ `int`, `bool`)
- **Outcome:** `modelAttribute(name, {...})` constructor exists and is exported (mirrors `fieldAttribute`, fixes `level: 'model'`); a reusable model-level `findModelAttributeNode(model, name)` + `buildModelInterpretCtx(...)` (mirroring the `@relation` helpers, minus `resolveReferencedModel`/`field`); trivial `int` (`NumberLiteralExprAst`→number) and `bool` (`BooleanLiteralExprAst`→boolean) leaves added + tested. No attribute migrated yet (proven with a unit test using a stub model spec).
- **Builds on:** slice-1 engine + combinators (now in `main`).
- **Hands to:** the `modelAttribute` constructor + model-ctx plumbing every `@@` dispatch consumes.
- **Gate:** psl-parser typecheck + test + lint; `lint:framework-vocabulary`.

### D2 — Migrate `@map` + `@@map`
- **Outcome:** field `@map` and model `@@map` lowered via specs (single positional `str()`); `parseMapName` deleted. Proves `modelAttribute` end-to-end against a real attribute.
- **Builds on:** D1.
- **Gate:** sql-contract-psl tests; fixtures:check; `rg parseMapName` → zero.

### D3 — Migrate `@id`/`@unique` (field) + `@@id`/`@@unique` (model)
- **Outcome:** the four constraint attributes lowered via specs (`map: optional(str())` fields; model variants add `list(fieldRef('self'), { nonEmpty, unique })`). `parseAttributeFieldList`/`parseFieldList`/`findDuplicateFieldName` deleted (subsumed by `list`). `parseConstraintMapArgument` + `mapFieldNamesToColumns` retained (still used by `@@index` / semantic).
- **Builds on:** D1.
- **Gate:** sql suites; fixtures:check; relevant `rg` gates.

### D4 — Kit `record` + migrate `@@index`
- **Outcome:** `record(value)` / `map(key, value)` combinator (`ObjectLiteralExprAst`→`Record<string,string>`) added + tested; `@@index` lowered via a spec (`fields` list; `map`/`type`/`options` named; `options`-requires-`type` in `refine`). `parseObjectLiteralStringMap` (+ `splitObjectLiteralEntries`/`findTopLevelColon`) and the now-last-caller `parseConstraintMapArgument` deleted.
- **Builds on:** D1, D3.
- **Gate:** sql suites; fixtures:check; `rg` gates.

### D5 — Migrate `@@control`
- **Outcome:** `@@control` lowered via `oneOf(identifier('managed'), …)`; `parseControlPolicyAttribute` + `CONTROL_POLICY_LITERALS`/`isControlPolicyLiteral` deleted. Interpreter's `PSL_DUPLICATE_ATTRIBUTE` guard retained.
- **Builds on:** D1.
- **Gate:** sql suites; fixtures:check; `rg` gate.

### D6 — Kit `entityRef` + migrate `@@discriminator` + `@@base`
- **Outcome:** `entityRef()` (bare-identifier model-name reference) added + tested; `@@discriminator` via `fieldRef('self')`, `@@base` via `entityRef()` + `str()`. String-type + base-resolution checks stay in `resolvePolymorphism`.
- **Builds on:** D1.
- **Gate:** sql suites (polymorphism); fixtures:check.

### D7 — Kit `funcCall`/`funcCallFrom` + scalar/array-literal leaf; migrate `@default` — SPLIT OUT

> **Mid-flight demotion (operator decision):** `@default` was split into the follow-up slice `sql-default`. Grounding at pickup showed it introduces a novel registry-parameterised `funcCall` combinator plus six preserved semantic codes, pushing this slice's PR past a single coherent review. This slice closes at D6; the entry below is retained for provenance only and is delivered by `sql-default`.
- **Outcome:** `funcCall`/`funcCallFrom` (registry-parameterised — builds `ParsedDefaultFunctionCall` from `FunctionCallAst`, defers name/arg validation to `lowerDefaultFunctionWithRegistry`) + a matching-scalar-literal + array-literal leaf; `@default` lowered via `oneOf(matchingScalarLiteral(), funcCallFrom(registry), enum-member, list(...))`, covering literal / function / bare-enum-member / list defaults. Preserve `PSL_UNKNOWN_DEFAULT_FUNCTION` / `PSL_INVALID_DEFAULT_*` codes.
- **Builds on:** D1 (+ int/bool from D1).
- **Focus:** the long pole; do NOT bundle with anything else. If it balloons, surface for a slice split (spec Open Question 1).
- **Gate:** sql suites (defaults, incl. `interpreter.defaults.test.ts`); fixtures:check; `rg` gates for the retired default-literal helpers.

### D8 (optional) — Cleanup sweep — NOT NEEDED
- No orphaned helpers remained after D2–D6 (each dispatch deleted its own dead helpers and `rg`-confirmed zero callers). Folded away; nothing to do.

_(As-shipped: this slice delivered D1–D6 — every SQL attribute except `@default` is spec-driven; the syntax helpers for those attributes are gone; semantic checks, the `@db.*` helpers, and the three `@default`-only helpers are retained. `@default` (former D7) was split to the follow-up slice `sql-default`. D2/D3/D5 were mechanical once D1 landed; D1/D4/D6 carried the kit-growth risk.)_
