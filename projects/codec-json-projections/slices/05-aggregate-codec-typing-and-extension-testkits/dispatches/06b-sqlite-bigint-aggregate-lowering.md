# Brief: D6b — SQLite bigint aggregate lowering

## Task

Make top-level SQLite aggregates whose output codec is `sqlite/bigint@1` readable past 2^53. Today the driver's statement iteration (`packages/3-targets/7-drivers/sqlite/src/sqlite-driver.ts:76`, `stmt.iterate()` without big-integer reads) throws `RangeError` on a wide INTEGER before any codec runs; the D6 R2 probe proved `CAST(sum(c) AS TEXT)` round-trips exactly. The SQLite aggregate descriptors whose declared output is `sqlite/bigint@1` (count; integer sum; min/max where they resolve to bigint) gain the `lower` hook — carried by the protocol since D2, unused by any built-in until now — rendering the cast, so the wire form matches the codec's expected text. The previously-impossible read is pinned: a top-level `sum` over `sqlite/bigint` past 2^53 asserting the exact bigint. The sqlite aggregate conformance suite covers the lowered form; any moved rendered-SQL snapshots are classified mechanical.

## Scope

**In:** `packages/3-targets/3-targets/sqlite/src/core/aggregates.ts` (the hooks); the sqlite testkit's aggregate conformance suite; the integration test pinning the top-level read; snapshot moves.

**Out:** the driver (`setReadBigInts` rejected on blast radius — decision record `wip/unattended-decisions.md` entry 2); PostgreSQL (needs no lowering, D3 proved); the lane (D7); ORM surfaces (D6, closed).

## Completed when

- [ ] A top-level SQLite `sum` over `sqlite/bigint@1` past 2^53 returns the exact bigint through the ORM path (the read D6 R2 proved impossible), pinned by an integration test.
- [ ] The lowering cannot select a different output codec than declared (the D2 invariant) — the conformance suite exercises the lowered SQL against the live database.
- [ ] Validation gates green; every moved snapshot classified.

## Standing instruction

Stay focused on the goal; control scope. Trivial-and-related fixes that obviously serve the goal go in the same dispatch with a one-line note. Anything that pulls you off the goal halts and surfaces.

## References

- Plan § Dispatch 6b; `wip/unattended-decisions.md` entry 2; your own D6 R2 probe table.
- D2's lowering vocabulary (`SqlAggregateLowering` in `relational-core/src/aggregate-descriptor.ts` — the hook signature returns `AnyExpression`, no codec channel).
- D4's matrix and conformance suite (the surface being extended).

## Operational metadata

- **Model tier:** `orchestrator` (continuity — the same implementer holds every relevant context).
- **Time-box:** 90 minutes. Overrun → halt and surface.
- **Halt conditions:** the lowering hook cannot express the cast through existing AST vocabulary; the lowered form breaks any non-bigint aggregate path; any driver change needed after all.

## Validation gates

```bash
pnpm build
pnpm typecheck
pnpm lint:deps
pnpm lint --filter <touched>
pnpm test --filter <touched> --filter @internal/integration-tests
pnpm fixtures:check   # no-op
```

Foreground only; long output saved once under `wip/`; environment-blocked classification per the D1 precedent.
