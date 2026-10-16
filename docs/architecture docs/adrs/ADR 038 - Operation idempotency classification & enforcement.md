# ADR 038 — Operation idempotency classification & enforcement

## Decision

Before the runner applies an operation, it runs the operation's postchecks. If they all hold, the operation is already applied, and the runner skips it. Otherwise it runs the prechecks, executes the operation, and runs the postchecks again to confirm the result. After the last operation, the runner checks the whole database against the migration's end contract.

That order makes every postcheck do two jobs: it confirms an operation worked, and it decides whether the operation runs at all. So every postcheck follows one rule:

> Before an operation runs, its postchecks may all hold only when the operation's full effect is already in place.

A postcheck that also holds for another state lets the runner skip work that was never done. Where the full effect cannot be checked reliably, the operation carries no postcheck.

### Example: changing a default from `'open'` to `'closed'`

A `ticket` table has a column `status text DEFAULT 'open'`. A migration changes the default to `'closed'`. The Postgres planner writes this operation:

```json
{
  "id": "setDefault.ticket.status",
  "operationClass": "widening",
  "precheck": [{ "description": "ensure column \"status\" exists", "sql": "…" }],
  "execute": [
    {
      "description": "set default on \"status\"",
      "sql": "ALTER TABLE \"public\".\"ticket\" ALTER COLUMN \"status\" SET DEFAULT 'closed'"
    }
  ],
  "postcheck": []
}
```

Suppose the operation had the postcheck "column `status` has a default". Before the operation runs, the column has the default `'open'`, so that check already holds. The runner would skip the operation and the default would stay `'open'`. The check holds for a state other than the operation's full effect, so it breaks the rule.

A postcheck that compares the value would follow the rule, but Postgres stores a default as text in its own normalized form, for example `'closed'::text`. The check would need that text predicted at plan time for every type and expression, which is fragile. So `setDefault` carries no postcheck. With an empty postcheck list the runner never skips the operation: it checks that the column exists and runs `SET DEFAULT 'closed'`. Running it again on a column that already has that default is harmless. The final check against the end contract compares the default's value.

The class is `widening` because the column already has a default; on a column without one it is `additive`. A hand-written Postgres migration's `this.setDefault` takes no `operationClass` option. It reads the column in the migration's start contract, after renames made earlier in the same migration, and picks the class the same way ([ADR 232](ADR%20232%20-%20A%20migration%20is%20authored%20against%20its%20start%20and%20end%20contract%20snapshots.md)).

An `autoincrement()` default is different: `setDefault` then creates and attaches a sequence, and that operation keeps a postcheck: the column owns the planned sequence, at the planned width.

## Runner behavior

The Postgres, SQLite and MongoDB runners all do the same thing for each operation:

1. **Postchecks first.** Run the postchecks. If the list is not empty and every postcheck holds, the operation is already applied: skip it and continue. Postgres and SQLite record the skip with the reason `postcheck_pre_satisfied`. An empty list never skips.
2. **Prechecks.** Run the prechecks. If one fails, halt with `MIGRATION.PRECHECK_FAILED`.
3. **Execute.** Run the operation's statements or commands. On a database error, halt.
4. **Postchecks again.** If one fails, halt with `MIGRATION.POSTCHECK_FAILED`.

After the last operation, the runner introspects the database and compares it with the end contract, the same comparison `db verify` runs. A difference halts with `MIGRATION.SCHEMA_VERIFY_FAILED`, and the marker does not move. Postgres and SQLite do this for the app space on every run. MongoDB does it on every run except one where no operation ran and the marker is already at the destination.

Postgres and SQLite run the whole migration in one transaction, so a halt rolls back every operation (see [ADR 037](ADR%20037%20-%20Transactional%20DDL%20Fallback.md)). MongoDB has no transaction for DDL. A failed run leaves earlier operations applied, and the next run relies on step 1 to pass over them.

The runner options `prechecks`, `postchecks` and `idempotencyChecks` can each turn a step off. Step 1 runs only when both postchecks and idempotency checks are on.

Separately, the SQL runners skip every operation of a migration when the marker is already at its destination and the plan has an origin that differs from the destination. The final check still runs.

## Conflict matrix

| Before the operation | Result |
|---|---|
| Postchecks all hold (list not empty) | Skip as already applied |
| Postchecks do not all hold, a precheck fails | Halt: `MIGRATION.PRECHECK_FAILED` |
| Prechecks hold, execution fails | Halt with the database error |
| Prechecks hold, execution succeeds, a postcheck fails | Halt: `MIGRATION.POSTCHECK_FAILED` |
| All operations done, database differs from the end contract | Halt: `MIGRATION.SCHEMA_VERIFY_FAILED` |

## What a postcheck compares

A postcheck compares structure the database reports in its catalog: the kind of object, its table, its ordered columns, a foreign key's target and referential actions, an index's method and uniqueness, and so on. It never compares text the database prints back in its own form: expressions, index predicates, check constraint and policy bodies, and defaults. The database may print the same thing differently from how the plan wrote it, so a text comparison fails on a correct database.

