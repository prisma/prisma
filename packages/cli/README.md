# ork

CLI for Ork ORM.

## Features

- **Modern Command Framework**: Built with Commander.js and enhanced error handling
- **Colored Output**: Beautiful terminal output with chalk for better developer experience
- **Configuration Bridge**: Seamlessly bridges user-friendly config to Kysely dialect instances
- **ESM-Only**: Full ESM support with dynamic imports for optimal tree-shaking
- **Type-Safe**: Full TypeScript support with comprehensive type definitions

## Installation

```bash
npm install ork
# or
pnpm add ork
```

## Commands

### `ork init`

Initialize a new Ork project with interactive prompts.
If Vite is detected, it can auto-patch your `vite.config` to enable `unplugin-ork`.
It can also offer to install recommended dependencies based on your provider.
Supported providers: `postgresql`, `mysql`, `sqlite`, `d1`.

```bash
npx ork init
```

Options:

- `--url <url>` - Database connection URL (auto-detects provider)
- `--provider <provider>` - Database provider when no URL is provided
- `--force` - Overwrite existing configuration
- `--skip-schema` - Skip creating `schema.prisma`
- `--skip-install` - Skip dependency installation prompts
- `--skip-vite` - Skip Vite detection and auto-patching

### `ork migrate`

Run database migrations using the TypeScript-native migration engine.

```bash
ork migrate dev
ork migrate status
ork migrate history
ork migrate rollback
```

### `ork generate`

Generate type-safe Ork client code.

```bash
ork generate
ork generate --watch
```

### `ork dev`

Unified dev loop that watches your schema and runs generation + migrations.

```bash
ork dev
ork dev --yes
ork dev --unsafe
ork dev --no-migrate
ork dev --no-generate
```

## Configuration

The CLI uses `ork.config.ts` for configuration:

```typescript
import type { OrkConfig } from '@ork-orm/config'

export default {
  datasource: {
    provider: 'postgresql',
    url: '',
  },
  generator: {
    provider: 'ork',
    output: './.ork',
  },
  schema: './schema.prisma',
} satisfies OrkConfig
```

Set `datasource.url` to your connection string (or wire a custom dialect in code).
The CLI does not create `.env` files; set `DATABASE_URL` however you prefer.

## Status

The CLI is alpha-stage and focused on the core workflow: `init`, `generate`, and `migrate`.

## Related Packages

- `@ork-orm/schema-parser` - TypeScript-native schema parsing
- `@ork-orm/migrate` - Programmatic migration engine
- `@ork-orm/client` - Type-safe database client
- `unplugin-ork` - Build tool integration

## Special Thanks

Thank you to William ([@willguitaradmfar](https://github.com/willguitaradmfar)) for generously donating the `ork` npm package name.
