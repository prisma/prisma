---
from: "0.16"
to: "0.17"
changes:
  - id: strip-sha256-hash-prefixes
    summary: |
      Content hashes are bare lowercase hex from 0.17 — the `sha256:` prefix is gone from every
      surface (emitted `contract.json` / `contract.d.ts`, migration manifests, refs, CLI output,
      and the database marker/ledger), and loaders reject the legacy prefixed form. Contract hash
      VALUES are unchanged (only the prefix drops; `pnpm emit` regenerates live artefacts), but
      `migrationHash` VALUES change because the hashed manifest bytes embed the now-bare
      `from`/`to` strings. Run the colocated codemod over your checked-in `migrations/` trees
      FIRST, before the snapshot-layout migrator in the entries below — the 0.17 layout migrator
      accepts only bare-hex trees. The codemod handles both layouts: it strips the prefix from
      every hash literal (manifests, `ops.json`, pre-store sibling contract snapshots, store
      entries under `migrations/snapshots/`, `.d.ts` branded literals), maps the empty-tree
      sentinel `sha256:empty` to `empty`, recomputes each `migrationHash`, and repoints
      `refs/*.json`. Store directory names are the hash's hex, which does not change. Databases
      whose marker/ledger still hold prefixed values report a hash mismatch on verify — there is
      no compatibility shim; re-sign against the regenerated contract (`prisma-next db sign`).
    detection:
      glob: "**/*.{json,ts,tsx}"
      contains:
        - 'sha256:'
      anyMatch: true
    script: ./strip-sha256-hash-prefixes.ts
  - id: migration-contract-snapshots-moved-to-content-addressed-store
    summary: |
      Committed migration contract snapshots move from per-package sibling files
      (`start-contract.json` / `start-contract.d.ts` / `end-contract.json` /
      `end-contract.d.ts`) and per-space head copies
      (`migrations/<space-id>/contract.json` / `contract.d.ts`) into a single
      content-addressed store per migrations root, at
      `migrations/snapshots/<hex>/contract.json` + `contract.d.ts`, where `<hex>`
      is the contract's 64-hex storage hash (bare hex after the
      `strip-sha256-hash-prefixes` entry above, which must run first). Every
      distinct contract is stored once, however many migrations reference it.
      Every emitted `migration.ts` now imports its bookend contracts from the
      store (`../../snapshots/<hex>/contract.json`, `../../snapshots/<hex>/contract.d.ts`)
      instead of from sibling files in its own directory.
      This is a clean break: there is no fallback reader for the old sibling-file
      layout, so a committed migrations tree that has not been converted fails to
      load once you upgrade — `migration plan` / `migration new` / `migrate` /
      `migration check` all read contract snapshots through the store only, and
      a missing store entry fails with `MIGRATION.CONTRACT_SNAPSHOT_MISSING`
      naming the expected hash and path. `migration.json` / `ops.json` /
      `migrationHash` are unaffected — the contract snapshot was never part of
      migration identity, so converting the layout changes no migration's hash.
      To convert an existing project, run the migrator once per migrations root
      from a checkout of the `prisma/prisma-next` repository at (or above) the
      version you're upgrading to: `node scripts/migrate-migrations-layout.mjs
      [migrationsRoot...]` (with no arguments it auto-discovers every migrations
      root under the current directory). Per migration package, it reads
      `migration.json`, write-if-absents the destination contract (and the
      source contract, when present) into the store under the matching hash,
      rewrites the committed `migration.ts` import specifiers, and deletes the
      four sibling files. Per contract space, it store-writes any remaining
      per-space `contract.json` / `contract.d.ts` keyed by that space's
      `refs/head.json` hash, then deletes it. It asserts every contract's inner
      `storage.storageHash` against the hash it's filed under before writing
      anything (mismatch aborts the whole run, nothing is deleted), and
      re-verifies every `migrationHash` is unchanged after conversion. Run it,
      review the diff, then `pnpm typecheck` (or your project's equivalent) to
      confirm every rewritten `migration.ts` import resolves.
    detection:
      glob: "**/migration.ts"
      contains:
        - "./start-contract.json"
        - "./end-contract.json"
        - "./start-contract'"
        - "./end-contract'"
      anyMatch: true
  - id: ref-paired-snapshots-moved-to-content-addressed-store
    summary: |
      Ref-paired contract snapshot files (`refs/<name>.contract.json` /
      `refs/<name>.contract.d.ts`, written by `ref set` and `--advance-ref`) are
      no longer written or read. A ref is now only its pointer file,
      `refs/<name>.json` (`{ hash, invariants }`); the contract it names
      resolves through the same content-addressed store as every migration
      graph node, `migrations/snapshots/<hex>/contract.json` + `contract.d.ts`,
      by that hash. This is a clean break: a pointer whose store entry is
      missing now fails with `MIGRATION.CONTRACT_SNAPSHOT_MISSING` naming the
      expected hash and path, rather than silently falling back to the
      migration graph. The same one-shot migrator that folds per-package and
      per-space sibling snapshots (see the entry above) also folds any
      existing `refs/<name>.contract.json` / `refs/<name>.contract.d.ts`
      pairs: it write-if-absents the pair into the store under the sibling
      pointer's `hash`, then deletes the pair — the pointer file itself is
      read but never written, so it stays byte-identical. A `.contract.json`
      with no sibling pointer, or whose inner `storage.storageHash` disagrees
      with the pointer's `hash`, aborts the whole run before anything is
      written or deleted. Run `node scripts/migrate-migrations-layout.mjs
      [migrationsRoot...]` (same invocation as above; one run folds both
      migration-package and ref-paired snapshots), review the diff, then
      re-run `prisma-next ref list` to confirm your refs are unaffected.
    detection:
      glob: "**/refs/*.contract.json"
      anyMatch: true
  - id: extension-packs-config-key-renamed-to-extensions
    summary: |
      The `extensionPacks` key is renamed to `extensions` everywhere: the
      low-level `defineConfig` in `prisma-next.config.ts`, the TS builder's
      `defineContract` (record form), runtime/control client options, and the
      top-level key of the emitted `contract.json` / `contract.d.ts`. The old
      config key now fails loudly with "Config.extensionPacks is no longer
      supported; rename it to Config.extensions" — it is never silently
      ignored. Rename the key in `prisma-next.config.ts` (and `contract.ts` /
      `db.ts` if they pass `extensionPacks` to client factories). The target
      façades' `defineConfig` already used `extensions`; only projects on the
      low-level config change. Because the key sits in the canonicalized bytes
      of every contract hash, all three hashes (`storageHash`,
      `executionHash`, `profileHash`) change for every contract: re-emit with
      `prisma-next contract emit`, then re-anchor migrations — regenerate
      `migrations/snapshots/<hex>/` store entries and refs for the new hashes
      (a schema-unchanged project needs a hash-advance migration or a
      re-baseline; the database schema itself does not change).
    detection:
      glob: "**/{prisma-next.config.ts,contract.ts,db.ts}"
      contains:
        - "extensionPacks"
  - id: contract-source-format-key-renamed
    summary: |
      The contract source provider field `sourceFormat` is renamed to `format`
      (`contract.source.format` in the low-level config; provider objects from
      `prismaContract()` / `typescriptContract()` emit the new field
      automatically once upgraded). Rename any literal `sourceFormat:` in
      hand-written provider objects or config assertions.
    detection:
      glob: "**/prisma-next.config.ts"
      contains:
        - "sourceFormat"
  - id: sugar-output-path-key-renamed-to-output
    summary: |
      The target façades' `defineConfig` option `outputPath` is renamed to
      `output`. Semantics are unchanged (a directory; `contract.json` is
      written inside it). Rename the key in `prisma-next.config.ts`.
    detection:
      glob: "**/prisma-next.config.ts"
      contains:
        - "outputPath"
  - id: orm-count-only-mutation-terminals-renamed
    summary: Replace `createCount(...)`, `updateCount(...)`, and `deleteCount()` with `createAndCount(...)`, `updateAndCount(...)`, and `deleteAndCount()` in ORM call sites; arguments, guards, behavior, and `Promise<number>` results are unchanged, and no compatibility aliases remain.
    detection:
      glob: "**/*.{ts,tsx,mts,cts}"
      contains:
        - ".createCount("
        - ".updateCount("
        - ".deleteCount("
      anyMatch: true
  - id: psl-format-error-class-removed
    summary: |
      The `PslFormatError` class is deleted from `@prisma-next/psl-parser`. `format()`
      on source with parse errors now throws a structured envelope with code
      `PSL.PARSE_FAILED`; the diagnostics previously on `error.diagnostics` are at
      `error.meta.diagnostics`. Replace `error instanceof PslFormatError` with
      `isStructuredError(error) && error.code === 'PSL.PARSE_FAILED'`
      (`isStructuredError` from `@prisma-next/utils/structured-error`). The message
      text is unchanged.
    detection:
      glob: "**/*.{ts,mts,cts}"
      contains:
        - "PslFormatError"
  - id: scalar-type-descriptors-channel-removed
    summary: |
      The scalar-type descriptor channel is retired in favour of the unified authoring type
      namespace. Projects with custom control-stack setups that import
      `createPostgresScalarTypeDescriptors` / `createSqliteScalarTypeDescriptors`, or that read
      `scalarTypeDescriptors` from a control stack or contract-source context, must migrate:
      those exports are deleted, and scalar types are now zero-arg type-constructor
      contributions in the component's `authoring.type` namespace — e.g.
      `String: { kind: 'typeConstructor', output: { codecId: 'pg/text@1', nativeType: 'text' } }`.
      Read the scalar type names via `stack.scalarTypes`, or the full name ->
      `{ codecId, nativeType }` map via `collectScalarTypeConstructors(stack.authoringContributions.type)`
      from `@prisma-next/framework-components/authoring`. Standard target setups
      (`@prisma-next/postgres`, `@prisma-next/sqlite`) supply the contributions themselves.
    detection:
      glob: "**/*.{ts,mts,cts}"
      contains:
        - "createPostgresScalarTypeDescriptors"
        - "createSqliteScalarTypeDescriptors"
        - "scalarTypeDescriptors"
      anyMatch: true
  - id: postgres-native-types-move-to-type-position
    summary: |
      PostgreSQL native storage types are authored directly in PSL type position, and the legacy `@db.*` attribute channel is removed. Rewrite `BaseType @db.Type` as `Type` and `BaseType @db.Type(args)` as `Type(args)` in both `types {}` aliases and model fields, then re-run `prisma-next contract emit`. Any remaining `@db.X(args)` fails with `@db.X(args) is no longer supported; use X(args) in type position`, preserving the constructor name and arguments in the suggested replacement. The supported translations are `@db.Char` → `Char`, `@db.VarChar` → `VarChar`, `@db.Numeric` → `Numeric`, `@db.Uuid` → `Uuid`, `@db.Inet` → `Inet`, `@db.SmallInt` → `SmallInt`, `@db.Real` → `Real`, `@db.Timestamp` → `Timestamp`, `@db.Timestamptz` → `Timestamptz`, `@db.Date` → `Date`, `@db.Time` → `Time`, and `@db.Timetz` → `Timetz`; preserve constructor arguments. Rewrite the old native-json spelling `Json @db.Json` as bare `Json`. This source migration preserves native types and supplied type parameters. It also preserves codec ids except for `@db.Date` → `Date`, which rebinds `pg/timestamptz@1` to `pg/date@1`, changes the contract storage hash, and requires re-emission plus re-signing; see the `postgres-date-rebound-to-pg-date` entry below. Separately, apply the `postgres-json-rebound-to-native-json` entry below to old bare `Json` fields that meant jsonb storage.
    detection:
      glob: "**/*.prisma"
      contains:
        - "@db."
      anyMatch: true
  - id: postgres-json-rebound-to-native-json
    summary: |
      On the postgres target the PSL `Json` scalar re-binds from `pg/jsonb@1` / `jsonb` to
      `pg/json@1` / `json`; a new bare `Jsonb` scalar carries `pg/jsonb@1` / `jsonb`. Postgres
      schemas that use `Json` and mean jsonb storage (which every pre-0.16 `Json` field did)
      must switch those fields — and `types {}` aliases — to `Jsonb`, then re-run
      `prisma-next contract emit`; with `Jsonb` the emitted `contract.json` is byte-identical
      to the pre-0.16 output. A field left as `Json` now emits a native `json` column and a
      new storage hash, which against an existing jsonb database is a schema change. The
      removed `@db.Json` spelling must be rewritten from `Json @db.Json` to bare `Json`; any remaining use fails with migration guidance to use `Json` in type position. SQLite and Mongo `Json` bindings are untouched. The TS builder surface (`field.json()`, `jsonbColumn`) is unchanged and stays jsonb.
    detection:
      glob: "**/*.prisma"
      contains:
        - "Json"
      anyMatch: true
  - id: default-generators-no-longer-set-storage
    summary: |
      `@default(<generator>)` no longer influences a column's storage — the type position is
      the only storage decider. Pre-0.16, a generator default on a bare `String` field re-picked
      the column's storage to a sized char: `String @default(uuid())` / `@default(uuid(7))`
      emitted `sql/char@1` / `character(36)`, `@default(cuid(2))` `character(24)`,
      `@default(nanoid())` `character(21)` (or `character(<size>)` for `nanoid(<size>)`), and
      `@default(ulid())` `character(26)`. From 0.16 such fields emit the target's `String`
      storage (postgres: `pg/text@1` / `text`) with the same execution-time generator, so a
      re-emit produces a new storage hash — against an existing database created with the char
      storage this is a schema change. To keep the prior storage byte-identical, name it in the
      type position: `Char(36) @default(uuid())`, `Char(24) @default(cuid(2))`,
      `Char(21) @default(nanoid())` (or `Char(<size>)` for a sized nanoid), `Char(26)
      @default(ulid())` — or adopt native `Uuid` for `uuid()` if a `uuid`-typed column is
      preferred (that is a schema change too). Then re-run `prisma-next contract emit` and, if
      you accepted a storage change, plan/apply the matching migration. Generator applicability
      validation is unchanged (`uuid()` on `Int` still fails with
      `PSL_INVALID_DEFAULT_APPLICABILITY`), and the TS builder presets
      (`field.id.uuidv4String()`, `field.generated(uuidv4())`, …) are untouched — they bundle
      their `char(N)` storage explicitly.
    detection:
      glob: "**/*.prisma"
      contains:
        - "@default(uuid("
        - "@default(cuid("
        - "@default(nanoid("
        - "@default(ulid("
      anyMatch: true
  - id: postgres-date-rebound-to-pg-date
    summary: |
      On the postgres target, the bare `Date` type constructor re-binds from `pg/timestamptz@1` to the dedicated `pg/date@1` codec. Rewrite the removed `DateTime @db.Date` spelling as `Date`; leaving it unchanged now fails with migration guidance to use `Date` in type position. The stored native type is unchanged (`date`), so no schema migration is needed, but a re-emit changes the column's codec ref and therefore the contract's storage hash: run `prisma-next contract emit`, then re-sign any signed database against the regenerated contract (`prisma-next db sign`) — verify reports a hash mismatch until you do.
      Contracts emitted before the upgrade keep working (`pg/timestamptz@1` still exists).
      Runtime behavior changes on re-emit: date columns decode as a `Date` at UTC midnight
      (previously the driver's local-midnight `Date` passed through, so the instant depended
      on the process timezone — code reading local getters near midnight in negative-UTC-offset
      zones saw the neighboring day), encode formats `YYYY-MM-DD` from UTC getters, and
      relation `.include()` over a date column now decodes instead of failing with
      `RUNTIME.DECODE_FAILED`. Update tests or application code that pinned the old
      local-midnight instants to expect `new Date(Date.UTC(y, m, d))`.
    detection:
      glob: "**/*.prisma"
      regex:
        - '@db\.Date'
        - '\sDate(\s|\?|\[|$)'
      anyMatch: true
  - id: sql-escape-error-class-removed
    summary: |
      The `SqlEscapeError` class is deleted from `@prisma-next/target-postgres` and
      `@prisma-next/target-sqlite` (including its re-export from the postgres/sqlite
      adapter `control` entrypoints). Identifier/literal escaping failures now throw a
      structured envelope with code `CONTRACT.IDENTIFIER_INVALID`. Replace
      `error instanceof SqlEscapeError` with
      `isStructuredError(error) && error.code === 'CONTRACT.IDENTIFIER_INVALID'`
      (`isStructuredError` from `@prisma-next/utils/structured-error`). Message text is
      unchanged.
    detection:
      glob: "**/*.{ts,mts,cts}"
      contains:
        - "SqlEscapeError"
  - id: supabase-error-classes-removed
    summary: |
      The `SupabaseConfigError` and `InvalidJwtError` classes are deleted from
      `@prisma-next/extension-supabase/runtime`. The same failures now throw
      structured envelopes with codes `SUPABASE.CONFIG_INVALID` and
      `SUPABASE.JWT_INVALID`. Replace `error instanceof SupabaseConfigError` with
      `isStructuredError(error) && error.code === 'SUPABASE.CONFIG_INVALID'` and
      `error instanceof InvalidJwtError` with
      `isStructuredError(error) && error.code === 'SUPABASE.JWT_INVALID'`
      (`isStructuredError` from `@prisma-next/utils/structured-error`). Message
      text is unchanged.
    detection:
      glob: "**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}"
      contains:
        - "SupabaseConfigError"
        - "InvalidJwtError"
      anyMatch: true

  - id: indexes-are-name-identified
    summary: |
      Secondary indexes are name-identified from 0.17. Every index entry in the emitted
      `contract.json` / `contract.d.ts` now carries `name` (the full physical name) and
      `unique`, plus `prefix` when the name is toolchain-managed; `columns` became optional
      (an index carries either `columns` or an opaque `expression` — never both). Contracts
      emitted by 0.16 fail validation on load (the error message contains "indexes[0].name
      must be a string (was missing)"), and storage hashes move for every contract that
      declares indexes — re-emit with `prisma-next contract emit`. Physical names change for managed indexes: an unnamed
      PSL `@@index([a, b])` / TS `constraints.index([a, b])` and every FK-backing index now
      CREATE as `<default-prefix>_<8hex>` content-hash wire names (e.g.
      `user_email_idx_46df9cad`), and a TS `constraints.index([...], { name: "x" })` name is
      now a managed prefix — the physical name becomes `x_<8hex>`. PSL
      `@@index([...], map: "x")` is now an exact physical name whose identity is verified
      against the live catalog. Existing databases converge without rebuilds: after
      re-emitting, the first plan that allows the `widening` class (`db update`, or
      `migration plan` + `migrate`) is `ALTER INDEX … RENAME TO` ops only — renames happen
      only when a widening plan runs FIRST. Under an additive-only policy the rename pairing
      does not run: the new wire-named index is created beside the old one, and once both
      exist a later plan can no longer pair them — the old index is removed only by a
      destructive-allowed plan dropping it. Update any code or tests that hard-code the old
      physical index names.
    detection:
      glob: "**/*.{prisma,ts,json}"
      contains:
        - "@@index"
        - "constraints.index"
        - '"indexes":'
      anyMatch: true
  - id: framework-error-classes-removed
    summary: |
      Three exported framework error classes are deleted: `ConfigFileNotFoundError`
      (from `@prisma-next/config-loader`), `ConfigValidationError` (from
      `@prisma-next/config/config-validation`), and `DomainNamespaceResolutionError`
      (from `@prisma-next/contract/types`). The same failures now throw structured
      envelopes with codes `CONFIG.FILE_NOT_FOUND`, `CONFIG.VALIDATION_FAILED`, and
      `CONTRACT.NAMESPACE_INVALID` respectively. Replace each
      `error instanceof <Class>` with
      `isStructuredError(error) && error.code === '<CODE>'`
      (`isStructuredError` from `@prisma-next/utils/structured-error`). Message
      text is unchanged.
    detection:
      glob: "**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}"
      contains:
        - "ConfigFileNotFoundError"
        - "ConfigValidationError"
        - "DomainNamespaceResolutionError"
      anyMatch: true
  - id: pg-int8-application-values-are-bigint
    summary: |
      `pg/int8@1` carries `bigint` application values where it carried `number`. A JS `number`
      cannot represent the whole signed 64-bit range, so any value past 2^53 was already being
      silently rounded. Every read of an `int8` column now yields a `bigint`, and every value
      compared against one must be a `bigint` literal. `count()` is the widest instance: it
      resolves to `pg/int8@1`, so a counted column's row type is `bigint` and a `having`
      comparison reads `fns.gt(fns.count(), 5n)`. Update row-type annotations, comparison
      literals, and any arithmetic that mixes a counted value with a `number` — TypeScript will
      not implicitly convert between the two, so `pnpm typecheck` locates every site.
      A contract's `int8` literal defaults are also emitted as decimal strings rather than JSON
      numbers; re-emit to pick that up.
    detection:
      glob: "**/*.{ts,tsx,mts,cts}"
      contains:
        - "fns.count("
        - "pg/int8@1"
        - "int8Column"
      anyMatch: true
  - id: pg-interval-values-are-iso-8601-durations
    summary: |
      Reading a `pg/interval@1` column returns an ISO-8601 duration string — `P1M`, `P30D`,
      `P1Y2M3DT4H5M6S`, `PT0S` for zero — where it returned a `JSON.stringify` of the driver's
      component object such as `{"days":1}`. Writing accepts the same spelling. An interval
      carries months, days and microseconds independently, so `P1M` and `P30D` remain distinct
      and neither converts to the other. Replace any parsing of the old object-shaped string,
      and replace interval literals written in PostgreSQL's own syntax (`'1 day'`) with the
      ISO-8601 form (`'P1D'`); a value that is not a valid duration is now rejected rather than
      passed through.
    detection:
      glob: "**/*.{ts,tsx,mts,cts}"
      contains:
        - "pg/interval@1"
        - "intervalColumn"
      anyMatch: true
  - id: codec-json-forms-are-canonical
    summary: |
      Several codecs' JSON representation changed so a value survives the round trip through a
      contract. `pg/numeric@1` and `sqlite/bigint@1` are decimal text where they were JSON
      numbers — `9007199254740993` reached JSON as `…992` before, and arbitrary-precision
      decimals lost their tail. `pg/bytea@1` is base64 where it was PostgreSQL's `\x`-prefixed
      hex. `sqlite/blob@1` is uppercase hexadecimal where it was base64. `sqlite/bigint@1`
      additionally accepts values it previously refused outright: half of SQLite's INTEGER range
      had no JSON representation at all. Run `prisma-next contract emit` to regenerate
      `contract.json` / `contract.d.ts`; any literal default on one of these codecs changes
      spelling, and with it the `storageHash`. Code that reads such a default out of a contract,
      or that hand-writes one, must use the new form.
    detection:
      glob: "**/contract.{json,d.ts}"
      contains:
        - "pg/numeric@1"
        - "pg/bytea@1"
        - "sqlite/bigint@1"
        - "sqlite/blob@1"
      anyMatch: true
  - id: float-json-requires-extra-float-digits-at-least-one
    summary: |
      The canonical JSON of `pg/float4@1`, `pg/float8@1`, `pg/float@1` and `pg/vector@1` holds
      only where the PostgreSQL session's `extra_float_digits` is 1 or above. That is the default
      from PostgreSQL 12 onward, so most deployments already satisfy it — but a connection that
      sets the GUC to 0 or below reverts to a fixed digit count and truncates: `1/3` reads back
      as `0.333333333333333` rather than `0.3333333333333333`, and the value no longer
      round-trips. Check any connection string, pool `options`, server config or proxy that sets
      `extra_float_digits` and remove settings of 0 or below.
    detection:
      glob: "**/*.{ts,tsx,mts,cts,js,mjs,cjs,json,toml,yaml,yml,env}"
      contains:
        - "extra_float_digits"
      anyMatch: true
  - id: sqlite-real-rejects-non-finite-values
    summary: |
      `sqlite/real@1` rejects infinities and `NaN` on both the encode and decode sides. JSON has
      no spelling for either, and SQLite renders an infinity as `9.0e+999`, which reads back as
      `Infinity` rather than failing — so a non-finite value used to pass through and corrupt the
      value silently. Guard any computation that can produce a non-finite float before writing it
      to a `REAL` column, or store it in a column whose codec admits it.
    detection:
      glob: "**/*.{ts,tsx,mts,cts}"
      contains:
        - "sqlite/real@1"
        - "realColumn"
      anyMatch: true
---

# 0.16 → 0.17 — User upgrade instructions

## `strip-sha256-hash-prefixes`

Starting at the 0.17 release, every content hash Prisma Next mints or accepts is bare lowercase hex — the `sha256:` prefix is removed across the board: emitted `contract.json` / `contract.d.ts` (including the `StorageHashBase<'…'>` / `ProfileHashBase<'…'>` branded type literals), migration manifests, refs, CLI output, and the marker/ledger bookkeeping tables in your database. The prefix carried no information (the algorithm never varied per hash), and the hash **value** — not an in-band tag — signals a format change. Loaders and validators now reject the legacy prefixed form outright.

Two distinct effects on your checked-in artefacts:

- **Contract hashes keep their value.** `storageHash` / `profileHash` are computed over contract content, which never embedded its own hash — only the textual prefix drops.
- **Migration hash values change.** `migrationHash` is computed over the manifest bytes, which embed the `from` / `to` contract-hash strings; with those now bare, every recomputed `migrationHash` differs from the stored one.

### Migrate checked-in `migrations/` trees — before the layout migrator

Run the colocated codemod from your project root, **before** `scripts/migrate-migrations-layout.mjs` (the snapshot-layout entries below) — the 0.17 layout migrator accepts only bare-hex trees:

```bash
pnpm exec tsx ./strip-sha256-hash-prefixes.ts
```

For every on-disk migration package (a `migration.json` with a sibling `ops.json`) it strips the prefix from the manifest's `from` / `to`, from hash literals inside `ops.json`, in pre-store sibling contract snapshots (`*-contract.json`, `*.d.ts`, `migration.ts`), and in content-addressed store entries (`migrations/snapshots/<hex>/contract.json` + `contract.d.ts` — the directory name is the hash's hex and does not change), recomputes `migrationHash` over the bare-hex content, and rewrites `refs/*.json` — repointing refs that held old migration hashes at the recomputed ones, and mapping the empty-tree sentinel `sha256:empty` to `empty`. The edit is format-preserving (only hash literals and the recomputed hash value change) and idempotent: re-running over an already-bare tree makes no further changes.

Use `--check` for a dry run that lists files still needing the fix and exits non-zero if any remain:

```bash
pnpm exec tsx ./strip-sha256-hash-prefixes.ts --check
```

### Re-emit live contract artefacts

Regenerate your emitted artefacts so `contract.json` / `contract.d.ts` pick up the bare-hex form:

```bash
pnpm emit
# (runs `prisma-next contract emit` under the hood)
```

The regenerated files differ only in hash representation — the hash values themselves are unchanged.

### Update hash literals your own code carries

If your application or tests hard-code hash strings (asserting a `migrationHash`, comparing a `storageHash`, matching CLI output), drop the `sha256:` prefix — and for migration hashes, read the new value from the regenerated manifest, since the value itself changed.

### Database marker/ledger

There is no compatibility shim: a database whose marker/ledger rows still hold prefixed values reports a hash mismatch on `prisma-next db verify`. Re-sign the database against your regenerated contract:

```bash
prisma-next db sign
```

### Validation

After the codemod and re-emit, run `pnpm typecheck && pnpm test` (or your application's equivalent), and exercise any command that loads your migrations (deploy or migration-status step) — the loader recomputes and verifies each manifest's `migrationHash` on read, so a stale or still-prefixed manifest fails immediately. `git grep -n "sha256:"` over your project should return no hits in committed artefacts.

Also in this release, the ORM client's internal `throw new Error(...)` sites
were converted to a structured-error scheme (`ORM.*` codes via `structuredError`,
or `InternalError` for invariants). These are internal throw sites: the errors
are still `Error` instances with unchanged message text, so application code
that catches them by message or by `instanceof Error` is unaffected. No action
required beyond the migration contract-snapshot layout change above.

## `indexes-are-name-identified`

Secondary indexes are **name-identified**: the contract stores every index's full physical name, and schema verification and migration planning pair indexes by that name instead of by column tuple.

### What changed in the emitted contract

Each entry in a table's `indexes` array in `contract.json` / `contract.d.ts` now always carries:

- `name` — the full physical name of the index in the database.
- `unique` — always present (`false` for everything authored today).
- `prefix` — present when the name is toolchain-managed: the physical name is then `<prefix>_<8hex>`, where the suffix is a content hash of the index definition.
- `columns` — now optional; an index carries either `columns` or an opaque `expression` string, never both.

Newly available in 0.17 (additive — no migration needed): RLS policy blocks (`policy_select` etc.) accept `@@map("physical name")` to adopt an existing live policy under its exact name — no wire-name hash, drift detection byte-compares the body against Postgres's reprint (hand-authoring the text warns with `PN_EXACT_NAME_BODY_COMPARISON`), and replacing `@@map` with the plain head later converges via a single `ALTER POLICY … RENAME`. Also newly available: both authoring surfaces accept the full index parameter matrix. PSL `@@index` and TS `constraints.index` take `expression:` (instead of a fields list; requires `name:` or `map:`), `where:` (partial-index predicate), `unique:`, `type:`/`options:` (target-registered access method), and `name:` xor `map:`. Combining `map:` with a SQL body emits the `PN_EXACT_NAME_BODY_COMPARISON` warning at build time — drift detection byte-compares hand-authored text against Postgres's reprint, so prefer `name:` unless the text was captured by `contract infer`. SQLite contracts reject `expression:`/`where:` with `CONTRACT.ARGUMENT_INVALID` (the target does not support them).

A contract emitted by 0.16 fails validation when a 0.17 toolchain loads it — a `Contract structural validation failed: storage.namespaces.<ns> …` error whose message contains `indexes[0].name must be a string (was missing)` and `indexes[0].unique must be boolean (was missing)` — and the storage hash moves for every contract that declares indexes. Re-emit:

```bash
prisma-next contract emit
```

### What changed about physical index names

| Authoring input | 0.16 physical name | 0.17 physical name |
| --- | --- | --- |
| PSL `@@index([a, b])` / TS `constraints.index([cols.a, cols.b])` (unnamed) | `<table>_<a>_<b>_idx` | `<table>_<a>_<b>_idx_<8hex>` (managed) |
| FK-backing index (derived from a relation) | `<table>_<col>_idx` | `<table>_<col>_idx_<8hex>` (managed) |
| TS `constraints.index([...], { name: "x" })` | `x` | `x_<8hex>` — the name is now a managed *prefix* |
| PSL `@@index([...], map: "x")` | `x` | `x` — an exact physical name, now verified against the live catalog |

The `<8hex>` suffix is a content hash over the index definition (element list, predicate, uniqueness, access method, options), so an unchanged definition always produces the same name.

### Converging an existing database

No index is rebuilt. After re-emitting the contract, the first plan that allows the `widening` operation class converges the live names with `ALTER INDEX … RENAME TO` ops only:

- `prisma-next db update` (its default policy includes widening), or
- `prisma-next migration plan --name converge-index-names` followed by `prisma-next migrate`.

Inspect the plan before applying — for a schema whose only drift is the index naming, it contains nothing but renames.

Under an **additive-only** policy (e.g. `db init`'s class set) the rename pairing is skipped: the plan creates the new wire-named index beside the old one. Once both indexes exist, a later widening plan has nothing left to pair — the new name is already present, and the rename op's own precheck requires its target name to be absent — so after the additive create the old index is removed **only** by a destructive-allowed plan dropping it. A rename happens only when a widening-allowed plan is the *first* convergence, before any create. This degradation is deliberate — an additive-only run never emits an op class it is not allowed to execute; if you want renames instead of create-then-drop, run the widening plan first.

### Hard-coded names

If application code, tests, or operational scripts hard-code physical index names (e.g. `user_email_idx`), read the new names from the regenerated `contract.json` — managed names now carry the hash suffix. PSL schemas that must keep a byte-exact legacy name can pin it with `@@index([...], map: "<exact name>")`.

## Incidental dependency and lint-config bumps

Routine dev-dependency bumps and biome `$schema` version alignment in `examples/` (dependabot `dev-deps` group, PR #1058) require no Prisma Next-specific upgrade action; review and test the affected examples as with any routine dependency update.

## Incidental dependency bumps in examples

Routine runtime dependency bumps in `examples/` (dependabot `runtime-deps` group, PR #1065) require no Prisma Next-specific upgrade action; review and test the affected examples as with any routine dependency update.

## Incidental example dependency bumps (react-router 8)

The `react-router-demo` example moves its `react-router`, `@react-router/dev`, `@react-router/node`, and `@react-router/serve` dependencies from 7.x to 8.x. This is an example-local framework upgrade and requires no Prisma Next-specific upgrade action; the Prisma Next surfaces the example uses are unchanged.

## `pg-int8-application-values-are-bigint`

An `int8` is a signed 64-bit integer; a JS `number` holds integers exactly only to 2^53. The codec previously handed you a `number`, so anything larger was already wrong by the time your code saw it. It now hands you a `bigint`.

TypeScript does not implicitly convert between `number` and `bigint`, so `pnpm typecheck` finds every affected site. Three shapes recur:

- **Row-type annotations.** A counted column is `bigint`: `SqlQueryPlan<{ name: string; postCount: bigint }>`.
- **Comparison literals.** `fns.gt(fns.count(), 5)` becomes `fns.gt(fns.count(), 5n)`.
- **Values read from a driver.** A raw `pg` query returns an `int8` as a decimal *string*; convert with `BigInt(row.id)` rather than annotating it `number`.

Arithmetic mixing the two throws at runtime rather than coercing, so a site that typechecks after a cast is worth reading again.

## `pg-interval-values-are-iso-8601-durations`

The application value of `pg/interval@1` is now defined, where before it was whatever the driver happened to hand over. It is an ISO-8601 duration string, spelled as PostgreSQL spells one under `IntervalStyle = 'iso_8601'`: zero components omitted, `T` present only when a time component is, each component carrying its own sign, and `PT0S` for a zero interval.

Any accepted duration is normalised to that spelling, so `P13M` is carried as `P1Y1M`. Text that is not a valid duration — including PostgreSQL's own `'1 day'` — is rejected rather than passed through.

This is the one change in this release that alters what a *query* returns rather than only what a contract holds.

## `codec-json-forms-are-canonical`

The rule these follow is that a value written through a codec and read back must be the same value. Where a codec's JSON form could not carry its own range, the form changed rather than the range being quietly clipped.

Re-emit first (`prisma-next contract emit`), then reconcile any code that reads or writes one of these forms directly. Literal defaults are where this most often surfaces: an `int8` default of `0` is now `"0"` in `contract.json`, and the `storageHash` moves with it.
