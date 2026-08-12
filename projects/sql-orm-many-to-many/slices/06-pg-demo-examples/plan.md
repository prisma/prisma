# Slice 6: PG demo M:N examples + dual-mode — Dispatch plan (provisional)

**Spec:** `projects/sql-orm-many-to-many/slices/06-pg-demo-examples/spec.md`
**Linear:** [TML-2795](https://linear.app/prisma-company/issue/TML-2795)

> **Provisional** — half B depends on slice 5 (PSL M:N authoring); the dual-mode-reconciliation approach (half A) is an open decision. Firm up at pickup.

### Dispatch 1: dual-mode reconciliation (independent — can run before slice 5)

- **Outcome:** `pnpm test:dual-mode` is green — either both PSL and TS emit legs pass, or the TS contract source is removed and the demo is cleanly PSL-only (per Open Question 1).
- **Builds on:** nothing in this project (it's a pre-existing demo bug).
- **Hands to:** a demo whose contract source(s) are consistent — a clean base for the M:N example additions.
- **Focus:** `examples/prisma-8-demo` dual-mode setup (`prisma-next.config.ts*`, `prisma/contract.ts`, `src/prisma/contract.prisma`, the `emit:psl`/`emit:ts`/`test:dual-mode` scripts).

### Dispatch 2: PG demo M:N examples (blocked by slice 5)

- **Outcome:** the PG demo demonstrates the M:N API — `Post ↔ Tag` M:N in the PSL source, with include / `some`/`none`/`every` filter / nested `connect`/`disconnect`/`create` ORM modules + CLI commands + seed + integration tests (per the project's integration-test standard), mirroring slice 4.
- **Builds on:** slice 5 (PSL authors M:N → the PSL source can express it) + dispatch 1 (consistent contract source) + slice 4 (the example shape).
- **Hands to:** M:N demonstrated in both demos.
- **Focus:** PSL `Post ↔ Tag` M:N + re-emit; ORM modules mirroring slice 4's; CLI/seed/tests; regenerate migration refs per the demo's current `fixtures/` convention.

## Handoff completeness

Slice-DoD reachable: `test:dual-mode` green (D1) · PG M:N examples per standard (D2). D1 is independent (start anytime); D2 waits on slice 5.
