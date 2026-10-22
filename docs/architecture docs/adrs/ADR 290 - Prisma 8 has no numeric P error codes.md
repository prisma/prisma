# ADR 290 — Prisma 8 has no numeric `P` error codes

**Status:** Proposed
**Date:** 2026-10-22
**Builds on:** [ADR 239 — Errors are structural envelopes with dotted namespace codes](ADR%20239%20-%20Errors%20are%20structural%20envelopes%20with%20dotted%20namespace%20codes.md)

---

## Decision

Errors are structured envelopes with dotted `NAMESPACE.SUBCODE` codes, plus `why` and `nextActions` fields that say what to do. Use instead: branch on the envelope's `code`. Every published code is in the [error reference](../../reference/error-reference.md).

## Context

Users ask for Prisma 7's numeric codes, such as `P2002` for a unique violation or `P2025` for a missing record. [ADR 239](ADR%20239%20-%20Errors%20are%20structural%20envelopes%20with%20dotted%20namespace%20codes.md) rejected keeping numeric codes: "dotted names are self-describing; numeric codes force a lookup table to read any log line". The [scoreboard](../../../scorecard/19-observability-and-lifecycle.md) lists the `P` code taxonomy as not in 8.0.

## Consequences

Code that branched on Prisma 7 codes branches on dotted codes. [ADR 239](ADR%20239%20-%20Errors%20are%20structural%20envelopes%20with%20dotted%20namespace%20codes.md) records no revisit-if condition.
