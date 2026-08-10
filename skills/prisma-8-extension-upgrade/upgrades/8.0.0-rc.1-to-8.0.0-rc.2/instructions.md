---
from: "8.0.0-rc.1"
to: "8.0.0-rc.2"
changes:
  - id: check-constraint-ir-carries-an-opaque-expression
    summary: |
      `CheckConstraint` (contract IR) and `SqlCheckConstraintIR` (schema IR) changed from
      `{ name, column, valueSet }` / `{ name, column, permittedValues }` to
      `{ name, prefix?, expression }`. Both are constructed from an `SqlObjectNaming` rather
      than a bare name, exactly like `Index` / `SqlIndexIR`: pass
      `{ naming: { kind: 'wire', prefix, hash }, expression }` for a managed check, or
      `{ naming: { kind: 'exact', name }, expression }` for one adopted verbatim. Compute the
      hash with `computeCheckContentHash(expression)` from `@internal/sql-schema-ir/naming`.
      Reading a check off a built node is unchanged (`check.name`), and `check.prefix` tells
      you whether it is wire-named. Contract JSON hydrates through
      `checkConstraintInputFromSerialized`, which rejects a `prefix` that does not parse out of
      the `name`. `resolveValueSetValues` is gone — a check no longer references a value set,
      so there is nothing to resolve; the members are already baked into the predicate text.
    detection:
      glob: "**/*.{ts,mts,cts}"
      contains:
        - 'CheckConstraint'
        - 'permittedValues'
        - 'resolveValueSetValues'
      anyMatch: true
  - id: add-check-constraint-call-takes-an-expression
    summary: |
      `AddCheckConstraintCall` is now constructed as
      `(schemaName, tableName, constraintName, expression)` — the `column` and `values`
      parameters are gone, and the rendered DDL is
      `ALTER TABLE … ADD CONSTRAINT "x" CHECK (<expression>)` with the predicate emitted
      verbatim. The matching migration-class method takes
      `{ schema, table, constraint, expression }`. `DropCheckConstraintCall` is unchanged.
      There is no compatibility overload — update every construction site.
    detection:
      glob: "**/*.{ts,mts,cts}"
      contains:
        - 'AddCheckConstraintCall'
        - 'addCheckConstraint'
      anyMatch: true
  - id: specifier-default-control-policy-requires-create-namespace
    summary: |
      The options bag on `typescriptContract` / `typescriptContractFromPath` now requires
      `createNamespace` alongside `defaultControlPolicy`. Stamping a specifier default carries
      a consequence — derived CHECK constraints are stripped from tables the stamped policy
      leaves non-managed — and the strip rebuilds storage namespaces through the target's
      factory, so the two options travel together. Pass the same factory the PSL specifier
      already takes:
      `typescriptContract(contract, output, { defaultControlPolicy: 'external' })` becomes
      `typescriptContract(contract, output, { defaultControlPolicy: 'external',
      createNamespace: postgresCreateNamespace })`, with `postgresCreateNamespace` imported
      from the Postgres target's types entrypoint (`@internal/target-postgres/types`).
      Calls without an options bag are unchanged, and `emptyContract` already took
      `createNamespace`.
    detection:
      glob: "**/*.{ts,mts,cts}"
      contains:
        - 'typescriptContract'
        - 'defaultControlPolicy'
      anyMatch: false
  - id: re-emit-extension-contract-spaces
    summary: |
      Run your extension's `contract emit` (the `build:contract-space` script, if you have one)
      to regenerate its committed `contract.json` / `contract.d.ts`. Two things change: any
      enum CHECK is re-serialized into the new shape with a wire name, and every list (`many`)
      column gains a declared element-non-null CHECK that the Postgres planner used to
      synthesize without ever declaring. Prefixes derived from long table and column names are
      truncated to 54 UTF-8 bytes so the wire name fits Postgres's 63-byte identifier limit;
      identity lives in the hash, so truncated prefixes still yield distinct names.
      Postgres introspection also stopped parsing predicates and now captures every CHECK
      constraint verbatim, so any hand-written or platform-installed check on a table your
      extension manages is visible for the first time: it verifies as an undeclared extra under
      `--strict` and becomes a `dropCheckConstraint` under a policy that allows `destructive`.
      If your extension installs checks out of band — through a raw-SQL migration step rather
      than through the contract — there is no way to declare them in 8.0.0-rc.2 (checks have no
      authoring surface, and derivation from column shape is not one). Keep the tables carrying
      them under an additive-only policy — the checks survive, and only `--strict` verify
      reports them — or expect the first destructive plan against an upgraded database to
      offer to drop them. An authoring/opt-out surface is planned for a later release.
    detection:
      glob: "**/contract.json"
      contains:
        - '"many": true'
        - '"valueSet"'
      anyMatch: true
  - id: stub-execution-contexts-must-carry-an-aggregate-registry
    summary: |
      A pack that hand-rolls an `ExecutionContext` in its tests must give it an
      `aggregateDescriptors` registry whose `values()` yields the descriptors the test exercises.
      `orm(...)` and every `Collection` construction enumerate that registry to build their method
      sets, so a stub context without the field raises
      `TypeError: Cannot read properties of undefined (reading 'values')` at construction, and a
      registry whose `values()` yields nothing produces a collection and a `sql()` function bag
      with no aggregate methods at all — `TypeError: aggregate.count is not a function` at the
      first call. A `resolve()` that answers `count` is no longer sufficient on its own: `resolve`
      settles one `(operation, input)` pair, `values` declares the vocabulary. Prefer
      `buildSqlAggregateDescriptorRegistry(descriptors, codecDescriptors)` from
      `@internal/sql-relational-core/aggregate-descriptor-registry` over a hand-written object —
      it settles the same registry the runtime does.
    detection:
      glob: "**/*.{ts,tsx,mts,cts}"
      contains:
        - "aggregateDescriptors"
        - "ExecutionContext"
        - "SqlAggregateDescriptorRegistry"
      anyMatch: true
  - id: aggregate-surfaces-derive-from-the-contract-s-operation-map
    summary: |
      The ORM's `aggregate()` / `groupBy().aggregate()` / `groupBy().having()` builders, the
      include reducers on a collection, and the SQL builder's aggregate functions no longer
      declare `count` / `sum` / `avg` / `min` / `max` outright. Each surface is a mapped type over
      the operation names in the contract's emitted `AggregateTypes` block. A contract that
      carries that block is unaffected — the same five methods are there, with the same result
      types. A contract whose block is unknown — an in-code `defineContract(...)` value, or a
      contract emitted before `AggregateTypes` existed — resolves every one of those surfaces to
      `AggregateOperationsUnavailable`, an empty type, so the call fails with
      `Property 'count' does not exist` rather than offering selector types the declaration
      cannot supply. This is a compile-time change only: the runtime builds its methods from the
      composed registry and dispatches exactly as before. Either emit the contract and type the
      client from the emitted `Contract`, or cast the builder to a dynamic record — see the body
      for the shape.
    detection:
      glob: "**/*.{ts,tsx,mts,cts}"
      contains:
        - "defineContract"
        - ".aggregate("
        - "AggregateBuilder"
        - "HavingBuilder"
      anyMatch: true
  - id: count-over-a-field-counts-that-field
    summary: |
      `count(field)` renders `COUNT(<column>)` in the ORM. It used to drop the argument and render
      `COUNT(*)`. PostgreSQL declares `count` with `input: { kind: 'any' }`, which settles into
      both a `withoutInput` row and an `anyInput` row, so the derived method carries both arities
      honestly: `count()` counts rows, `count(field)` counts that field's non-null values. Typed
      call sites are unaffected, because `count` took no argument before and no such call
      compiled. Reachable through a call that bypassed the types — a `@ts-expect-error`, an
      `as never` argument, or dynamic invocation. Those call sites change result whenever the
      column holds NULLs. Sweep them and drop the argument wherever `COUNT(*)` was what you meant.
    detection:
      glob: "**/*.{ts,tsx,mts,cts}"
      contains:
        - "count("
        - ".aggregate("
      anyMatch: true
  - id: contributed-aggregate-operations-carry-a-lowering-hook
    summary: |
      An aggregate descriptor whose `operation` is not one of `count`, `sum`, `avg`, `min`, `max`
      must declare a `lower` hook. `operation` has been a `string` for a release, but a name
      outside that alphabet was inert — no consumer surface offered it. It is live now: a
      contributed operation surfaces as a method on the ORM and SQL-builder aggregate surfaces
      under its own name, so it must be able to build an expression, and the closed AST alphabet
      gives it none. Registry assembly rejects a hook-less descriptor with
      `RUNTIME.AGGREGATE_LOWERING_MISSING` while the execution context composes. Two further
      rules follow. An out-of-alphabet operation is projection-only: HAVING, ORDER BY, and
      comparison operands refuse it with `ORM.AGGREGATE_PROJECTION_ONLY`, and its typed HAVING
      method does not exist. And its name may not shadow an ORM collection member (`select`,
      `where`, `include`, `combine`, `state`, …), because reducers install into that same
      namespace; `orm(...)` rejects a collision with `ORM.AGGREGATE_OPERATION_RESERVED`.
    detection:
      glob: "**/*.{ts,tsx,mts,cts}"
      contains:
        - "aggregateDescriptors"
        - "SqlAggregateDescriptor"
      anyMatch: true
