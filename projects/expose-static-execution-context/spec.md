# Orphan slice: expose the static execution context symmetrically

Standalone slice (no parent project). Make the execution plane's **static context** — the
`ExecutionContext` (contract + codecs + operations + types, no driver/connection) — a
first-class, symmetric, client-safe surface on both the Mongo and Postgres facades.

## At a glance

The SQL/Postgres facade already builds its `ExecutionContext` **upfront** and exposes it as
`db.context: ExecutionContext<TContract>` (`packages/3-extensions/postgres/src/runtime/postgres.ts`,
`createExecutionContext({ contract, stack })`). The type lives in
`packages/2-sql/4-lanes/relational-core/src/query-lane-context.ts`:

```ts
interface ExecutionContext<TContract> {
  readonly contract: TContract;
  readonly contractCodecs: ContractCodecRegistry;
  readonly codecDescriptors: CodecDescriptorRegistry;
  readonly queryOperations: SqlOperationRegistry;
  readonly types: TypeHelperRegistry;
}
```

Mongo has the equivalent — `MongoExecutionContext` in
`packages/2-mongo-family/7-runtime/src/mongo-execution-stack.ts`, whose own doc says
*"Mirrors SQL's `ExecutionContext` in role; Mongo's flavour is leaner."* — but it was never
finished into a usable static context. Three gaps versus SQL:

| | SQL `ExecutionContext` | `MongoExecutionContext` |
|---|---|---|
| built | upfront, before connect | lazily inside `buildRuntime` (`mongo.ts:145`), only on connect |
| exposed | `db.context` | not exposed |
| typed | `contract: TContract` | `contract: unknown` |

The Mongo context is **already driver-free**: `createMongoExecutionStack({ target, adapter })`
takes no driver (it is optional), `@internal/mongo-runtime` has zero driver dependencies,
and the `MongoDriverImpl` is created separately and only handed to `createMongoRuntime`. So
the static context is built without touching `mongodb` today — it is just buried in the
connect path and discarded as a standalone value.

This slice surfaces that abstraction symmetrically and uses it to replace the example's interim
`buildNamespacedEnums` + `blindCast` static-enum helper.

## Why now

PR #880 ("Exercise Mongo enums in retail-store") needed the static enum accessors importable
from a `'use client'` component without pulling the Mongo driver into the browser bundle. It
prototyped a `mongoEnums` + dedicated `@internal/mongo/enums` entrypoint to do that, then
**pulled it back out** — that machinery did not belong in an "exercise enums" PR. The example
now builds its static enums directly from the existing public, driver-free `buildNamespacedEnums`
(`@internal/contract/enum-accessor`) with one `blindCast` in `src/enums.ts`. That works but
is a narrow point solution: the real abstraction is the `ExecutionContext`, which both targets
should build upfront, expose, and offer client-safe. This slice provides the principled surface
the prototype was reaching for.

## Chosen design

The static context to expose **is** the `ExecutionContext` (the execution plane's driver-free
foundation). `enums`, the query builder (`query`/`sql`), and `raw` all derive from it.

1. **Mongo — build upfront, type, expose.** Lift `createMongoExecutionContext({ contract, stack })`
   out of `buildRuntime` so it is constructed once at facade-build time from a driver-free
   stack (`{ target, adapter }`); `buildRuntime` reuses it and adds the driver. Type it
   `MongoExecutionContext<TContract>` (`contract: TContract`, not `unknown`). Expose
   `readonly context: MongoExecutionContext<TContract>` on `MongoClient`, mirroring Postgres's
   `db.context`.

2. **Client-safe static-context factory per target.** `mongoStatic({ contractJson })` /
   `postgresStatic({ contractJson })` on a dedicated client-safe entrypoint
   (`@internal/<target>/static`) build the `ExecutionContext` from the static contract with
   no driver, and return it alongside the derived static surface (`enums`, builder, `raw`,
   `contract`). The factory and the facade share one builder so the exposed `db.context` and
   the standalone context are identical.

