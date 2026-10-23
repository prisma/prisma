---
changes:
  - id: family-query-builder-drops-mongo-query
    summary: |
      `@prisma/orm-family-mongo/query-builder` (`@internal/mongo-query-builder`) no longer exports `mongoQuery`. Use `mongoQuery` from `@prisma/orm-mongo/query-builder`, which validates the contract once, as `mongo({ contract })` does. Extension code that builds plans on a contract it has already validated, such as one from `contractFromJson`, may instead use `mongoQueryOnValidatedContract` from the internal path `@prisma/orm-family-mongo/query-builder/internal/on-validated-contract`; it does not validate. The detection matches files that import `mongoQuery` from the family package, under its own name or another.
    detection:
      glob: "**/*.{ts,mts,cts,tsx,js,mjs,cjs}"
      matches:
        - '\bimport\s*(?:type\s*)?\{[^}]*(?<![\w$])mongoQuery(?![\w$])[^}]*\}\s*from\s*[\x27\x22](?:@prisma/orm-family-mongo/query-builder|@internal/mongo-query-builder)[\x27\x22]'
---

# The family query builder no longer exports mongoQuery

```ts
// Before
import { mongoQuery } from '@prisma/orm-family-mongo/query-builder';

// After
import { mongoQuery } from '@prisma/orm-mongo/query-builder';
```
