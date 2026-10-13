---
changes:
  - id: runtime-activity-is-activity
    summary: |
      `RuntimeActivity` is renamed `Activity`, with no alias. It is the type of the `activity` parameter of `activityStarted`, `activityEnded` and `activityFinalized`.
    detection:
      glob: "**/*.{ts,mts,cts,tsx}"
      matches:
        - '\bRuntimeActivity\b'
  - id: activity-has-client-kinds
    summary: |
      `Activity` and `ActivityEndedResult` also have one member per client activity kind a package registers in `ClientActivityKinds`. A hook that narrows by ruling out kinds, such as `if (result.kind === 'transaction') return;` followed by statement fields, no longer compiles once a kind is registered. Narrow by the kind you handle: `if (result.kind !== 'statement') return;`.
    detection:
      glob: "**/*.{ts,mts,cts,tsx}"
      matches:
        - '\.kind\s*===\s*[''"]transaction[''"]'
  - id: runtime-queryable-starts-activities
    summary: |
      The SQL runtime's `RuntimeQueryable`, and so `Runtime`, `RuntimeConnection` and `RuntimeTransaction`, gain `startActivity(activity)` and `planContentHash(plan)`. An object you build that implements one of them must have both. A `SqlRuntimeBase` subclass whose connection-like object wraps a raw connection implements them with `this.startActivityOnTarget(this.connectionTarget(connection, owner), activity, undefined)` and `this.connectionPlanContentHash(plan, connection)`.
    detection:
      glob: "**/*.{ts,mts,cts,tsx}"
      matches:
        - '\b(RuntimeConnection|RuntimeTransaction|RuntimeQueryable)\b'
  - id: transaction-context-is-a-runtime-scope
    summary: |
      `TransactionContext`, the `tx` of `withTransaction`, no longer extends `RuntimeQueryable`; it is a `RuntimeScope` (`query` and `execute`) with `invalidated`. Code that accepts `RuntimeQueryable` only to send statements, and is given `tx` or a test stub, takes `RuntimeScope` from `@prisma/orm-family-sql/relational-core/types` instead. Prepared statements now accept any `RuntimeScope` as their target, and `PreparedStatementQueryTarget` and `PreparedStatementExecuteTarget` extend `RuntimeScope`.
    detection:
      glob: "**/*.{ts,mts,cts,tsx}"
      matches:
        - 'target:\s*RuntimeQueryable\b'
        - '\bTransactionContext\b'
  - id: begin-transaction-on-takes-a-parent
    summary: |
      `SqlRuntimeBase.beginTransactionOn(connection, owner)` takes a third argument, `parent`: the activity the transaction starts beneath, or `undefined`. Pass `undefined` where you began a transaction before.
    detection:
      glob: "**/*.{ts,mts,cts,tsx}"
      matches:
        - '\bbeginTransactionOn\s*\(\s*[^,()]+,\s*[^,()]+\)'
  - id: transaction-activity-takes-a-parent
    summary: |
      `startTransactionActivity` requires `parent` (the activity the transaction starts beneath, or `undefined`). `ActivityParent.adopt(child)` returns an `ActivityChildSlot` (`statementFailed()`, `ended(own)`, `transactionEnded()`) instead of an end callback, and `ActivityParent.activity` is an `ActivityBase`. Adopting beneath an ended activity throws `RUNTIME.ACTIVITY_ENDED` instead of an internal error.
    detection:
      glob: "**/*.{ts,mts,cts,tsx}"
      matches:
        - '\bstartTransactionActivity\s*\('
        - '\.adopt\s*\('
  - id: orm-runtime-objects-pass-activities
    summary: |
      The ORM's structural `RuntimeQueryable` has optional `startActivity` and `planContentHash`. A client facade that builds the ORM's runtime object passes both through to the runtime it wraps, and the one for `tx` passes them through `startActivityOn(txCtx, activity)` and `planContentHashOn(txCtx, plan)` from `@prisma/orm-family-sql/runtime/internal/prepared-query`. Without them the ORM runs, but its calls are not activities. Where the facade's statements run through sessions of its own, such as role sessions, pass members whose statements go the same way, or leave them out; do not pass the plain runtime's.
    detection:
      glob: "**/*.{ts,mts,cts,tsx}"
      matches:
        - '\bormBuilder\s*\(|\borm\s*\(\s*\{\s*runtime\s*:'
