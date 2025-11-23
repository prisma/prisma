# Multi-File Schema Demo

This fixture demonstrates how to organize Prisma schemas across multiple files in Prisma 7+.

## Structure

```
multi-file-demo/
  prisma.config.ts          # Config pointing to schema directory
  prisma/
    schema.prisma            # Generator and datasource config
    models/                  # Directory containing model files
      user.prisma           # User model
      payment.prisma        # Payment model
```

## Key Concepts

### 1. Configuration File

[`prisma.config.ts`](file:///Users/devkumarsingh/Desktop/prisma%20issue/prisma/packages/internals/src/__tests__/__fixtures__/getSchema/multi-file-demo/prisma.config.ts) points to the schema directory:

```typescript
import { defineConfig } from '@prisma/config'

export default defineConfig({
  datasource: {
    url: process.env.DATABASE_URL ?? 'file:./dev.db',
  },
})
```

### 2. Base Configuration

[`schema.prisma`](file:///Users/devkumarsingh/Desktop/prisma%20issue/prisma/packages/internals/src/__tests__/__fixtures__/getSchema/multi-file-demo/prisma/schema.prisma) contains generator and datasource blocks:

```prisma
datasource db {
  provider = "postgresql"
}

generator client {
  provider = "prisma-client-js"
}
```

### 3. Separate Model Files

Models are split across files in the `models/` subdirectory:

- [`user.prisma`](file:///Users/devkumarsingh/Desktop/prisma%20issue/prisma/packages/internals/src/__tests__/__fixtures__/getSchema/multi-file-demo/prisma/models/user.prisma) - User model with relation to Payment
- [`payment.prisma`](file:///Users/devkumarsingh/Desktop/prisma%20issue/prisma/packages/internals/src/__tests__/__fixtures__/getSchema/multi-file-demo/prisma/models/payment.prisma) - Payment model with relation to User

Even though these models are in separate files, they can reference each other through relations.

## Benefits

- **Better Organization**: Group related models by domain or feature
- **Easier Collaboration**: Reduce merge conflicts when multiple developers work on schemas
- **Clearer Structure**: Large schemas become easier to navigate
- **Flexible Grouping**: Use subdirectories for additional organization

## Usage

This is a test fixture. To use multi-file schemas in your own project:

1. Create a `prisma.config.ts` in your project root
2. Point `schema` to a directory: `schema: './prisma/schema'`
3. Create multiple `.prisma` files in that directory
4. Run Prisma commands normally (`prisma generate`, `prisma migrate`, etc.)

For a complete guide, see [`MULTI_FILE_SCHEMAS.md`](file:///Users/devkumarsingh/Desktop/prisma%20issue/prisma/MULTI_FILE_SCHEMAS.md) in the repository root.
