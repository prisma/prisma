---
from: "0.17"
to: "0.18"
changes:
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
      `expression: `"kind" IN ('admin', 'user')`` — and use the wire name from your
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
