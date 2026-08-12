# Modular Refactoring Patterns

This document covers patterns for refactoring large monolithic files into modular, maintainable structures while maintaining API stability.

## When to Refactor

**Signals that refactoring is needed:**
- File exceeds 1000+ lines
- Multiple distinct responsibilities in one file
- Difficult to test individual components
- Hard to understand the overall structure
- Repeated patterns that could be extracted

## Refactoring Strategy

### Phase 1: Extract Pure Helpers

Start by extracting pure, side-effect-free utility functions:

**✅ CORRECT: Extract pure helpers first**

```typescript
// utils/ast.ts - Thin wrappers around rich AST classes
export { BinaryExpr, ColumnRef, OperationExpr, ParamRef } from '@internal/sql-relational-core/ast';

// utils/errors.ts - Centralized error constructors
export function errorModelNotFound(modelName: string): never {
  throw planInvalid(`Model ${modelName} not found in mappings`);
}
```

**Why?**
- Pure functions are easiest to extract and test
- No dependencies on class state
- Can be moved without breaking changes
- Provides foundation for other extractions

### Phase 2: Extract Domain Modules

Group related functionality into domain-specific modules:

**✅ CORRECT: Organize by domain**

```typescript
// selection/predicates.ts - WHERE clause building
export function buildWhereExpr(...): BinaryExpr { ... }

// selection/ordering.ts - ORDER BY clause building
export function buildOrderByClause(...): OrderByItem[] { ... }

// mutations/insert-builder.ts - INSERT plan building
export function buildInsertPlan(...): Plan<number> { ... }
```

**Organization Principles:**
- **By domain**: Group by what the code does (selection, mutations, relations)
- **By layer**: Separate concerns (building, planning, lowering)
- **Single responsibility**: Each module has one clear purpose
- **Cohesive**: Related functions live together

### Phase 3: Extract State and Context

Extract state management and context creation:

**✅ CORRECT: Separate state from logic**

```typescript
// orm/state.ts - Immutable state shapes
export interface OrmBuilderState {
  readonly table: TableRef;
  readonly wherePredicate: AnyBinaryBuilder | undefined;
  readonly includes: OrmIncludeState[];
  // ...
}

// orm/context.ts - Context creation
export interface OrmContext<TContract extends SqlContract<SqlStorage>> {
  readonly context: ExecutionContext<TContract>;
  readonly contract: TContract;
}
```

**Why?**
- State shapes are reusable across modules
- Context creation is a single responsibility
- Makes dependencies explicit
- Easier to test in isolation

### Phase 4: Create Facade

Replace the monolithic class with a thin facade that delegates to modules:

**✅ CORRECT: Thin facade delegates to modules**

```typescript
// orm/builder.ts - Main facade
export class OrmModelBuilderImpl<...> {
  findMany(options?: BuildOptions): Plan<Row> {
    const { includesAst, includesForMeta } = buildIncludeAsts(...);
    const projectionState = buildProjectionState(...);
    const whereExpr = buildWhereExpr(...);
    const ast = buildSelectAst(...);
    const planMeta = buildMeta(...);
    return createPlan(ast, lowered, paramValues, planMeta);
  }
}
```

**Key Points:**
- Facade is thin - mostly delegates to module functions
- Public API remains unchanged
- Internal structure is modular
- Each method is readable and focused

## Maintaining API Stability

**CRITICAL**: During refactoring, the public API must remain unchanged.

**✅ CORRECT: Internal refactoring, same public API**

```typescript
// Before: Monolithic class
export class OrmModelBuilderImpl {
  findMany() { /* 200 lines of logic */ }
}

// After: Facade delegates to modules
export class OrmModelBuilderImpl {
  findMany() {
    // Delegate to extracted functions
    return buildSelectPlan(this.state, ...);
  }
}
```

**Testing Strategy:**
- Rely on existing tests - they verify API stability
- Run tests after each extraction phase
- Don't change test structure during refactoring
- Tests should pass without modification

## Error Handling Patterns

**Centralize error constructors** in a single module:

**✅ CORRECT: Centralized errors**

```typescript
// utils/errors.ts
export function errorModelNotFound(modelName: string): never {
  throw planInvalid(`Model ${modelName} not found in mappings`);
}

export function errorFailedToBuildWhereClause(): never {
  throw planInvalid('Failed to build WHERE clause');
}
```

**Why?**
- Consistent error messages
- Easy to update error text
- Single source of truth
- Better discoverability

## Type Safety During Refactoring

**Replace `any` with proper types** during extraction:

**❌ WRONG: Using `any` in extracted functions**

```typescript
export function buildDeletePlan(
  where: (model: any) => AnyBinaryBuilder,
  getModelAccessor: () => any,
): Plan<number> { ... }
```

**✅ CORRECT: Use proper generic types**

```typescript
export function buildDeletePlan<
  TContract extends SqlContract<SqlStorage>,
  CodecTypes extends Record<string, { output: unknown }>,
  ModelName extends string,
>(
  where: (model: ModelColumnAccessor<TContract, CodecTypes, ModelName>) => AnyBinaryBuilder,
  getModelAccessor: () => ModelColumnAccessor<TContract, CodecTypes, ModelName>,
): Plan<number> { ... }
```

**Key Points:**
- Add generic type parameters when extracting functions
- Use existing type definitions (e.g., `ModelColumnAccessor`)
- Pass type parameters through the call chain
- Never use `any` as a shortcut

## Handling `exactOptionalPropertyTypes`

