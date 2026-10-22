# ADR 278 — Each database's packages live in one folder

**Status:** Accepted
**Date:** 2026-10-22
**Domain:** Repository layout, Adapters / Targets
**Amends:** [ADR 140 — Package Layering & Target-Family Namespacing](ADR%20140%20-%20Package%20Layering%20&%20Target-Family%20Namespacing.md)

---

## At a glance

Everything one database needs sits in one folder:

```text
packages/
  2-sql-family/                SQL family
  2-mongo-family/              Mongo family
  3-targets/
    postgres/
      1-target/                @internal/target-postgres
      2-adapter/               @internal/adapter-postgres
      3-driver/                @internal/driver-postgres
      4-codec-testkit/         @internal/postgres-codec-testkit
      9-facade/                @internal/postgres
    sqlite/                    the same five
    mongo/
      1-target/                @internal/target-mongo
      2-adapter/               @internal/adapter-mongo
      3-driver/                @internal/driver-mongo
      9-facade/                @internal/mongo
  3-extensions/                extension packs
```

A new database adds one folder under `3-targets/`.

## Decision

1. **A database's target, adapter, driver, codec testkit and facade live in `packages/3-targets/<db>/`.** Each is its own package, as before.
2. **Folders inside a database folder are numbered by dependency order.** The adapter imports the target, the facade imports the target, adapter and driver, and the driver imports none of them. A database that has no codec testkit skips `4-`.
3. **Family folders are named `2-<family>-family`.** `2-sql` became `2-sql-family`, matching `2-mongo-family`.
4. **Extension packs stay in `packages/3-extensions/`,** including packs that only work with one database, such as pgvector.
5. **Every package under `3-targets/<db>/` registers the same globs in `architecture.config.json`,** the recipe in `docs/onboarding/Repo-Map-and-Layering.md`, and every target has a test that it imports neither its adapter nor its driver.

Package names did not change, so no import, published name or emitted file changed.

## Why

### The role folders checked nothing

Before this ADR, SQL targets were split by role: `3-targets/3-targets/<db>`, `3-targets/6-adapters/<db>` and `3-targets/7-drivers/<db>`, with the facade in `3-extensions/<db>`. The numbers 3, 6 and 7 looked like layers. They were not checked: `pnpm lint:deps` takes each file's domain, layer and plane from globs in `architecture.config.json`, and that file defines no layer order for the `targets` and `extensions` domains. The folders only spread one database across four places.

### Mongo had already grouped by database, without a recorded reason

The Mongo target was first placed in the role folders and moved the same day to `packages/3-mongo-target/{1-mongo-target,2-mongo-adapter,3-mongo-driver}`. That kept a database together but added a top-level folder per database and repeated the database's name in every folder. This ADR keeps the grouping and drops the extra top-level folder.

### The facade is one database's wiring

A facade composes one database's target, adapter and driver into the client an application installs. It belongs with them. An extension pack, by contrast, uses the same extension points a third-party pack would; keeping first-party packs in `3-extensions/` keeps that visible.

## Consequences

- A developer working on one database opens one folder.
- Adding MySQL and MariaDB adds `3-targets/mysql/` and `3-targets/mariadb/`.
- Paths are named in `architecture.config.json`, `packages/0-shared/publish-surface/src/shells.ts`, `coverage.config.json`, `tsconfig.base.json` and a few lint scripts. Those changed with the move; nothing else depends on folder depth.

## Alternatives considered

- **Keep the role folders.** Rejected: they enforce nothing and spread each database across four folders.
- **Copy Mongo's layout for every database** (`packages/3-<db>-target/1-<db>-target/...`). Rejected: a top-level folder per database, and the name repeated in every folder.
- **Move single-database extension packs under their database** (`3-targets/postgres/extensions/pgvector`). Rejected: it hides that they are ordinary packs.
