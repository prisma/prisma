# Brief: D2 Round 2 — close SQL runtime production gate and vocabulary

## Task

Resolve reviewer findings F2 and F3 without changing the accepted SQL runtime design: preserve the SQL-specific middleware context through shared preparation so production typecheck passes, and replace retired row-`execute` wording with the settled `query` / `queryPrepared` vocabulary.

## Scope

**In:** The narrow `sql-runtime.ts` type boundary identified by F2; misleading comments/JSDoc/test prose in D2-touched SQL-runtime files identified by F3; focused tests only if the type correction changes executable behavior.

**Out:** The three accepted D6 middleware fixture literals; downstream family/consumer migration; result-contract redesign; compatibility aliases; production behavior changes beyond restoring the intended SQL context type.

## Completed when

- [ ] The shared preparation path retains `SqlMiddlewareContext` and the SQL-runtime production source typechecks/builds without the F2 error.
- [ ] D2-touched prose consistently names row operations `query` / `queryPrepared` and statistics operations `execute`; malformed wording is gone.
- [ ] Framework/relational-core/SQL-runtime builds, SQL-runtime lint, focused tests, and a production-source typecheck gate pass; remaining package typecheck errors are only the three accepted D6 fixtures.

## Standing instruction

Stay focused on F2/F3. Do not migrate accepted D6 fixtures or alter the accepted query/execute architecture.

## Operational metadata

- **Model tier:** orchestrator — resume the persistent implementer.
- **Time-box:** 30 minutes.
- **Halt conditions:** Fixing the SQL context requires weakening framework types or changing another production package; the residual set includes any production error after the fix; destructive git would be required.
