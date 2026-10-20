# Slice 4: a client loads without a database, renders SQL, and runs plans

Ticket: TML-3604. Branch: `tml-3604-a-client-loads-without-a-database-and-runs-plans` from `main`, after slice 3 merges. Project: [../../spec.md](../../spec.md). Requirements: project spec, cross-cutting requirements 5 and 8, and the definition-of-done item about printing SQL with no database.

## At a glance

```ts
// scripts/print-sql.ts — no DATABASE_URL, no database running
import { db } from '../src/prisma/db';

const plan = db.orm.public.Post.published().prepared.all().plan;
console.log(db.toSql(plan));
// { sql: 'SELECT … FROM "public"."post" WHERE "post"."published" = $1', params: [true] }
```

```ts
const plan = db.sql.public.post.select('id', 'title').limit(10).build();
for await (const row of db.query(plan)) console.log(row);
await db.execute(db.raw.sql`UPDATE post SET pinned = false`.build());
```

```ts
const db = postgres({ contract, url, middleware: [budgets({ maxLatencyMs: 200 })], mode: 'permissive' });
```

## Chosen design

1. **Creating a client has no side effects, and a test proves it for every client.** `postgres()`, `postgresServerless()`, `sqlite()` and `supabase()` are each created with no URL and no database. The test then reads the static members, builds a plan from `sql`, `raw` and `orm` (including a custom collection class method), and renders it with `toSql`. For Supabase the plans come from a role-bound client (`db.asAnon()`), because `SupabaseDb` itself has no query builders. The test also shows that no pool, driver or connection was created.
2. **Supabase creates its pool and driver on the first query.** Today `supabase()` creates the `pg.Pool`, the driver and both runtimes when it is called, as soon as a URL is given. It changes to the lazy pattern `postgres()` uses. It stays `async` and keeps requiring `jwtSecret` or `jwksUrl`, because those are configuration, not a database.
3. **`toSql(plan)` is a static member.** It returns `{ sql, params }` for a plan from `sql`, `raw` or the ORM (`SqlQueryPlan`). It needs only the adapter and the contract (`lowerSqlPlan`), so it works with no database. It is on `PostgresStaticContext` and `SqliteStaticContext`, so `postgresStatic()`, `sqliteStatic()`, `postgres()`, the serverless client and its connections, and `sqlite()` all have it, and so does every transaction. Supabase role-bound clients have it too, and the service-role client's `supabase` member has its own over the extension contract. It checks the plan's target and storage hash with the same check the runtime uses, so it rejects what the runtime would reject. The static entries keep the adapter they already build. Its JSDoc and the facade READMEs say exactly what it returns:
   - `params` are the values the plan holds, before codecs encode them for the driver;
   - middleware rewrites (`beforeCompile`) are not applied, because they belong to running a query;
   - a plan with `prepare` bind sites is rejected with the existing `RUNTIME.PREPARE_BIND_ON_ADHOC` error code, with a message worded for `toSql`.
4. **`query(plan)` and `execute(plan)` on every SQL client.** They have the signatures a transaction's `query` and `execute` already have (`RuntimeScope` in relational-core), so the client and the transaction share one member type per family. For Postgres they are declared once, in `PostgresQueryMembers`, which a client, a serverless connection and a transaction share; the serverless client does not have them. SQLite gets them on `SqliteClient`. Supabase role-bound clients already have them. `SupabaseDb` gets none, because a query on it would have no role. MongoDB gets none: `db.query` there is already its query builder, and MongoDB is outside this project's `query(plan)` scope.
5. **A `mode` option on every SQL client.** `postgres()`, `postgresServerless()`, `sqlite()` and `supabase()` take `mode?: RuntimeMode` (`'strict' | 'permissive'`, named once in the SQL runtime) and pass it on to the SQL runtime, which already supports it with `'strict'` as the default. MongoDB already has it. The README explains how this affects `budgets`: `'permissive'` turns a `'warn'` severity into a warning, and a row-count limit warns only if its severity is also `'warn'`.
6. **User-facing code moves off `db.runtime().query(plan)` and `db.runtime().execute(plan)`.** This covers examples, package READMEs, docs (including the Serverless Deployment Guide and ADR 263's text), `skills/prisma-8` and `apps/telemetry-backend`. `db.runtime()` stays for what it is still needed for: `connection`, `close` and `telemetry`. Release notes and the CHANGELOG are history and stay as they are. Tests that exercise the runtime directly stay as they are.

## Coherence rationale

The four items share one property: a client is a complete object for tools and applications. It can be loaded, it can render what it would run, and it can run a plan without reaching through `runtime()`. They change the same facade files as slice 3.

## Scope

**In:** everything above; the demo script in the At a glance as a test in `examples/prisma-8-demo` that imports `src/prisma/db.ts` with `DATABASE_URL` unset; docs; upgrade instructions if a type a user or extension author names changes (for example a test double typed as `PostgresClient`).

**Out:**
- Making `supabase()` synchronous.
- Wire-encoded parameters in `toSql` (they need an async codec step and the runtime's middleware).
- Plan forms for writes (project non-goal).
- `query(plan)` on MongoDB.

## Pre-investigated edge cases

| Case | Disposition |
| --- | --- |
| `db.query(preparable.plan)` on an ORM plan | Yields database rows, not the result `consume` builds, as `db.runtime().query(plan)` does today. The README says so. |
| `postgres()` with no URL: `prepare`, `transaction` and `runtime()` create the pool | Not part of the no-side-effects test. The test uses static members, plan building and `toSql` only. |
| `postgres-serverless.test.ts` asserts the exact key list of the serverless client | Update it to include `toSql`. |
| The `postgres.test.ts` no-pool test casts `{ contract }` with `as Parameters<…>` | Remove the cast; the type no longer needs it. |

## Slice-specific done conditions

- A no-database test per client, as described in design point 1.
- A type test shows `db.query`, `db.execute` and `db.toSql` have the same types on a client, a serverless connection and a transaction, where they exist.
- No example, README, doc or skill calls `runtime().query(` or `runtime().execute(`.

## Dispatch plan

### D1. Client members and lazy Supabase

- **Outcome:** design points 1 to 5, with the tests above.
- **Builds on:** `main` after slice 3.
- **Hands to D2:** the members, built.
- **Focus:** `packages/3-extensions/{postgres,sqlite,supabase}`, `packages/2-sql/5-runtime` if a shared type moves.

### D2. Call sites, docs, upgrade instructions and checks

- **Outcome:** design point 6; the demo test; docs for `toSql`, `query`, `execute` and `mode`; upgrade instructions if needed; every repository check passes.
- **Builds on:** D1.
- **Hands to:** review and PR.
