---
from: "8.0.0-rc.8"
to: "8.0.0-rc.9"
changes:
  - id: remove-nested-relations-from-sql-orm-upsert-and-batch-create
    summary: |
      SQL ORM `upsert({ create })`, `createAll()`, and `createAndCount()` payloads no longer accept nested relation mutation callbacks, which these operations cannot execute. Remove the callbacks and create related records separately, or use ordinary `create()` when the records must be created as one nested relation operation.
  - id: namespace-qualify-sql-orm-filter-types
    summary: |
      SQL ORM reusable filter types now require the domain namespace before the model name: `<Contract, Namespace, Model>`.
  - id: to-one-relations-record-nullable
    summary: |
      `ContractNonJunctionRelation`'s `'1:1'` and `'N:1'` members now require `nullable: boolean`,
      and contract validation rejects a `contract.json` whose to-one relations lack it. Set
      `nullable` on every to-one relation the extension constructs, and rebuild the extension's
      contract space so its emitted `contract.json` / `contract.d.ts` carry the flag.
    detection:
      glob: "**/*.ts"
      matches:
        - '(?<!\bnullable\b(?:[^{}]|\{[^{}]*\})*)(?:(?<=\bon\s*:(?:[^{}]|\{[^{}]*\})*)|(?=(?:[^{}]|\{[^{}]*\})*\bon\s*:))\bcardinality:\s*[''"](?:N:1|1:1)[''"](?!(?:[^{}]|\{[^{}]*\})*\bnullable\b)'
  - id: contract-space-re-emit-nullable
    summary: |
      The extension's emitted `contract.json` must carry `nullable` on every `1:1` and `N:1`
      relation. Rebuild the contract space (the package's `build:contract-space` script) once
      after upgrading.
    detection:
      glob: "**/contract.json"
      matches:
        - '"cardinality":\s*"(?:N:1|1:1)",\s*"on":'
---

# 8.0.0-rc.8 → 8.0.0-rc.9 — Extension author upgrade instructions

## `remove-nested-relations-from-sql-orm-upsert-and-batch-create`

Find SQL ORM calls to `upsert()`, `createAll()`, and `createAndCount()` whose create payloads contain relation fields assigned callback functions. Remove those callbacks and create the related records separately. When the operation requires nested relation creation, replace it with ordinary `create()`, which continues to accept and execute relation mutation callbacks.

## `namespace-qualify-sql-orm-filter-types`

Find TypeScript references to `ShorthandWhereFilter`, `RelationPredicate`, `RelationPredicateInput`, and `RelationFilterAccessor`. Add the model's domain namespace as the second generic argument and place the model name third. Rewrite `ShorthandWhereFilter<Contract, Model>` as `ShorthandWhereFilter<Contract, Namespace, Model>` and `ShorthandWhereFilter<Contract, Model, Namespace>` as `ShorthandWhereFilter<Contract, Namespace, Model>`. Rewrite the relation types from `<Contract, Model>` to `<Contract, Namespace, Model>`. For predicates targeting a relation, use the namespace declared by that relation's `to.namespace` coordinate.

## `to-one-relations-record-nullable`

For every TypeScript file matched by `detection`, find each object literal that builds a to-one contract relation (`cardinality: 'N:1'` or `'1:1'` together with an `on` join) and add `nullable: <boolean>` to it: `true` when the relation field is optional (the local foreign-key columns are nullable), `false` when it is required. The side of a one-to-one relation that does not own the foreign key is always `nullable: true`. Contract builders and PSL authoring set the flag from the field's `?`, so only code that assembles `ContractRelation` values by hand needs the edit.

## `contract-space-re-emit-nullable`

For every `contract.json` matched by `detection`, run the extension package's `build:contract-space` script (or its emit command) once after upgrading. The expected diff is one `"nullable"` boolean per to-one relation in `contract.json`, plus the `Models` namespace, `models` constant, and `RelationKeys` import in `contract.d.ts`.
