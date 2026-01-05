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

```bash
npx refract init
```

Options:

- `--provider <provider>` - Database provider (postgresql, mysql, sqlite)
- `--url <url>` - Database connection URL
- `--force` - Overwrite existing configuration

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

## Configuration

The CLI uses `refract.config.ts` for configuration:

```typescript
import type { RefractConfig } from '@refract/config'

export default {
  datasource: {
    provider: 'postgresql',
    url: 'postgresql://username:password@localhost:5432/database',
  },
  generator: {
    provider: '@refract/client',
    output: './.refract',
  },
  schema: './schema.prisma',
} satisfies RefractConfig
```

## Status

The CLI is alpha-stage and focused on the core workflow: `init`, `generate`, and `migrate`.

## Related Packages

- `@refract/schema-parser` - TypeScript-native schema parsing
- `@refract/migrate` - Programmatic migration engine
- `@refract/client` - Type-safe database client
- `unplugin-refract` - Build tool integration
