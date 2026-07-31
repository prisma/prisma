# `prisma-next db init` and `prisma-next db update`

Two complementary commands for managing database schema lifecycle.

## Overview

| Command | Purpose | Marker required? | Policy |
|---------|---------|-----------------|--------|
| `db init` | Sign an existing database under contract management | No (creates one) | Additive only |
| `db update` | Update your database schema to match your contract | No (creates if missing) | Additive + widening + destructive |

**`db init`** is run once per database to sign it under contract management. It introspects the live schema, plans additive operations to fill any gaps, executes them, and writes a contract marker (signature).

**`db update`** is run after every contract change. It introspects the live schema, plans a full reconciliation (including destructive operations like dropping extra columns/tables), executes the plan, and writes the marker. It works on any database, whether or not it has been initialized with `db init`.

## Typical workflow

```bash
# 1. Define schema and emit contract
prisma-next contract emit --config prisma-next.config.ts

# 2. Sign the database (first time only)
prisma-next db init --db $DATABASE_URL

# 3. Evolve the schema: add a column, change a type, etc.
#    Re-emit the contract after editing the schema
prisma-next contract emit --config prisma-next.config.ts

# 4. Preview what db update would do
prisma-next db update --db $DATABASE_URL --dry-run

# 5. Apply the update
prisma-next db update --db $DATABASE_URL
```

## How `db update` reacts to database state

### Scenario 1: Database already matches contract (no-op)

**Behavior**: `db update` succeeds with 0 operations. The marker already matches the current contract, so the planner finds no differences between the introspected schema and the contract.

```
✔ Database already matches contract
  Signature: abc123...
```

**When this happens**: You run `db init` and then immediately run `db update` without changing the contract. Or you run `db update` twice in a row. The command is idempotent.

### Scenario 2: Local contract different from remote database (forward evolution)

**Behavior**: `db update` plans and applies the delta between the database's current schema and the new contract.

Example: you added a `nickname` column to the `user` table in your contract.

**Dry-run mode** (`--dry-run`):
```
✔ Planned 1 operation(s)
│
└─ Add column nickname on user [additive]

Destination hash: new-hash...

This is a dry run. No changes were applied.
Run without --dry-run to apply changes.
```

For SQL targets, plan mode also prints a DDL preview derived from planned operations.

**Apply mode** (default):
```
✔ Applied 1 operation(s)
  Signature: new-hash...
```

The planner supports three operation classes:
- **Additive**: Create tables, add columns, add indexes/constraints
- **Widening**: Relax nullability (NOT NULL → nullable)
- **Destructive**: Drop tables, drop columns, alter column types, tighten nullability

### Scenario 3: Local contract divergent from remote database (conflicts)

**Behavior**: `db update` fails with `PLANNING_FAILED` when the planner detects irreconcilable differences.

This happens when:
- The database has been manually altered in ways that conflict with the contract (e.g., a column type was changed to something incompatible)
- The contract requires changes that cannot be expressed as safe operations under current policy

```
✖ Migration planning failed due to conflicts (PLANNING_FAILED)
  Conflicts (showing 1 of 1):
    - [typeMismatch] Column user.email: expected text, found varchar(100)
```

**Recovery**: Inspect the conflict, reconcile the schema drift manually or update the contract to match reality, then re-run `db update`.

If the runner detects that the resulting schema does not match the contract, it fails with `RUNNER_FAILED`:

```
✖ Schema verify failed (RUNNER_FAILED)
  Why: The resulting database schema does not satisfy the destination contract.
  Fix: Inspect the reported conflict, reconcile schema drift if needed, then re-run `prisma-next db update`
```

## Key differences between `db init` and `db update`

| Aspect | `db init` | `db update` |
|--------|-----------|-------------|
| Requires marker | No | No |
| Creates marker | Yes (on apply) | Creates or updates marker (on apply) |
| Operation policy | Additive only | Additive + widening + destructive |
| Execution checks | Disabled (fresh introspection) | Disabled by default (same-session plan/apply) |
| Existing marker handling | Idempotent if hash matches; error if mismatched | Ignored; marker is bookkeeping only |
| Use case | Conservative first-time signing (additive only) | General-purpose schema evolution |

## Flags

Both commands share the same flag surface:

| Flag | Description |
|------|-------------|
| `--db <url>` | Database connection string |
| `--config <path>` | Path to `prisma-next.config.ts` |
| `--dry-run` | Preview planned operations without applying |
| `-y, --yes` | Auto-accept prompts (skips destructive operation confirmation for `db update`) |
| `--json [format]` | Output as JSON (`object` format only) |
| `-q, --quiet` | Quiet mode: errors only |
| `-v, --verbose` | Verbose output: debug info, timings |
| `--no-color` | Disable color output |

## Programmatic API

Both commands are available via the control client:

```typescript
import { createControlClient } from '@internal/cli/control-api';

const client = createControlClient({
  family: sqlFamily,
  target: postgresTarget,
  adapter: postgresAdapter,
  driver: postgresDriver,
});

// db init
const initResult = await client.dbInit({
  contractIR: contractJson,
  mode: 'apply',
  connection: databaseUrl,
});

// db update
const updateResult = await client.dbUpdate({
  contractIR: contractJson,
  mode: 'plan', // or 'apply'
  connection: databaseUrl,
});

await client.close();
```
