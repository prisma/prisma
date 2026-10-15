# Runtime middleware sees a tree of activities — spec

Linear: [P-TML-1155](https://linear.app/prisma-company/project/runtime-middleware-sees-a-tree-of-activities-c691d141b3b6). Decision record: [ADR 271](../../docs/architecture%20docs/adrs/ADR%20271%20-%20The%20runtime%20middleware%20observes%20a%20tree%20of%20activities%2C%20each%20started%2C%20ended%20and%20finalized.md); reasoning, prior art and rejected alternatives: [`design.md`](design.md).

## Purpose

Middleware sees one statement at a time, but most of what it reasons about sits above the statement: when a write's effects are final, what the user annotated an ORM call with, which user action a statement belongs to. This project gives middleware one tree of activities with the same lifecycle on every node, so a middleware answers those questions without knowing how a client turns one call into statements. Its first users close the cache middleware's two gaps: invalidating after a write commits, and caching a whole ORM call.

## At a glance

```ts
// A write carries its own invalidation; the cache acts once the write's effects are final.
await db.orm.public.User.where({ id: 1 }).update({ name: 'Alicia' }, (m) =>
  m.annotate(invalidateAnnotation({ keys: ['user-1'] })),
);

// A cached ORM call: on a hit, the ORM sends no statement at all.
const user = await db.orm.public.User.first({ id: 1 }, (m) =>
  m.annotate(cacheAnnotation({ key: 'user-1' })),
);

// A middleware author writes one lifecycle, whatever the activity is.
const audit: CrossFamilyMiddleware = {
  name: 'audit',
  async activityFinalized(activity, result, ctx) {
    if (activity.kind === 'orm-call' && result.outcome !== 'rolled-back') await record(activity);
  },
};
```

## Non-goals

- **The Mongo ORM.** It takes no annotations today, so it does not start call activities. Mongo statements are activities like any other.
- **Nested transactions and savepoints.** The tree allows a transaction under a transaction; building them is a separate project.
- **A transaction interceptor** (for example running each transaction as a savepoint in tests). Nothing needs it now.
- **Serving cached reads inside a transaction**, and caching that tells reads from writes inside one.
- **Fixing the direct single-client Postgres driver** running a runtime-scope statement inside an open transaction unseen. Unchanged by this project.
- **An OpenTelemetry middleware.** The tree makes one straightforward; shipping one is separate.

## Place in the larger world

- Replaces the per-statement middleware interface defined by ADR 014, ADR 215 and ADR 260. Every middleware, first-party and external, is rewritten.
- Absorbs the remaining slice of the cache-invalidation-on-write project (`projects/cache-invalidation-on-write/`, ticket TML-3400). That project's first slice, the `afterTransaction` stage (TML-3399), is replaced here by `activityFinalized`.
- The public middleware types ship in `@prisma/orm-framework` (`./components/runtime`), `@prisma/orm-family-sql/runtime`, `@prisma/orm-family-mongo/runtime` and `@prisma/orm-extension-middleware-cache`, so each breaking slice records upgrade instructions for applications and for extension authors.
- Users get each slice in the next `8.0.0-rc` release after it merges.

## Cross-cutting requirements

- **One lifecycle.** Every activity has `activityStarted`, `activityEnded` and `activityFinalized`, as ADR 271 defines them. No middleware branches on a transaction to learn when an activity's effects are final.
- **Observing never changes results.** Only interceptors change or stop a statement, and only `intercept` supplies a result for any activity.
- **Annotations stay where the user wrote them.** No client copies an annotation onto statements it did not annotate.
- **The cache stays correct.** It never serves or stores inside a transaction or on a held connection, and never invalidates before a write's effects are final.
- **No cost when unused.** A runtime with no middleware pays no measurable overhead per statement; the subsystem doc's overhead targets hold.

## Transitional-shape constraints

- Each slice's pull request is green on its own and leaves no old hook beside its replacement.
- Between slices, documentation describes what has shipped: the runtime subsystem doc, the `prisma-8` skill's runtime reference and the affected package READMEs change in the slice that changes the behaviour.
- Until ORM calls are activities, an ORM write annotation reaches only the statements it reaches today; the cache README states that limit until it is lifted.

## Project DoD

- An ORM `update()` annotated with `invalidateAnnotation`, inside and outside `db.transaction(fn)`, invalidates its keys only after the commit, and a rolled-back transaction leaves the cached entry in place (Postgres integration tests).
- An annotated ORM read served from the cache sends no statement to the driver, and an annotated read inside a transaction or on a Supabase role session is never served from the cache (integration tests).
- Writes with relation callbacks and creates on multi-table-inheritance models invalidate like any other write.
- The demo's middleware and every first-party middleware use only the new interface; no reference to `beforeQuery`, `afterQuery`, `afterTransaction` or the other removed hooks remains outside historical release notes and upgrade guides.
- ADR 160 and ADR 260 carry supersession notes; the runtime subsystem doc, the `prisma-8` skill references and the cache README describe the shipped behaviour.
- `projects/activity-tree/` and `projects/cache-invalidation-on-write/` are deleted, with anything long-lived moved to `docs/`.

## Open questions

- None that block slice 1. Slice-level design questions are listed in the plan under the slice that answers them.

## References

- [ADR 271](../../docs/architecture%20docs/adrs/ADR%20271%20-%20The%20runtime%20middleware%20observes%20a%20tree%20of%20activities%2C%20each%20started%2C%20ended%20and%20finalized.md) and [`design.md`](design.md)
- [ADR 266 — The cache middleware passes data to its store](../../docs/architecture%20docs/adrs/ADR%20266%20-%20The%20cache%20middleware%20passes%20data%20to%20its%20store%2C%20and%20the%20store%20decides%20how%20to%20cache.md)
- [Runtime & Middleware Framework](../../docs/architecture%20docs/subsystems/4.%20Runtime%20&%20Middleware%20Framework.md)
- [`projects/cache-invalidation-on-write/spec.md`](../cache-invalidation-on-write/spec.md)
