---
changes:
  - id: control-adapter-marker-location
    summary: |
      `SqlControlAdapter` (from `@prisma/orm-family-sql/family/control-adapter`) and `MongoControlAdapter` (from `@prisma/orm-family-mongo/family/control-adapter`) have a new required field, `markerLocation`: the name of the table or collection that holds the contract markers, which messages show the user. `ControlFamilyInstance` (from `@prisma/orm-framework/components/control`) has it too; the SQL and Mongo families read it from the control adapter.
    detection:
      glob: "**/*.{ts,tsx,mts,cts}"
      matches:
        - '(?<![\s\S])(?![\s\S]*markerLocation)[\s\S]*\bimplements\s+(?:SqlControlAdapter|MongoControlAdapter)\b'
  - id: verify-contract-spaces-marker-location
    summary: |
      `verifyContractSpaces` (from the `spaces` subpath of the migration tools) takes a required `markerLocation`, the name of the target's marker table or collection, which the remediation of an orphan marker names.
    detection:
      glob: "**/*.{ts,tsx,mts,cts,js,mjs,cjs}"
      matches:
        - '(?<![\w$])verifyContractSpaces\s*\('
---

# A control adapter names where it keeps its markers

Add `markerLocation` to your control adapter, so messages about the contract markers name the right table:

```ts
// Before
export class MyControlAdapter implements SqlControlAdapter<'my-target'> {
  readonly familyId = 'sql' as const;
  readonly targetId = 'my-target' as const;
  …
}

// After
export class MyControlAdapter implements SqlControlAdapter<'my-target'> {
  readonly familyId = 'sql' as const;
  readonly targetId = 'my-target' as const;
  readonly markerLocation = 'my_schema.marker';
  …
}
```

A test double that builds a control adapter or a `ControlFamilyInstance` sets it too.

A call to `verifyContractSpaces` passes the marker location of the target it verifies, such as `markerLocation: 'prisma_contract.marker'` for Postgres or `'_prisma_marker'` for SQLite.
