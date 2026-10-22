---
changes:
  - id: target-migrations-marker-location
    summary: |
      `TargetMigrationsCapability` (from `@prisma/orm-framework/components/control`) has a new required field, `markerLocation`: the name of the table or collection that holds the contract markers, which messages show the user. A target's `migrations` object must set it.
    detection:
      glob: "**/*.{ts,tsx,mts,cts}"
      matches:
        - '(?<![\s\S])(?![\s\S]*markerLocation)[\s\S]*\bmigrations\s*:\s*\{[\s\S]*\bcreateRunner\b'
  - id: verify-contract-spaces-marker-location
    summary: |
      `verifyContractSpaces` (from the `spaces` subpath of the migration tools) takes a required `markerLocation`, the name of the target's marker table or collection, which the remediation of an orphan marker names.
    detection:
      glob: "**/*.{ts,tsx,mts,cts,js,mjs,cjs}"
      matches:
        - '(?<![\w$])verifyContractSpaces\s*\('
---

# A target names where it keeps its markers

Add `markerLocation` to the `migrations` object of your target descriptor, so messages about the contract markers name the right table:

```ts
// Before
migrations: {
  createPlanner(adapter) { … },
  createRunner(family) { … },
  contractToSchema(contract, frameworkComponents) { … },
},

// After
migrations: {
  markerLocation: 'my_schema.marker',
  createPlanner(adapter) { … },
  createRunner(family) { … },
  contractToSchema(contract, frameworkComponents) { … },
},
```

A test double that builds a `TargetMigrationsCapability` sets it too.

A call to `verifyContractSpaces` passes the marker location of the target it verifies, such as `markerLocation: 'prisma_contract.marker'` for Postgres or `'_prisma_marker'` for SQLite.