---

# 8.0.0-rc.1 → 8.0.0-rc.2 — Extension-author upgrade instructions

## `stub-execution-contexts-must-carry-an-aggregate-registry`

The aggregate method sets are built by enumerating the composed registry, once per `Collection` construction and once at `orm(...)`. A test that fabricates an `ExecutionContext` therefore has to supply one:

```ts
import { buildSqlAggregateDescriptorRegistry } from '@internal/sql-relational-core/aggregate-descriptor-registry';

const context = {
  contract,
  codecDescriptors,
  aggregateDescriptors: buildSqlAggregateDescriptorRegistry(descriptors, codecDescriptors),
  // …
};
```

Two distinct failures tell you which half is missing:

- **`TypeError: Cannot read properties of undefined (reading 'values')`**, thrown from `new Collection(...)` or `orm(...)` — the stub has no `aggregateDescriptors` field at all.
- **`TypeError: aggregate.count is not a function`** (or `posts.count is not a function`, or `fns.sum is not a function`) — the stub has a registry, but its `values()` yields nothing, so no method was installed. `resolve()` alone no longer describes the surface: `resolve` settles one `(operation, input)` pair on demand, `values` declares which operations exist.

A minimal hand-written stub that keeps `count` available:

```ts
const aggregateDescriptors = {
  resolve: (operation: string) =>
    operation === 'count'
      ? { operation, output: { codecId: 'pg/int8@1' }, nullable: false, lower: undefined }
      : undefined,
  values: function* () {
    yield {
      operation: 'count',
      input: { kind: 'any' as const },
      output: { kind: 'codec' as const, codecId: 'pg/int8@1' },
      nullable: false,
    };
  },
};
```

