---
changes:
  - id: runtime-activity-is-activity
    summary: |
      `RuntimeActivity` is renamed `Activity`, with no alias. It is the type of the `activity` parameter of `activityStarted`, `activityEnded` and `activityFinalized`.
    detection:
      glob: "**/*.{ts,mts,cts,tsx}"
      matches:
        - '\bRuntimeActivity\b'
  - id: activity-includes-client-activities
    summary: |
      `Activity` is `StatementActivity | TransactionActivity | ClientActivity`, and `ActivityEndedResult` includes `ClientActivityEnded`, in every program. A client activity's kind contains a hyphen, such as `orm-call`. A hook that narrows by ruling out `'transaction'` and then reads statement fields no longer compiles. Narrow by the kind you handle, such as `if (result.kind !== 'statement') return;`, and ignore kinds you do not know.
    detection:
      glob: "**/*.{ts,mts,cts,tsx}"
      matches:
        - '\.kind\s*===\s*[''"]transaction[''"]'
  - id: runtime-connections-carry-an-activity-source
    summary: |
      The SQL runtime's queryables start client activities through an internal `activitySource` member, which `startActivityOn` and `planContentHashOn` read. A connection-like object that a `SqlRuntimeBase` subclass builds over a raw connection adds `[activitySource]: this.connectionActivitySource(connection, () => session)`, and `ActivitySourceTarget` to the object's declared type, so activities can start on it. The public `RuntimeConnection` type does not require it.
    detection:
      glob: "**/*.{ts,mts,cts,tsx}"
      matches:
        - '\[transactionStart\]\s*:'
  - id: begin-transaction-on-takes-a-parent
    summary: |
      `SqlRuntimeBase.beginTransactionOn(connection, owner)` takes a third argument, `parent`: the activity the transaction starts beneath, or `undefined`. Pass `undefined` where you began a transaction before.
    detection:
      glob: "**/*.{ts,mts,cts,tsx}"
      matches:
        - '\bbeginTransactionOn\s*\(\s*[^,()]+,\s*[^,()]+\)'
  - id: transaction-activity-takes-a-parent
    summary: |
      `startTransactionActivity` requires `parent` (the activity the transaction starts beneath, or `undefined`). An `ActivityParent` has `acceptsChildren()`, and its `adopt(child)` returns an `ActivityChildSlot` (`statementFailed()`, `ended(own)`, `transactionAcceptsChildren()`) instead of an end callback; `ActivityParent.activity` is an `ActivityBase`. A transaction stops accepting children with `stopAcceptingChildren()`, and adopting beneath a parent that no longer accepts children throws `RUNTIME.ACTIVITY_ENDED` instead of an internal error.
    detection:
      glob: "**/*.{ts,mts,cts,tsx}"
      matches:
        - '\bstartTransactionActivity\s*\('
        - '\.adopt\s*\('
  - id: orm-runtime-objects-pass-activities
    summary: |
      The ORM's structural `RuntimeQueryable` has optional `startActivity` and `planContentHash`. A client facade that builds the ORM's runtime object passes both through with `startActivityOn(runtime, activity)` and `planContentHashOn(runtime, plan)` from `@prisma/orm-family-sql/runtime/internal/prepared-query`, for the runtime it wraps and for the context of `db.transaction(fn)`. Without them the ORM runs, but its calls are not activities. Where the facade's statements run through sessions of its own, such as role sessions, pass members whose statements go the same way, or leave them out; do not pass the plain runtime's.
    detection:
      glob: "**/*.{ts,mts,cts,tsx}"
      matches:
        - '\bormBuilder\s*\(|\borm\s*\(\s*\{\s*runtime\s*:'
---

# Clients start their own activities

The runtime's middleware tree now has a third kind of activity: one a client starts for an act the runtime would not otherwise see, such as an ORM call. A client starts it with `startActivityOn(queryable, activity)` and sends statements through the returned handle. A middleware can supply such an activity's result through the new `intercept.onActivity` handler.

## Rename `RuntimeActivity`

Replace every `RuntimeActivity` with `Activity`, imported from the same module:

```ts
// before
import type { RuntimeActivity } from '@prisma/orm-framework/components/runtime';
async activityStarted(activity: RuntimeActivity, ctx) {}

// after
import type { Activity } from '@prisma/orm-framework/components/runtime';
async activityStarted(activity: Activity, ctx) {}
```

## Narrow activities by the kind you handle

`Activity` always includes `ClientActivity`, whose kind contains a hyphen. A hook that rules out `'transaction'` and then reads statement fields stops compiling. Test for the kind you handle instead:

```ts
// before
if (result.kind === 'transaction') return;
record(result.latencyMs);

// after
if (result.kind !== 'statement') return;
record(result.latencyMs);
```

A middleware that sees a kind it does not know should ignore it rather than fail. A package that wants a typed result for its own kind registers it:

```ts
declare module '@prisma/orm-framework/components/runtime' {
  interface ClientActivityRegistry {
    'orm-call': { result: unknown };
  }
}
```

## Give your connection objects an activity source

Inside a `SqlRuntimeBase` subclass, a connection-like object over a raw connection gets its activity members from the base class:

```ts
const session: RoleSession & TransactionStartTarget & ActivitySourceTarget = {
  [transactionStart]: createTransactionStart(),
  [activitySource]: self.connectionActivitySource(conn, () => session),
  // query, execute, transaction, release, destroy as before
};
```

`activitySource` and `ActivitySourceTarget` come from `@prisma/orm-family-sql/runtime/internal/prepared-query`.

## Pass a parent when beginning or starting a transaction

```ts
// before
return self.beginTransactionOn(conn, session);
// after
return self.beginTransactionOn(conn, session, undefined);

// before
await startTransactionActivity({ middleware, context, holdFinishedChildren });
// after
await startTransactionActivity({ middleware, context, parent: undefined, holdFinishedChildren });
```

An `ActivityParent` you implement yourself has `acceptsChildren()` and returns an `ActivityChildSlot` from `adopt`. Most runtimes only pass the parent they were given to `streamStatement`, `executeStatement`, `startTransactionActivity` or `startClientActivity` and need no change.

## Pass activities through a client facade

A facade that builds the ORM's runtime object passes the new members through, so ORM calls can become activities:

```ts
import { planContentHashOn, startActivityOn } from '@prisma/orm-family-sql/runtime/internal/prepared-query';

const orm = ormBuilder({
  runtime: {
    query: (plan) => runtime.query(plan),
    execute: (plan) => runtime.execute(plan),
    connection: () => runtime.connection(),
    startActivity: (activity) => startActivityOn(runtime, activity),
    planContentHash: (plan) => planContentHashOn(runtime, plan),
  },
  context,
});
```

Do the same for the ORM object inside `db.transaction(fn)`, with the transaction context in place of `runtime`.

If the facade sends its statements through sessions of its own, such as role-bound sessions, the activity's statements and transaction must go through them too; pass members that do so, or leave both out. Passing the plain runtime's members would run the activity's statements without the session.
