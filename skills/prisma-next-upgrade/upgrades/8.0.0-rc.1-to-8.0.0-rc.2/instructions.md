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
  - id: aggregate-methods-come-from-the-emitted-contract
    summary: |
      The aggregate methods — `count`, `sum`, `avg`, `min`, `max` — are no longer declared on the
      ORM and SQL-builder surfaces outright. Each surface is derived from the operation names in
      the emitted `contract.d.ts`'s `AggregateTypes` block, so a target or extension can contribute
      an operation and it appears under its own name with no client change. If your contract is
      emitted with `prisma-next contract emit` on 8.0.0-rc.1 or later, nothing changes: the same
      five methods are there with the same arities and result types. If it is not — you author it
      in code with `defineContract(...)` and hand that value straight to the client (the no-emit
      flow), or you have not re-emitted since before 8.0.0-rc.1 — every aggregate surface resolves
      to `AggregateOperationsUnavailable`, an empty type, and each call becomes
      `Property 'count' does not exist on type 'AggregateOperationsUnavailable'`. That covers
      `aggregate()`, `groupBy().aggregate()`, `groupBy().having()`, the `include(...)` reducers,
      and `sql()`'s `fns.count` / `fns.sum` / … Runtime behaviour is unchanged; this is a
      compile-time change. Re-emit the contract, or cast the builder to a dynamic record.
    detection:
      glob: "**/*.{ts,tsx,mts,cts}"
      contains:
        - "defineContract"
        - ".aggregate("
        - ".having("
        - "fns.count"
      anyMatch: true
  - id: count-over-a-field-counts-that-field
    summary: |
      `aggregate.count(field)` renders `COUNT(<column>)`. It used to accept the argument, discard
      it, and render `COUNT(*)`. PostgreSQL declares `count` over any input, so the derived method
      carries both arities honestly: `count()` counts rows, `count(field)` counts that field's
      non-null values. No previously type-safe call changes meaning — `count` took no argument
      before, so the field-taking form never typechecked. What changes is a call that got past
      the types: a `@ts-expect-error` above a `count(...)`, a `count(x as never)`, or dynamic
      dispatch. Those now count a column instead of rows, which differs whenever the column holds
      NULLs. Sweep them and drop the argument wherever `COUNT(*)` was what you meant.
    detection:
      glob: "**/*.{ts,tsx,mts,cts}"
      contains:
        - "count("
        - ".aggregate("
      anyMatch: true
---

# 8.0.0-rc.1 → 8.0.0-rc.2 — User upgrade instructions

## `aggregate-methods-come-from-the-emitted-contract`

Which aggregate methods exist is now the contract's answer rather than a fixed list in the client. The emitted `contract.d.ts` carries an `AggregateTypes` block naming every operation your target and extensions declare, and each surface below is derived from it:

| Surface | What it offers |
| --- | --- |
| `db.orm.User.aggregate((a) => …)` | one selector method per declared operation |
| `db.orm.User.groupBy('kind').aggregate((a) => …)` | the same |
| `db.orm.User.groupBy('kind').having((h) => …)` | the same, restricted to `count` / `sum` / `avg` / `min` / `max` |
| `db.orm.User.include('posts', (posts) => posts.count())` | one reducer per declared operation |
| `db.sql.public.user.select('n', (f, fns) => fns.count())` | one function per declared operation |

**If your contract is emitted, you are done.** The block declares the five operations both built-in targets contribute, so the methods, their arities, and their result types are exactly what they were.

**If your contract's block is unknown, the surfaces are empty.** Two situations reach that state:

- You author the contract in TypeScript with `defineContract(...)` and pass the value straight to the client, never running `prisma-next contract emit`. A contract value built in code carries no emitted type maps.
- You are still using a `contract.d.ts` emitted before 8.0.0-rc.1, when the `AggregateTypes` block did not exist yet.

Either way the call is a compile error:

```text
Property 'count' does not exist on type 'AggregateOperationsUnavailable'.
```

The type is an empty interface whose name is the diagnosis; hovering it shows the reason. Nothing changes at runtime — the client installs its aggregate methods from the composed target and extensions, exactly as it always has.

**Preferred fix: emit the contract.** Run

```bash
prisma-next contract emit
```

and type the client from the emitted `Contract`. That gives you the whole aggregate surface back, plus the per-operation result types and the field names each operation admits.

**Alternative, where the contract is deliberately un-emitted:** cast the builder and dispatch by name.

```ts
import type { AggregateSpec } from '@prisma/orm-postgres/orm-client';

type DynamicAggregates = Record<string, (field?: string) => AggregateSpec[string]>;

const stats = await db.User.aggregate((aggregate) => {
  const dynamic = aggregate as DynamicAggregates;
  return { total: dynamic['sum']!('views'), peak: dynamic['max']!('views') };
});
```

If you previously widened the *argument* instead — `aggregate.sum('views' as never)`, which compiled because the admitted field names were already `never` for such a contract — move the cast from the argument to the builder and pass the field name as a plain string.

## `count-over-a-field-counts-that-field`

```ts
await db.User.aggregate((aggregate) => ({ all: aggregate.count() }));
// SELECT COUNT(*) …

await db.User.aggregate((aggregate) => ({ withEmail: aggregate.count('email') }));
// SELECT COUNT("email") … — rows whose email is NULL are not counted
```

The second form used to render `COUNT(*)`: the argument was accepted and thrown away. Both arities are now read off what the target declares for `count` — PostgreSQL declares it over any input, which means both a call with a value and a call without one — so the argument is honoured.

No previously type-safe call changes meaning, because `count` took no argument and the field-taking form did not typecheck. Sweep instead for calls that bypassed the types:

- a `// @ts-expect-error` directly above a `count(...)` call — where the argument is a field your contract admits, that suppression is now unused and TypeScript flags the unused directive;
- `count(field as never)` or `count(field as any)`;
- dynamic dispatch through a `Record<string, …>` cast.

For each, decide which count you meant: `count()` for rows, `count(field)` for that field's non-null values.

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