What each target checks, beyond "an object with this name exists":

- **Postgres.**
  - `createTable`: the relation is a table.
  - `addColumn` and the two recipes that add a required column: the column's type, and `NOT NULL` where the column declares it. The type is compared as `format_type` prints it when the column's data type can read that text back, and by type OID otherwise.
  - `createIndex`: the index is on the planned table, with the planned uniqueness, access method and ordered columns, and has an expression and a predicate exactly when the plan does. The expression and predicate text are not compared.
  - `addPrimaryKey`, `addUnique`: the constraint kind and its ordered columns.
  - `addForeignKey`: the kind, the columns, the referenced table and columns, and the `ON DELETE` and `ON UPDATE` actions.
  - `addCheckConstraint`: the constraint kind. The body is not compared.
  - `createRlsPolicy`: the command, whether it is permissive, and the roles as a set. The `USING` and `WITH CHECK` bodies are not compared.
  - `renameTable`, `renameColumn`, `renameIndex`, `renameConstraint`, `renameRlsPolicy`: the new name exists and the old name is gone.
  - `setDefault`: no postcheck for a literal or function default; for `autoincrement()`, the column owns the planned sequence at the planned width.
- **SQLite.**
  - `createTable`: the table has exactly the planned columns, each with its declared type, nullability and primary key position.
  - `addColumn`: the column's declared type and nullability.
  - `createIndex`: the index is on the planned table, over the planned columns in order, with the planned uniqueness.
  - `recreateTable`: also each foreign key's `ON DELETE` and `ON UPDATE` actions, and whether a column is `AUTOINCREMENT`. SQLite keeps `AUTOINCREMENT` only in the `CREATE TABLE` statement it stores, so that one check reads the stored statement. SQLite stores the statement as it was written, not reprinted, so the comparison is reliable.
- **MongoDB.**
  - `createIndex`: the keys and every option the planner tells indexes apart by: `unique` and `sparse` (set or not), the TTL, the partial filter, the wildcard projection, the collation, and for a text index the key, weights and languages as MongoDB lists them. MongoDB returns index options as they were given, apart from the defaults it fills in for a collation and a text index, so these are document comparisons, not comparisons of reprinted text.
  - `collMod` that sets a validator: the whole validator document. For a validator that is only a `$jsonSchema`, the `$jsonSchema` body.

An operation whose postcheck cannot tell its effect apart from no change is refused. A hand-written Postgres `this.alterColumnType` with `using`, on a column that already has the new type in the migration's start contract (after renames made earlier in the migration), fails with `MIGRATION.ALTER_COLUMN_TYPE_UNCHANGED` when `migration.ts` builds its operations. Its postcheck checks the column's type, which already holds, so the runner would skip it and the conversion in `using` would never run. A conversion that keeps the type is written as a `dataTransform`, whose checks look at the rows.

When the full effect of an operation cannot be checked through structure, the operation carries no postcheck, as `setDefault` does. This has a cost. Without a postcheck the runner always runs the prechecks, and a create-style operation has a precheck that its object does not exist yet. On a database that already has the object, that precheck fails. So an operation drops its postcheck only when running it again is harmless and its precheck does not refuse a database that already has its effect.

## Context

The migration runner applies a sequence of operations defined on an edge from `fromHash` to `toHash`. Real databases can be retried, interrupted, or concurrently modified. To remain safe and resumable, the runner must distinguish between an operation that is already applied, a true conflict, and a fresh apply.

The skip in step 1 decides the outcome when the database does not match the migration's start state:

- A database with no marker. `db migrate` runs every operation of every migration against whatever is there. This is how an existing database is adopted.
- `db init` and `db update`, which plan from the live database.
- A database that drifted from its marker, or a hand-written migration whose operations do not match the database.
- MongoDB only: running again after a partial failure.

## Problem

- Without explicit idempotency semantics, a retried migration may partially reapply destructive steps or hide conflicts
- Different operations have different safety characteristics and verification strategies
- The runner needs a uniform way to decide continue, skip or fail on every replay scenario

## Goals

- Classify operations by idempotency and define precise pre/post invariants
- Define what "already applied" means and how the runner records outcomes
- Specify runner behavior on replays vs true conflicts
- Keep semantics deterministic and auditable

## Non-goals

- Designing compensation logic for every possible database defect
- Auto-healing external state or application data
- Replacing human review for destructive changes

## Definitions

**Precondition**
A set of checks evaluated before execution that must hold for the operation to be safely applied

**Postcondition**
A set of checks that hold exactly when the operation's full effect is in place. The runner evaluates them before execution, to detect an applied operation, and after execution, to confirm success

**Already applied**
A state where the postcondition fully holds before the operation runs, with effects equivalent to a successful apply

**Conflict**
A state where the postcondition does not hold and the precondition fails, indicating divergence from the planned edge

## Idempotency classes

