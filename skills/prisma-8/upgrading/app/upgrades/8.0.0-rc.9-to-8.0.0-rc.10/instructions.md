---
from: "8.0.0-rc.9"
to: "8.0.0-rc.10"
changes:
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
---

## `to-one-relations-record-nullable`

For every `contract.json` matched by `detection`, run the project's emit command (`prisma contract emit`, or the project's `contract:emit` script) once after upgrading. The emit reads the `?` on each to-one relation field in the schema and writes `"nullable": true` or `"nullable": false` next to that relation's `"cardinality"`. The emit also fails, rather than emitting, when a required relation field sits over a nullable foreign key or the reverse; fix the schema so the field's `?` matches the key's `?`, then emit again.

## `contract-dts-exports-models`

After the emit, `import type { Models, models } from './prisma/contract'` (the project's contract path) gives `Models.<namespace>_<Model>` for every model, and `Scalars<M>` / `Shape<M, { relation: {} }>` from `@prisma/orm-postgres/family-contract/types` (or the Mongo family package) derive the default row and a data structure with relations from it. Replace hand-written row types that duplicate a model's fields with these when convenient.
