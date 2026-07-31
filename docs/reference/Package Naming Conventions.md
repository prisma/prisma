# Package Naming Conventions

This document defines the relationship between the repository directory layout and published package names.

## Directory Structure

The repository uses numbered prefixes in directory names to reflect the architecture hierarchy:

```
packages/
  1-framework/           # Domain 1: Framework (target-agnostic)
    0-foundation/        # Layer 0: Foundation
    1-core/              # Layer 1: Core
    2-authoring/         # Layer 2: Authoring
    3-tooling/           # Layer 3: Tooling
  2-document/            # Domain 2: Document (placeholder)
  2-mongo-family/        # Domain 2: Mongo family
  2-sql/                 # Domain 2: SQL family
    1-core/              # Layer 1: Core
    2-authoring/         # Layer 2: Authoring
    3-tooling/           # Layer 3: Tooling
    4-lanes/             # Layer 4: Lanes
    5-runtime/           # Layer 5: Runtime
  3-mongo-target/        # Domain 3: Mongo target packages
  3-extensions/          # Domain 3: Extensions
  3-targets/             # Domain 3: Targets
    3-targets/           # Layer 3: Target descriptors
    6-adapters/          # Layer 6: Adapters
    7-drivers/           # Layer 7: Drivers
```

The numbered prefixes serve two purposes:
1. **Visual hierarchy**: Makes domain/layer relationships clear at a glance
2. **Dependency direction**: Lower numbers can be imported by higher numbers, never the reverse

Planes are a conceptual grouping recorded in `architecture.config.json` but do not appear as intermediate subdirectories.

## Naming Rules

- Use the published package name as the only import specifier. The directory layout is for humans and guardrails.
- Encode target family with a family-specific prefix such as `sql-` or `mongo-` for discoverability.
- Collapse nested dirs to hyphenated names; no slashes after the scope.
- Keep conventional names for adapters/drivers (e.g., `@internal/adapter-postgres`, `@internal/driver-postgres`) even when nested under `packages/3-targets/**`.
- Layers (core/authoring/tooling/lanes/runtime/adapters) constrain dependency direction and generally do not appear in package names.

## Path → Package Name Examples

**Framework Domain:**

| Directory | Package Name |
|-----------|--------------|
| `packages/1-framework/0-foundation/contract/` | `@internal/contract` |
| `packages/1-framework/1-core/operations/` | `@internal/operations` |
| `packages/1-framework/1-core/framework-components/` | `@internal/framework-components` |
| `packages/1-framework/1-core/errors/` | `@internal/errors` |
| `packages/1-framework/1-core/config/` | `@internal/config` |
| `packages/1-framework/2-authoring/contract/` | `@internal/contract-authoring` |
| `packages/1-framework/2-authoring/psl-parser/` | `@internal/psl-parser` |
| `packages/1-framework/3-tooling/cli/` | `@internal/cli` |
| `packages/9-public/prisma-next/` | `prisma-next` (bin-only shim — see [ADR 211](../architecture%20docs/adrs/ADR%20211%20-%20prisma-next%20bin-only%20distribution.md)) |
| `packages/1-framework/3-tooling/emitter/` | `@internal/emitter` |

**SQL Domain:**

| Directory | Package Name |
|-----------|--------------|
| `packages/2-sql/1-core/contract/` | `@internal/sql-contract` |
| `packages/2-sql/1-core/operations/` | `@internal/sql-operations` |
| `packages/2-sql/1-core/schema-ir/` | `@internal/sql-schema-ir` |
| `packages/2-sql/2-authoring/contract-ts/` | `@internal/sql-contract-ts` |
| `packages/2-sql/3-tooling/emitter/` | `@internal/sql-contract-emitter` |
| `packages/2-sql/3-tooling/family/` | `@internal/family-sql` |
| `packages/2-sql/4-lanes/relational-core/` | `@internal/sql-relational-core` |
| `packages/2-sql/4-lanes/sql-lane/` | `@internal/sql-lane` |
| `packages/2-sql/5-runtime/` | `@internal/sql-runtime` |

**Mongo Family Domain:**

| Directory | Package Name |
|-----------|--------------|
| `packages/2-mongo-family/1-foundation/mongo-contract/` | `@internal/mongo-contract` |
| `packages/2-mongo-family/2-authoring/contract-psl/` | `@internal/mongo-contract-psl` |
| `packages/2-mongo-family/2-authoring/contract-ts/` | `@internal/mongo-contract-ts` |
| `packages/2-mongo-family/3-tooling/emitter/` | `@internal/mongo-emitter` |
| `packages/2-mongo-family/4-query/query-ast/` | `@internal/mongo-query-ast` |
| `packages/2-mongo-family/5-query-builders/orm/` | `@internal/mongo-orm` |
| `packages/2-mongo-family/5-query-builders/query-builder/` | `@internal/mongo-query-builder` |
| `packages/2-mongo-family/6-transport/mongo-lowering/` | `@internal/mongo-lowering` |
| `packages/2-mongo-family/6-transport/mongo-wire/` | `@internal/mongo-wire` |
| `packages/2-mongo-family/7-runtime/` | `@internal/mongo-runtime` |
| `packages/2-mongo-family/9-family/` | `@internal/family-mongo` |

**Mongo Target Domain:**

| Directory | Package Name |
|-----------|--------------|
| `packages/3-mongo-target/1-mongo-target/` | `@internal/target-mongo` |
| `packages/3-mongo-target/2-mongo-adapter/` | `@internal/adapter-mongo` |
| `packages/3-mongo-target/3-mongo-driver/` | `@internal/driver-mongo` |

**Targets Domain:**

| Directory | Package Name |
|-----------|--------------|
| `packages/3-targets/3-targets/postgres/` | `@internal/target-postgres` |
| `packages/3-targets/6-adapters/postgres/` | `@internal/adapter-postgres` |
| `packages/3-targets/7-drivers/postgres/` | `@internal/driver-postgres` |

**Extensions Domain:**

| Directory | Package Name |
|-----------|--------------|
| `packages/3-extensions/pgvector/` | `@internal/extension-pgvector` |

## Workspace Dependencies

Every import from another `@internal/*` package requires an explicit `workspace:*` dependency in `package.json`. TypeScript resolves imports through `node_modules` symlinks created by pnpm.

### Adding a Dependency

```bash
# From the package directory
pnpm add @internal/some-package@workspace:*
```

Or manually add to `package.json` (keep alphabetical order):

```json
{
  "dependencies": {
    "@internal/some-package": "workspace:*"
  }
}
```

Then run `pnpm install` from the repository root to update the lockfile.

### Subpath Exports

Packages expose specific entrypoints via the `exports` field. Import from these subpaths, not internal file paths:

```typescript
// Correct — uses subpath export
import { createRuntime } from '@internal/adapter-postgres/runtime';

// Incorrect — imports internal path
import { createRuntime } from '@internal/adapter-postgres/dist/exports/runtime';
```

## Workspace Globs (pnpm)

```yaml
packages:
  - packages/**
  - examples/*
  - test/**
```

## Enforcement

- Use `scripts/check-imports.mjs` with `architecture.config.json` to enforce dependency direction: `core → authoring → tooling → lanes → runtime → adapters`.
- The import validation script enforces domain/layer/plane rules: same-layer imports allowed, downward imports allowed, upward imports denied, cross-domain imports denied except framework domain, migration→runtime imports denied, runtime→migration imports allowed for artifacts only.
- Numbered directory prefixes provide visual reinforcement of dependency direction.
