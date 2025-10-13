# @refract/client Examples

This directory contains demonstrations of the Refract client functionality.

## Demo: Task 14 Subtasks 1-3

**File**: `demo.ts`

**Usage**:

```bash
pnpx tsx demo.ts
```

**What it demonstrates**:

### ✅ Subtask 1: Package Structure

- ESM-only TypeScript package with proper exports
- Integration with `@refract/schema-parser` and `@refract/driver-postgresql`
- esbuild-based build system
- Comprehensive test suite

### ✅ Subtask 2: Schema AST Consumer & Type Generator

- Parses complete Prisma schemas with all standard blocks:
  - `generator` and `datasource` blocks
  - Models with `@default`, `@unique`, `@id` attributes
  - Relations (one-to-one, one-to-many, many-to-many)
  - Enums and optional fields
  - Composite keys with `@@id`, unique constraints with `@@unique`
- **Multiple Input Types**: Supports both string content and file paths
- Generates Kysely-compatible database schema types
- Creates TypeScript model interfaces
- Produces CRUD operation type definitions

### ✅ Subtask 3: Client Factory with Driver Integration

- `RefractClientFactory` class implementation
- Schema parsing integration
- PostgreSQL driver integration ready
- Kysely instance management
- Connection lifecycle management (`$connect`, `$disconnect`)
- Transaction support (`$transaction`)
- Factory pattern with proper cleanup

### Enhanced parseSchema Function

The demo showcases the enhanced `parseSchema` function that supports:

- **String Content**: Direct schema content parsing
- **File Paths**: Single file path (e.g., `'./schema.prisma'`)
- **Multiple Files**: Array of file paths for multi-file schemas
- **Auto-detection**: Automatically detects whether input is content or file path

### Schema Features Demonstrated

The demo uses a simple, easy-to-understand blog schema:

- **User Model**: Basic user with email, name, role, and timestamps
- **Post Model**: Blog posts with title, content, publication status
- **One-to-Many Relation**: Users can have multiple posts
- **Enum Type**: Role enum with ADMIN, AUTHOR, READER values
- **Real-world Attributes**: `@id`, `@unique`, `@default()`, timestamps

### Generated Output

The demo shows:

1. **Database Schema Types**: Kysely-compatible interface for the entire database
2. **Model Interfaces**: TypeScript interfaces for each model
3. **CRUD Operations**: Type-safe operation definitions for each model
4. **Generated Metadata**: Detailed information about fields, keys, and relationships

### What's Next

**Remaining Work (Task 14)**:

- **Subtask 4**: CRUD Operations Generator - Generate actual `findMany`, `create`, `update`, `delete` methods
- **Subtask 5**: Client API Assembly and Export Generation - Assemble final client with all model operations

The foundation is solid and ready for CRUD operations implementation!
