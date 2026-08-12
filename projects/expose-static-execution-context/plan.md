# Plan — expose the static execution context symmetrically

One orphan slice, one PR (#888, branch `slice/expose-static-execution-context`). Taken over from
the planning-only PR; spec is the accepted contract. Decomposed into three sequential implementer
dispatches — sequential because D2 mirrors the surface D1 designs, and D3 consumes D1's entrypoint.
Tests-first in every dispatch.

## Grounded boundaries

- Entrypoint mechanics: `src/exports/<name>.ts` barrel + entry in `tsdown.config.ts` + `exports`
  map in `package.json`. Adding `@internal/<target>/static` = those three touch-points plus the
  factory module.
- `createSqlExecutionStack` / `createExecutionContext` (`packages/2-sql/5-runtime/src/sql-context.ts`)
  both take `driver` as **optional** (capability source only) → a driverless Postgres context is
  buildable. Constraint: the static module must not import `postgresDriver` (module-level driver
  import is what pulls `pg` into the bundle).
- Mongo context is already driver-free (`createMongoExecutionStack({target, adapter})` takes no
  driver). It is built lazily inside `buildRuntime` (`mongo.ts:145`) and discarded as a standalone
  value. `MongoExecutionContext` is typed `<TTargetId>` with `contract: unknown`
  (`mongo-execution-stack.ts:114`).
- Mongo facade surface today: `orm`/`query`/`contract`/`enums` (no `context`, no `raw`, no `sql`).
  Postgres facade surface: `sql`/`orm`/`enums`/`raw`/`context`/`stack` (no `contract`).

## D1 — Mongo: type, lift, expose, `mongoStatic`

1. `@internal/mongo-runtime` (`mongo-execution-stack.ts`): add a `TContract` generic to
   `MongoExecutionContext` / `createMongoExecutionContext`; type `contract: TContract` (drop
   `unknown`). Keep `TTargetId`.
2. `mongo.ts` facade: build `createMongoExecutionContext({contract, stack})` **once upfront** from
   the driver-free stack; `buildRuntime` reuses it (adds only the driver). Expose
   `readonly context: MongoExecutionContext<TContract>` on `MongoClient`.
3. New `@internal/mongo/static` entrypoint (`src/exports/static.ts` + tsdown + package.json):
   `mongoStatic({ contractJson })` → `{ context, contract, enums, query }`. Shared builder owns the
   typed `enums` derivation; the facade calls it too, removing the `unboundNamespace` blindCast.
4. Tests-first: facade exposes typed `context`; `mongoStatic` returns matching shapes; enums behave
   identically; client-safety import-graph test (no `mongodb`/`@internal/driver-mongo` in the
   `/static` module graph).

## D2 — Postgres: expose `contract`, driver-free `postgresStatic` (mirror D1)

1. `postgres.ts`: expose `readonly contract` on `PostgresClient`; route `enums` through the shared
   static builder (remove the `blindCast`).
2. New driver-free module + `@internal/postgres/static` entrypoint: `postgresStatic({contractJson})`
   builds an adapter-only (driverless) stack + context, returns `{ context, contract, enums, sql, raw }`.
   Must not import `postgresDriver`.
3. SQLite parity: extend `sqliteStatic` only if cheap (changes are SQL-family-level so it mostly
   inherits); otherwise defer with a note.
4. Tests-first: `context`/`contract` exposed and typed; `postgresStatic` shapes; client-safety
   import-graph test (no `pg`/`@internal/driver-postgres`).

## D3 — Consumer + acceptance + full gate

1. Minimal `'use client'` component in `examples/retail-store` importing `@internal/mongo/static`
   and using the static surface (enums).
2. Confirm both client-safety import-graph tests pass; retail-store typecheck + `next build` clean.
3. Full CI gate set (build, typecheck --force, the Lint job incl lint:deps/lint:casts, fixtures:check,
   all three test suites) before declaring green. PR title/body refresh to convert #888 from
   planning-only to the implementation PR.

## Open call (flagged, proceeding with the recommendation)

Consumer approach = **A** (fresh client component), since the spec's "migrate the interim" target
never existed on `main` and #880's machinery was deliberately pulled. Will steered "take it over"
without redirecting this; proceeding with A.
