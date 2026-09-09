---
from: "8.0.0-rc.8"
to: "8.0.0-rc.9"
changes:
  - id: mongo-index-projections-use-native-lists
    summary: |
      MongoDB wildcard index `include` and `exclude` projections in Prisma schema files must use native PSL lists instead of encoded list strings.
    detection:
      glob: "**/*.prisma"
      matches:
        - '\b(?:include|exclude)\s*:\s*"\[[^"\r\n]*\]"'
  - id: mongo-text-index-weights-use-native-records
    summary: |
      MongoDB text-index `weights` in Prisma schema files must use native PSL records instead of encoded JSON strings.
    detection:
      glob: "**/*.prisma"
      matches:
        - '\bweights\s*:\s*"\{\s*(?:\\.|[^"\\])*\}"'
  - id: explicit-enum-sort-values
    summary: |
      PostgreSQL text-backed enums now sort by stored value rather than declaration order; encode semantic ranks explicitly when ordering matters.
  - id: namespace-qualify-sql-orm-filter-types
    summary: |
      SQL ORM reusable filter types now require the domain namespace before the model name: `<Contract, Namespace, Model>`.
  - id: to-one-relations-record-nullable
    summary: |
      Every `1:1` and `N:1` relation in `contract.json` now carries a `nullable` boolean, and the
      client refuses a contract without it. Re-run `prisma contract emit` so the emitted
      `contract.json` / `contract.d.ts` match the installed toolchain.
    detection:
      glob: "**/contract.json"
      matches:
        - '"cardinality":\s*"(?:N:1|1:1)",\s*"on":'
  - id: contract-dts-exports-models
    summary: |
      `contract.d.ts` now exports a `Models` namespace and a `models` constant that name every
      model with its fields and relations. The re-emit above produces them; use them with
      `Scalars` and `Shape` to name row types without a client in scope.
  - id: mongo-unlowered-attributes-are-rejected
    summary: |
      MongoDB Prisma schema files must not carry `@default(...)`, `@updatedAt`, or `@db.*` attributes; the Mongo interpreter never lowered them and now rejects them.
    detection:
      glob: "**/*.prisma"
      matches:
        - '@(?:default\(|updatedAt\b|db\.)'
---

# 8.0.0-rc.8 → 8.0.0-rc.9 — User upgrade instructions

## `mongo-index-projections-use-native-lists`

For every Prisma schema matched by `detection`, replace encoded projection strings with native PSL lists. For example, change `include: "[a, b]"` to `include: ["a", "b"]` and `exclude: "[a]"` to `exclude: ["a"]`. Decode each string's fields in their existing order and preserve whether the argument is `include` or `exclude`.

## `mongo-text-index-weights-use-native-records`

For every Prisma schema matched by `detection`, replace the encoded JSON string passed to `weights` with a native PSL record. For example, change `weights: "{\"title\": 10}"` to `weights: { title: 10 }`, preserving every field name and numeric weight.

## `explicit-enum-sort-values`

Review queries that order text-backed enum columns and rely on declaration order. To retain semantic ranking, use an explicit ranking expression or numeric enum values. For example, a priority enum can use `{ codecId: 'pg/int4@1', nativeType: 'int4' }` with `member('Low', 0)`, `member('High', 1)`, and `member('Urgent', 2)`. In PSL, use `@@type("pg/int4@1")` with `Low = 0`, `High = 1`, and `Urgent = 2`. Update literal writes and type annotations to the numeric values, then re-emit the contract. For an existing database, create a data-preserving migration mapping the old strings to their numeric ranks and update defaults and constraints; do not rewrite applied migration history. PostgreSQL native enum columns retain the database's native ordering.

## `namespace-qualify-sql-orm-filter-types`

Find TypeScript references to `ShorthandWhereFilter`, `RelationPredicate`, `RelationPredicateInput`, and `RelationFilterAccessor`. Add the model's domain namespace as the second generic argument and place the model name third. Rewrite `ShorthandWhereFilter<Contract, Model>` as `ShorthandWhereFilter<Contract, Namespace, Model>` and `ShorthandWhereFilter<Contract, Model, Namespace>` as `ShorthandWhereFilter<Contract, Namespace, Model>`. Rewrite the relation types from `<Contract, Model>` to `<Contract, Namespace, Model>`. Use the namespace facet through which the model is queried, such as `'public'` for `db.public.User`.

## `to-one-relations-record-nullable`

For every `contract.json` matched by `detection`, run the project's emit command (`prisma contract emit`, or the project's `contract:emit` script) once after upgrading. The emit reads the `?` on each to-one relation field in the schema and writes `"nullable": true` or `"nullable": false` next to that relation's `"cardinality"`. The emit also fails, rather than emitting, when a required relation field sits over a nullable foreign key or the reverse; fix the schema so the field's `?` matches the key's `?`, then emit again.

## `contract-dts-exports-models`

After the emit, `import type { Models, models } from './prisma/contract'` (the project's contract path) gives `Models.<namespace>_<Model>` for every model, and `Scalars<M>` / `Shape<M, { relation: {} }>` from `@prisma/orm-postgres/family-contract/types` (or the Mongo family package) derive the default row and a data structure with relations from it. Replace hand-written row types that duplicate a model's fields with these when convenient.
## `mongo-unlowered-attributes-are-rejected`

First, before editing any schema, determine whether the project targets MongoDB: its `prisma.config.ts` imports `@prisma/orm-mongo`, or its `package.json` depends on that package. If neither holds, skip this change entirely and leave every schema untouched. The `detection` pattern also matches SQL schemas, where `@default(...)` and `@db.<Type>` are supported and deleting them breaks the contract.

For every matched MongoDB schema, delete each `@default(...)`, `@updatedAt`, and `@db.<Type>` attribute from the field that carries it, leaving the field's type and its other attributes in place. For example, change `status ProductStatus @default(Active)` to `status ProductStatus` and `updatedAt DateTime @updatedAt` to `updatedAt DateTime`. The Mongo interpreter never lowered these attributes into the contract, so the emitted `contract.json` does not change; defaults and timestamps stay the responsibility of application code, as they already were. `prisma contract emit` now fails with `PSL_UNSUPPORTED_FIELD_ATTRIBUTE` while any of them remain.
