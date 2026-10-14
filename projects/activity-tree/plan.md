# Runtime middleware sees a tree of activities — plan

**Spec:** [`spec.md`](spec.md). **Linear:** [P-TML-1155](https://linear.app/prisma-company/project/runtime-middleware-sees-a-tree-of-activities-c691d141b3b6).

## Summary

Four slices, one pull request each. Slice 1 changes the middleware interface for statements and transactions. After it, two threads run in parallel: client activities then ORM calls (slices 2 and 3), and the cache's write invalidation (slice 4).

```
1 ──► 2 ──► 3
└───► 4
```

## Slice 1: the middleware interface on statements and transactions (TML-3559)

**Outcome:** every statement and transaction is an activity. Middleware implements the lifecycle events `activityStarted`, `activityEnded` and `activityFinalized` and the interceptors `beforeCompile`, `beforeEncode`, `intercept.onQuery`, `intercept.onExecute` and `onRow`. The old per-statement hooks, including `afterTransaction`, are gone. Each activity has its own `ctx` with `parent`, `state(key)` and `inTransaction()`. Finalization is always tracked, children before parents; a statement sent on a transaction's connection is that transaction's child.

**Builds on:** nothing. **Hands to:** slices 2 and 4: the activity model, the `ctx` API and `activityFinalized`.

**In scope:** framework-components (interface, runners), the SQL runtime (transaction bookkeeping, queryables), the Mongo runtime, the Supabase role session; rewriting the cache's read path, budgets, lints and the demo's slow-query warning, with their tests; upgrade instructions for applications and extension authors; ADR 160 and ADR 260 supersession notes; the runtime subsystem doc, the `prisma-8` skill's runtime and debug references, and the runtime and cache READMEs.

**Note:** the largest slice, because the interface cannot change in halves without keeping old hooks beside new ones. The change to each middleware is mechanical once the runners change.

## Slice 2: clients start activities (TML-3560)

**Outcome:** the runtime's queryables offer `startActivity({ kind, contentHash, annotations })`, returning an `ActivityHandle`: a queryable whose statements are its children, with `transaction()`, `intercepted` and `end({ outcome, result })`. `intercept.onActivity` runs for client activities. Ending an activity with an open child is a runtime error. The Postgres, SQLite and both Supabase client facades pass the handle through, including the prepared-statement targets. User-facing types do not show `startActivity`; the ORM's structural `RuntimeQueryable` declares it optional until slice 3.

**Builds on:** slice 1. **Hands to:** slice 3: a working handle on every queryable the ORM can hold.

**Design question this slice answers:** how a client computes a content hash. The ORM's collection state holds query-tree class instances, which `canonicalStringify` rejects. The slice adds a runtime method that returns the content hash of a plan the client has built, using the same digest as `ctx.contentHash`, so a client never serialises query trees itself. The method applies the `beforeCompile` chain before hashing, as a statement's own key does today. Otherwise a middleware that rewrites queries by context, such as one adding a tenant filter, would give two tenants' ORM calls the same derived key, and the cache would serve one tenant's rows to the other.

## Slice 3: ORM calls are activities, and the cache caches them (TML-3561)

**Outcome:** every SQL ORM terminal method, including prepared collections at each execution, starts an `orm-call` activity and sends its statements, and its own transaction, through the handle. The user's annotations live on the call; the ORM stops merging them onto statement plans. The cache serves and stores annotated ORM calls through `intercept.onActivity`, skipping calls inside a transaction or on a held connection, so a hit sends no statement. The ORM's structural `RuntimeQueryable` requires `startActivity`.

**Builds on:** slice 2. **Hands to:** close-out. Write annotations on relation-callback writes and multi-table-inheritance creates now reach the cache.

**Note:** moving annotations off statements and serving calls from the cache must land together, or the statement-level cache for ORM reads would stop working in between.

## Slice 4: a write carries its invalidation (TML-3400)

**Outcome:** `invalidateAnnotation<TMeta>({ keys, meta })`, applicable to writes. The cache implements `activityFinalized` and invalidates for any activity carrying the annotation unless the outcome is `rolled-back`. Until slice 3 lands, an ORM write annotation reaches only the statements it reaches today (not relation-callback writes or multi-table-inheritance creates), and the cache README says so.

**Builds on:** slice 1. **Hands to:** close-out.

**Note:** the cache's hook reads the annotation from whatever activity carries it, so it needs no change when slice 3 moves ORM annotations onto the call.

## Dependencies

- prisma/orm#30653 (ADR 271 and the design document) merges first.
- Each slice reaches users in the next `8.0.0-rc` release after it merges.

## Deferred

Gaps outside the project's scope are listed in [`deferred.md`](deferred.md).

## Close-out

- Verify the project DoD in [`spec.md`](spec.md).
- Move anything long-lived out of `projects/activity-tree/` and `projects/cache-invalidation-on-write/`; ADR 271 already holds the decisions.
- Strip repo-wide references to both folders, then delete them.
