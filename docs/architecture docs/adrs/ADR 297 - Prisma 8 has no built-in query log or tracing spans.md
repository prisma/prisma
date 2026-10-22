# ADR 297 — Prisma 8 has no built-in query log or tracing spans

**Status:** Proposed
**Date:** 2026-10-22
**Builds on:** [ADR 271 — The runtime middleware observes a tree of activities, each started, ended and finalized](ADR%20271%20-%20The%20runtime%20middleware%20observes%20a%20tree%20of%20activities,%20each%20started,%20ended%20and%20finalized.md)

---

## Decision

Not in 8.0. The runtime exposes one middleware interface that observes every activity, and logging and tracing are written on it. Use instead: a small middleware on the lifecycle events. [ADR 271](ADR%20271%20-%20The%20runtime%20middleware%20observes%20a%20tree%20of%20activities,%20each%20started,%20ended%20and%20finalized.md) shows a tracer that opens a span per activity and nests it under its parent.

## Context

Users ask to turn on a built-in query log, or to get OpenTelemetry spans out of the box, without writing middleware ([scoreboard](../../../scorecard/19-observability-and-lifecycle.md), `prisma-8` skill: [runtime.md](../../../skills/prisma-8/references/runtime.md), [debug.md](../../../skills/prisma-8/references/debug.md)). [ADR 291](ADR%20291%20-%20Prisma%208%20has%20no%20%24on%20events.md) covers `$on` events, which a maintainer has ruled out; this ADR covers the built-in log and spans, which no maintainer has answered yet.

## Consequences

No revisit-if condition is recorded. The issues filed through the skill's feedback flow are the evidence a maintainer weighs when scheduling it.
