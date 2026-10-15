---
changes:
  - id: mongo-validator-derivation-moves-to-mongo-contract
    summary: |
      `deriveJsonSchema`, `derivePolymorphicJsonSchema` and the `FieldValueSets` type move from `@internal/mongo-contract-psl` (`@prisma/orm-family-mongo/contract-psl`) to `@internal/mongo-contract` (`@prisma/orm-family-mongo/contract`). Their signatures do not change. Extensions that author Mongo contracts through `defineContract(...)` or PSL need no change.
    detection:
      glob: "**/*.{ts,mts,cts}"
      matches:
        - 'import[^;]*\b(?:deriveJsonSchema|derivePolymorphicJsonSchema|FieldValueSets)\b[^;]*from\s*[''"](?:@internal/mongo-contract-psl|@prisma/orm-family-mongo/contract-psl)[''"]'
---

## `mongo-validator-derivation-moves-to-mongo-contract`

```ts
// before
import { deriveJsonSchema, type FieldValueSets } from '@internal/mongo-contract-psl';

// after
import { deriveJsonSchema, type FieldValueSets } from '@internal/mongo-contract';
```

`derivePolymorphicJsonSchema` moves the same way. Through the public package, import from `@prisma/orm-family-mongo/contract` instead of `@prisma/orm-family-mongo/contract-psl`. The calls stay as they are.
