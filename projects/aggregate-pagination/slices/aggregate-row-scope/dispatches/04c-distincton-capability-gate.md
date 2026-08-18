# Brief: D4c — `distinctOn` capability gate in the ORM lane

_Inserted by operator decision on 2026-08-18. The operator chose full type-and-runtime parity with the sql-builder lane over a runtime-only gate. See the slice spec § Scope and the slice plan § Dispatch 4c._

## Task

`postgres.distinctOn` is an adapter-reported capability. The **sql-builder** lane enforces it at two levels; the **ORM** lane has never consulted it. So on SQLite, `.distinctOn('title')` type-checks, records into state unchecked, survives plan-build, and the renderer drops the clause on the floor (`sqlite/src/core/adapter.ts:236` reads only `ast.distinct`; `ast.distinctOn` appears nowhere in that file). The user gets undeduped rows and no signal — a confident wrong answer, which is the failure this whole project exists to eliminate.

Close it at both levels, mirroring the lane that already does it right:

| Level | Mirror this |
| --- | --- |
| Type | `distinctOn: GatedMethod<…, { postgres: { distinctOn: true } }, …>` — `sql-builder/src/types/select-query.ts:66-68`, `types/grouped-query.ts:70-72` |
| Runtime | `distinctOn = this._gate({ postgres: { distinctOn: true } }, 'distinctOn', …)` — `sql-builder/src/runtime/query-impl.ts:67-69` |
| Proof shape | `test/e2e/framework/test/sqlite/sql-builder.test.ts:345-352` — asserts **both**, `@ts-expect-error` for the type gate and `.toThrow('distinctOn() requires capability postgres.distinctOn')` for the runtime gate |

**Both terminals.** The gap is one ungated method, not one code path: `.distinctOn(...).all()` is affected identically and has been since before this slice. Gate the method, and both terminals close.

## The trap — read this before writing the check

**The docs name a key that does not exist.** `docs/architecture docs/subsystems/3. Query Lanes.md:452` says `.distinctOn()` requires `projection.distinctOn`, and ADR 065 lists canonical keys `projection.distinct` / `projection.distinctOn`. The key actually emitted and enforced is **`postgres.distinctOn`**. Gating on the documented key would check something never present and reject on every target, including Postgres.

Fix that doc line as part of this dispatch — a doc that would mislead the next implementer into shipping a universal rejection is worth the two-line correction while you are here.

## Reuse, don't invent

- `hasContractCapability(contract, 'distinctOn')` (`collection-contract.ts:592`) **already resolves correctly against both contracts unmodified** — it falls back to scanning per-target buckets, returning `true` for `postgres.distinctOn` and `false` for the SQLite contract. Do not add a parallel helper.
- Mirror `assertReturningCapability` (`collection-contract.ts:582`) for the runtime assertion, reusing the existing **`ORM.CAPABILITY_MISSING`** subcode. The project DoD says "No new ORM error subcode was added" — reuse satisfies it; a new subcode would break it.

## Scope

**In:** `src/collection.ts` (the `distinctOn` signature and body), `src/collection-contract.ts` (the assertion helper), tests at both levels, and the one incorrect doc line.

**Out:** `distinct()` — it lowers to the portable `ROW_NUMBER` dedup and needs no capability. The renderer. `compileGroupedAggregate`. Anything about the Postgres `DISTINCT ON` / `ORDER BY` prefix rule, which is a different pre-existing problem.

## Completed when

- [ ] `.distinctOn(...)` on a contract without `postgres.distinctOn` is a **compile error** and, if reached dynamically, a **runtime error** carrying `ORM.CAPABILITY_MISSING`.
- [ ] Both levels are asserted by tests, following the sql-builder proof shape (`@ts-expect-error` plus `.toThrow(...)`).
- [ ] Postgres-target chains are unaffected — `.distinctOn(...)` still compiles and still emits what it emits today.
- [ ] The `projection.distinctOn` doc line names `postgres.distinctOn`.
- [ ] **Baseline snapshot byte-unchanged.**
- [ ] Gates green, plus `pnpm typecheck` at the **workspace** level, not only the package — see below.

## Validation gates

- `cd packages/3-extensions/sql-orm-client && pnpm typecheck`
- **`pnpm typecheck` (workspace-wide)** — this dispatch newly makes a compile error out of code calling `distinctOn` on a non-Postgres target. That is the point, but it means the blast radius may extend past this package into `examples/`, `test/`, or sibling packages.
- `pnpm --filter @internal/sql-orm-client test`
- `pnpm --filter @internal/sql-orm-client lint`
- `pnpm fixtures:check`

## Standing instruction

Stay focused on the goal; control scope. Anything that pulls you off the goal halts and surfaces.

## Halt conditions

- **Workspace typecheck reveals existing callers on non-Postgres targets.** Expected-possible: such code is already silently broken. Do **not** mass-edit call sites to make the gate pass. Report what broke and where; whether to fix, migrate, or narrow the gate is the operator's call.
- The type gate cannot be expressed without changing `Collection`'s public generic shape in a way that ripples through unrelated methods. Halt — a typed-surface change that wide is its own slice.
- `hasContractCapability` turns out **not** to resolve as described. That would falsify the premise this dispatch was authorised on; halt and report rather than working around it.
- 90 minutes.

## House rules that apply

- No `any`; no bare `as` in production code. `@ts-expect-error` is permitted **only** in negative type tests — which is exactly what the type-gate test is.
- `.agents/rules/capabilities-ownership.mdc` — capabilities are adapter-reported; contracts declare requirements.
- `.agents/rules/omit-should-in-tests.mdc`, `.agents/rules/no-transient-project-ids-in-code.mdc`.
- `.agents/rules/doc-maintenance.mdc` — the doc correction is in scope, not a side-quest.

## References

- Slice spec § Scope (amended 2026-08-18) — why this is in the slice and what claim of the spec's it corrects.
- The repo's own record of the gap: `scorecard/06-sql-orm-client.md:21` marks ORM `distinct`/`distinctOn` on SQLite as `🟡` — "reachable through the public surface, but no proving integration test exists yet" — against `scorecard/05-sql-query-builder.md:33`, which marks the builder's as `—` (n/a, gated). This dispatch moves the ORM row to match. Update the scorecard if this dispatch changes what it records.

## Operational metadata

- **Model tier:** mid, on the persistent implementer.
- **Time-box:** 90 minutes.
