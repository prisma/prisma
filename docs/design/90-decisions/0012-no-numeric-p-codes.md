# 0012 — No numeric `P` error codes

> Draft — unconfirmed. No maintainer has accepted this record yet, so it does not count as a decision.

**Status:** `proposed`. Intended status: `never`.

## The request

Return Prisma 7's numeric error codes, such as `P2002` for a unique violation or `P2025` for a missing record.

## The decision

Errors are structured envelopes with dotted `NAMESPACE.SUBCODE` codes, plus `why` and `nextActions` fields that say what to do. ADR 239 rejected keeping numeric codes: "dotted names are self-describing; numeric codes force a lookup table to read any log line". The scorecard lists the `P` code taxonomy as not in 8.0.

## What to use instead

Branch on the envelope's `code`. Every published code is in the [error reference](../../reference/error-reference.md).

## Revisit if

The ADR records no condition.

## Sources

- [ADR 239](../../architecture%20docs/adrs/ADR%20239%20-%20Errors%20are%20structural%20envelopes%20with%20dotted%20namespace%20codes.md)
- [scorecard: observability, `P` codes](../../../scorecard/19-observability-and-lifecycle.md)
