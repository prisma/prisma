# affected-row-counts — Plan

**Spec:** `projects/affected-row-counts/spec.md`
**Linear Project:** [Prisma 8 RC1](https://linear.app/prisma-company/project/prisma-8-rc1-7592265f700c) — tracked under parent issue [TML-3166](https://linear.app/prisma-company/issue/TML-3166), one sub-issue per slice.

## At a glance

Three slices in the repo's standard substrate → consumer → docs shape: a stack of two (reshape the driver execution surface, then let the count reach the caller and delete the pre-`SELECT`), plus a documentation slice that is independent of both because every decision it records was settled at spec time.

## Composition

### Stack (deliver in order)

1. **Slice `query-execute-split`** — Linear: [TML-3167](https://linear.app/prisma-company/issue/TML-3167)
   - **Outcome:** `SqlQueryable` is two methods wide and named the way Go names them — `query()` streams rows, `execute()` returns `SqlStatementStats { affectedRows: number }`. Prepared-ness rides on the request rather than doubling the surface, so four methods become two; SQLite's connection and transaction classes stop duplicating each other; the runtime's prepared and unprepared execution paths merge into one. **Nothing above the runtime changes behaviour** — the count terminals still run their pre-`SELECT` at the end of this slice.
   - **Builds on:** None.
   - **Hands to:** A driver that answers "how many rows did that affect" directly, and a runtime with one execution path instead of two — the substrate slice 2 reads from.
   - **Focus:** `driver-types.ts`; the postgres queryable base and its connection/transaction/driver subclasses; both sqlite queryable classes plus the abstract base they're missing; the runtime's two near-identical generators (`sql-runtime.ts:386` and `:531`, which differ only in how they build `exec`); and the driver fakes — 18 test files carry one, 12 of them clustered in `packages/2-sql/5-runtime/test/`, with 96 `executePrepared` occurrences repo-wide. The control plane's `SqlControlDriverInstance.query` is a different interface and does not move. Postgres's `execute()` reads `rowCount` off the buffered result; sqlite's is `stmt.run()`, with `columns().length === 0` kept as a guard so a misrouted `RETURNING` plan fails loudly instead of silently discarding rows. Also lands the ADR 210 conformance fix this slice's code sits on top of: a failed stale-handle retry must surface `ADAPTER.PREPARE_FAILED`, which today is emitted nowhere. Deliberately out of scope: any ORM-visible behaviour change.

2. **Slice `count-terminals`** — Linear: [TML-3168](https://linear.app/prisma-company/issue/TML-3168)
   - **Outcome:** `updateAndCount` and `deleteAndCount` issue exactly one statement and return the number the engine reported; the pre-`SELECT` is deleted rather than left dormant; a middleware `intercept` on a statistics-shaped execution cannot produce a fabricated count.
   - **Builds on:** Slice 1's `execute()`.
   - **Hands to:** The project's purpose, delivered — plus a statistics path `createAndCount` and ADR 023's write budgets could consume later.
   - **Focus:** Apply the runtime vocabulary decided at Slice 2 DoR: rename the current row-streaming `execute` / `executePrepared` methods to `query` / `queryPrepared`, then add statistics-returning `execute`. The distinction is explicit at the call site and must not be inferred from SQL text, AST shape, result generics, or `SqlQueryPlan` versus `SqlExecutionPlan` (which only records lowering state). Both `query` and `execute` are present on every `RuntimeScope` implementation (runtime, transaction context, supabase, mongo — a scope missing either is a compile error, not a silent hole). Route the two terminals in `collection.ts` through `execute`; update the intercept-result contract. Tests: statement count observed through middleware, and an interleaved-write integration test proving the number came from the write rather than a prior read. Do not add `executePrepared` until a prepared statistics caller exists. Deliberately out of scope: `createAndCount`, and the streaming `RETURNING` terminals.

### Parallel group A (independent of the stack)

- **Slice `count-semantics`** — Linear: [TML-3169](https://linear.app/prisma-company/issue/TML-3169)
  - **Outcome:** ADR 210 describes the two-method driver surface, and each target's definition of "affected" is documented where a user of that target will find it — Postgres's matched-rows command tag, SQLite's `sqlite3_changes64()`, Mongo's `modifiedCount`.
  - **Builds on:** None. Every decision it records was settled in the spec; it does not need either code slice to have landed.
  - **Hands to:** The project-DoD's ADR and documentation conditions, and the vocabulary the other two slices' PR descriptions use.
  - **Focus:** An **amendment** to [ADR 210](../../docs/architecture%20docs/adrs/ADR%20210%20-%20Prepared%20Statements%20-%20Author%20Surface%20and%20Driver%20SPI.md) — not a new ADR — restating its unchanged principles (opaque slot, lazy synchronous allocation, driver may ignore the slot, `preparedStatements: false` leaves it unset) over the two-method surface; per-target semantics documentation; [`scorecard/06-sql-orm-client.md`](../../scorecard/06-sql-orm-client.md) and [`scorecard/07-mongodb-query-and-orm.md`](../../scorecard/07-mongodb-query-and-orm.md). No code — the `DRIVER.PREPARE_FAILED` conformance fix lives in slice 1 with the driver. **Added 2026-08-05:** the amendment must also correct ADR 210 § Stale-handle retry, which names `ADAPTER.PREPARE_FAILED` — a namespace [ADR 239](../../docs/architecture%20docs/adrs/ADR%20239%20-%20Errors%20are%20structural%20envelopes%20with%20dotted%20namespace%20codes.md) abolished when it superseded ADR 027. Slice 1 ships `DRIVER.PREPARE_FAILED`; this slice makes the ADR say so.

## Dependencies (external)

- [x] **Linear sync** — done. This project rides the existing [Prisma 8 RC1](https://linear.app/prisma-company/project/prisma-8-rc1-7592265f700c) Linear Project rather than getting one of its own, matching the codec-json-projections precedent (TML-3060 with its slice stack beneath it). Parent [TML-3166](https://linear.app/prisma-company/issue/TML-3166) with one sub-issue per slice, so the GitHub integration's auto-close fires per-slice instead of on the whole project — the reopen churn [`drive/project/README.md`](../../drive/project/README.md) § Linear conventions warns about. Working branch per slice follows `tml-XXXX-<slug>`.
- [ ] **Workspace install** — this worktree has no `node_modules`, so no validation gate has been run and Drive trace emission is blocked. `pnpm install` before the first dispatch.

## Sequencing rationale

**Why `query-execute-split` ships on its own**, despite slice-INVEST's warning against slices whose value is "preparation for the next one" ([`drive/calibration/sizing.md`](../../drive/calibration/sizing.md) § Slice INVEST). Folding it into slice 2 would produce one PR spanning a breaking driver SPI change, a prepared/unprepared collapse across both drivers and ~15 fakes, a runtime de-duplication, the ORM terminals and their tests — which trips the explicit mis-sizing signal *"a slice that needs the reviewer to read three unrelated areas of the codebase to verify."* It also carries value of its own beyond enabling slice 2: the driver surface halves, and SQLite's twice-written method bodies and the runtime's two near-identical generators go away. Shipping it alone satisfies the spec's transitional-shape constraint directly — the pre-`SELECT` stays until the drivers report, so slice 1 merges with observable behaviour unchanged.

**Why slice 1 isn't split further, despite its footprint.** It is one atomic compile unit: the moment `SqlQueryable` changes shape, both drivers, the runtime's two generators, and all 18 test fakes stop compiling. There is no ordering of those pieces that leaves a green `main` in between, so any attempt to split produces slices that cannot merge independently — a direct *Independent* failure. Its size is footprint, not incoherence: one interface change with its conforming implementations is the repo's clean **hard-cut migration of one substrate concept** shape, and the calibration is explicit that "a 2000-LoC mechanical migration with one outcome passes" *Small* while a small PR spanning three unrelated ideas does not.

The one item that is genuinely a second outcome is the `ADAPTER.PREPARE_FAILED` conformance fix. It stays in slice 1 because it corrects the very code being rewritten and the ADR being amended, but it should be its own dispatch with its own brief rather than riding inside the SPI change's diff — the calibration's stated remedy for "while I'm in there" work. Deciding that is `drive-plan-slice`'s call at pickup.

**Why `count-semantics` is parallel rather than stacked last.** It records decisions, not behaviour: the semantics are settled in the spec, so the ADR and the per-target documentation can be written and merged at any point without waiting for either code slice. Keeping it out of the stack also gets the ADR in front of a reviewer early, while the design rationale is still live — the repo's project-shape pattern explicitly allows for *"a parallelisable docs/ADR slice."*
