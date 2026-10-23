---
changes:
  - id: mongo-query-validates-contract
    summary: |
      `mongoQuery({ contract })` from `@prisma/orm-mongo/query-builder` now validates the contract as `mongo({ contract })` does, and throws `CONTRACT.VALIDATION_FAILED` for a malformed one. A value from `contractFromJson(...)` or `defineContract(...)` is not validated again. If you pass raw `contract.json`, or an object you built by hand, pass `contractFromJson<Contract>(json)` instead. The family package `@prisma/orm-family-mongo/query-builder` no longer exports `mongoQuery`; import it from `@prisma/orm-mongo/query-builder`. The detection matches files that call `mongoQuery(`, import it under another name, or import it from the family package.
    detection:
      glob: "**/*.{ts,mts,cts,tsx,js,mjs,cjs}"
      matches:
        - '(?<![\w$.])mongoQuery\s*\('
        - '(?<![\w$.])mongoQuery\s+as\s+[\w$]+'
        - '\bimport\s*(?:type\s*)?\{[^}]*(?<![\w$])mongoQuery(?![\w$])[^}]*\}\s*from\s*[\x27\x22](?:@prisma/orm-family-mongo/query-builder|@internal/mongo-query-builder)[\x27\x22]'
---

# mongoQuery validates its contract

```ts
// Before: raw JSON was accepted unchecked
const query = mongoQuery({ contract: contractJson as Contract });

// After
const query = mongoQuery({ contract: contractFromJson<Contract>(contractJson) });
```