Prefer the real builder where the test can afford it — it applies the same validation the runtime does, including the lowering rule below.

## `aggregate-surfaces-derive-from-the-contract-s-operation-map`

Every aggregate surface is now a mapped type keyed by the operation names in the contract's emitted `AggregateTypes` block:

| Surface | Type |
| --- | --- |
| `collection.aggregate(fn)` | `AggregateBuilder<TContract, ModelName, NsId>` |
| `groupBy(...).aggregate(fn)` | the same |
| `groupBy(...).having(fn)` | `HavingBuilder<…>` — keyed by the map *intersected with* the SQL alphabet |
| `include('rel', (rel) => …)` | `AggregateIncludeReducers<…>` on the collection |
| `sql().select((f, fns) => …)` | `AggregateOnlyFunctions<QC>` |

For a contract emitted by `prisma-next contract emit` on 8.0.0-rc.1 or later, nothing changes: the block declares `count`, `sum`, `avg`, `min`, and `max`, so the five methods are there with the same arities and result types they had.

For a contract whose block is unknown, all five surfaces resolve to `AggregateOperationsUnavailable` — an empty interface carrying one optional symbol-keyed brand that names the reason on hover. Two populations reach it:

- a contract built in code with `defineContract(...)` and used without emission (fixtures, integration tests, the no-emit authoring flow);
- a contract emitted before `AggregateTypes` existed, i.e. before 8.0.0-rc.1.

