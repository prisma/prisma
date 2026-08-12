# v0.17.0

This is the namespace release: Prisma Next now publishes as 17 packages under the `@prisma` scope, and an application depends on exactly one database facade. It also completes the structured error-code scheme across every plane, makes relation-loading lossless for big numbers and temporal values, and gives every SQL index and RLS policy an exact, migratable name.

## Breaking changes

- **One `@prisma` package per application** — the `@prisma-next/*` scope is retired; nothing publishes under it again. An application depends on exactly one database facade — `@prisma/orm-postgres`, `@prisma/orm-sqlite`, or `@prisma/orm-mongo` — plus any extension packs it uses (now named `@prisma/orm-extension-*`); everything else arrives as the facade's exact-pinned dependencies. Regenerating your contract rewrites generated imports to facade entrypoints with no `contractHash` change. See the [0.16-to-0.17 upgrade recipe](https://github.com/prisma/prisma/blob/v0.17.0/skills/upgrade/prisma-next-upgrade/upgrades/0.16-to-0.17/) and the [extension-author recipe](https://github.com/prisma/prisma/blob/v0.17.0/skills/extension-author/prisma-8-extension-upgrade/upgrades/0.16-to-0.17/). ([#29864](https://github.com/prisma/prisma/pull/29864), [#29880](https://github.com/prisma/prisma/pull/29880), [#29883](https://github.com/prisma/prisma/pull/29883), [#29884](https://github.com/prisma/prisma/pull/29884))

  Before:

  ```jsonc
  "dependencies": {
    "@prisma-next/postgres": "0.16.0",
    "@prisma-next/framework-components": "0.16.0",
    "@prisma-next/sql-runtime": "0.16.0"
  }
  ```

  After:

  ```jsonc
  "dependencies": {
    "@prisma/orm-postgres": "0.17.0"
  }
  ```

- **Every published error is a structured envelope with a dotted code** — the four legacy error systems (`PN-CLI-4001`-style codes, `RUNTIME.DECODE_FAILED`-style codes, and codeless error classes) consolidate into one scheme: a structural envelope carrying a `NAMESPACE.SUBCODE` code, recognized by the `isStructuredError` type predicate instead of `instanceof`. The ORM, contract-authoring, adapter/target, extension, and framework planes are all swept; legacy error classes (`PslFormatError`, the Supabase and SQL-escape classes, framework classes) are deleted. Prisma 7's `P1001`-style codes are not carried over. ([#1016](https://github.com/prisma/prisma-next/pull/1016), [#1021](https://github.com/prisma/prisma-next/pull/1021), [#1025](https://github.com/prisma/prisma-next/pull/1025), [#1049](https://github.com/prisma/prisma-next/pull/1049), [#1053](https://github.com/prisma/prisma-next/pull/1053), [#1063](https://github.com/prisma/prisma-next/pull/1063))

  Before:

  ```ts
  if (error instanceof PslFormatError) {
    report(error.diagnostics);
  }
  ```

  After:

  ```ts
  if (isStructuredError(error) && error.code === 'PSL.PARSE_FAILED') {
    report(error.meta.diagnostics);
  }
  ```