The classes below describe how operations behave on replay. The runner does not read a class from the operation: it decides from the postchecks and prechecks alone, as described in [Runner behavior](#runner-behavior). An operation's class shows in which checks it carries.

### 1. Strictly idempotent (creates)

**Examples:** create table, column, index or constraint

- **Pre:** target does not exist
- **Post:** target exists and matches its definition by structure
- **Already applied:** post holds before the run, so the runner skips the operation

### 2. Effect-idempotent

**Examples:** set nullability, set a default

- **Pre:** the target exists and is compatible with the change
- **Post:** the metadata matches the desired spec, when that can be checked by structure
- **Already applied:** post holds before the run. When the effect cannot be checked by structure, as for a column default, there is no post and the operation runs again; this is safe because running it again is harmless

### 3. Replay-sensitive but bounded by unique identity

**Examples:** insert into ledger tables, enqueue background task with unique opId

- **Pre:** no prior execution with the same identity AND schema compatible
- **Post:** effect observed for that identity
- **Already applied:** post holds before the run

### 4. Non-idempotent requiring explicit guard

**Examples:** destructive DDL (drop table/column), irreversible data transforms

- **Pre:** exact match of expected pre-state
- **Post:** exact match of desired post-state
- **Already applied:** post holds before the run. Policy decides whether such an operation may run at all

## Examples

### Strict

**createIndex**
- **Pre:** no index with this name
- **Post:** an index with this name exists on the planned table, over the planned columns in order, with the planned uniqueness (and on Postgres the planned access method, and an expression and predicate exactly when the plan has them)
- **Replay:** post holds, so the runner skips it

### Effect

**setDefault to `'closed'`** (see the [example](#example-changing-a-default-from-open-to-closed))
- **Pre:** column exists
- **Post:** none
- **Replay:** runs `SET DEFAULT` again; the final check compares the value

### Data transform

**dataTransform that backfills a column**
- **Pre:** some rows still need the change
- **Post:** no row needs the change
- **Replay:** post holds, so the runner skips it

### Non-idempotent

**dropColumn**
- **Pre:** column exists
- **Post:** column missing
- **Replay:** post holds, so the runner skips it

## Rationale

- One decision tree for every operation keeps the runner simple and auditable
- Checking the postcondition first lets a migration run again, or run against a database that already has part of its effect, without failing on prechecks
- The rule keeps that skip safe: a skip happens only when the work is done
- The final check against the end contract catches anything an operation's own checks cannot see, such as a default's value

## Alternatives considered

- **Prechecks first, postchecks only when a precheck fails.** An operation whose precheck still holds after it was applied, such as making a column required when no row holds NULL, would run again. Checking the postcondition first gives one test for "already applied". In both orders the postcheck decides the skip, so it must follow the same rule.
- **A postcheck that compares the text the database stores.** Exact when it matches, but the database prints values, expressions and bodies in its own normalized form. Predicting that text at plan time for every type and expression is fragile, and a wrong prediction fails a correct migration.
- **Treat all ops as effect-idempotent with best-effort checks.** Too optimistic; a weak check skips work that was never done.
- **Require operators to mark everything idempotent manually.** Too error-prone and inconsistent.

## Consequences

### Positive

- Safe retries and resumability across failures
- An existing database can be adopted by running the migrations against it
- Clear operator signals on conflicts vs harmless replays

### Negative

- Every postcheck must be reviewed against the rule; a weak postcheck silently skips work
- Some operations carry no postcheck and rely on the final check against the end contract

## Implementation notes

- Postgres and SQLite express checks as SQL statements that return one boolean ([ADR 028](ADR%20028%20-%20Migration%20Structure%20&%20Operations.md)); MongoDB uses `{ source, filter, expect }` checks ([ADR 188](ADR%20188%20-%20MongoDB%20migration%20operation%20model.md)). All share the three-phase envelope of [ADR 191](ADR%20191%20-%20Generic%20three-phase%20migration%20operation%20envelope.md).
- Operations carry no `idempotency` field, and the ledger records migrations, not operation identities or fingerprints.
- Map runner outcomes to stable errors per [ADR 027](ADR%20027%20-%20Error%20Envelope%20Stable%20Codes.md).

## Testing

- For each postcheck, a test that the postcheck does not hold on a database where the operation's effect is only partly in place
- Unit tests for success, replay and conflict paths
- Tests that interrupt mid-edge and verify resumability

## References

- [ADR 027 — Error envelope & stable codes](ADR%20027%20-%20Error%20Envelope%20Stable%20Codes.md)
- [ADR 028 — Migration structure & operations](ADR%20028%20-%20Migration%20Structure%20&%20Operations.md)
- [ADR 037 — Transactional DDL fallback & compensation](ADR%20037%20-%20Transactional%20DDL%20Fallback.md)
- [ADR 039 — Migration graph path resolution & integrity](ADR%20039%20-%20Migration%20graph%20path%20resolution%20&%20integrity.md)
- [ADR 188 — MongoDB migration operation model](ADR%20188%20-%20MongoDB%20migration%20operation%20model.md)
- [ADR 191 — Generic three-phase migration operation envelope](ADR%20191%20-%20Generic%20three-phase%20migration%20operation%20envelope.md)