The symptom is a compile error at the call site:

```text
Property 'count' does not exist on type 'AggregateOperationsUnavailable'.
```

Runtime behaviour is unchanged — the methods are installed from the composed registry either way — so a cast is a legitimate fix where the contract is deliberately un-emitted:

```ts
import type { AggregateSpec } from '@internal/sql-orm-client';

type DynamicAggregates = Record<string, (field?: string) => AggregateSpec[string]>;

const stats = await readings.aggregate((aggregate) => {
  const dynamic = aggregate as DynamicAggregates;
  return { total: dynamic['sum']!('counter'), peak: dynamic['max']!('counter') };
});
```

The same shape works for an include reducer, whose callback receives the refinement collection:

```ts
const reduceToTotal = (related: unknown): unknown =>
  (related as DynamicAggregates)['sum']!('counter');

await readings.select('id').include('samples', (samples) => reduceToTotal(samples) as never).all();
```

Where an argument was previously widened past the types — `aggregate.sum('counter' as never)` compiled because `AggregateFieldNames` was already `never` for such a contract — the cast moves from the argument to the builder, and the field name goes back to being a plain string.

The better fix, wherever the pack can emit, is to emit: run `prisma-next contract emit` and type the client from the emitted `Contract`. That restores full typing — arities, admitted field names, and per-codec result types — instead of erasing it.

## `count-over-a-field-counts-that-field`

`count(field)` counts that field:

```ts
await db.orm.User.aggregate((aggregate) => ({ all: aggregate.count() }));
// SELECT COUNT(*) …

await db.orm.User.aggregate((aggregate) => ({ named: aggregate.count('email') }));
// SELECT COUNT("email") … — rows whose email is NULL are not counted
```

The second call used to render `COUNT(*)`: the argument was accepted and discarded. It is honoured now, because both arities are read off `count`'s rows rather than special-cased — PostgreSQL declares `count` with `input: { kind: 'any' }`, which settles into a `withoutInput` row (the zero-argument call) and an `anyInput` row (the field-taking call).

No typed call site changes meaning, because the field-taking overload did not exist before. What to sweep for is a call that got past the types:

- `// @ts-expect-error` immediately above a `count(...)` call. Where the argument is a field the contract admits, the suppression is now unused and TypeScript reports the unused directive. Where it is not — a relation name, say — the directive still holds and the call still fails.
- `count(x as never)` or `count(x as any)`.
- dynamic dispatch through a `Record<string, …>` cast.

For each, decide which count you meant. `COUNT(*)` is `count()`; `COUNT(col)` skips NULLs.

## `contributed-aggregate-operations-carry-a-lowering-hook`

Aggregate operation names are an open vocabulary, and they now reach the consumer surfaces. The SQL alphabet holds exactly five names (`count`, `sum`, `avg`, `min`, `max`), and a pack that contributes a descriptor named outside it — `bitOr`, say — gets a method under that name on the ORM's `aggregate()`, on `groupBy().aggregate()`, and on the include reducers, plus a matching function on the SQL builder. Three rules come with that.

**Declare a `lower` hook.** The AST's `AggregateExpr` carries only alphabet names, so a novel operation has no default form; the hook builds its whole expression from existing nodes:

```ts
import type { SqlAggregateDescriptor } from '@internal/sql-relational-core/aggregate-descriptor-registry';
import { FunctionCallExpr } from '@internal/sql-relational-core/ast';

const bitOr: SqlAggregateDescriptor = {
  operation: 'bitOr',
  input: { kind: 'codec', codecId: 'pg/int8@1' },
  output: { kind: 'codec', codecId: 'pg/int8@1' },
  nullable: true,
  lower: ({ expr }) => FunctionCallExpr.of('bit_or', expr === undefined ? [] : [expr]),
};
```