- **Content hashes are bare hex** — the `sha256:` prefix is gone from every surface (emitted contracts, migration manifests, refs, CLI output, and the database marker), and loaders reject the prefixed form. Contract hash values are unchanged; `migrationHash` values change. A codemod in the [0.16-to-0.17 recipe](https://github.com/prisma/prisma/blob/v0.17.0/skills/upgrade/prisma-next-upgrade/upgrades/0.16-to-0.17/) converts checked-in migration trees. ([#1033](https://github.com/prisma/prisma-next/pull/1033))

- **Migration contract snapshots move into a content-addressed store** — per-migration sibling snapshot files and ref-paired copies are replaced by a single `migrations/snapshots/<hex>/` store per migrations root; every distinct contract is stored once, and `migration.ts` imports its bookend contracts from the store. This is a clean break with no fallback reader; a one-shot migrator (`scripts/migrate-migrations-layout.mjs`) converts existing trees and re-verifies every `migrationHash` unchanged. ([#1018](https://github.com/prisma/prisma-next/pull/1018), [#1024](https://github.com/prisma/prisma-next/pull/1024))

- **PostgreSQL native types are authored in type position; the `@db.*` attribute channel is removed** — write the native type directly (`VarChar(255)`, `Uuid`, `Timestamptz`) instead of a base type plus `@db.*` attribute; remaining `@db.X(args)` usage fails with the exact replacement spelled out. `Json` re-binds to native `json` storage, with a new `Jsonb` scalar for jsonb (what every pre-0.16 `Json` field meant — switch those fields to keep a byte-identical contract), and `Date` re-binds to the correct `pg/date@1` codec. ([#1022](https://github.com/prisma/prisma-next/pull/1022), [#1036](https://github.com/prisma/prisma-next/pull/1036), [#1054](https://github.com/prisma/prisma-next/pull/1054))

  Before:

  ```prisma
  model User {
    id    String @id @db.Uuid
    name  String @db.VarChar(255)
  }
  ```

  After:

  ```prisma
  model User {
    id    Uuid         @id
    name  VarChar(255)
  }
  ```

- **Relation-loading and aggregates are lossless** — values read through `.include()` no longer pass through lossy JSON: every codec gains an explicit lossless JSON form produced inside the database. 64-bit integers arrive as `bigint` instead of silently rounding, decimals as exact strings, and temporal columns decode correctly. Aggregate result types change accordingly: `count()` is a `bigint`, decimal sums are strings. Regenerate your contract after upgrading. ([#29844](https://github.com/prisma/prisma/pull/29844), [#1023](https://github.com/prisma/prisma-next/pull/1023), [#1051](https://github.com/prisma/prisma-next/pull/1051))

- **SQL indexes and RLS policies are name-identified** — every index and RLS policy carries an exact name in the contract, names travel on the wire, live objects can be adopted by exact name (`@@map`), and a rename converges by renaming instead of drop-and-recreate. ([#1047](https://github.com/prisma/prisma-next/pull/1047), [#29807](https://github.com/prisma/prisma/pull/29807), [#29865](https://github.com/prisma/prisma/pull/29865))

- **`extensionPacks` config key renamed to `extensions`** — in `prisma-next.config.ts`, the TS builder, client options, and the emitted contract's top-level key. The old key fails loudly. Because the key sits in the hashed contract bytes, all contract hashes change: re-emit and re-anchor migrations per the recipe. Two smaller key renames ride along: `contract.source.sourceFormat` → `format`, and the facade `defineConfig` option `outputPath` → `output`. ([#1032](https://github.com/prisma/prisma-next/pull/1032))

- **Count-only mutation terminals renamed** — `createCount(...)` / `updateCount(...)` / `deleteCount()` become `createAndCount(...)` / `updateAndCount(...)` / `deleteAndCount()`; behavior and `Promise<number>` results are unchanged, with no compatibility aliases. ([#1044](https://github.com/prisma/prisma-next/pull/1044))

## Features

- Expression, partial, and unique indexes are authorable in both PSL and the TypeScript builder. ([#1048](https://github.com/prisma/prisma-next/pull/1048))
- `contract infer` reaches full fidelity — indexes, policy blocks, and `@@rls` are captured — and signs the database, so introspect-then-verify works end to end on an adopted database. It also infers 1:1 relations from unique indexes. ([#29808](https://github.com/prisma/prisma/pull/29808), [#1038](https://github.com/prisma/prisma-next/pull/1038))
- Every error code is documented on an in-repo reference page (221 codes), kept complete by a CI check, and error envelopes carry a `docsUrl` pointing at their per-code anchor. ([#1027](https://github.com/prisma/prisma-next/pull/1027), [#29806](https://github.com/prisma/prisma/pull/29806))

## Fixes

- MongoDB write results decode through their type codecs instead of returning raw wire values. ([#29879](https://github.com/prisma/prisma/pull/29879))
- The Postgres runtime driver serializes queries per pinned client, fixing interleaved-query failures on a shared connection. ([#29839](https://github.com/prisma/prisma/pull/29839))
- Mixed-case native-enum casts are quoted, so PascalCase enum type names survive Postgres case-folding. ([#1034](https://github.com/prisma/prisma-next/pull/1034))
- Driver cursor streaming runs inside an explicit transaction, fixing dropped-portal failures under load. ([#1017](https://github.com/prisma/prisma-next/pull/1017))
- Published type declarations name only dependencies a consumer will actually have installed. ([#29862](https://github.com/prisma/prisma/pull/29862))
