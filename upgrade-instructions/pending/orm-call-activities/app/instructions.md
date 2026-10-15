---
changes:
  - id: orm-annotations-on-the-call
    summary: |
      Every SQL ORM terminal method runs as one `orm-call` activity, and the annotations a `configure` callback records live on that activity. The statements the call sends carry none, so a middleware that reads an ORM annotation from a statement plan (`handle.read(plan)` or `plan.meta.annotations`) in `beforeEncode`, `intercept.onQuery`, `onRow` or `activityStarted` of a statement finds nothing. Read it from the call instead: in `activityStarted(activity)`, `if (activity.kind === 'orm-call') handle.read(activity)`.
    detection:
      glob: "**/*.{ts,mts,cts,tsx}"
      matches:
        - '\.read\(\s*(?:plan|exec|draft)\b'
        - 'meta\.annotations\b'
  - id: cached-orm-reads-key-on-the-call
    summary: |
      The cache middleware caches an annotated ORM read as a whole: a hit sends no statement. Without a `key`, the read is keyed by the call's content hash, and the `deriveKey` option applies only to annotated SQL builder queries. Where a `deriveKey` added a prefix (for example a tenant) to ORM reads, pass that prefix in `cacheAnnotation({ key })` on those reads. Statement middleware such as a slow-query log sees no statement for a cache hit of an ORM read.
    detection:
      glob: "**/*.{ts,mts,cts,tsx}"
      matches:
        - '\bderiveKey\b(?!FromContentHash)'
  - id: cache-store-holds-cached-values
    summary: |
      A cache store holds `CachedValue`, `{ kind: 'rows', rows } | { kind: 'result', result }`, not `CachedRows`. Type a custom store as `CacheStore<TMeta, CachedValue>` (or `CacheStore<TMeta>`), store and return the value whole, `kind` included, and make a store that serialises values round-trip the decoded values an ORM call returns, such as `Date` and `bigint`.
    detection:
      glob: "**/*.{ts,mts,cts,tsx}"
      matches:
        - '\bCachedRows\b'
  - id: close-lets-open-orm-calls-finish
    summary: |
      On a client that closes at once (`postgres({ url })`, `sqlite()`, `supabase()`), an ORM call that resolves to one value, such as `first()`, `create()`, `include(...).create()` or a nested create, starts when it is called, and `close()` waits for it, so one left pending at `close()` now completes instead of rejecting: a `create()` used to reject with "Runtime is closed", and `include(...).create()` and a nested create with "Postgres client is closed". A streaming read such as `all()` starts when it is read; read after `close()`, it rejects with "Postgres client is closed" instead of "Runtime is closed". Update code or tests that expect the old outcome.
    detection:
      glob: "**/*.{ts,mts,cts,tsx}"
      matches:
        - 'Runtime is closed|Postgres client is closed'
---

# ORM calls are activities

Each SQL ORM terminal method is one `orm-call` activity. Its statements, its own transaction and the read-back after a nested write are its children, and the user's annotations are on it, not on the statements.

## Read ORM annotations from the call

Before:

```ts
const audit: SqlMiddleware = {
  name: 'audit',
  familyId: 'sql',
  async beforeEncode(plan) {
    const actor = auditAnnotation.read(plan);
    if (actor) log(actor);
  },
};
```

After:

```ts
const audit: SqlMiddleware = {
  name: 'audit',
  familyId: 'sql',
  async activityStarted(activity) {
    if (activity.kind !== 'orm-call') return;
    const actor = auditAnnotation.read(activity);
    if (actor) log(actor);
  },
};
```

A middleware that must also see annotated SQL builder queries keeps its statement path: those queries are statement activities and carry their annotations on the plan as before.

## Custom cache stores

Change the value type from `CachedRows` to `CachedValue`:

```ts
import type { CachedValue, CacheStore } from '@prisma/orm-extension-middleware-cache';

const store: CacheStore<unknown, CachedValue> = {
  // get, set and unset as before; value is now { kind: 'rows', rows } or { kind: 'result', result }
};
```