Without it, the execution context refuses to compose:

```text
RUNTIME.AGGREGATE_LOWERING_MISSING: Aggregate descriptor 'bitOr:codec:pg/int8@1' declares
operation 'bitOr', which is outside the SQL aggregate alphabet (count, sum, avg, min, max)
and carries no lowering hook.
```

**Use it in projections only.** The lowered form is a rendering for the driver boundary. HAVING, ORDER BY, and comparison operands compare inside the database, where that rendering would change what the comparison means, so both consumers refuse those positions at authoring time with `ORM.AGGREGATE_PROJECTION_ONLY`. The typed surface agrees: `HavingBuilder` is keyed by the map intersected with the alphabet, so a contributed operation has no HAVING method to call. Project it in a select and filter or order on the projected value.

**Pick a name no collection member owns.** Include reducers install into the ORM collection's own namespace, beside `select`, `where`, `include`, `combine`, `aggregate`, and the collection's instance fields. `orm(...)` rejects a collision with `ORM.AGGREGATE_OPERATION_RESERVED` and names the operation in `meta.operation`; rename the operation.

Reference: [the aggregate descriptor guide](https://github.com/prisma/prisma/blob/main/docs/reference/aggregate-descriptor-guide.md).

<!--
PR #29910: `changes: []`. Binding internal mutation-reload filters and repairing Supabase runtime coverage after the driver SPI split require no downstream extension source translation.

PR #29920: `changes: []`. Adds prepared-statement test coverage to the Supabase runtime suite (test-fixture codec registration only) and fixes a postgres direct-driver transaction defect; neither requires downstream extension source translation. The SPI split itself is recorded as `driver-spi-splits-query-and-execute` in the 0.17-to-8.0.0-rc.1 transition.

PR #29902: `changes: []`. Generated contracts gain additive aggregate rows for new opt-in integer representation codecs, but existing extension schemas and source require no migration; extension authors re-emit only when adopting the new target-scoped types.
-->

## Why checks stopped being structured

A check is now one opaque SQL string that nothing parses. Postgres reprints predicates in its
own normalized form — a `varchar` membership test comes back as
`((col)::text = ANY ((ARRAY[…])::text[]))` — so any structured reading of a live predicate
drifts against the authored text. Equality for a wire-named check is name equality, because the
hash already commits to the predicate; only an exact-named check compares its body, and then
byte-for-byte.
## If your target pack authors checks

Check emission is driven by a duck-typed `renderCheckExpressions` hook on the pack's
`authoring` contributions, resolved the same way `qualifyColumnType` is. It receives one
column's shape (`tableName`, `columnName`, `many`, and `memberValues` — the last present only
for a value set the toolchain owns) and returns `{ kind, columnName, expression }` candidates,
where `kind` is `'membership'` or `'elementNotNull'`. A pack without the hook emits no checks
at all, which is how SQLite keeps its no-CHECK stance. Nothing in the return value is a name:
the contract builder composes the prefix from the table, the column, and the kind, truncates it
to 54 UTF-8 bytes, and appends the content hash.
## Hand-written checks are visible now

Postgres introspection reads `pg_get_expr(c.conbin, c.conrelid)` and stores the predicate
verbatim; it no longer recognises only the two shapes the old parser could parse. Every CHECK
constraint on a managed table therefore reaches the differ, and one the contract does not
declare is an ordinary undeclared extra: reported by `db verify --strict`, and dropped by a plan
whose control policy allows `destructive`.

For an extension this matters in one specific case — a check your extension installs through a
raw-SQL migration step rather than deriving in its contract space. That constraint used to be
invisible and is now drop-eligible against any database the extension manages. Declaring it is
not possible in 8.0.0-rc.2: a contract space derives checks from column shape (enum membership,
list element-non-null) and has no surface for an arbitrary hand-written predicate. Document
that the tables carrying it stay under an additive-only policy — the check survives, plain
`db verify` tolerates it, and only `--strict` reports it — or accept the drop under a
destructive plan. An authoring/opt-out surface for checks is planned for a later release.
