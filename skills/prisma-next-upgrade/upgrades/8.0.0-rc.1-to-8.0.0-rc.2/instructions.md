---
from: "8.0.0-rc.1"
to: "8.0.0-rc.2"
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
      Introspection also stopped parsing predicates, so every CHECK constraint on a managed
      table is now visible — including hand-written ones (`price > 0`, a composite `AND`, a
      `NOT VALID` constraint) that earlier versions could not see at all. An undeclared check
      is an extra: `prisma-next db verify --strict` reports it, and a plan run under a policy
      that allows `destructive` emits a `dropCheckConstraint` operation for it. Read the first
      plan for `dropCheckConstraint` operations naming constraints you wrote by hand. There is
      no way to declare a hand-written check in 8.0.0-rc.2 — checks have no authoring surface — so
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

# 8.0.0-rc.1 → 8.0.0-rc.2 — User upgrade instructions

<!--
PR #29910: `changes: []`. The example changes repair test instrumentation and fixture/runtime isolation after the driver SPI split; they require no user API, contract, configuration, generated-artifact, or source translation.
PR #29902: `changes: []`. Generated contracts gain additive aggregate rows for new opt-in integer representation codecs, but existing schemas and source require no migration; users re-emit only when adopting the new target-scoped types.
-->

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
  an undeclared extra. Declaring it is not an option in 8.0.0-rc.2 — there is no authoring surface
  for a hand-written check (in PSL or in a TypeScript contract), and `contract infer` does not
  read checks back out of the catalog. An authoring/opt-out surface is planned for a later
  release;
- if it was already dead, let the drop through under the destructive plan.

Nothing drops silently — an additive-only policy never emits the operation at all — but the
first plan after upgrading is the moment to look, because it is the first plan that can see
these constraints.
