# Slice 6: PG demo M:N examples + dual-mode reconciliation

_Parent project: `projects/sql-orm-many-to-many/`. Linear: [TML-2795](https://linear.app/prisma-company/issue/TML-2795). Status: **complete** (branch `tml-2795-slice-6-pg-demo-mn-examples`, stacked on slice 5)._

## At a glance

Bring the M:N demo examples to the **PG** demo (`examples/prisma-8-demo`), mirroring the SQLite demo (slice 4), and reconcile the demo's pre-existing **dual-mode contract drift**. The PG demo emits from PSL, so its M:N examples can't exist until PSL can author M:N (slice 5).

## Chosen design

Two separable halves:

**A. Dual-mode reconciliation (independent — can start before slice 5).** The PG demo is nominally dual-mode (PSL `src/prisma/contract.prisma` + TS `prisma/contract.ts`, expected to emit identically). They're out of sync: the committed contract matches the **PSL** emit; `emit:ts` diverges (drops the discriminated `Task`/`Bug`/`Feature` hierarchy, `displayName`, typed `Address`) → `test:dual-mode` is red on the TS leg. Root cause: the **TS builder can't author the discriminator/`@@base` hierarchy**. Reconcile by one of: (i) add TS-builder discriminator/inheritance authoring (framework feature — bigger), (ii) drop the TS contract source and make the demo PSL-only, or (iii) another agreed approach. Decide at pickup.

**B. M:N examples (blocked by slice 5).** Once PSL authors M:N, add a `Post ↔ Tag` M:N relation to the PSL source (`src/prisma/contract.prisma`) + example ORM modules (include / `some`/`none`/`every` filter / nested `connect`/`disconnect`/`create` via the callback mutator) + CLI commands + seed + integration tests — mirroring slice 4's SQLite modules.

## Scope

**In:** the PG demo only — dual-mode reconciliation (A) + M:N examples on the PSL source (B); integration tests matching the demo's `test/` pattern (`withDevDatabase`).

**Out:** the PSL M:N authoring mechanism itself (slice 5); the SQLite demo (slice 4, done); TS-builder discriminator authoring if reconciliation chooses to drop the TS source instead.

## Pre-investigated edge cases

| Edge case | Disposition |
|---|---|
| Dual-mode `emit:check` only diffs the **default (PSL)** config | `test:dual-mode` (run-suite-against-each-emit) is the real dual-mode gate; reconciliation must make BOTH legs green or remove the TS leg |
| The integration-test standard (whole-row, explicit-select, ≥1 implicit) | applies to the PG M:N examples too (project cross-cutting requirement) |
| PG demo migration fixtures (reorganised on `main` under `fixtures/`) | M:N relation will add migration refs — regenerate per the demo's current convention |

## Slice-specific done conditions

- [x] Dual-mode reconciliation **deferred, not done in this slice**. The PSL-only arm was attempted (TS contract source + no-emit workflow removed) and then reverted: the no-emit workflow and `test:dual-mode` are kept as-is on `main`, so no demonstration is lost. `test:dual-mode` stays red on the TS leg, which is tolerable because CI does not run it (CI runs `typecheck:examples` / `lint:examples` / `test:examples` only, all green). Real parity is tracked by **TML-2938** (bring the TS leg to parity, green the dual-mode test), blocked by **TML-2228** (TS authoring DSL polymorphism support — the discriminated `Task`/`Bug`/`Feature` hierarchy can't be authored in TS until that lands).
- [x] PG demo demonstrates the M:N API — all nine surfaces mirroring slice 4 — via `repo-*` CLI commands, seeded, with integration tests per the standard.

## Open Questions

1. **Dual-mode reconciliation approach** — resolved: neither arm is taken in this slice. The no-emit / dual-mode surface is left exactly as `main` had it (additive M:N only), and parity is deferred to TML-2938 (blocked by TML-2228). Approach (i) — add TS-builder discriminator authoring — is the path TML-2938 will take once TML-2228 unblocks it.

## References

- Parent: `projects/sql-orm-many-to-many/spec.md` (§ Follow-on scope, § Cross-cutting integration-test standard). Slice 4 (`TML-2790`) is the example shape to mirror; slice 5 (`TML-2794`) is the blocker for half B.
