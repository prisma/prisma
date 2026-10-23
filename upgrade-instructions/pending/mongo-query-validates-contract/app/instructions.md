---
changes:
  - id: mongo-query-validates-contract
    summary: |
      `mongoQuery({ contract })` from `@prisma/orm-mongo/query-builder` now validates the contract as `mongo({ contract })` does, and throws `CONTRACT.VALIDATION_FAILED` for a malformed one. A value from `contractFromJson(...)` or `defineContract(...)` is not validated again. If you pass raw `contract.json`, or an object you built by hand, pass `contractFromJson<Contract>(json)` instead. The detection matches files that call `mongoQuery(`.
    detection:
      glob: "**/*.{ts,mts,cts,tsx,js,mjs,cjs}"
      matches:
        - '(?<![\w$.])mongoQuery\s*\('
---

# mongoQuery validates its contract

```ts
// Before: raw JSON was accepted unchecked
const query = mongoQuery({ contract: contractJson as Contract });

// After
const query = mongoQuery({ contract: contractFromJson<Contract>(contractJson) });
```
