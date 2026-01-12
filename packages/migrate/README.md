# @ork/migrate

TypeScript-native migration engine for Ork ORM with direct Kysely integration.

## Overview

`@ork/migrate` provides programmatic migration capabilities that work directly with Kysely dialect instances, eliminating custom driver abstractions and providing transparent, type-safe database operations.

## Key Features

- **Direct Kysely Integration**: Works with Kysely dialect instances for PostgreSQL, MySQL, SQLite, and D1
- **TypeScript-Native**: No Rust binaries or external dependencies
- **Programmatic API**: `await ork.migrate.diff()` and `await ork.migrate.apply()`
- **Transparent Operations**: Uses Kysely's native introspection and DDL builders
- **Type Safety**: Full TypeScript support with proper type inference
- **Comprehensive Schema Diffing**: 
  - **Foreign Key Constraints**: Full support for FK creation, modification, and deletion with cascade rules
  - **Index Management**: Unique indexes, multi-column indexes, and custom named indexes
  - **Default Values**: Column default value creation, modification, and removal
  - **Enum Types**: Database enum type creation, value addition, and type management
- **Risk Assessment**: Automatic detection of destructive changes with detailed warnings
- **Golden Snapshot Testing**: Deterministic SQL generation with comprehensive test coverage

## Installation

```bash
npm install @ork/migrate kysely
# or
pnpm add @ork/migrate kysely
```

## Usage

### Basic Setup

```typescript
import { createMigrate } from '@ork/migrate'
import { Kysely, PostgresDialect } from 'kysely'
import { Pool } from 'pg'

// Create your Kysely instance
const db = new Kysely({
  dialect: new PostgresDialect({
    pool: new Pool({ connectionString: process.env.DATABASE_URL! }),
  }),
})

// Create migration engine
const migrate = createMigrate(db, {
  useTransaction: true,
  validateSchema: true,
})
```

### Generate Migration Diff

```typescript
// Generate diff without applying changes
const diff = await migrate.diff('./prisma/schema.prisma')

console.log('Migration Summary:')
console.log('- Tables to create:', diff.summary.tablesCreated)
console.log('- Tables to modify:', diff.summary.tablesModified)
console.log('- Columns to add:', diff.summary.columnsAdded)
console.log('- Risk level:', diff.impact.riskLevel)

if (diff.hasDestructiveChanges) {
  console.warn('⚠️  This migration contains potentially destructive changes')
}
```

### Apply Migrations

```typescript
// Apply migrations to database
const result = await migrate.apply('./prisma/schema.prisma')

if (result.success) {
  console.log(`✅ Migration completed successfully`)
  console.log(`   Statements executed: ${result.statementsExecuted}`)
  console.log(`   Execution time: ${result.executionTime}ms`)
} else {
  console.error('❌ Migration failed:')
  result.errors.forEach((error) => {
    console.error(`   ${error.message}`)
    if (error.statement) {
      console.error(`   SQL: ${error.statement}`)
    }
  })
}
```

### Migration History

```typescript
// Get migration history
const history = await migrate.getHistory()

history.forEach((entry) => {
  console.log(`${entry.id}: ${entry.name}`)
  console.log(`  Applied: ${entry.appliedAt}`)
  console.log(`  Duration: ${entry.executionTime}ms`)
  console.log(`  Success: ${entry.success}`)
})
```

### Schema Validation

```typescript
// Validate current database against schema
const isValid = await migrate.validate('./prisma/schema.prisma')

if (isValid) {
  console.log('✅ Database schema is up to date')
} else {
  console.log('⚠️  Database schema is out of sync')
}
```

## Supported Kysely Dialects

Works with any Kysely dialect:

- **PostgreSQL**: `kysely` with `PostgresDialect`
- **MySQL**: `kysely` with `MysqlDialect`
- **SQLite**: `kysely` with `SqliteDialect`
- **Cloudflare D1**: `kysely-d1`
- **Note**: Ork targets these providers today; other Kysely dialects may work but are not officially supported yet.

## Configuration Options

```typescript
interface MigrationOptions {
  /** Whether to run migrations in a transaction (default: true) */
  useTransaction?: boolean
  /** Timeout for migration operations in milliseconds (default: 30000) */
  timeout?: number
  /** Whether to validate schema before applying migrations (default: true) */
  validateSchema?: boolean
  /** Custom migration table name (default: '_ork_migrations') */
  migrationTableName?: string
}
```

## Architecture

### Direct Kysely Integration

Unlike traditional ORMs that use custom driver abstractions, `@ork/migrate` works directly with your Kysely instance:

1. **Introspection**: Uses `kysely.introspection.getTables()` to get current database state
2. **DDL Generation**: Uses `kysely.schema.createTable()`, `kysely.schema.alterTable()` for SQL generation
3. **Execution**: Executes through the same Kysely instance with proper transaction handling

### No Translation Layers

- No DMMF compatibility layers
- No custom driver abstractions
- No format conversion between systems
- Direct use of Kysely's native types and APIs

### Type Safety

Full TypeScript support with:

- Proper type inference for all operations
- Type-safe configuration options
- Strongly typed return values
- Integration with Kysely's type system

## Development

```bash
# Install dependencies
pnpm install

# Build package
pnpm build

# Run tests
pnpm test

# Development mode
pnpm dev
```

## License

Apache-2.0
