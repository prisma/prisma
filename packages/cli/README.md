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

### `refract migrate` (Coming Soon)

Run database migrations using the TypeScript-native migration engine.

### `refract generate` (Coming Soon)

Generate type-safe Refract client code.

## Configuration

The CLI uses `refract.config.ts` for configuration:

```typescript
import { defineConfig } from '@refract/cli'

export default defineConfig({
  datasource: {
    provider: 'postgresql',
    url: 'postgresql://username:password@localhost:5432/database',
  },
  generator: {
    provider: '@refract/client',
    output: './node_modules/@refract/client',
  },
  schema: './schema.prisma',
})
```

## Architecture

### Command Framework

The CLI is built on a modern command architecture with:

- **BaseCommand**: Abstract base class with common functionality
- **Enhanced Error Handling**: Consistent error handling with helpful suggestions
- **Colored Output**: Beautiful terminal output using chalk
- **Configuration Loading**: Automatic config discovery and validation

### Configuration Bridge

The key innovation is the configuration-to-Kysely bridge that:

1. Loads `refract.config.ts` with simple provider configuration
2. Dynamically creates appropriate Kysely dialect instances
3. Passes them to migration engine and client generation methods
4. Supports tree-shaking through dynamic imports

### Database Support

Currently supports:

- **PostgreSQL**: Using `kysely` + `pg`
- **MySQL**: Using `kysely` + `mysql2`
- **SQLite**: Using `kysely` + `better-sqlite3`

Database drivers are loaded dynamically for optimal bundle size.

## Development

```bash
# Install dependencies
pnpm install

# Build the package
pnpm build

# Run tests
pnpm test

# Test CLI locally
pnpm refract --help
```

## Testing

The CLI includes comprehensive tests covering:

- Command execution and error handling
- Configuration file generation and validation
- Interactive prompts and user input
- File system operations and cleanup

## Implementation Status

✅ **Task 15.1 Complete**: CLI Command Framework Enhancement

- Modern command framework with Commander.js
- Enhanced error handling with colored output
- Base command architecture with consistent patterns
- Comprehensive test coverage

🚧 **Next Steps**:

- Task 15.2: Configuration-to-Kysely Bridge Implementation
- Task 15.3: Project Initialization Command Implementation
- Task 15.4: Migration Command with Kysely Integration
- Task 15.5: Client Generation Command Integration
- Task 15.6: ESM Configuration and Developer Experience Enhancement

## Related Packages

- `@refract/schema-parser` - TypeScript-native schema parsing
- `@refract/migrate` - Programmatic migration engine
- `@refract/client` - Type-safe database client
- `unplugin-refract` - Build tool integration
