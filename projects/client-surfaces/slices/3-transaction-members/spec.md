# Slice 3: a transaction offers the client's query members

Ticket: TML-3603. Branch: `tml-3603-a-transaction-offers-the-clients-query-members` from `main`. Project: [../../spec.md](../../spec.md). Requirement: project spec, cross-cutting requirement 3.

## At a glance

```ts
await db.transaction(async (tx) => {
  const posts = await tx.orm.public.Post.published().forUpdate().all();
  await tx.execute(tx.raw.sql`UPDATE post SET pinned = false WHERE id = ${posts[0]!.id}`.build());
  const byId = await tx.prepare({ id: 'pg/int4@1' }, (params) =>
    tx.sql.public.post.select('id').where((f, fns) => fns.eq(f.id, params.id)).build(),
  );
  await byId.query(tx, { id: 1 });
});
```

The same code works inside a transaction on every SQL client: Postgres, a serverless connection, SQLite, and a Supabase role-bound client.

## Chosen design

1. **A transaction offers the client's query members.** On every SQL client, `tx` has `sql`, `orm` (with the client's custom collection classes), `raw`, `prepare`, `query` and `execute`, with the same types as on the client. It has no lifecycle members (`close`, `[Symbol.asyncDispose]`), no `transaction` and no `runtime()`. `query` and `execute` are already there, because every transaction context is a queryable runtime; this slice adds the rest.
2. **A statement runs where it is executed.** A query built with `tx.sql`, `tx.raw` or `tx.orm` and run through `tx` runs inside the transaction. A prepared statement runs on the runtime passed to it, `ps.query(tx, params)`, as it does today; `tx.prepare` exists so code inside a transaction needs nothing from the outer client. If preparing itself uses a connection, `tx.prepare` uses the transaction's.
3. **Supabase's transaction catches up.** A Supabase role-bound client's `transaction` gives `tx` the same members as above, with the application's custom collection classes on `tx.orm`, and every statement inside runs under the role the client is bound to.
4. **SQLite's ORM offers `fragment`.** SQLite's `db.orm` and `tx.orm` expose the single namespace of the ORM client (SQLite has no schemas), which leaves out `fragment`. They offer `fragment` beside the models, as Postgres's `db.orm.fragment` does, without changing how models are reached (`db.orm.Post`).
5. **One definition of the transaction's members per family.** The members a transaction offers are defined once and reused by every client of a family, the way Postgres and the serverless client already share `buildPostgresRuntimeBoundMembers`, so a member added later reaches every client's transactions.

## Coherence rationale

One property, "a transaction offers what the client offers", checked on four clients. The SQLite `fragment` gap is the same kind of gap (a member the client should have), small, and in the same files.

## Scope

**In:** everything above, docs for the transaction members on each facade README and in `skills/prisma-8`, and upgrade instructions if any type a user names changes.

**Out:**
- Creating clients without side effects, `toSql(plan)`, `query`/`execute` on the client itself, the runtime `mode` option (slice 4).
- MongoDB transactions (another project).
- `enums` and `nativeEnums` on Supabase role-bound clients and their transactions (recorded in `deferred.md` if not already).

## Pre-investigated edge cases

| Case | Disposition |
| --- | --- |
| A prepared statement executed with `ps.query(tx, …)` after the transaction ends | Fails like any query on an ended transaction (`tx.invalidated`); a test covers it. |
| A statement prepared with `db.prepare` and executed with `ps.query(tx, …)` | Runs inside the transaction. Verify this holds today; if it does not, report before changing it. |
| Supabase's role settings inside a transaction | Every statement inside the transaction runs under the bound role; a test asserts the role's `set_config` calls frame the transaction's statements. |
| `tx.orm.fragment(...)` | Available wherever `db.orm.fragment` is. |
| A function written against `db.orm.public` called with `tx.orm.public` | Already works (slice 2); keep it working on SQLite after `fragment` is added. |

## Slice-specific done conditions

- A run-time test per client (Postgres, serverless connection, SQLite, Supabase role-bound client) uses `tx.sql`, `tx.raw`, `tx.prepare` and `tx.orm` inside one transaction and asserts every statement runs between the transaction's start and end.
- A type test per client shows each member on `tx` has the same type as on the client.
- A test shows `db.orm.fragment` and `tx.orm.fragment` on SQLite.

## Dispatch plan

### D1. Transaction members on every client

- **Outcome:** the five design points, with the tests above.
- **Builds on:** `main` after slice 2.
- **Hands to D2:** the members, built.
- **Focus:** `packages/3-extensions/{postgres,sqlite,supabase}`.

### D2. Docs, upgrade instructions and checks

- **Outcome:** READMEs and the skill describe what a transaction offers; upgrade instructions if a public type changed; every repository check passes.
- **Builds on:** D1.
- **Hands to:** review and PR.
