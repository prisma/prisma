# Deferred

Work found during the project and set aside. Each entry says where it came from. At close-out each one is resolved, filed, or dropped.

## Running a migration.ts loads the target and adapter packages twice

From the system-design review of slice 2b (2026-10-22).

`node migration.ts` imports the target natively. The migration CLI then loads `prisma.config.ts` through c12 and jiti, which evaluates the target and adapter packages a second time. ADR 242 requires each module to exist once in a process, because registries and `instanceof` checks depend on it. Postgres and SQLite get away with it because they dispatch DDL through `ast.accept(visitor)`. The MySQL adapter hit it when it used `instanceof`, and now uses `accept` too. Any future `instanceof` or module-level registry on this path breaks silently.

Fix: make the config load reuse the modules already loaded, and add a test that fails when a target module is evaluated twice in one migration.ts run. Worked out from the code, not yet reproduced.

## One per-space apply loop for targets whose DDL is not transactional

From the system-design review of slice 2b (2026-10-22).

The Mongo and MySQL runners each carry their own copy of the loop that applies a space, verifies it, writes its marker, and stops on failure with `failingSpace` and `databaseUnchanged`. Two improvements:

1. Move the loop into one shared helper both runners use.
2. Run every check that needs no database change, for every space, before the first change, so a failure that can be predicted is reported while the database is still untouched.
