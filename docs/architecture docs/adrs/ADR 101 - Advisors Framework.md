# ADR 101 — Advisors framework


## Context

We added a "squash advisor" concept to nudge teams toward keeping a small active migration graph. The same pattern appears in other areas like graph hygiene, preflight effectiveness, and drift hygiene. Rather than hard-coding warnings in individual commands, we want a thin, reusable Advisors framework that evaluates project state and emits actionable, low-noise suggestions

## Problem

- Hygiene and safety guidance is scattered across commands and hard to tune
- CI and PPg need consistent, machine-readable diagnostics with suggested actions
- Teams have different appetites for advisory strictness and noise
- We need a place for future hygiene checks without bloating lints or runtime hooks

## Goals

- Provide a tiny, uniform API for computing advisories from project state
- Make advisors configurable with consistent severity and on/off controls
- Keep advisors non-blocking by default, with an enforce mode available
- Reuse the same diagnostics payloads across CLI, CI, and PPg
- Keep runtime perf impact negligible

## Non-goals

- Per-Plan linting or policy enforcement (covered by ADR 022)
- Heavy analyzers requiring full SQL parsing or deep DB introspection
- Replacing human review with automated graph surgery

## Decision

Introduce a lane-neutral Advisors framework

### Advisory shape

```typescript
type AdvisorySeverity = 'info' | 'warn' | 'error'

interface Advisory {
  id: string                                // e.g. 'squash.age-window', 'graph.orphans-present'
  severity: AdvisorySeverity
  summary: string                           // one-line human hint
  evidence: Record<string, unknown>         // small JSON: counts, hashes, dates
  suggestedActions: Array<{
    title: string                           // e.g. 'Create baseline'
    command?: string                        // CLI one-liner
    link?: string                           // docs or PPg action URL
  }>
  fingerprint: string                       // stable hash of inputs for dedupe in CI
}
```

### Advisor interface

```typescript
interface AdvisorContext {
  coreHash?: string
  contract?: object                         // optional JSON contract
  graph?: MigrationGraphSummary             // reconstructed or from index
  ledger?: MigrationLedgerSummary
  preflight?: PreflightSummary              // cached rollup, not raw artifacts
  config: AdvisorsConfig
  clock: () => Date
}

type Advisor = (ctx: AdvisorContext) => Promise<Advisory[]>
```

### Configuration

```json
{
  "advisors": {
    "mode": "suggest",                        // off | suggest | enforce
    "rules": {
      "squash.age-window": { "level": "warn", "windowDays": 14, "minEdgesBeforeSuggest": 5 },
      "squash.edges-since-baseline": { "level": "warn", "maxEdgesSinceBaseline": 20 },
      "graph.orphans-present": { "level": "warn" },
      "graph.parallel-edges": { "level": "error", "exemptLabels": ["parallel-ok"] }
    }
  }
}
```

- **mode**: off disables all advisors
- **mode**: suggest prints hints and surfaces CI annotations
- **mode**: enforce fails CI when any advisory at level error is emitted

## Where advisors run

- `migrate graph status`
- `migrate plan` and `migrate apply --dry-run`
- Preflight in CI and PPg

## Surfacing and UX

- CLI prints a compact advisors section with exact commands
- CI and PPg emit annotations using the advisory payload, de-duplicated by fingerprint
- A snooze mechanism may suppress repeats by advisory id and commit SHA

## Scope and performance guardrails

- Advisors must run in O(V+E) over the active migration graph and use summaries for preflight
- No heavy SQL parsing, DB sampling, or network calls beyond local context
- Advisors produce small JSON payloads and avoid logging raw params or PII

## Consequences

### Positive

- Centralized, consistent hygiene guidance across CLI, CI, and PPg
- Configurable noise level and strictness
- Easy to add new checks without entangling core logic

### Negative

- Another configuration surface to document and support
- Potential to drift into policy enforcement if not kept thin

### Mitigations

- Keep default mode at suggest
- Require a brief spec per advisor id and track usefulness via telemetry
- De-duplication via fingerprint to avoid noisy PRs

## Alternatives considered

- **Hard-coded warnings in each command**
- **Folding checks into lints or budgets**
- **Relying solely on documentation**

## Implementation notes

- Introduce @prisma/advisors with registry, types, and minimal runner
- Wire into CLI status, plan, and apply flows
- Emit advisories in diagnostics format per ADR 047
- PPg surfaces advisories as PR annotations with optional server-side actions

## Testing

- Unit tests per advisor with fixed fixtures
- End-to-end tests verifying CLI and CI outputs and enforce mode behavior
- Telemetry checks for advisory frequency and action uptake

## References

- ADR 022 — Lint rule taxonomy & configuration model
- ADR 047 — Diagnostics artifacts & formats
- ADR 051 — PPg preflight-as-a-service contract
- ADR 028 — Migration structure & operations
- ADR 039 — Migration graph path resolution & integrity

