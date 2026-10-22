---
changes:
  - id: target-apply-atomicity
    summary: |
      `TargetMigrationsCapability` (from `@prisma/orm-framework/components/control`) has two new required fields: `applyAtomicity`, `'all-spaces'` or `'per-space'`, which says whether a failed apply rolls back every contract space, and `markerLocation`, the name of the table or collection that holds the contract markers, which messages show the user. A target's `migrations` object must set both.
    detection:
      glob: "**/*.{ts,tsx,mts,cts}"
      matches:
        - '(?<![\s\S])(?![\s\S]*applyAtomicity)[\s\S]*\bmigrations\s*:\s*\{[\s\S]*\bcreateRunner\b'
  - id: verify-contract-spaces-marker-location
    summary: |
      `verifyContractSpaces` (from the `spaces` subpath of the migration tools) takes a required `markerLocation`, the name of the target's marker table or collection, which the remediation of an orphan marker names.
    detection:
      glob: "**/*.{ts,tsx,mts,cts,js,mjs,cjs}"
      matches:
        - '(?<![\w$])verifyContractSpaces\s*\('
  - id: plan-target-details-schema-optional
    summary: |
      `SqlPlanTargetDetails.schema` (from `@prisma/orm-family-sql/family/control`) is optional, and SQLite operations no longer carry `schema: 'main'`. Code that reads `target.details.schema` handles `undefined`.
    detection:
      glob: "**/*.{ts,tsx,mts,cts}"
      matches:
        - '\.details\??\.schema(?![\w$])'
---

# A target states what a failed migration apply leaves

A database whose DDL is transactional can roll a failed apply back across every contract space; one whose DDL commits as it runs, or bypasses transactions, cannot. Each target now says which it is, and the CLI words its failure reports from that. Add both fields to the `migrations` object of your target descriptor:

```ts
// Before
migrations: {
  createPlanner(adapter) { … },
  createRunner(family) { … },
  contractToSchema(contract, frameworkComponents) { … },
},

// After
migrations: {
  applyAtomicity: 'all-spaces',
  markerLocation: 'my_schema.marker',
  createPlanner(adapter) { … },
  createRunner(family) { … },
  contractToSchema(contract, frameworkComponents) { … },
},
```

State `'all-spaces'` when your runner applies every space inside one transaction and rolls them all back on a failure. State `'per-space'` when it applies and writes the marker of each space on its own, so a failure leaves the spaces before it applied; set `failingSpace` and `databaseUnchanged` on the failures it returns (`withFailingSpace` and `withDatabaseUnchanged` from the same module). A test double that builds a `TargetMigrationsCapability` sets both fields too.

A call to `verifyContractSpaces` passes the marker location of the target it verifies, such as `markerLocation: 'prisma_contract.marker'` for Postgres or `'_prisma_marker'` for SQLite.

Code that reads `target.details.schema` from a SQL migration operation treats it as `string | undefined`: SQLite and MySQL operations name no schema.
