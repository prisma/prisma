# Slice `query-execute-split` — Dispatch plan

**Slice spec:** `projects/affected-row-counts/slices/query-execute-split/spec.md`
**Linear:** [TML-3167](https://linear.app/prisma-company/issue/TML-3167)

## Shape

Six dispatches in the repo's **hard-cut migration of one substrate concept** shape (`drive/calibration/sizing.md` § Slice-shape patterns): substrate + reference implementation → second implementation → consumer migration → mechanical fan-out closing the gate. The conformance fix leads, deliberately.

**Expected intermediate state: repo-wide `pnpm typecheck` is red from D2 until D6 closes it.** The moment `SqlQueryable` changes shape, both drivers, the runtime and all 18 test fakes stop compiling — that is the slice's premise, not a defect. Each of D2–D5 gates on its **own package's** typecheck and tests; D6 owns repo-wide green. An implementer who reports "typecheck is red elsewhere" during D2–D5 has observed the plan working, not a failure.

Two calibration patterns drove the boundaries. **"Mechanical fan-out + design judgment in one dispatch"** is why the runtime merge (D4), the supabase judgment (D5), and the 18-file fake migration (D6) are three dispatches rather than one — the judgment sites would otherwise be buried in the fan-out's diff where the reviewer misses them. **"While I'm in there cleanup"** is why the `ADAPTER.PREPARE_FAILED` fix is D1 with its own brief rather than riding inside the SPI diff.

### Dispatch 1: `ADAPTER.PREPARE_FAILED` conformance

- **Outcome:** A failed stale-handle retry surfaces `ADAPTER.PREPARE_FAILED` with the originating error as `cause`, and a test asserts it. The code is currently absent from all source — it appears only in ADR 210, ADR 027, and this project's docs.
- **Builds on:** None. Runs against today's unmodified SPI.
- **Hands to:** A `withStaleHandleRetry` that is ADR-210-conformant *before* it gets rewritten — so D2's reshape carries the fix forward rather than being asked to introduce it mid-refactor.
- **Focus:** `postgres-driver.ts` `withStaleHandleRetry` (currently `:190`; the retry-failure path at `:214` rethrows a generic `normalizePgError`). Read ADR 210 § Stale-handle retry and ADR 027 for the envelope shape — this is a **single-file judgment call**, and the envelope's exact shape is the thing to get right. Deliberately out of scope: any SPI shape change. Gates green throughout; this dispatch does not break the build.

### Dispatch 2: the interface, with postgres as its reference implementation

- **Outcome:** `SqlQueryable` is `query()` (rows, streaming) + `execute()` (`SqlStatementStats`) + `explain?`; `SqlStatementStats` and `PreparedStatementHandle` exist; `SqlExecuteRequest` carries the optional slot and `PreparedExecuteRequest` extends it; `SqlQueryResult` is deleted. The postgres driver conforms, and a test pins that `execute()`'s `affectedRows` comes from pg's command tag.
- **Builds on:** D1's conformant retry path; the spec's chosen design.
- **Hands to:** The SPI's final shape plus one complete worked implementation — the reference every later dispatch conforms against.
- **Focus:** `driver-types.ts`; `postgres-driver.ts` (`PostgresQueryable` base + its four subclasses) and `postgres/src/exports/runtime.ts`. The prepared fall-through (`:173`, prepared-statements-disabled) becomes an internal branch of `query()`. Branch on `req.preparedStatementHandle === undefined`, never `in`. The `handle as string` bare cast (`:185`) should not survive — narrow where the handle is minted. The cursor path is untouched: statistics no longer ride the row stream, so nothing is extracted from `readCursor`. Gate: postgres-driver package typecheck + tests. Deliberately out of scope: sqlite, runtime, fakes.

### Dispatch 3: sqlite conforms, and stops writing every method twice

- **Outcome:** The sqlite driver conforms to the new SPI, with `execute()` as `stmt.run()` (`changes` = `sqlite3_changes64()`). `SqliteConnectionImpl` and `SqliteTransactionImpl` share an abstract base instead of duplicating four method bodies verbatim. Two tests: `run().changes` is the count source, and a `RETURNING` statement routed to `execute()` fails loudly.
- **Builds on:** D2's SPI shape and the postgres implementation as reference.
- **Hands to:** Both shipped drivers conforming — the project-DoD condition "both drivers return a real `affectedRows`" is now reachable.
- **Focus:** `sqlite-driver.ts` (`SqliteConnectionImpl` `:66`, exported; `SqliteTransactionImpl` `:139`, not; the base stays package-private). `columns().length === 0` is retained as a **guard, not a router** — `run()` on a `RETURNING` statement executes it and discards rows silently, so a misrouted plan must fail rather than lose data. Gate: sqlite-driver package typecheck + tests. Deliberately out of scope: runtime, fakes.

### Dispatch 4: one runtime execution path

- **Outcome:** `executeAgainstQueryable` and `executePreparedAgainstQueryable` are one code path parameterised by how `exec` is built. The per-call `planExecutionId` mint (ADR 220) survives for every entry point.
- **Builds on:** D2's request shape — prepared-ness on the request is what makes the two thunks one call.
- **Hands to:** A single runtime execution path, so the fakes in D6 have exactly one driver-facing contract to satisfy.
- **Focus:** `sql-runtime.ts` (`:386` and `:531` — they differ in exactly two places: how `exec` is produced, and `:472` vs `:602` for the driver call) and `prepared/prepared-statement.ts`. `RuntimeScope` (`relational-core/src/runtime-scope.ts:20`) is **not** touched — adding a statistics method to every scope is slice 2. Gate: runtime package typecheck against `src` (its `test/` tree is still red until D6, by design). Deliberately out of scope: the 12 runtime test fakes.

### Dispatch 5: supabase conforms, and its control statements get a home

- **Outcome:** The supabase runtime conforms to the reshaped surface, and `openRoleSession`'s three raw-connection calls — `SELECT set_config($1,$2,false)` twice and `RESET ALL` once — route through `query()` and drain, rather than the deleted buffered `query(sql, params)`.
- **Builds on:** D2's SPI and D4's single runtime path.
- **Hands to:** Every production implementation of the surface conforming; only test doubles remain.
- **Focus:** `supabase-runtime.ts` (`:41`, `:42`, `:125`). This is the **judgment site the project spec missed** — the calls read like control-plane code but run on a raw runtime `SqlConnection`, so the "control plane is a separate interface" boundary does not cover them. `execute()` stays reserved for single DML with a real count, per the spec; `SELECT set_config` legitimately returns a row and `RESET ALL` returns none, so draining is correct for both. If that reasoning does not survive contact with the code, **halt and surface** rather than inventing a third method. Gate: supabase package typecheck + tests.

### Dispatch 6: the fakes follow, and the gate closes

- **Outcome:** Every driver fake implements the new surface; `grep -rn 'executePrepared' --include='*.ts' packages/ test/` returns zero outside `node_modules`/`dist` (baseline: 96 occurrences across 25 files); repo-wide `pnpm typecheck`, `pnpm lint:deps`, and `pnpm test:packages` are green.
- **Builds on:** D5's state — all production implementations conforming, so the fakes have a settled contract to mirror.
- **Hands to:** Slice DoD. The SPI is two methods wide end-to-end with no remaining references to the retired pair.
- **Focus:** 18 test files carrying a fake, 12 clustered in `packages/2-sql/5-runtime/test/`, plus `relational-core/test/ast/driver-types.test.ts`, four postgres/sqlite driver + adapter test files, and `supabase/test/supabase-runtime.test.ts`. A **mechanical fan-out** — uniform transformation, file count irrelevant, verification is one grep plus workspace typecheck. Any fake that needs a *judgment* call rather than a mechanical rewrite is a signal the contract from D2–D5 is underspecified: halt and surface rather than inventing per-fake semantics.

## Handoff linearity

D1 → D2 → D3 → D4 → D5 → D6 is linear; each `builds on` references the immediately-prior `hands to`. Two non-obvious dependencies worth naming for brief assembly:

- **D3, D4 and D5 all build on D2's SPI shape**, not merely on their immediate predecessor. An implementer picking up D4 or D5 needs D2's `driver-types.ts` in context, not just D3's or D4's diff.
- **D6 depends on the union of D2–D5**, not on D5 alone. Its brief needs the settled contract, which is only complete once every production implementation has landed.

## Slice-DoD reachability

| Slice-DoD condition | Closed by |
| --- | --- |
| Zero `executePrepared` occurrences | D6 (grep gate) |
| `SqlQueryResult` deleted, not orphaned | D2 (deleted) · D6 (verified unreferenced) |
| `ADAPTER.PREPARE_FAILED` emitted + asserted | D1 |
| Per-driver count-source tests | D2 (pg command tag) · D3 (sqlite `run().changes` + `RETURNING` guard) |
| `pnpm lint:deps` clean | D6 |
| No net increase in bare-`as` casts | D2 (`handle as string` removed) · D6 (repo-wide check) |

Project-DoD floor items and the team-DoD overlay (`drive/calibration/dod.md`) are inherited, not restated.

## Open items

1. **Should D1 land before or after the reshape?** Working position: before, as planned above. It is a self-contained single-file judgment call, and fixing it against stable code produces a cleaner review than introducing it mid-refactor. If D2's rewrite turns out to relocate the retry logic wholesale, D1's test is what proves the behaviour survived the move.
