# 0013 — No `$on` events

**Status:** `never`
**Decided by:** Will Madden, 2026-10-22

## The request

Subscribe to client events with `$on('query')`, `$on('info')`, `$on('warn')` or `$on('error')`, as Prisma 7 allows.

## The decision

Never. Will Madden: "middleware already covers this." The runtime exposes one middleware interface that observes every activity, so a second event API in the core would duplicate it. This rests on the rule that the core does not build a feature that can be built as an extension or in user space ([project intent](../00-purpose/project-intent.md#what-it-deliberately-does-not-do)).

## What to use instead

A small middleware on the lifecycle events. It sees each activity start, and end with its outcome: succeeded, failed or stopped (ADR 271).

## Sources

- [project intent, what it deliberately does not do](../00-purpose/project-intent.md#what-it-deliberately-does-not-do)
- [scorecard: observability and lifecycle](../../../scorecard/19-observability-and-lifecycle.md)
- [ADR 271](../../architecture%20docs/adrs/ADR%20271%20-%20The%20runtime%20middleware%20observes%20a%20tree%20of%20activities,%20each%20started,%20ended%20and%20finalized.md)
- [`prisma-8` skill, runtime.md](../../../skills/prisma-8/references/runtime.md)