When TypeScript's `exactOptionalPropertyTypes` is enabled, optional properties must be explicitly handled:

**✅ CORRECT: Use `compact` helper for optional properties**

```typescript
import { compact } from '@internal/sql-relational-core/ast';

const includeForMeta: IncludeState = compact({
  alias: includeState.alias,
  table: includeState.childTable,
  on: { ... },
  childProjection: childProjectionState,
  childWhere: includeState.childWhere, // undefined is OK
  childOrderBy: includeState.childOrderBy, // undefined is OK
}) as IncludeState;
```

**Why?**
- `compact` removes `undefined` values from objects
- Satisfies `exactOptionalPropertyTypes` requirements
- Cleaner than conditional spreads
- Consistent pattern across codebase

## Import Organization

**Follow Biome's import organization rules:**

**✅ CORRECT: Organized imports**

```typescript
// 1. External type imports
import type { ParamDescriptor, Plan } from '@internal/contract/types';

// 2. External value imports
import { planInvalid } from '@internal/sql-relational-core/errors';

// 3. Internal type imports
import type { OrmContext } from '../orm/context';

// 4. Internal value imports
import { buildWhereExpr } from '../selection/predicates';
import { createDeleteAst } from '../utils/ast';
import { errorModelNotFound } from '../utils/errors';
```

**Why?**
- Consistent with codebase style
- Easier to read and maintain
- Biome auto-fixes import order
- Groups related imports together

## Testing During Refactoring

**Run tests after each extraction phase:**

```bash
# After extracting utilities
pnpm --filter @internal/sql-orm-lane test

# After extracting domain modules
pnpm --filter @internal/sql-orm-lane test

# After creating facade
pnpm --filter @internal/sql-orm-lane test
```

**Key Points:**
- Tests should pass without modification
- If tests break, API contract was changed (fix it)
- Use existing tests to verify correctness
- Don't refactor tests during code refactoring

## Example: ORM Lane Refactoring

The `@internal/sql-orm-lane` package was refactored from a single 1900-line file into a modular structure:

**Before:**
- `orm-builder.ts` (1900 lines) - Everything in one file

**After:**
- `orm/builder.ts` - Thin facade (700 lines)
- `selection/*.ts` - Query selection building (6 modules)
- `relations/*.ts` - Relation handling (1 module)
- `mutations/*.ts` - Write operations (3 modules)
- `plan/*.ts` - Plan assembly (3 modules)
- `utils/*.ts` - Shared utilities (3 modules)
- `types/*.ts` - Internal types (1 module)

**Result:**
- ✅ Public API unchanged
- ✅ All tests pass
- ✅ Better maintainability
- ✅ Easier to understand
- ✅ Easier to test individual components

## Example: SQL Lane Refactoring

The `@internal/sql-lane` package was refactored from a single 1940-line `sql.ts` file into a modular structure:

**Before:**
- `sql.ts` (1940 lines) - Everything in one file

**After:**
- `sql/builder.ts` - Thin public facade (replaces old `sql.ts`)
- `sql/select-builder.ts` - SelectBuilderImpl class
- `sql/mutation-builder.ts` - Insert/Update/Delete builders
- `sql/include-builder.ts` - IncludeMany child builder and AST building
- `sql/join-builder.ts` - Join DSL logic
- `sql/predicate-builder.ts` - Where clause building (consolidated duplicate implementations)
- `sql/projection.ts` - Projection building logic
- `sql/plan.ts` - Plan assembly and meta building
- `sql/context.ts` - Context wiring logic
- `utils/errors.ts` - Centralized error constructors
- `utils/capabilities.ts` - Capability checking logic
- `utils/guards.ts` - Type guards and column info helpers
- `utils/state.ts` - Immutable builder state types
- `types/internal.ts` - Internal helper types
- `types/public.ts` - Public type re-exports

**Key Learnings:**
- **Consolidate duplicate code**: The refactoring consolidated three duplicate `_buildWhereExpr` implementations (in SelectBuilderImpl, UpdateBuilderImpl, DeleteBuilderImpl) into a single `buildWhereExpr` function in `predicate-builder.ts`
- **Use AST factories consistently**: All AST construction flows through factories from `@internal/sql-relational-core/ast`, ensuring consistency and reducing duplication
- **Centralize error handling**: All error constructors are in `utils/errors.ts`, providing a single source of truth for error messages
- **Capability checks**: Capability checking logic is centralized in `utils/capabilities.ts`, following the same pattern as the ORM lane
- **State management**: Immutable state types are extracted to `utils/state.ts`, making state shapes reusable across modules

**Result:**
- ✅ Public API unchanged (all exports remain the same)
- ✅ All 96 tests pass
- ✅ Better maintainability (focused modules instead of one giant file)
- ✅ Easier to understand and test individual components
- ✅ No duplicate code (especially `_buildWhereExpr`)

## Summary

1. **Start with pure helpers** - Easiest to extract, no dependencies
2. **Extract by domain** - Group related functionality together
3. **Separate state from logic** - Extract state shapes and context
4. **Create thin facade** - Delegate to modules, keep API stable
5. **Centralize errors** - Single source of truth for error messages
6. **Use proper types** - Replace `any` with generics during extraction
7. **Handle optional properties** - Use `compact` for `exactOptionalPropertyTypes`
8. **Organize imports** - Follow Biome rules
9. **Test frequently** - Run tests after each phase
10. **Maintain API stability** - Public API must not change
