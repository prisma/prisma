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
      an operation and it appears under its own name with no client change. Deriving the surface
      neither adds nor removes a method by itself, but the block a re-emit produces is not the
      list it was: PostgreSQL now contributes eight operations and SQLite seven, and every bare
      result type moved — `count-over-a-field-counts-that-field` and
      `aggregate-defaults-are-js-native-numbers` cover that, so work them too. If it is not — you author it
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
  - id: aggregate-defaults-are-js-native-numbers
    summary: |
      `count()`, `sum()` over an integer column, and `avg()` over an integer column all return
      `number`. On PostgreSQL they returned, respectively, a `bigint`; a `bigint` or a decimal
      string depending on the column's width; and a decimal string. On SQLite the first two
      returned a `bigint` and `avg()` was already a `number`. The lossless results moved to three new
      operations beside them — `countBigInt()` → `bigint`, `sumBigInt()` → `bigint` (on
      PostgreSQL exact past 2^63 over a `BigInt` / `BigIntNumber` / `UnboundedInt` column, whose
      total the database computes as `numeric`; over the narrower integers the total is an `int8`
      and PostgreSQL raises `bigint out of range` past 2^63), `avgDecimal()` → decimal string
      (PostgreSQL only; SQLite has no
      decimal type and contributes none). An empty input set answers `count()` with `0`, not `0n`.
      A `count()`, or a `sum()` over an integer column, whose value passes ±(2^53 − 1) raises
      `RUNTIME.DECODE_FAILED` instead of returning a rounded number — on the `.include()` path as
      well as the top level — so switch that call to `countBigInt()` / `sumBigInt()` wherever the
      magnitude is real. No other result is guarded: a `sum` outside the integer columns keeps its
      own family, and `avg` is a fraction that rounds as any double does.
      Unchanged: `min` / `max`, `sum` / `avg` over a float column, `sum` over `numeric` (still a
      decimal string), `sum` over `UnboundedInt` (still a `bigint`), and the ORM's `having(...)`
      operands, which the ORM types as `number` whatever the aggregate's result type is. The SQL
      builder's comparison operands are the other case, and they do move: `fns.gt(a, b)` types
      both sides from one codec, so `fns.gt(fns.count(), 1n)` becomes `fns.gt(fns.count(), 1)`.
      Sweep aggregate results for
      `2n`-style literals, `String(count)` serialisation, `Number(...)` unwrapping, and `?? '0'`
      coalescing, and write each as the plain number it now is. Then re-emit with
      `prisma-next contract emit`: `contract.d.ts`'s `AggregateTypes` block carries the new
      result codecs and the three new operations, and until you re-emit, the types describe the
      old results and the new methods do not exist.
    detection:
      glob: "**/*.{ts,tsx,mts,cts}"
      contains:
        - ".aggregate("
        - ".count()"
        - ".groupBy("
        - ".include("
      anyMatch: true
  - id: integer-columns-refuse-the-wrong-js-type
    summary: |
      A `BigInt` or `UnboundedInt` column refuses a JS `number`, and a `BigIntNumber` column
      refuses a `bigint`, with `RUNTIME.ENCODE_FAILED` and a message naming the type that
      arrived: `pg/int8@1 value must be a bigint, got number 9`. The wide-integer codecs used to
      accept a number and stringify it, which let a fractional value such as `1.5` reach an
      integer column unremarked. No typed call site changes — a `BigInt` column's application
      type has always been `bigint` — so sweep the ones that bypassed the types: a
      `// @ts-expect-error` over a create/update value, an `as never` / `as any` argument, a
      value that came out of `JSON.parse` (which yields numbers, never bigints), and dynamic
      dispatch. Convert each to the column's own type, `BigInt(value)` for a `bigint` column.
      Schema-written literal defaults are unaffected: `BigInt @default(0)` still emits, because
      the JSON side of these codecs accepts a safe-integer number and only the wire side does not.
    detection:
      glob: "**/*.{ts,tsx,mts,cts}"
      contains:
        - "bigint"
        - "BigInt"
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

