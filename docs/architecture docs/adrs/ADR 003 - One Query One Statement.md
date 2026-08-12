# ADR 003 — One Query → One Statement

## Context

- Prisma 7 often mapped a single high-level call to multiple database round-trips
  - Examples include relation loading, pagination with count, and follow-up reads for computed results
- Hidden multi-statement behavior makes performance unpredictable, complicates guardrails, and is hard for agents to reason about
- Our runtime plugins, budgets, and preflight checks work best when a query has a single, verifiable statement boundary
- Postgres and other SQL engines already support powerful single-statement composition via joins, CTEs, lateral subqueries, and JSON aggregation

## Decision

- A Plan produced by the query lanes (DSL or TypedSQL) must compile to exactly one database statement
  - No hidden follow-up reads or writes
- Higher-level conveniences must lower to one statement or be expressed as explicit multi-statement workflows outside the query lane
- The runtime will treat one Plan as one parse/bind/execute cycle and apply guardrails, verification, and budgets to that single statement
- Any multi-statement behavior must use explicit orchestration APIs (e.g., transactions or pipelines) and will be subject to a separate policy surface

## Details

### What counts as "one statement"

- Exactly one server-side statement as understood by the target protocol
  - For Postgres this is a single PREPAREd text/binary statement executed once
- A statement may include CTEs, lateral joins, window functions, JSON aggregation, or RETURNING clauses
  - These are still one statement
- Anonymous `DO $$ ... $$` blocks or stored procedures are considered one statement, but their use is a TypedSQL-only escape hatch and subject to stricter policies and preflight scrutiny

### Allowed lowerings in the DSL

- Relation traversal must compile to one statement
  - e.g., 1:N includes via LEFT JOIN LATERAL + json_agg (see `includeMany` in SQL DSL), N:1 via LEFT JOIN with aliased projection
- Derived projections must be computed in the statement
  - e.g., SELECT …, count(*) OVER (…) AS total_count

### What is not allowed inside a single Plan

- Implicit secondary reads (e.g., fetch ids then fetch related rows)
- Client-side filtering, paging, sorting after a broad read
- Multi-step upserts or read-then-write sequences

### Expressing multi-statement workflows

- Use explicit orchestration APIs such as `beginTransaction` or `runPipeline([Plan, Plan, …])`
- Each step is a Plan with its own verification and guardrails
- Policies can require a transaction for certain multi-Plan patterns

## Why this matters

- **Deterministic verification**: Guardrails, EXPLAIN budgets, and plan hashing are meaningful at a single statement boundary
- **Predictable performance**: No surprise N+1 or hidden fan-out
- **Agent ergonomics**: The system returns a single diagnostic per query and actionable hints to fix it

## Alternatives considered

- **Allow hidden multi-query expansions inside the DSL**: More ergonomic for some patterns, but breaks verification and performance predictability
- **Auto-batching and transparent data loaders**: Helpful for specific cases but re-introduces non-determinism and complicates budgets and lints
- **Force everything into stored procedures**: Uniform statement boundary but poor portability and harder local reasoning

## Consequences

### Positive

- Strong alignment with verification, guardrails, and CI preflight
- Easier to reason about performance and capacity
- Clear, teachable mental model for users and agents

### Trade-offs

- Some high-level patterns become compiler work or explicit orchestration
- A few workloads may prefer server-side procedures, which we support via TypedSQL with stricter policies
- Migration from patterns that previously relied on client-side stitching requires rewrites or ORM-layer lowerings

## Scope and non-goals

### In scope for MVP

- Enforce one Plan → one statement in the DSL and TypedSQL lanes
- Provide transaction and pipeline APIs for explicit multi-statement workflows
- Preflight and budgets operate at the statement boundary

### Out of scope for MVP

- Automatic batching or N+1 elimination inside the DSL
- Global query planners that split or merge statements behind the scenes

## Backwards compatibility and migration

- For Prisma 7 codebases that relied on multi-query relation loading, provide an ORM extension that lowers includes to single statements where feasible
- Where not feasible, offer recipes to move to explicit transaction pipelines or to server-side routines via TypedSQL
- Document common rewrites with examples and performance guidance

## Open questions

- Minimum ORM lowering surface to cover common relation includes without regressions
- Policy defaults for allowing DO blocks or stored procedures in production
- How to report composite diagnostics for multi-Plan pipelines in a developer-friendly way

## Decision record

- Adopt a strict one query → one statement rule for all query Plans
- Provide explicit orchestration for multi-statement workflows and keep them under separate policies and budgets
- Favor compiler lowerings and SQL features to preserve ergonomics without sacrificing determinism and safety
