# ADR 307 — No recovery resets or drops a database

**Status:** Accepted
**Date:** 2026-10-23

## Decision

No error, document or skill recommends resetting or dropping a database to fix a migration, marker or contract problem. Prisma 8 has no reset operation. A database can always be moved, in one of two ways:

- **`db update`**, which plans the operations that make the live database satisfy a target contract, runs them, and signs the database. It is for a database whose migration history does not need to be kept: a local, development, staging or preview database, shared or not.
- **Authored migrations**, for a database that changes only through migrations, such as production ([ADR 287](ADR%20287%20-%20Prisma%208%20has%20no%20db%20push%20to%20production.md)).

The commonest case is a database whose marker names a contract that is not in the migration graph:

```text
✖ The database is at a contract that is not in the migration graph (MIGRATION.MARKER_MISMATCH)
  why  The database's marker names contract 267755c4…, and no migration in migrations/app starts or ends there.
       This usually means a migration this database applied was later planned again or deleted, for example a
       branch that was deployed and then rebased. The database last applied 9f1e02ab…, then
       20261013T0910_request_description, which is no longer on disk. The database does not need to be reset or dropped.
```

The error gives both recoveries, each labelled with the kind of database it is for.

## Why

A shared development database's marker ended up outside the migration graph after a branch deployed to it was rebased. The agent handling the failed deploy proposed resetting the database, because every text it read either scoped `db update` to a local machine or offered recoveries that the CLI itself refuses. Its data mattered; `db update` would have moved it.

A reset loses data that no migration needs to lose, and an agent short of ideas reaches for one if any text allows it. Removing the option from every text, and saying in the error that it is not needed, leaves only the recoveries that keep the data.

## Consequences

- The reset recoveries and the "auto-reset" development policy in [ADR 123](ADR%20123%20-%20Drift%20Detection,%20Recovery%20&%20Reconciliation.md) are superseded. Where ADR 123 lists a reset, use `db update` or an authored migration, chosen as above.
- A database whose data does not matter is still moved with `db update`, not reset. The rule has no exception for disposable data.
- No revisit-if condition is recorded.

## Alternatives considered

- **A reset command for development databases.** Rejected: `db update` already moves any database to any contract it can name, and a reset command would be the option agents reach for on databases whose data matters.
- **Recommending a reset only where the data is disposable.** Rejected: neither the CLI nor an agent can tell from a connection whether a database's data matters.
