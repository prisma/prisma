# @refract/cli

CLI for Refract ORM.

## Features

- **Modern Command Framework**: Built with Commander.js and enhanced error handling
- **Colored Output**: Beautiful terminal output with chalk for better developer experience
- **Configuration Bridge**: Seamlessly bridges user-friendly config to Kysely dialect instances
- **ESM-Only**: Full ESM support with dynamic imports for optimal tree-shaking
- **Type-Safe**: Full TypeScript support with comprehensive type definitions

## Installation

```bash
npm install @refract/cli
# or
pnpm add @refract/cli
```

## Commands

### `refract init`

Initialize a new Refract project with interactive prompts.
If Vite is detected, it can auto-patch your `vite.config` to enable `unplugin-refract`.
It can also offer to install recommended dependencies based on your provider.
Supported providers: `postgresql`, `mysql`, `sqlite`, `d1`.

```bash
npx refract init
```

Options:

- `--url <url>` - Database connection URL (auto-detects provider)
- `--provider <provider>` - Database provider when no URL is provided
- `--force` - Overwrite existing configuration
- `--skip-schema` - Skip creating `schema.prisma`
- `--skip-install` - Skip dependency installation prompts
- `--skip-vite` - Skip Vite detection and auto-patching

### `refract migrate`

Run database migrations using the TypeScript-native migration engine.

```bash
refract migrate dev
refract migrate status
refract migrate history
refract migrate rollback
```

### `refract generate`

Generate type-safe Refract client code.

```bash
refract generate
refract generate --watch
```

### `refract dev`

Unified dev loop that watches your schema and runs generation + migrations.

```bash
refract dev
refract dev --yes
refract dev --unsafe
refract dev --no-migrate
refract dev --no-generate
```

## Configuration

The CLI uses `refract.config.ts` for configuration:

```typescript
import type { RefractConfig } from '@refract/config'

export default {
  datasource: {
    provider: 'postgresql',
    url: '',
  },
  generator: {
    provider: '@refract/client',
    output: './.refract',
  },
  schema: './schema.prisma',
} satisfies RefractConfig
```

Set `datasource.url` to your connection string (or wire a custom dialect in code).
The CLI does not create `.env` files; set `DATABASE_URL` however you prefer.

## Status

The CLI is alpha-stage and focused on the core workflow: `init`, `generate`, and `migrate`.

## Related Packages

- `@refract/schema-parser` - TypeScript-native schema parsing
- `@refract/migrate` - Programmatic migration engine
- `@refract/client` - Type-safe database client
- `unplugin-refract` - Build tool integration
