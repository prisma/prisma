# Test Import Patterns

## Core Principle

**Tests should import from source files directly, not from package exports.**

When writing tests within a package, import from the source files (`../src/...`) rather than from package exports (`@internal/package-name/...`). This ensures tests run against the actual implementation code, not the built dist files.

## Import Patterns

### Within-Package Tests

**✅ CORRECT: Import from source files**

```typescript
// packages/sql-query/test/contract.test.ts
import { validateContract } from '../src/contract';
import { defineContract } from '../src/exports/contract-builder';
```

**❌ WRONG: Import from package exports**

```typescript
// packages/sql-query/test/contract.test.ts
import { validateContract } from '@internal/sql-query/contract';
import { defineContract } from '@internal/sql-query/contract-builder';
```

**Why?**
- Tests run against source code, not dist files
- Avoids Vitest resolution issues with workspace dependencies
- Ensures tests catch issues in source code before building
- No need for special Vitest resolve aliases

### Cross-Package Tests

**✅ CORRECT: Import from package exports**

```typescript
// packages/integration-tests/test/contract.test.ts
import { defineContract } from '@internal/sql-contract-ts/contract-builder';
import { validateContract } from '@internal/sql-contract/validate';
```

**Why?**
- Integration tests verify the public API works correctly
- Tests the actual package exports that consumers will use
- Ensures the built package works as expected

### Test Fixtures

**✅ CORRECT: Use package exports in fixtures**

```typescript
// packages/framework/tooling/cli/test/fixtures/valid-contract.ts
import { defineContract } from '@internal/sql-contract-ts/contract-builder';
```

**Why?**
- Fixtures represent real consumer code
- Should use the same imports that consumers would use
- Verifies the public API is correct

## The `exports/` Folder

The `exports/` folder contains the public API surface (what gets built and published). Tests should import from source files directly, not from the `exports/` folder.

**Structure:**
- `src/contract-builder.ts` - The actual implementation
- `src/exports/contract-builder.ts` - Thin re-export for public API

**Test imports:**
```typescript
// ✅ CORRECT: Import from source
import { defineContract } from '../src/contract-builder';

// ❌ WRONG: Import from exports folder
import { defineContract } from '../src/exports/contract-builder';
```

## Package Extraction Patterns

When extracting code from one package to another:

1. **Move tests with the code** - Tests should move to the new package
2. **Update test imports** - Tests should import from source (`../src/index`) not from package exports
3. **Remove duplicate tests** - Don't keep duplicate test files in both packages
4. **Update consumer imports** - Update all consumer imports to use the new package
5. **Add tests for re-exports** - Re-export files need tests to verify they work correctly
6. **Delete old implementation files** - Remove old source files after migration
7. **Keep transitional re-exports** - Re-exports stay until future slice (per brief) with TODO comments

**Example:**
- Old: `packages/sql-target/src/operations-registry.ts`
- New: `packages/framework/core-operations/src/index.ts` (core types) + `packages/sql/operations/src/index.ts` (SQL-specific)
- Action:
  1. Move implementation to new packages
  2. Move tests to new packages with updated imports (`../src/index`)
  3. Add tests for re-exports in old package
  4. Update all consumer imports
  5. Keep transitional re-exports with TODO comments

## Common Mistakes

### Importing from Package Exports in Same-Package Tests

**❌ WRONG:**
```typescript
// packages/sql-query/test/contract.test.ts
import { validateContract } from '@internal/sql-query/contract';
```

**Problem:** This resolves to the dist file, which may have workspace dependencies that Vitest can't resolve. Also, tests should run against source code.

**✅ CORRECT:**
```typescript
// packages/sql-query/test/contract.test.ts
import { validateContract } from '../src/contract';
```

### Using Package Aliases for the Containing Package

**❌ WRONG: Import from own package using package name**
```typescript
// packages/sql-lane/test/sql.test.ts
import { sql } from '@internal/sql-lane/sql';
```

