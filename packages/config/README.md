# @ork/config

Shared configuration and Kysely instance management for Ork packages.

## Purpose

This package centralizes configuration loading and Kysely instance creation across all Ork packages (`cli`, `migrate`, `client`), eliminating duplication and ensuring consistent database setup.

## Key Features

- **Priority-based config resolution**: Explicit config > ork.config.ts > .config/ork.ts
- **Centralized provider support**: Easy to add new database providers
- **Kysely dialect creation**: Handles all provider-specific setup
- **Type-safe configuration**: Zod schema validation

## Usage

### Basic Kysely Creation

```typescript
import { createKyselyFromConfig } from '@ork/config'

// Uses config file discovery
const { kysely, config } = await createKyselyFromConfig()

// With explicit config
const { kysely } = await createKyselyFromConfig({
  config: {
    datasource: { provider: 'postgresql', url: process.env.DATABASE_URL! },
    schema: './schema.prisma'
  }
})

// From URL (auto-detects provider)
import { createKyselyFromUrl } from '@ork/config'
const { kysely } = await createKyselyFromUrl(process.env.DATABASE_URL!)
```

### Configuration Loading Only

```typescript
import { loadOrkConfig } from '@ork/config'

const { config, configPath } = await loadOrkConfig({
  cwd: '/path/to/project'
})
```

### Dialect Creation Only

```typescript
import { createKyselyDialect } from '@ork/config'

const dialect = await createKyselyDialect(config)
const kysely = new Kysely({ dialect })
```

## Configuration Priority

1. **Explicit config parameter** (highest priority)
2. **Explicit configFile parameter**
3. **ork.config.ts/js/mjs** 
4. **.config/ork.ts/js/mjs** (lowest priority)

## Supported Providers

- `postgresql` - Standard PostgreSQL
- `mysql` - MySQL
- `sqlite` - SQLite
- `d1` - Cloudflare D1

## Adding New Providers

1. Add to `SUPPORTED_PROVIDERS` in `src/constants.ts`
2. Add URL pattern to `PROVIDER_URL_PATTERNS`
3. Add metadata to `PROVIDER_METADATA`
4. Add case in `src/dialect-factory.ts`
5. Add peer dependency to `package.json`

## Package Dependencies

This package uses peer dependencies for database drivers, so only install what you need:

```bash
# PostgreSQL
npm install pg @types/pg

# MySQL  
npm install mysql2

# SQLite
npm install better-sqlite3 @types/better-sqlite3

# Cloudflare D1
npm install kysely-d1
```