**If your contract is emitted, re-emit it — and keep reading.** Deriving the surface takes nothing away on its own: whatever the composed targets and extensions declare is what the block names. But the built-in targets changed what they declare in this same release. PostgreSQL now contributes eight operations and SQLite seven, and the bare results over integer columns moved — `count`, `sum`, and `avg`. `min` / `max` did not, nor did `sum` and `avg` over a float, `numeric`, or temporal column, nor `sum` over an `UnboundedInt` column. Two entries below carry those changes, and a re-emitted contract lands you in both: [`count-over-a-field-counts-that-field`](#count-over-a-field-counts-that-field) and [`aggregate-defaults-are-js-native-numbers`](#aggregate-defaults-are-js-native-numbers).

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

## `aggregate-defaults-are-js-native-numbers`

The aggregate vocabulary is split in two. The bare operations answer in the type a JS developer expects; three new suffixed operations answer losslessly.

| Call | Reads as | Empty input set |
| --- | --- | --- |
| `count()` | `number` | `0` |
| `countBigInt()` | `bigint` | `0n` |
| `sum(field)` over `Int` / `BigInt` / `BigIntNumber` | `number \| null` | `null` |
| `sumBigInt(field)` over any integer column | `bigint \| null` | `null` |
| `avg(field)` over any integer column | `number \| null` | `null` |
| `avgDecimal(field)` over any integer or `Decimal` column | decimal `string \| null` | `null` |

These do not move: `min` / `max` keep the column's own type; `sum` and `avg` over a float column stay `number`; `sum` over `Decimal` stays a decimal string; `sum` over `UnboundedInt` stays a `bigint`; and the ORM's `having(...)` operands stay plain numbers, because the ORM types a HAVING comparand as `number` whatever result type the aggregate carries.

The SQL builder's comparison operands are the other case, and they do move. `fns.gt(a, b)` types both sides from one codec, so a literal compared against an aggregate follows that aggregate's result codec:

```ts
// before
.having((_f, fns) => fns.gt(fns.count(), 1n))
// after
.having((_f, fns) => fns.gt(fns.count(), 1))
```

Make the same one-token change wherever a `fns.count()` or an integer `fns.sum(...)` meets a literal — in `having(...)`, in `where(...)`, and inside a larger expression.

SQLite states the same policy in its own terms — `count`, integer `sum`, and `avg` are all `number`, with `countBigInt` and `sumBigInt` beside them. **SQLite has no `avgDecimal`**: an exact mean needs a decimal type the database does not have, so the method is absent from a SQLite contract and calling it is a type error.

### What to change

1. **Re-emit first.** `prisma-next contract emit` rewrites the `AggregateTypes` block. Until you do, the types describe the old results and the three new methods do not exist.
2. **Unwrap the bigint handling around bare aggregates.** Each of these is now noise or a type error:

   ```ts
   const { total } = await db.User.aggregate((a) => ({ total: a.count() }));

   total === 2n              // ← was needed; now `total === 2`
   Number(total)             // ← was needed; `total` is already a number
   String(total)             // ← was needed for JSON; JSON.stringify handles it now
   JSON.stringify(rows, (_k, v) => typeof v === 'bigint' ? String(v) : v)
   //                        ↑ the replacer can go
   ```

3. **Change the method, not the value, where you need exactness.** A decimal-string average was doing real work in a money or reporting path; `avgDecimal(field)` returns exactly what `avg(field)` used to, and `countBigInt()` exactly what `count()` used to.

   `sumBigInt(field)` matches the old `sum(field)` everywhere but one column class. On PostgreSQL, a `BigInt` or `BigIntNumber` column's `sum` used to be a decimal `string`, because the database totals a 64-bit column as `numeric`; `sumBigInt` reads that same total as a `bigint`. So a money path summing a `BigInt` column gets a `bigint` where it had a string — exact either way, but a different type. Convert at the consumption site (`String(total)`) if a decimal library or a string comparison is downstream. Over every other integer column, and on SQLite, `sumBigInt` is the old `sum` unchanged.

### The bare operations throw rather than round

A `count()`, or a `sum()` over an integer column, whose value passes ±(2^53 − 1) raises a structured error instead of answering with a rounded one:

```text
RUNTIME.DECODE_FAILED: pg/int8number@1 value must be an integer within
the safe integer range, got 9007199254740992
```

That is the trade these defaults make: a value you can compare, serialise, and do arithmetic with, and a loud failure rather than a quietly wrong total. It fires on the `.include()` path too — the reducer's value travels as a JSON number, but the guard runs after the parse, and rounding is monotone, so a value that was outside the range is still outside it after parsing.

Those two are the results a guarded integer codec produces. A `sum` over a `Decimal`, `UnboundedInt`, or float column stays in that column's own family and has no such guard, and neither does `avg`, which is a fraction already and rounds as any double does — reach for `avgDecimal` where the exact mean matters.

Totals cross the boundary in practice where counts do not: summing 64-bit IDs, or cent amounts across a large table. If a `sum` in your code can plausibly get there, move it to `sumBigInt` now rather than waiting for the error in production.

### If you are upgrading from before 8.0.0-rc.1

You cross two hops, and the aggregate result types move in both. The `0.17 → 8.0.0-rc.1` step changes `count()` to `bigint` and integer averages to decimal strings; this step changes those same calls to `number` and adds the suffixed variants. Apply the steps in order — that is what the upgrade skill does — but do the sweeping once, at the end: for `count()` and integer `sum()` / `avg()`, the destination is `number`, which is where a pre-8.0.0-rc.1 codebase already was. What genuinely changed for you across both hops is the throw outside ±(2^53 − 1) on `count()` and integer `sum()`, and the three new operations; the empty-relation `count` ends where it started, at `0`.

## `integer-columns-refuse-the-wrong-js-type`

Writing a JS `number` to a `BigInt` or `UnboundedInt` column now fails before any SQL runs:

```text
RUNTIME.ENCODE_FAILED: pg/int8@1 value must be a bigint, got number 9
```

The codec used to accept the number and stringify it, so `9` wrote `9` and `1.5` wrote `1.5` — a fractional value in an integer column, unremarked. The mirror case reports as clearly: passing `9n` to a `BigIntNumber` column names the type that arrived rather than complaining about a range the value is plainly inside.

No typed call site changes, because a `BigInt` column's application type has always been `bigint`. Sweep the ones that got past the types:

- a `// @ts-expect-error` over a `create(...)` / `update(...)` value;
- `value as never` or `value as any` in a write;
- a value that came out of `JSON.parse`, which yields numbers and never bigints;
- dynamic dispatch through a `Record<string, unknown>`.

Convert each to the column's own type — `BigInt(value)` for a `bigint` column, and a plain number for a `BigIntNumber` one.

Schema-written defaults need nothing. `BigInt @default(0)` still emits and still migrates: the JSON side of these codecs accepts a safe-integer number, because a schema language writes no `bigint` literal, and only the query-parameter side requires the exact type.

<!--
PR #29910: `changes: []`. The example changes repair test instrumentation and fixture/runtime isolation after the driver SPI split; they require no user API, contract, configuration, generated-artifact, or source translation.
PR #29902: `changes: []`. Generated contracts gain additive aggregate rows for new opt-in integer representation codecs, but existing schemas and source require no migration; users re-emit only when adopting the new target-scoped types.
PR #29950: `changes: []`. The demo applications adopt the integer representation types and the precision-preserving aggregates on their own models, and the reference docs gain the matching examples; the diff is confined to example apps and documentation and requires no user API, contract, configuration, generated-artifact, or source translation.
PR #29939: `changes: []`. Dependabot's weekly runtime-dependency bumps (`ws`, `lucide-react`, `postcss`, `uniku`, `@vercel/detect-agent`, and the `@types/node` / `@types/pg` / `tsx` catalog entries). The example diff is dependency version strings, and requires no user API, contract, configuration, generated-artifact, or source translation.
PR #29940: `changes: []`. Dependabot's weekly dev-dependency bumps (type packages, wrangler, biome, test tooling) plus the matching `biome.jsonc` `$schema` realignment; the example diffs are devDependency version strings and a schema URL, and require no user API, contract, configuration, generated-artifact, or source translation.
PR #29965: `changes: []`. Dependabot's dev-dependency bumps (`wrangler`, `@cloudflare/vitest-pool-workers`, `@biomejs/biome`) plus the matching `biome.jsonc` `$schema` realignment to 2.5.7; the example diffs are devDependency version strings and a schema URL, and require no user API, contract, configuration, generated-artifact, or source translation.
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
