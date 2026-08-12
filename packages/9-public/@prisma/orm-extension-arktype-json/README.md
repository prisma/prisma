# @prisma/orm-extension-arktype-json

JSON columns with a validated, typed shape for Prisma Next, built on [arktype](https://arktype.io).

```bash
pnpm add @prisma/orm-extension-arktype-json
```

## Entrypoints

| Namespace | Surface |
| --- | --- |
| `/pack` | the extension pack an application composes into `extensions: [...]` — pure, no runtime imports |
| `/column-types` | the `arktypeJson(schema)` column author |
| `/codecs`, `/codec-types` | the `arktype/json@1` codec descriptor and the types emitted contracts reference |
| `/runtime` | the runtime extension |
| `/control` | the control descriptor |

## Responsibilities

Given an arktype `Type`, `arktypeJson(schema)` produces a column that stores `jsonb`, carries the schema's serialized form in `typeParams`, and renders the schema's TypeScript expression as the column's type in `contract.d.ts`. At runtime the framework rehydrates the schema from that serialized form and validates wire payloads on decode; a validation failure raises `RUNTIME.JSON_SCHEMA_VALIDATION_FAILED`. Encoding only checks JSON representability.

JSON-with-schema is deliberately a per-library extension — this pack covers arktype; other validators get their own packs once each has a clean serialize-and-rehydrate story. Raw, untyped JSON columns stay in the Postgres target.

## Dependencies

`@prisma/orm-framework` and `@prisma/orm-family-sql` at exact lockstep versions, plus `arktype` and `@standard-schema/spec`.

`arktype` is an ordinary dependency, not a peer: a column carries its schema as a serialized form and the runtime rehydrates it from that, so this pack never compares schema objects with the copy an application authored against. The application's own `arktype` and this pack's may be separate instances.

`@prisma/orm-target-postgres` is an exact-pinned **peer** dependency: the application supplies it, directly or through a facade, and everyone shares that one copy. A hard dependency would let an application upgrade the facade without upgrading this pack and end up with two target copies whose codec and operation registries have quietly diverged; as a peer that combination fails to install instead.
