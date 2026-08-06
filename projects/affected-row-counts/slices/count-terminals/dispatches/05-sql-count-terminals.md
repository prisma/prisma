# Brief: SQL count terminals consume write statistics

## Task

Rewrite SQL ORM `updateAndCount` and `deleteAndCount` to execute only their non-returning DML plan and return that operation's `affectedRows`, such that no matching-row pre-read survives, annotations remain attached to the write, transaction scope stays pinned, and a row that becomes matching immediately before the write is reflected in the returned count. Preserve the empty `updateAndCount({})` zero-statement return.

## Scope

**In:** SQL ORM count-terminal production code and the smallest runtime helper/type changes it owns; central SQL ORM test runtime support required to distinguish query rows from execute stats; focused unit/type tests; real-driver integration tests under `test/integration/test/sql-orm-client/` that prove statement count and interleaving. Tests first. The one-statement proof must observe middleware execution rather than inspect source. The interleaving fixture must use a one-shot guard and independent runtime/connection to commit a newly matching row immediately before the DML, so the test fails under the old pre-read result.

**Out:** `createAndCount`; returning/streaming terminals; broad row-caller/fake migration assigned to D6; middleware/framework redesign; driver changes; target semantic normalization; compatibility aliases; prepared statistics.

## Completed when

- [ ] Both non-empty count terminals call statistics `execute` exactly once and return `affectedRows`; their primary-key `compileSelect`, `countCompiled`, `matchingRows`, and `.length` path is deleted; empty update remains a zero-statement `0`.
- [ ] Focused unit tests prove one annotated write execution and no query execution for each terminal; middleware-observed integration evidence proves one statement.
- [ ] A real-driver interleaving test inserts a newly matching row immediately before the write and observes the write-derived count including it; the fixture cannot recurse through its middleware.
- [ ] SQL ORM production build/lint/source typecheck, focused package tests, and affected Postgres/SQLite integration tests pass after rebuilding producers; residual mechanical callers are enumerated for D6.

## Standing instruction

Stay focused on count-terminal behavior. If the interleaving proof cannot discriminate old read-then-write from write-derived count, halt rather than ship a tautological test.

## References

- Slice spec: `projects/affected-row-counts/slices/count-terminals/spec.md`
- Slice plan: `projects/affected-row-counts/slices/count-terminals/plan.md` § Dispatch 5
- SQL runtime hand-off: commits `4477b0d61f`, `e014e8e540`, `12921055f6`
- Project purpose and project-DoD: `projects/affected-row-counts/spec.md`
- Calibration: `drive/calibration/failure-modes.md` F3, F5, F13, F14, F15, F17, F19; `drive/calibration/grep-library.md` § Cross-cutting anti-patterns

## Operational metadata

- **Model tier:** orchestrator — behavioral integration seam and count provenance are judgment-heavy.
- **Time-box:** 105 minutes.
- **Halt conditions:** The interleaving test cannot fail under the old implementation; middleware observation requires counting setup/control statements as terminal statements; transaction binding would be lost; another production package must change; destructive git would be required. Planned D6 caller errors are not halt conditions.