---

# Clients start their own activities

The runtime's middleware tree now has a third kind of activity: one a client starts for an act the runtime would not otherwise see, such as an ORM call. A client registers its kinds by module augmentation, starts an activity with `startActivity`, and sends statements through the returned handle. A middleware can supply such an activity's result through the new `intercept.onActivity` handler.

## Rename `RuntimeActivity`

Replace every `RuntimeActivity` with `Activity`, imported from the same module:

```ts
// before
import type { RuntimeActivity } from '@prisma/orm-framework/runtime';
async activityStarted(activity: RuntimeActivity, ctx) {}

// after
import type { Activity } from '@prisma/orm-framework/runtime';
async activityStarted(activity: Activity, ctx) {}
```

## Narrow activities by the kind you handle

A package can add kinds to `Activity`:

```ts
declare module '@prisma/orm-framework/runtime' {
  interface ClientActivityKinds {
    'orm-call': { result: unknown };
  }
}
```

A hook that rules out `'transaction'` and then reads statement fields stops compiling once any kind is registered. Test for the kind you handle instead:

```ts
// before
if (result.kind === 'transaction') return;
record(result.latencyMs);

// after
if (result.kind !== 'statement') return;
record(result.latencyMs);
```

A middleware that sees an unknown kind should ignore it rather than fail.

## Implement the new queryable members

An object that implements the SQL runtime's `Runtime`, `RuntimeConnection`, `RuntimeTransaction` or `RuntimeQueryable` must have `startActivity` and `planContentHash`. Inside a `SqlRuntimeBase` subclass, a connection-like object over a raw connection gets them from the base class:

```ts
const session = {
  startActivity(activity) {
    return self.startActivityOnTarget(self.connectionTarget(conn, session), activity, undefined);
  },
  planContentHash(plan) {
    return self.connectionPlanContentHash(plan, conn);
  },
  // query, execute, transaction, release, destroy as before
};
```

## Take `RuntimeScope` where you only send statements

`TransactionContext` is no longer a `RuntimeQueryable`. Where a function or method accepts the SQL runtime's `RuntimeQueryable` only to call `query` or `execute`, and callers pass `tx` or a test stub, change the parameter to `RuntimeScope`:

```ts
// before
import type { RuntimeQueryable } from '@prisma/orm-family-sql/runtime';
query(target: RuntimeQueryable, params: Params): Result;

// after
import type { RuntimeScope } from '@prisma/orm-family-sql/relational-core/types';
query(target: RuntimeScope, params: Params): Result;
```

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

An `ActivityParent` you implement yourself returns an `ActivityChildSlot` from `adopt`. Most runtimes only pass the parent they were given to `streamStatement`, `executeStatement`, `startTransactionActivity` or `startClientActivity` and need no change.

## Pass activities through a client facade

A facade that builds the ORM's runtime object passes the new members through, so ORM calls can become activities:

```ts
const orm = ormBuilder({
  runtime: {
    query: (plan) => runtime.query(plan),
    execute: (plan) => runtime.execute(plan),
    connection: () => runtime.connection(),
    startActivity: (activity) => runtime.startActivity(activity),
    planContentHash: (plan) => runtime.planContentHash(plan),
  },
  context,
});
```

If the facade sends its statements through sessions of its own, such as role-bound sessions, the activity's statements and transaction must go through them too; pass members that do so, or leave both out. Passing the plain runtime's members would run the activity's statements without the session.

For the ORM object inside `db.transaction(fn)`, use the helpers that reach the members of the transaction context, which `tx` does not show:

```ts
import { planContentHashOn, startActivityOn } from '@prisma/orm-family-sql/runtime/internal/prepared-query';

startActivity: (activity) => startActivityOn(txCtx, activity),
planContentHash: (plan) => planContentHashOn(txCtx, plan),
```
