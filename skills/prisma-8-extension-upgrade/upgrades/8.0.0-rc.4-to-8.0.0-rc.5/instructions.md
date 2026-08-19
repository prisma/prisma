---
from: "8.0.0-rc.4"
to: "8.0.0-rc.5"
changes:
  - id: distinct-no-longer-takes-columns
    summary: |
      `Collection#distinct(...fields)` is removed. `Collection#distinct()` is a new no-argument
      method: plain `SELECT DISTINCT` over the projected columns, portable to every target, no
      capability needed. It replaces the old field-keyed form everywhere it appeared — the root
      collection surface and inside `include(...)` refinements alike.

      The old `distinct('a', 'b')` kept one representative row per `(a, b)` group, picked by
      `orderBy(...)`. Plain `distinct()` has no equivalent semantic — it dedupes whole projected
      rows, not by a chosen key. There is no drop-in replacement; every call site needs a choice:

      - If the intent was genuinely "unique rows" (the projection already is the dedup key, or
        duplicates only differ in columns you don't care about), narrow the `.select(...)` to
        just those columns and switch to `.distinct()`.
      - If the intent was "one representative row per key, chosen by ordering" — the common
        case — move to `.distinctOn('a', 'b')` if the contract declares the `postgres.distinctOn`
        capability and you can supply an `orderBy(...)`. `distinctOn` requires both.
      - If neither fits — a non-Postgres target, or no natural ordering to pick a representative
        — there is no portable equivalent; the query needs redesigning (e.g. aggregate first, or
        move the dedup into application code).

      One combination has no replacement at all: `.distinct(cols)` used to work alongside an
      `.include(...)` at the same level by pre-deduping scalar columns in a wrapped subquery
      before attaching the included relation's rows. Plain `.distinct()` cannot do this — every
      include, leaf or not, adds a `json_agg` (or equivalent) column to the row it dedupes over,
      and which children ride along with a collapsed row is undefined once `distinct()` has no
      key. `Collection#distinct()` combined with `Collection#include(...)` at the same level is
      now a compile-reachable, uniform ORM error (`ORM.INCLUDE_UNSUPPORTED`) on every target — not
      a Postgres-only SQL failure. If your code combines `distinct()` with an `include()` at the
      same level (including inside a refinement callback), restructure the query: drop the
      `include()` from under the distinct-affected level, or replace `distinct()` with
      `distinctOn(...)` where the capability and an `orderBy(...)` are available — `distinctOn`
      composes with `include()` because it only requires equality on the columns it lists, not
      the whole row.
    detection:
      glob: "**/*.{ts,mts,cts}"
      regex:
        - '\.distinct\([^)]+\)'
      anyMatch: true
---

# 8.0.0-rc.4 → 8.0.0-rc.5 — Extension-author upgrade instructions

## `distinct-no-longer-takes-columns`

`Collection#distinct(...fields)` is gone. `Collection#distinct()` — no arguments — is the
replacement surface: plain `SELECT DISTINCT` over whatever the chain has projected, portable to
every target, no capability required. It mirrors the sql-builder lane's own `distinct()`, which
already had this exact no-argument shape.

The old form kept one representative row per `(fields)` group, the representative chosen by
`orderBy(...)`. That semantic has no equivalent in plain SQL `DISTINCT`, which dedupes whole rows
rather than a chosen key. Every call site needs one of three treatments:

```ts
// Before: dedup by a chosen key
const countries = await db.orm.User.distinct('country');

// After, if the projection already is the key you wanted unique:
const countries = await db.orm.User.select('country').distinct();

// After, if you need "the latest row per country" (a representative, not just uniqueness),
// and the contract declares postgres.distinctOn:
const latestPerCountry = await db.orm.User
  .orderBy((u) => [u.country.asc(), u.createdAt.desc()])
  .distinctOn('country');
```

`distinctOn` requires both the `postgres.distinctOn` capability and a prior `orderBy(...)` — if
either is missing, there is no portable substitute; the query needs redesigning rather than a
mechanical rename.

A combination with no replacement at all: `distinct(cols)` used to work alongside an `include(...)`
at the same level by pre-deduping scalar columns in a wrapped subquery before attaching the
included relation's rows. Plain `distinct()` cannot reproduce this — every include, leaf or not,
adds a `json_agg` (or equivalent) column to the row it dedupes over, and which children ride along
with a collapsed row is undefined once `distinct()` has no key.

`Collection#distinct()` combined with `Collection#include(...)` at the same level — at the root or
inside a refinement callback — is rejected by the ORM itself with a named error
(`ORM.INCLUDE_UNSUPPORTED`), on every target:

```ts
// Rejected: distinct() cannot dedupe a row carrying posts' included data.
await db.orm.User.include('posts').distinct().all();
// ORM.INCLUDE_UNSUPPORTED: distinct() cannot combine with include('posts') at the same level — …
```

This used to be a Postgres-only failure (`could not identify an equality operator for type json`,
thrown by the database once the query reached it) and, on SQLite, a silent wrong answer —
`DISTINCT` deduped on the serialized child array's text identity instead of the scalar columns the
caller meant, since SQLite has no native JSON type. Both are now the same named ORM error before
either target sees the query. If your code combines `.distinct()` with an `.include(...)` at the
same level, restructure the query:

- Drop the `.include(...)` from under the distinct-affected level, or
- Replace `.distinct()` with `.distinctOn(...)` where the contract declares the `postgres.distinctOn`
  capability and you can supply an `orderBy(...)` — `distinctOn` composes with `include()` because
  it only requires equality on the columns it lists, not the whole row.
