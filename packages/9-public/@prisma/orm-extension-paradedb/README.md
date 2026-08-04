# @prisma/orm-extension-paradedb

BM25 full-text search indexes for Prisma Next on PostgreSQL, powered by [ParadeDB](https://paradedb.com).

```bash
pnpm add @prisma/orm-extension-paradedb
```

## Entrypoints

| Namespace | Surface |
| --- | --- |
| `/pack` | the extension pack an application composes into `extensions: [...]` — pure, no runtime imports |
| `/index-types` | the `bm25` index type and its option shape |
| `/operation-types` | types emitted contracts reference |
| `/runtime` | the runtime extension |
| `/control` | the control descriptor |

## Responsibilities

Registers a `bm25` entry with the SQL family's index-type registry, so contracts author full-text indexes through the ordinary `constraints.index(...)` surface and the Postgres adapter emits `CREATE INDEX ... USING bm25 WITH (...)`. It also declares the `paradedb/bm25` capability for contract-level feature detection.

The current surface covers the `key_field` storage parameter. Per-field tokenizer configuration waits on expression-index support.

## Dependencies

`@prisma/orm-framework`, `@prisma/orm-family-sql`, and `@prisma/orm-toolchain` at exact lockstep versions, plus `arktype`.

`@prisma/orm-target-postgres` is an exact-pinned **peer** dependency, as it is for every Postgres extension pack: the application supplies it, directly or through a facade. Unlike its siblings this pack does not reach the target at run time — the index type is registered against the SQL family, and the Postgres adapter renders it — but it is still a pack that only works on Postgres, and stating that uniformly is what makes the install requirement legible.
