---
from: "0.17"
to: "0.18"
changes:
  - id: codec-conformance-harness-moves-to-testkit-packages
    summary: |
      The database-backed codec conformance harness moves into two dedicated dev-only packages,
      `@internal/postgres-codec-testkit` and `@internal/sqlite-codec-testkit`. Like every
      `@internal/*` package they are workspace-private — a published home under the `@prisma/*`
      scope is a follow-up — so today's consumers are packs developed in this repository. A pack
      that reached the in-repo harness through a relative cross-package import
      (`../../../3-targets/6-adapters/postgres/test/codec-conformance/harness`) adds the matching
      testkit as a workspace devDependency and imports `runPostgresCodecProjection` /
      `runSqliteCodecProjection` from the package instead; a `tsconfig` whose `rootDir` was widened
      to reach across that boundary can be narrowed back to the pack. The harness API is unchanged —
      caller-supplied connection, one case per codec and value — so the cases themselves move
      verbatim. Production adapters take no dependency on either testkit.
    detection:
      glob: "**/*.{ts,tsx,json}"
      contains:
        - "codec-conformance"
        - "runPostgresCodecProjection"
        - "runSqliteCodecProjection"
      anyMatch: true
  - id: aggregate-result-codecs-are-target-declared
    summary: |
      Targets declare what each aggregate returns, through `SqlAggregateDescriptor` contributions on
      `types.aggregateDescriptors`. A descriptor maps an operation and an input match —
      no input, an exact codec id, a codec trait, or input-agnostic — to a result codec and a
      declared nullability, and resolution consults exact matches, then traits, then the
      input-agnostic entry. Emission and the runtime read the same contributions, so an extension
      that contributes an aggregate cannot type one result and decode another. Two consequences for
      existing packs. First, aggregate results now carry their declared codec into decoding, so a
      pack asserting an aggregate reads back as a `number` updates that expectation — on PostgreSQL
      `count` and widened sums are bigints and integer averages are decimal strings; on SQLite `avg`
      is a number and integer sums are bigints. Second, a pack that asserts rendered SQL for SQLite
      aggregates sees `CAST(… AS text)` around any aggregate whose result is `sqlite/bigint@1`:
      SQLite computes those into an INTEGER that `node:sqlite` refuses to hand over past 2^53, so
      the target's descriptor renders the cast that keeps the value readable. Regenerate contracts —
      the emitted `contract.d.ts` gains an `AggregateTypes` block that the ORM and SQL builder
      resolve their result types from.
    detection:
      glob: "**/*.{ts,tsx}"
      contains:
        - "aggregateDescriptors"
        - "AggregateExpr"
        - "codecTypes"
      anyMatch: true
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
      than through the contract — there is no way to declare them in 0.18 (checks have no
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
---

# 0.17 → 0.18 — Extension-author upgrade instructions

## `codec-conformance-harness-moves-to-testkit-packages`

The conformance harness that measures a codec's JSON projection against a real database lives in dedicated packages, `@internal/postgres-codec-testkit` and `@internal/sqlite-codec-testkit`. They are workspace-private like every `@internal/*` package (a published `@prisma/*` home is a follow-up), so packs developed in this repository that reached the harness by relative path across the adapter's `test/` directory declare the workspace dependency instead:

```jsonc
// package.json
"devDependencies": {
  "@internal/postgres-codec-testkit": "workspace:*"
}
```

```ts
import { runPostgresCodecProjection } from '@internal/postgres-codec-testkit';
```

The harness API is the same one the in-repo version had — you supply the connection and the cases; it encodes, stores, projects through your descriptor, executes, and compares the database's JSON against `encodeJson` and back through `decodeJson`. Cases move verbatim. If your `tsconfig.json` widened `rootDir` to make the cross-package relative import resolve, narrow it back to the pack.

## `aggregate-result-codecs-are-target-declared`

Aggregate result typing is now declared rather than inferred. A target (or an extension) contributes `SqlAggregateDescriptor`s on `types.aggregateDescriptors`, a sibling of `codecTypes`:

```ts
import type { SqlAggregateDescriptor } from '@internal/sql-relational-core/aggregate-descriptor-registry';

const sumOverMoney: SqlAggregateDescriptor = {
  operation: 'sum',
  input: { kind: 'codec', codecId: 'ext/money@1' },
  output: { kind: 'codec', codecId: 'ext/money@1' },
  nullable: true,
};
```

Each descriptor claims one `(operation, input)` pair, and exactly one component may claim it. The input match is one of four kinds — `none` (an operation over rows), `codec` (an exact codec id), `trait` (any codec carrying that trait), or `any` (a result that does not depend on its input) — and resolution consults them in that order of specificity: exact, then trait, then input-agnostic. The result is either `self` (the matched input's codec, for an aggregate that returns one of its inputs) or a named codec id. Emission reads the same contributions the runtime resolves against, so an emitted result type and a decoded value cannot disagree.

Two things to check in an existing pack:

- **Expectations that an aggregate reads back as a `number`.** On PostgreSQL, `count` and sums that widen to `int8` are bigints, and integer averages are decimal strings; on SQLite, integer sums are bigints while `avg` is a number.
- **Assertions over rendered SQL for SQLite aggregates.** An aggregate whose declared result is `sqlite/bigint@1` renders as `CAST(… AS text)`. SQLite computes such an aggregate into an INTEGER, and `node:sqlite` raises rather than returning one past 2^53; the descriptor's lowering hook renders the cast that keeps the value readable, and the bigint codec reads the text back. If your pack contributes an aggregate whose result outruns a double, declare the same lowering.

Then regenerate contracts (`prisma-next contract emit`): `contract.d.ts` gains an `AggregateTypes` block, and both the ORM client and the SQL builder resolve aggregate result types from it.

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
not possible in 0.18: a contract space derives checks from column shape (enum membership,
list element-non-null) and has no surface for an arbitrary hand-written predicate. Document
that the tables carrying it stay under an additive-only policy — the check survives, plain
`db verify` tolerates it, and only `--strict` reports it — or accept the drop under a
destructive plan. An authoring/opt-out surface for checks is planned for a later release.
