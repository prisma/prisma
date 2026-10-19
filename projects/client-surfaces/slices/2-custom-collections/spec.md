# Slice 2: every SQL client takes custom collection classes

Ticket: TML-3546. Branch: `tml-3546-every-sql-client-takes-custom-collection-classes` from `main`. Project: [../../spec.md](../../spec.md). Decision: ADR 274, decision 2.

## At a glance

```ts
export const contract = contractFromJson<Contract>(contractJson);

export const db = postgres({
  contract,
  url: process.env['DATABASE_URL']!,
  collections: { User: UserCollection, Post: PostCollection },
});

await db.orm.public.Post.published().all();

await db.transaction(async (tx) => {
  const posts = await tx.orm.public.Post.published().forUpdate().all();
});
```

Both calls compile, and `published()` runs, on every SQL client.

## Chosen design

1. **A `collections` option on every SQL client:** `postgres()`, `postgresServerless()`, `sqlite()` and `supabase()`. It has the same type `orm({ collections })` already takes (`packages/3-extensions/sql-orm-client/src/orm.ts`), and its type is inferred from the value. The client call names no type (slice 1 made this possible).
2. **The classes reach every ORM the client offers:**
   - `db.orm` and the `tx.orm` of every transaction, on Postgres and SQLite;
   - every connection a serverless client's `connect()` opens, and those connections' transactions;
   - every client Supabase binds to a database role (`asUser`, `asAnon`, the service role). Supabase's transaction offers no ORM yet; slice 3 adds it, with the classes.
   - Supabase's own internal ORM, over its extension contract, does not take the application's classes.
3. **The client types carry the classes.** Each client type gains a second type parameter for the classes, defaulting to no classes, for example `PostgresClient<TContract, TCollections = Record<never, never>>`. The facades' `OrmClient` aliases stop dropping `orm()`'s `Collections` parameter. A type written with only the contract, such as `PostgresClient<Contract>`, still describes a client without classes.
4. **The examples use the client's ORM.** `examples/prisma-8-demo`, `examples/prisma-8-demo-sqlite`, `examples/paradedb-demo` and `examples/prisma-8-cloudflare-worker` pass their classes to the client and drop `createOrmClient` and every other hand-built `orm({ runtime, context, collections })`. `examples/prisma-8-demo` gains one query that uses a custom class method together with a row lock inside a transaction.
5. **Docs:** the READMEs of the SQL ORM client and the facades, and `skills/prisma-8`, show `collections` on the client and no hand-built ORM client for custom classes. ADR 274's opening example compiles.

## Coherence rationale

One option, threaded to every place a client builds an ORM, plus the type parameter that carries it, plus moving the examples onto it. One reviewer can hold it.

## Scope

**In:** everything above, with upgrade instructions for applications that build their own ORM client to reach custom classes.

**Out:**
- Supabase's transaction ORM, `raw` and `prepare` on transactions, SQLite's `fragment` (slice 3).
- Creating clients without side effects, `toSql`, `query`, `mode` (slice 4).
- Tightening what `collections` accepts (for example rejecting a key that is not a model name). It keeps `orm()`'s existing type.
- MongoDB, which has no custom collection classes.

## Pre-investigated edge cases

| Case | Disposition |
| --- | --- |
| A test that passes only because it builds its own `orm()` | The new tests go through each published client, never a hand-built `orm()`. This is how the gap stayed hidden. |
| `tx.orm` built in a separate code path from `db.orm` (`postgres-members.ts`, `sqlite.ts`) | Both paths take the classes; a test calls a class method on each. |
| A class method that returns `this.where(...)` chained after `forUpdate()` | Chaining keeps the class (ADR 265); the transaction test chains a lock after a class method. |
| A function typed against `PostgresClient<Contract>` receiving a client with classes | Must still compile: the default type parameter makes a client with classes assignable where no classes are expected, or the spec is wrong. Cover with a type test. |
| The serverless client builds an ORM at factory time with a runtime that always throws | It takes the classes too, so a wrong class fails at factory time, as today's context check does. |

## Slice-specific done conditions

- A run-time test per client (Postgres, serverless connection, SQLite, Supabase role-bound client) calls a custom class method on `db.orm`, and on `tx.orm` where the client has one, through the published factory.
- A type test per client shows the method typed on `db.orm` and `tx.orm`, and a negative type test shows a method that does not exist is rejected.
- `git grep` finds no `orm({` call that passes `collections` in examples, READMEs, docs or skills.

## Dispatch plan

### D1. The option and its types

- **Outcome:** every SQL client takes `collections`, passes it to every ORM it builds, and carries it in its types, with the run-time and type tests above.
- **Builds on:** `main`.
- **Hands to D2:** the option, built, so examples and docs can move.
- **Focus:** `packages/3-extensions/{postgres,sqlite,supabase}`, and `sql-orm-client` only if its exported types need it.

### D2. Examples, docs and upgrade instructions

- **Outcome:** the examples use the client's ORM with their classes, the docs show it, upgrade instructions exist, and every repository check passes.
- **Builds on:** D1.
- **Hands to:** review and PR.
