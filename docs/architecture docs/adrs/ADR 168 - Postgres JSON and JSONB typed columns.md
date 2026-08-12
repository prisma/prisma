# ADR 168 — Postgres JSON and JSONB typed columns

## Context

Prisma Next needs first-class support for PostgreSQL `json` and `jsonb` storage columns in:

- contract authoring helpers
- adapter/runtime codec registration
- migration/introspection surfaces
- emitted `contract.d.ts` typing

We also need a clear default type when users do not provide a schema.

## Decision

Treat `json` and `jsonb` as Postgres-native storage types with dedicated codecs:

- `pg/json@1`
- `pg/jsonb@1`

Expose contract authoring helpers:

- `jsonColumn`, `jsonbColumn`
- `json(schema?)`, `jsonb(schema?)` where `schema` is a Standard Schema value (Arktype-compatible)

Use existing parameterized type infrastructure (`typeParams`) to carry schema metadata:

- `jsonb(auditSchema)` stores schema output JSON Schema in `typeParams.schemaJson`
- `typeParams.schema` is a phantom type-level key used only for Standard Schema output inference
- `contract.d.ts` rendering derives a type expression from schema metadata when present
- fallback type is `JsonValue` when no schema is provided

## JSON value semantics

PostgreSQL accepts any valid JSON value in both `json` and `jsonb` columns:

- object
- array
- string
- number
- boolean
- JSON `null`

Important distinction:

- JSON `null` is a JSON value inside a non-null SQL cell.
- SQL `NULL` is the absence of a value at the column level.

## json vs jsonb behavior

- `json` stores the original JSON text representation.
- `jsonb` stores a binary-normalized representation.
- `jsonb` does not preserve whitespace.
- `jsonb` does not preserve object key order.
- `jsonb` keeps only the last value for duplicate keys.

These behavioral differences do not change the Prisma Next JS runtime value type (both decode to `JsonValue` by default), but they matter for storage semantics and query/index behavior.

## Typed JSON design

Standard Schema values are chosen as the source of typed JSON metadata:

- They provide a cross-library contract (`~standard`) shared by Arktype and other schema libraries.
- They remain serializable into `contract.json` via schema output JSON Schema payload.
- They allow emitted `contract.d.ts` to derive concrete object types without stringly-typed hints.

Fallback remains `JsonValue` to provide a safe default for untyped JSON columns.

## Consequences

### Positive

- Postgres JSON/JSONB works end-to-end across authoring, runtime lowering, and schema surfaces.
- Generated typings preserve schema-derived types from Standard Schema inputs.
- Default behavior remains safe and broadly compatible via `JsonValue`.

### Tradeoffs

- Type derivation quality depends on schema metadata quality (`~standard` JSON Schema output).
- Unsupported schema constructs degrade to `JsonValue` during rendering.

## Related

- ADR 114 — Extension codecs & branded types
- ADR 121 — Contract.d.ts structure and relation typing
- ADR 131 — Codec typing separation
