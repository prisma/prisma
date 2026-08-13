# Retrospectives

## 2026-08-12 — Confirm public API designs before dispatch

**Trigger:** Mandatory final project retro per invariant I10.

**What happened:** The project successfully replaced pre-read count inference with database-reported affected-row statistics, but Slice 2 initially implemented an operation-discriminated middleware SPI that the operator had not approved. That design was reverted and replaced with the approved operation-specific query and execute hooks, adding avoidable implementation and review rounds.

**Root cause:** The dispatch Definition of Ready treated an agent-authored specification as evidence that a public cross-family API shape was settled. No gate required the brief to identify who approved the exact shape or to route an unsettled design through discussion before implementation.

**What worked well:** Explicit query-versus-execute semantics, tests that proved the count came from the write, focused reviewer rounds, exact-lease rebases, and CI ownership caught integration, packaging, and shared-worker failures before merge. The durable ADR, subsystem, upgrade, error-reference, and scorecard updates now describe the shipped shape.

**Landing surface(s):**

- Project-context: `drive/calibration/dor.md` § Dispatch-DoR overlay — public or cross-family API changes must name the approving design owner and durable decision record; an agent-authored spec alone is insufficient evidence of approval.
- ADR: `docs/architecture docs/adrs/ADR 215 - Runtime middleware lifecycle beforeExecute before encodeParams.md` — records the operation-specific middleware lifecycle that ultimately shipped.

**Deferred work:** None. The documentation-only `count-semantics` work planned under TML-3169 was completed during close-out rather than requiring another implementation slice.

**Team summary:** Affected-row counts now come from the write itself, and future public API dispatches must carry explicit design-owner approval before implementation starts.
