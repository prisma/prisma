---
from: "0.17"
to: "0.18"
changes:
  - id: aggregate-results-carry-their-target-s-codec
    summary: |
      Aggregates read back through the codec their target declares for the result, so their
      application types change. `count()` is a `bigint` on both targets — a count is a cardinality
      and is not capped at 2^53. On PostgreSQL, `sum` over `int2`/`int4` widens to `int8` and reads
      as a `bigint`, while `sum(int8)` and `avg` over any integer are `numeric` and read as decimal
      **strings**; `min`/`max` keep the column's own type, except over `varchar`, where PostgreSQL
      returns `text`. On SQLite, `sum` over an integer column is a `bigint` and `avg` is always a
      `number` (real). The two targets genuinely diverge on `avg` — a portable query must handle
      both, and there is no shim that flattens them. Include reducers
      (`.include('posts', (p) => p.count())`) decode the same way, so an included count is a
      `bigint` too, and an empty relation reads `0n` rather than `0`. Comparisons are where this
      bites quietly: `count === 2` is false where `count` is `2n`, and `JSON.stringify` throws on a
      bigint. Sweep for `toBe(<number>)` / `=== <number>` / arithmetic against an aggregate result
      and switch to `2n` or the decimal string, and render bigints explicitly (`String(value)`)
      wherever you serialise. `having(...)` operands are the exception and stay numbers — they are
      compared inside SQL and never cross a codec. Regenerate your contracts
      (`prisma-next contract emit`): the emitted `contract.d.ts` gains an `AggregateTypes` block
      that types every aggregate per operation and input codec, and the ORM and SQL builder both
      resolve their result types from it — against a contract emitted before 0.18 an aggregate
      resolves to `never` in the ORM and to `unknown` in the SQL builder.
    detection:
      glob: "**/*.{ts,tsx,mts,cts}"
      contains:
        - "aggregate("
        - ".count()"
        - "groupBy("
      anyMatch: true
  - id: check-constraints-are-opaque-expressions
    summary: |
      CHECK constraints in `contract.json` changed shape: `{ name, column, valueSet }` became
      `{ name, prefix, expression }`, where `expression` is the raw SQL predicate and `name`
      is a content-addressed wire name (`<prefix>_<8hex>`, the same convention indexes and RLS
      policies already use). Run `prisma-next contract emit` to regenerate `contract.json` and
      `contract.d.ts` — an old-shape contract is rejected on read, so this is not optional.
      Regeneration also changes the physical names of your enum CHECK constraints, because the
      hash suffix is new: `prisma-next migration plan` will show a DROP of the old unsuffixed
      constraint plus an ADD of the wire-named one. That plan needs `destructive` to drop the
      stale constraint; under an additive-only policy the new constraint installs and the old
      one survives, and `prisma-next db verify --strict` reports it as an undeclared extra
      until you allow the drop. Every list (`many`) column now also carries a declared
      element-non-null CHECK that the planner previously invented behind your back; it appears
      in the contract and in the plan for the first time.
      Introspection also stopped parsing predicates, so every CHECK constraint on a managed
      table is now visible — including hand-written ones (`price > 0`, a composite `AND`, a
      `NOT VALID` constraint) that earlier versions could not see at all. An undeclared check
      is an extra: `prisma-next db verify --strict` reports it, and a plan run under a policy
      that allows `destructive` emits a `dropCheckConstraint` operation for it. Read the first
      plan for `dropCheckConstraint` operations naming constraints you wrote by hand. There is
      no way to declare a hand-written check in 0.18 — checks have no authoring surface — so
      to keep one, run plans for that table under an additive-only policy: the constraint
      stays enforced, plain `db verify` tolerates it, and only `--strict` lists it. Let the
      drop through only when the constraint is deliberately retired. An authoring/opt-out
      surface for checks is planned for a later release.
    detection:
      glob: "**/contract.json"
      contains:
        - '"valueSet"'
        - '"checks"'
      anyMatch: true
  - id: add-check-constraint-takes-an-expression
    summary: |
      In committed migration files, `this.addCheckConstraint({ schema, table, constraint,
      column, values })` is now `this.addCheckConstraint({ schema, table, constraint,
      expression })`. Replace the `column` and `values` pair with the predicate they used to
      describe — `column: 'kind', values: ['admin', 'user']` becomes
      `` expression: `"kind" IN ('admin', 'user')` `` — and use the wire name from your
      regenerated contract as `constraint`. If the constraint was created by the same
      migration's `createTable`, prefer moving it inline: add
      `checkExpression(<name>, <expression>)` to that table's `constraints` array and delete
      the follow-up `addCheckConstraint` call, which is what a freshly planned migration now
      produces. Import `checkExpression` from the same migration entrypoint as `col` and
      `primaryKey`.
    detection:
      glob: "**/migrations/**/*.ts"
      contains:
        - 'addCheckConstraint'
      anyMatch: true
  - id: specifier-default-control-policy-requires-create-namespace
    summary: |
      If your `prisma-next.config.ts` passes `defaultControlPolicy` in the options bag of
      `typescriptContract` or `typescriptContractFromPath`, that bag now also requires
      `createNamespace`. Stamping a default policy strips derived CHECK constraints from
      tables the policy leaves non-managed, and the strip rebuilds storage namespaces through
      the target's factory, so the two options travel together.
      `typescriptContract(contract, output, { defaultControlPolicy: 'external' })` becomes
      `typescriptContract(contract, output, { defaultControlPolicy: 'external',
      createNamespace: postgresCreateNamespace })`, with `postgresCreateNamespace` imported
      from the Postgres target's types entrypoint (`@internal/target-postgres/types`) — the
      same factory the PSL specifier already takes. Calls without an options bag are
      unchanged, and `emptyContract` already took `createNamespace`.
    detection:
      glob: "**/*.{ts,mts,cts}"
      contains:
        - 'typescriptContract'
        - 'defaultControlPolicy'
      anyMatch: false
  - id: int-backed-enums-fail-at-authoring
    summary: |
      An `enumType()` whose codec is numeric (e.g. `pg/int4@1`) used to build fine and fail
      later, at migrate time. It now throws `CONTRACT.ENUM_INVALID` while the contract is being
      built, because a numeric member set cannot be rendered as a CHECK predicate. If
      `prisma-next contract emit` fails with "numeric-enum CHECK constraints are not yet
      supported", change that enum's codec to a text one (`pg/text@1`) and give each member a
      string value, or replace it with a Postgres native enum (`pg.enum`), which enforces
      membership through the column type and needs no CHECK at all.
    detection:
      glob: "**/*.{ts,mts,cts,prisma}"
      contains:
        - 'enumType'
      anyMatch: true
