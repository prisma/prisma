# Slice 4 build review (TML-3387)

| Dispatch | Round | Commits | Must-fix | Should-fix | Low | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| a | 1 | `dc9e22ab28..e18a2f56eb` | 0 | 1 | 3 | ANOTHER ROUND NEEDED |

## Dispatch a, round 1

Every numbered item of the brief is built. The resolution runs inside the SQL family's `introspect`, so every caller of `familyInstance.introspect` gets it: `db verify` (`db-verify.ts` and `client.ts` schema verify), `db init` and `db update` (`db-run.ts`), both migration runners' post-apply checks, `db schema` and `contract infer`. No change outside the brief.

Checks run: `pnpm build`, root `typecheck:agent` (pass), tests of framework-components, sql-contract, schema-ir, sql family, Postgres and SQLite targets and adapters (all pass), `lint:deps` (pass), `lint:framework-vocabulary` (pass), the golden planner test (734 pass, no change), `fixtures:check` (clean), `git status` clean afterwards.

Verified without findings:

- Normal-form parameters change no hash or committed file. A value's `params` is read only by `dataTypeValuesEqual`; `toContract` writes the value alone. Spelling still uses the parameters as written, which is correct because parameters with one normal form give one spelling.
- Cost for `db schema` and `contract infer`: with the Postgres stack (52 SQL data types, 120 texts), 10,000 column resolutions take 157 ms, about 16 microseconds a column (`wip/s4/review-a1/bench.mjs`). Harmless. `contract infer` now resolves each column twice (its own `psl-build/column-types.ts` and the family); also harmless.
- The PGlite test covers an enum in `public` (`mood`) and in another schema (`app.status`), a list of an enum, a domain and a range (both unclaimed), and `numeric(10)` read as `{ precision: 10, scale: 0 }`.

### S4-a-R1-1 (should-fix): introspected nodes are rebuilt without their constructors

Where: `packages/2-sql/9-family/src/core/resolve-introspected-types.ts`, `rebuiltNode` and `rebuilt`.

What is wrong: the walk copies every changed container node with `Object.create(prototype, ownPropertyDescriptors)` and freezes the copy. I checked every schema IR class (the nine family classes and the six Postgres ones): each holds its state in own data properties, `kind` is an own non-enumerable property and is copied, none has a `#private` field, a cache or an own accessor, and nothing keys a `WeakMap` on a node. So the copies are correct today: `instanceof`, `nodeKind`, `children()`, `isEqualTo` and freezing all hold, and the PGlite test asserts the Postgres root. But the frozen-class pattern makes the constructor the one place a node is built, and this code is correct only while an unwritten rule holds. A target node with a `#private` field (the repository already uses one in `DataTypeValueRecord`) would throw a `TypeError` from its methods on the copy. A node that keeps columns in a `Map` or a non-node class would leave them unresolved with no error, and dispatch b would then report a false mismatch. A derived cache would be copied stale. `SqlColumnIR` meanwhile gets a constructor-based copy, `withDataType`, so the change uses two mechanisms.

Change: resolve each column when it is built. The control adapter is already created with the stack (`adapter.create(stack)` in `control-instance.ts`), so each adapter can pass a column's `reportedType` and `stack.declaredDataTypes` to one family function that returns `{ dataType, typeParams }` and put both in the column input. Delete the walk and `withDataType`. This adds one call in each adapter, which plan decision 1 ("no target code") may forbid; the orchestrator decides. If decision 1 stands as written, the sound alternative is a method on `SqlSchemaIRNode` that returns the node with its columns rebuilt, which each container class implements through its own constructor (two family classes, three Postgres classes), the rewriter variant of the frozen-class pattern.

### S4-a-R1-2 (low): `withDataType` copies fields by hand

Where: `packages/2-sql/1-core/schema-ir/src/ir/sql-column-ir.ts`, `withDataType`; its test in `sql-column-ir.test.ts`.

What is wrong: every field of `SqlColumnIRInput` is listed by hand, so a field added later is dropped silently. The test does not set `authoredDefault`, `codecRef` or `codecBaseNativeType`, so dropping them would pass.

Change: moot if S4-a-R1-1 resolves at construction. Otherwise set those three in the test.

### S4-a-R1-3 (low): the normal-form guard in `sqlDataType` is untested

Where: `packages/2-sql/1-core/contract/src/sql-data-type.ts`, the `normalize` passed to `dataType` (`isParamsOf(spec.params, params) ? normalize(params) : params`).

What is wrong: no test builds a value under parameters the type's schema refuses, so the branch that keeps them as written could be removed or inverted with every test green. `contract-to-schema-ir.ts` calls the unguarded `dataType.sql.normalize` directly, so the two callers treat bad parameters differently.

Change: add a test for a value built under parameters the schema refuses, or drop the guard if nothing can reach it.

### S4-a-R1-4 (low, for dispatch b): the contract side carries no stored type

Where: `packages/2-sql/9-family/src/core/migrations/contract-to-schema-ir.ts` `convertColumn`; `SqlColumnIR.isEqualTo`.

What is wrong: nothing is wrong in dispatch a, but b compares stored types and will need one. The contract-side column carries the codec's data type (`sqlite/datetime`) with parameters in that type's normal form; the database side carries the stored type (`sqlite/text`). `SqlColumnIR.isEqualTo` has no data type lookup, and the schema-ir package does not depend on sql-contract, so it cannot read `sql.storedAs`. `convertColumn` already computes the stored type (`const storage = sqlStorageType(dataType, ...)`, line 70).

Change: in dispatch b, stamp the stored type, with parameters in the stored type's normal form, on the contract-side column, and compare that. Alternatively, compare in the family, where the lookup is available.

Verdict: ANOTHER ROUND NEEDED, for S4-a-R1-1 once the orchestrator picks the approach.
