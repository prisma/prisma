---
from: "8.0.0-rc.9"
to: "8.0.0-rc.10"
changes:
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

## `to-one-relations-record-nullable`

For every TypeScript file matched by `detection`, find each object literal that builds a to-one contract relation (`cardinality: 'N:1'` or `'1:1'` together with an `on` join) and add `nullable: <boolean>` to it: `true` when the relation field is optional (the local foreign-key columns are nullable), `false` when it is required. The side of a one-to-one relation that does not own the foreign key is always `nullable: true`. Contract builders and PSL authoring set the flag from the field's `?`, so only code that assembles `ContractRelation` values by hand needs the edit.

## `contract-space-re-emit-nullable`

For every `contract.json` matched by `detection`, run the extension package's `build:contract-space` script (or its emit command) once after upgrading. The expected diff is one `"nullable"` boolean per to-one relation in `contract.json`, plus the `Models` namespace, `models` constant, and `RelationKeys` import in `contract.d.ts`.
