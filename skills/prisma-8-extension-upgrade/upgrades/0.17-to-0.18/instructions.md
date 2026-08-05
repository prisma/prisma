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
