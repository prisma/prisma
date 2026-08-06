# Brief: Mongo runtime and ORM adopt explicit query/statistics operations

## Task

Migrate Mongo runtime and ORM production code to row/result-streaming `query` and statistics-returning `execute`, such that `updateAndCount` returns Mongo `modifiedCount`, `deleteAndCount` returns Mongo `deletedCount`, and neither terminal reads a count from a fake result row or uses a cast. Preserve Mongo middleware, codec, abort, result-shape, and target semantics; caller intent selects query versus execute.

## Scope

**In:** `packages/2-mongo-family/7-runtime/src/**`; `packages/2-mongo-family/5-query-builders/orm/src/**`; their public executor/runtime types; the smallest focused tests needed to drive and prove row query, update/delete statistics, middleware intercept, abort, and count-terminal behavior. Tests first. Other Mongo operations that consume documents or command-result rows—including `createAndCount`—remain query consumers. Statistics execution maps the engine's explicit modified/deleted count to `RuntimeStatementStats.affectedRows`; unsupported statistics results fail loudly rather than using row length or a default.

**Out:** SQL/Supabase/SQL ORM, Mongo extension facade tests/fakes, broad Mongo test-literal rename fan-out, `createAndCount`, target semantic normalization, compatibility aliases, optional statistics, SQL/AST inference, `any`, or new bare casts.

## Completed when

- [ ] Mongo runtime public API exposes row `query` and stats `execute`; both use D1's operation-aware middleware lifecycle, and focused tests prove query rows, execute interception, count mapping, abort, and fresh IDs.
- [ ] Mongo ORM row/result consumers call `query`; `updateAndCount` and `deleteAndCount` call `execute` and return `affectedRows`; their former `modifiedCount` / `deletedCount` fake-row casts are deleted while `createAndCount` remains unchanged semantically.
- [ ] Mongo runtime and Mongo ORM production builds/lint and focused tests pass after rebuilding framework exports; remaining mechanical test/facade callers are enumerated for D6 with no compatibility alias.

## Standing instruction

Stay focused on Mongo conformance and existing count terminals. Any command whose statistics semantics are not explicit is a query consumer or a halt signal; do not invent a default count.

## References

- Slice spec: `projects/affected-row-counts/slices/count-terminals/spec.md`
- Slice plan: `projects/affected-row-counts/slices/count-terminals/plan.md` § Dispatch 3
- Framework substrate: commits `be09058a7d`, `9c77f09bb4`
- SQL reference implementation: commits `4477b0d61f`, `e014e8e540`, `12921055f6`
- Calibration: `drive/calibration/failure-modes.md` F3, F5, F14, F15, F17, F19; `drive/calibration/grep-library.md` § Cross-cutting anti-patterns

## Operational metadata

- **Model tier:** orchestrator — Mongo result classification and target semantics are judgment-heavy.
- **Time-box:** 90 minutes.
- **Halt conditions:** An update/delete result lacks its engine count; supporting execute requires SQL/AST/result-generic inference instead of caller selection; unsupported commands would need a fabricated/default count; another production package must change; destructive git would be required. Planned downstream test/facade errors are not halt conditions.
