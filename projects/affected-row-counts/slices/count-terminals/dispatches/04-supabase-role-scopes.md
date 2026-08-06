# Brief: Supabase role-bound query and statistics scopes

## Task

Migrate every Supabase role-bound app and secondary-root runtime scope to row `query` and statistics `execute`, such that role binding, same-connection and transaction pinning, reset-before-release, and destroy-on-error guarantees hold for both operations. Row APIs become `queryWithRole`/`query`; statistics execution returns the bound SQL runtime's `SqlStatementStats` without deriving it from rows.

## Scope

**In:** `packages/3-extensions/supabase/src/runtime/supabase-runtime.ts`, `supabase.ts`, their exported runtime types as required, and focused Supabase runtime/facade tests. Tests first. `openRoleSession` connection and transaction objects, ORM runtime objects, role-bound `Db`, and the Supabase-internal secondary root must each expose both semantic operations. Query streams keep release-after-drain/destroy-on-error behavior; eager execute releases after success and destroys on failure. Both operations must stay on the role-bound connection/transaction.

**Out:** SQL ORM count terminals, Mongo, framework/SQL runtime redesign, broad external fakes/examples, session-control semantics changes, compatibility aliases, prepared statistics, optional counts. The raw `set_config`/`RESET ALL` calls remain below the typed runtime scope and are not an ORM count source.

## Completed when

- [ ] Role session root/transaction, app role DB, ORM runtime object, service-role secondary root, and public types expose `query` + `execute`; no row-returning runtime `execute` alias remains.
- [ ] Focused tests prove query drain/release, query failure/destroy, execute same-connection stats/release, execute failure/destroy, transaction pinning, and session reset ordering without conflating raw session-control calls with typed statistics execution.
- [ ] Supabase production build/lint/source typecheck and focused tests pass after rebuilding SQL runtime exports; residual mechanical test/facade sites are enumerated for D6.

## Standing instruction

Stay focused on Supabase scope conformance and lifecycle. If a current role-bound cleanup guarantee cannot hold for eager execute, halt and surface rather than weakening cleanup.

## References

- Slice spec: `projects/affected-row-counts/slices/count-terminals/spec.md`
- Slice plan: `projects/affected-row-counts/slices/count-terminals/plan.md` § Dispatch 4
- SQL reference implementation: commits `4477b0d61f`, `e014e8e540`, `12921055f6`
- Slice 1 Supabase raw-control hand-off: PR #29907/current `origin/main`
- Calibration: `drive/calibration/failure-modes.md` F3, F5, F14, F15, F17, F19; `drive/calibration/grep-library.md` § Cross-cutting anti-patterns

## Operational metadata

- **Model tier:** mid — SQL reference pattern is settled, but connection cleanup remains load-bearing.
- **Time-box:** 75 minutes.
- **Halt conditions:** Execute cannot preserve role/connection binding or cleanup; raw control behavior must change; another production package is required; a public scope needs unpinned semantics; destructive git would be required. Planned downstream caller errors are not halt conditions.
