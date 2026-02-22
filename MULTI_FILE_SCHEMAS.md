# Multi-File Schema Guide

This guide explains how to use Prisma's multi-file schema feature, available in Prisma 7+.

## Overview

Prisma allows you to organize your schema across multiple `.prisma` files instead of having everything in a single `schema.prisma` file. This is especially useful for large projects where you want to organize models by domain or feature.

## Setup

### 1. Create a `prisma.config.ts` file

```typescript
import { defineConfig } from '@prisma/config'

export default defineConfig({
  // Point to a directory instead of a single file
  schema: './prisma/schema',

  datasource: {
    url: process.env.DATABASE_URL ?? 'file:./dev.db',
  },
})
```

### 2. Organize your schema files

Create multiple `.prisma` files in the schema directory:

```
prisma/
  schema/
    _datasource.prisma    # Database connection config
    users.prisma          # User-related models
    posts.prisma          # Post-related models
    comments.prisma       # Comment-related models
```

### 3. Define your schemas

Each file contains a portion of your schema:

**`_datasource.prisma`**:

```prisma
generator client {
  provider = "prisma-client"
}

// Note: datasource url is now in prisma.config.ts in Prisma 7
```

**`users.prisma`**:

```prisma
model User {
  id        Int       @id @default(autoincrement())
  email     String    @unique
  name      String?
  posts     Post[]
  comments  Comment[]
  createdAt DateTime  @default(now())
}
```

**`posts.prisma`**:

```prisma
model Post {
  id        Int       @id @default(autoincrement())
  title     String
  content   String?
  published Boolean   @default(false)
  authorId  Int
  author    User      @relation(fields: [authorId], references: [id])
  comments  Comment[]
  createdAt DateTime  @default(now())
}
```

**`comments.prisma`**:

```prisma
model Comment {
  id        Int      @id @default(autoincrement())
  content   String
  postId    Int
  post      Post     @relation(fields: [postId], references: [id])
  authorId  Int
  author    User     @relation(fields: [authorId], references: [id])
  createdAt DateTime @default(now())
}
```

## File Naming Conventions

### Recommended Patterns

1. **Prefix with underscore for config files**: `_datasource.prisma`, `_generator.prisma`
2. **Domain-based naming**: `users.prisma`, `products.prisma`, `orders.prisma`
3. **Feature-based naming**: `auth.prisma`, `billing.prisma`, `analytics.prisma`
4. **Alphabetical ordering**: Files are loaded in alphabetical order, so use prefixes if order matters

### Examples

```
prisma/schema/
  _00_datasource.prisma    # Loaded first
  _01_generator.prisma
  users.prisma
  products.prisma
  orders.prisma
  reviews.prisma
```

## Common Patterns

### Pattern 1: Domain-Driven Organization

Organize by business domain:

```
prisma/schema/
  _config.prisma           # Generator and datasource
  authentication/
    users.prisma
    sessions.prisma
    roles.prisma
  content/
    posts.prisma
    comments.prisma
    media.prisma
  commerce/
    products.prisma
    orders.prisma
    payments.prisma
```

> [!NOTE]
> Prisma recursively searches the schema directory, so you can use subdirectories for organization.

### Pattern 2: Shared Models with Features

Separate shared/core models from feature-specific ones:

```
prisma/schema/
  _config.prisma
  _shared/
    users.prisma
    timestamps.prisma
  features/
    blog.prisma
    shop.prisma
    analytics.prisma
```

### Pattern 3: Monorepo Organization

For monorepos with multiple apps sharing models:

```
packages/database/prisma/schema/
  _config.prisma
  core/                    # Shared across all apps
    users.prisma
    organizations.prisma
  app-specific/
    blog-models.prisma
    admin-models.prisma
```

## Migration from Single File

If you're migrating from a single `schema.prisma` file:

1. Create `prisma.config.ts` pointing to a directory
2. Move your existing `schema.prisma` into that directory
3. Optionally split it into multiple files:

```bash
# Before
prisma/
  schema.prisma

# After
prisma/
  schema/
    _config.prisma      # Generator and datasource blocks
    models.prisma       # All your models (initially)

# Then gradually split
prisma/
  schema/
    _config.prisma
    users.prisma
    posts.prisma
    ...
```

## Best Practices

### ✅ Do

- Use clear, descriptive file names
- Group related models together
- Keep generator and datasource in a separate config file (e.g., `_config.prisma` or move to `prisma.config.ts`)
- Use subdirectories for large schemas
- Document your organization strategy in a README

### ❌ Don't

- Split models and their relations across files (keep related models together)
- Use overly nested directory structures
- Forget to include all necessary imports/relations
- Have duplicate model or enum definitions

## Troubleshooting

### "Cannot find module '@prisma/client'"

Make sure you're importing from `@prisma/config` in your `prisma.config.ts`:

```typescript
import { defineConfig } from '@prisma/config' // ✅ Correct
import { defineConfig } from '@prisma/client' // ❌ Wrong
```

### Relations Not Found

Ensure related models can reference each other. Prisma loads all `.prisma` files and merges them, so relations work across files:

```prisma
// users.prisma
model User {
  id    Int    @id
  posts Post[] // ✅ Works even though Post is in posts.prisma
}

// posts.prisma
model Post {
  id       Int  @id
  authorId Int
  author   User @relation(fields: [authorId], references: [id])
}
```

### Schema Not Loading

Verify your `prisma.config.ts` points to the correct directory:

```typescript
export default defineConfig({
  schema: './prisma/schema', // Directory path
  // NOT: './prisma/schema.prisma'  // ❌ Single file path
})
```

## CLI Commands

All Prisma CLI commands work the same way with multi-file schemas:

```bash
# Generate Prisma Client
npx prisma generate

# Run migrations
npx prisma migrate dev

# Push schema changes
npx prisma db push

# Open Prisma Studio
npx prisma studio

# Validate schema
npx prisma validate
```

The CLI automatically reads your `prisma.config.ts` to find the schema location.

## Example Project Structure

Here's a complete example of a well-organized multi-file schema:

```
my-app/
  prisma/
    schema/
      _datasource.prisma
      enums/
        user-role.prisma
        post-status.prisma
      models/
        core/
          user.prisma
          organization.prisma
        features/
          blog/
            post.prisma
            comment.prisma
            tag.prisma
          ecommerce/
            product.prisma
            order.prisma
            payment.prisma
    migrations/
      ...
  prisma.config.ts
  package.json
```

## Resources

- [Prisma 7 Configuration Guide](https://www.prisma.io/docs)
- [Schema File Location](https://pris.ly/d/prisma-schema-location)
- [Prisma Config API Reference](https://www.prisma.io/docs/reference/config-reference)

## See Also

- Test fixtures: [`packages/internals/src/__tests__/__fixtures__/getSchema/multi-file-demo/`](file:///Users/devkumarsingh/Desktop/prisma%20issue/prisma/packages/internals/src/__tests__/__fixtures__/getSchema/multi-file-demo/)
- Config package: [`packages/config/`](file:///Users/devkumarsingh/Desktop/prisma%20issue/prisma/packages/config/)