**Problem:**
- Causes TypeScript `rootDir` inference issues during typechecking
- Tests should use relative imports for their own package
- Package aliases are for cross-package imports, not same-package imports

**✅ CORRECT: Use relative imports for own package**
```typescript
// packages/sql-lane/test/sql.test.ts
import { sql } from '../src/sql';
```

**Rule:** Test files should **never** import from their own package using package aliases (e.g., `@internal/package-name/...`). Always use relative imports (e.g., `../src/...`) when importing from the same package.

### Keeping Duplicate Test Files

**❌ WRONG:** Keeping the same test file in both old and new packages

**✅ CORRECT:** Move tests to the new package and delete duplicates from the old package

### Not Deleting Old Implementation Files

**❌ WRONG:** Leaving old implementation files after migration

**✅ CORRECT:** Delete old source files after verifying all imports are updated

### Importing from Other Packages

**✅ CORRECT: Always use workspace package names**

```typescript
// packages/framework/tooling/emitter/test/emitter.test.ts
import type { Contract } from '@internal/contract/types';
```

**Rule:** Tests should always use workspace package names (`@internal/package-name/...`) when importing from other packages, regardless of whether they're in the same domain or not. This ensures:
- Clear dependency boundaries
- Proper package build state validation
- Consistent import patterns across the codebase
- Architecture rules are properly enforced

**Why not relative paths?**
- Relative paths bypass package boundaries and architecture rules
- They can create hidden dependencies that violate domain separation
- They make it harder to track actual package dependencies
- They can cause issues when packages are moved or restructured

## Don't Export for Tests

**CRITICAL**: Never export functions, types, or utilities solely for test use. If tests in other modules need access to private implementation details, that's a code smell indicating the tests should be refactored.

**❌ WRONG: Exporting for test use**

```typescript
// packages/sql/family/src/core/instance.ts
/**
 * Exported for test use only.
 */
export function convertOperationManifest(manifest: OperationManifest): SqlOperationSignature {
  // ...
}

// packages/sql/family/package.json
{
  "exports": {
    "./instance": {
      "types": "./dist/exports/instance.d.ts",
      "import": "./dist/exports/instance.js"
    }
  }
}

// packages/framework/tooling/cli/test/emit.test.ts
import { convertOperationManifest } from '@internal/family-sql/instance';
```

**✅ CORRECT: Use relative imports within the same package**

```typescript
// packages/sql/family/src/core/instance.ts
/**
 * Converts an OperationManifest to a SqlOperationSignature.
 * Used internally by instance creation and test utilities in the same package.
 */
export function convertOperationManifest(manifest: OperationManifest): SqlOperationSignature {
  // ...
}

// packages/sql/family/src/core/assembly.ts (same package)
import { convertOperationManifest } from './instance';

export function assembleOperationRegistryFromPacks(packs: ReadonlyArray<...>): OperationRegistry {
  // Uses convertOperationManifest internally
  const signature = convertOperationManifest(operationManifest);
  // ...
}

// test/integration/utils/framework-components.ts (integration test utility)
import { createOperationRegistry } from '@internal/operations';
// Assembles registry using framework primitives, not SQL-specific re-exports
const registry = createOperationRegistry();
for (const desc of descriptors) {
  for (const sig of desc.operationSignatures?.() ?? []) {
    registry.register(sig);
  }
}
```

**Why?**
- **Same package tests**: If tests in the same module need it, use relative paths (`../src/...`)
- **Cross-package tests**: If tests in other modules need it, that's a code smell - refactor the tests to use public APIs or test utilities
- **Test utilities**: Create test utilities (like `assembleOperationRegistryFromPacks`) that encapsulate private functions and expose them through a public API
- **No test-only exports**: Package exports should only include production APIs, not test-only utilities

**Pattern:**
1. Keep functions private (or exported within the same package only)
2. Create test utilities in the same package that use private functions via relative imports
3. Export test utilities if needed (they're part of the package's test infrastructure)
4. Tests in other packages use the test utilities, not the private functions directly