---

# 0.17 → 0.18 — User upgrade instructions

## `aggregate-results-carry-their-target-s-codec`

An aggregate's result is a value the database computes, and 0.18 reads it back through the codec its target declares for that result rather than through whatever the driver happened to hand over. What each aggregate returns is now the target's answer, stated in the contract and honoured by the runtime:

| Target | Aggregate | Reads as |
| --- | --- | --- |
| PostgreSQL | `count()` (with or without an argument) | `bigint` |
| PostgreSQL | `sum` over `int2` / `int4` | `bigint` (the sum widens to `int8`) |
| PostgreSQL | `sum` over `int8`, `avg` over any integer | decimal `string` (the result is `numeric`) |
| PostgreSQL | `sum` / `avg` over `float4` / `float8` | `number` |
| PostgreSQL | `min` / `max` | the column's own type — except over `varchar`, which returns `text` |
| SQLite | `count()` | `bigint` |
| SQLite | `sum` over an integer column | `bigint` |
| SQLite | `avg` over anything | `number` (SQLite's `avg` is always real) |
| SQLite | `min` / `max` | the column's own type |

The targets diverge on `avg`, and deliberately: PostgreSQL computes it as `numeric`, SQLite as a float. A query written against both handles both.

Include reducers follow the same rules — `.include('posts', (posts) => posts.count())` yields a `bigint`, and a parent with no related rows reads `0n` where it read `0`.

Two failure modes are worth sweeping for, because neither announces itself:

- **Equality against a number.** `row.count === 2` is `false` when `row.count` is `2n`, and `expect(count).toBe(2)` fails the same way. Change the literal (`2n`), or compare through `Number(...)` where the magnitude is known to be small.
- **Serialisation.** `JSON.stringify` throws `TypeError: Do not know how to serialize a BigInt`. Render explicitly — `String(count)`, or a replacer that maps bigints to strings.

Arithmetic mixing a bigint with a number also throws (`2n + 1` is a `TypeError`); convert one side deliberately.

`having(...)` is the one place that does not move. A HAVING operand is compared inside SQL against the aggregate the database is computing, so it never crosses a codec: `having.count().gte(2)` keeps the plain number it always took. Only the aggregate's *result* — the value that reaches your code — carries its target's type.

Finally, regenerate your contracts:

```bash
prisma-next contract emit
```

The emitted `contract.d.ts` gains an `AggregateTypes` block — the settled result identity per operation and per input codec — and both the ORM client and the SQL builder resolve their aggregate result types from it. Against a contract emitted before 0.18 the block is absent, so an aggregate resolves to `never` in the ORM and to `unknown` in the SQL builder: a type error at the call site in the first case, an untyped value in the second, rather than a wrong runtime value in either.

## Regenerating is the first step

`prisma-next contract emit` rewrites `contract.json` / `contract.d.ts` into the new check shape
and mints the wire names every later step refers to. Do it before editing migration files, so
the constraint names you paste into `addCheckConstraint` / `checkExpression` are the ones the
contract actually declares.

## What the first plan after upgrading looks like

For each enum-restricted column: a DROP of the old unsuffixed constraint and an ADD of the
wire-named one. For each list column: an ADD of an element-non-null constraint that was
previously created without ever being declared. Neither is a data change — but the DROP is
classified `destructive`, so a plan run under an additive-only policy converges only partway
and `db verify --strict` will report the leftovers until you allow it.

There may also be a third kind of operation, and it is the one to read carefully. Introspection
no longer parses predicates: it captures every CHECK constraint on a managed table verbatim,
including the hand-written and platform-installed ones that earlier versions were structurally
unable to see. A check the contract does not declare is an undeclared extra, so
`db verify --strict` reports it and a plan run under a policy that allows `destructive` emits a
`dropCheckConstraint` for it — a constraint you wrote by hand and that has been enforcing your
data all along. Grep the first plan for `dropCheckConstraint` and check every constraint named:

- to keep it, run plans for that table under an additive-only policy. The constraint stays in
  place and keeps enforcing; plain `db verify` tolerates it, and only `--strict` reports it as
  an undeclared extra. Declaring it is not an option in 0.18 — there is no authoring surface
  for a hand-written check (in PSL or in a TypeScript contract), and `contract infer` does not
  read checks back out of the catalog. An authoring/opt-out surface is planned for a later
  release;
- if it was already dead, let the drop through under the destructive plan.

Nothing drops silently — an additive-only policy never emits the operation at all — but the
first plan after upgrading is the moment to look, because it is the first plan that can see
these constraints.
