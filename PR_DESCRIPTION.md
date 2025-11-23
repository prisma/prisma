fix(config): improve multi-file schema DX with better error messages

This PR enhances the developer experience around Prisma's multi-file schema feature by improving error handling, adding helpful warnings, and providing comprehensive documentation.

## Changes

### 1. Enhanced Config Validation (`packages/config`)

- Added specific error messages for unknown config fields
- Special guidance when `prismaSchemaFolder` is used (common mistake)
- Lists valid config options to help users fix issues quickly

**Example:**

```
Invalid configuration in prisma.config.ts:
The field 'prismaSchemaFolder' is not a valid configuration option.
Did you mean to use 'schema' pointing to a directory?

Valid configuration options are:
  - experimental
  - datasource
  - schema
  ...
```

### 2. Empty Schema Warning (`packages/internals`)

- Added warning when schema has no models, enums, or types
- Helps users debug misconfigured multi-file schema paths
- Prevents silent failures when schema directory is wrong

**Example:**

```
Warning: Your Prisma schema is empty (no models, enums, or types).
If you are using multi-file schemas, check that your `prisma.config.ts` points to the correct directory.
```

### 3. Fixed Error Message Formatting

- Fixed missing closing parenthesis in schema not found error
- Updated test snapshots to match corrected format

### 4. Documentation & Examples

- Created comprehensive `MULTI_FILE_SCHEMAS.md` guide (322 lines)
  - Setup instructions & migration guide
  - Organizational patterns (domain-driven, shared models, monorepo)
  - Best practices & troubleshooting
- Updated `multi-file-demo` fixture to be a correct example
- Added fixture-specific README

### 5. Test Coverage

- Added `prismaSchemaFolder.test.ts` to verify enhanced error messages
- All existing tests pass

## Testing

### Automated Tests

- ✅ `@prisma/config`: 68 tests passed
- ✅ `@prisma/internals`: `getSchema.test.ts` 9/9 tests passed
- ✅ `prismaSchemaFolder.test.ts`: 2/2 tests passed

### Manual Verification

Created a test project with multi-file schemas and verified:

- ✅ `prisma format` correctly processes all schema files
- ✅ `prisma validate` validates multi-file schemas
- ✅ `prisma migrate dev` creates migrations for all models
- ✅ Warning appears when schema path is misconfigured

## Related Issues

Addresses confusion around multi-file schema configuration, particularly:

- Common mistake of using non-existent `prismaSchemaFolder` property
- Silent failures when schema directory contains no models
- Unclear error messages when configuration is incorrect

## Breaking Changes

None. This PR only enhances existing error messages and adds new warnings.

## Notes for Reviewers

- The sandbox directory contains test files for manual verification but is gitignored
- Test snapshots were updated to match the corrected error message format
- Documentation follows existing Prisma markdown style
