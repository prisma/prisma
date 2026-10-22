# 0020 — No built-in query log or tracing spans

> Draft — unconfirmed. No maintainer has accepted this record yet, so it does not count as a decision.

**Status:** `proposed`. Intended status: `not-yet`.

## The request

Turn on a built-in query log, or get OpenTelemetry spans out of the box, without writing middleware.

## The decision

Not in 8.0. The runtime exposes one middleware interface that observes every activity, and logging and tracing are written on it. Record [0013](./0013-no-on-events.md) covers `$on` events, which a maintainer has ruled out; this record covers the built-in log and spans, which no maintainer has answered yet.

## What to use instead

A small middleware on the lifecycle events. ADR 271 shows a tracer that opens a span per activity and nests it under its parent.

## Revisit if

Not recorded. The skill reference sends users who need this to file an issue through its feedback flow, so those issues are the evidence a maintainer weighs when scheduling it.

## Sources

- [scorecard: observability and lifecycle](../../../scorecard/19-observability-and-lifecycle.md)
- [ADR 271](../../architecture%20docs/adrs/ADR%20271%20-%20The%20runtime%20middleware%20observes%20a%20tree%20of%20activities,%20each%20started,%20ended%20and%20finalized.md)
- [`prisma-8` skill, runtime.md](../../../skills/prisma-8/references/runtime.md)
- [`prisma-8` skill, debug.md](../../../skills/prisma-8/references/debug.md)