3. **Postgres — driverless context for the client-safe path.** Postgres's `createExecutionContext`
   treats the driver as optional (capability source only), but the facade builds its `stack`
   with the driver and imports `postgresDriver` at module level. For `postgresStatic`, build the
   context from a driverless (adapter-only) stack in a driver-free module. Also expose
   `readonly contract` on `PostgresClient` for shape symmetry (it surfaces `context`/`stack`
   today but not `contract`).

4. **Centralise the enum/`raw` derivation; remove the per-facade `blindCast`.** The actual
   `buildNamespacedEnums` + `blindCast` leak lives in the **facades** today, not the example —
   `postgres.ts` (`blindCast<NamespacedEnums…>`) and `mongo.ts` (`unboundNamespace` blindCast).
   The `<target>Static` factory owns the typed enum (and `raw`, where the target has one)
   derivation once; the facade calls the same builder, so the cast lives in framework code in
   one place instead of being re-asserted per facade.

5. **Migrate the interim consumer.** #880 landed on `main` (only its `@internal/mongo/enums`
   entrypoint was pulled), so `examples/retail-store/src/enums.ts` — the `buildNamespacedEnums`
   + `blindCast` interim — **does** exist, consumed by the `'use client'` `checkout-form.tsx`,
   `seed.ts`, and `api/orders/route.ts`. Delete that interim and point its consumers at
   `mongoStatic` / `@internal/mongo/static` so the typing comes from the framework, not a cast
   in example code. `checkout-form.tsx` importing the static surface is the `next build`
   client-safety acceptance test.

## Definition of done

- Both facades build the `ExecutionContext` upfront and expose `db.context: ExecutionContext<TContract>`
  with the same shape (Mongo's typed `<TContract>`, no `unknown`).
- `mongoStatic`/`postgresStatic` exist on `@internal/<target>/static`, return the
  `ExecutionContext` + derived static surface, and are **client-safe**: a `'use client'`
  component importing them builds (`next build`) with **no driver code in the client bundle**
  (the acceptance test that gated #880). Client-safety is also asserted cheaply in CI by a
  package test that imports each `/static` entrypoint and fails if the resolved module graph
  pulls in a driver package (`mongodb`, `pg`, `@internal/driver-*`).
- A minimal `'use client'` component in `retail-store` consumes `@internal/mongo/static` and
  stays green (typecheck, tests, `next build`).
- The per-facade enum `blindCast` is gone — both facades derive `enums` through the shared
  static builder.
- `db.enums`/`db.query`/`db.raw`/`db.sql` continue to behave identically (derived from the
  shared context).
- Symmetric: the same factory + entrypoint pattern on both targets; member shapes align
  (`contract`, `enums`, builder, `raw`, `context`).

## Out of scope / notes

- **Client-safety required a driver-free fix in the Mongo adapter.** The premise that building
  the Mongo `ExecutionContext` is driver-free was only true for `@internal/mongo-runtime`, not
  the adapter: the codec module (`packages/3-mongo-target/2-mongo-adapter/src/core/codecs.ts`)
  value-imported `ObjectId` from `mongodb`, dragging the whole driver into the client bundle
  (`next build` failed with 19 errors). `ObjectId` is a `bson` class `mongodb` merely re-exports,
  so the fix is to import it from the standalone browser-safe `bson` package. This is almost
  certainly why #880's `mongoEnums` entrypoint was pulled. The original client-safety tests also
  passed vacuously (an off-by-one `ROOT` so the graph walk read nothing); the strengthened walk
  now traverses workspace packages and distinguishes value from `import type`.
- This is distinct from `projects/facade-import-surface-completion/` (import-path consolidation).
  This slice is about the execution-plane static context abstraction, not import shapes.
- SQLite: the Postgres changes are SQL-family-level (`createExecutionContext`, the SQL builders),
  so SQLite inherits most of it; confirm and extend `sqliteStatic` for full parity if cheap.
- `MongoExecutionContext` is intentionally leaner than SQL's (no parameterised codecs, no
  JSON-schema validators, no mutation-default generators yet). Typing/exposing it does not
  require adding those — only `contract: TContract` and surfacing the existing value.
