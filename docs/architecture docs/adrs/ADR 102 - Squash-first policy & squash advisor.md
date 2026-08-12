# ADR 102 — Squash-first policy & squash advisor

## Context

Migration histories tend to accumulate branches and long paths, increasing pathfinding complexity and review burden. Our model supports baselines that collapse a set of edges into a single ∅ → H_latest edge embedding the destination contract. We want a default squash-first posture that nudges teams toward a small active migration history while keeping history auditable

## Problem

- Long migration histories hurt determinism, performance, and comprehension
- Parallel edges and orphans appear more often in large migration graphs
- Teams need a gentle, configurable way to keep migration graphs small without mandating a committed graph index

## Goals

- Encourage short active migration histories via regular baselines
- Provide clear, actionable suggestions and one-command automation
- Keep policy flexible across teams and environments
- Preserve safety and auditability

## Non-goals

- Automatic graph surgery on feature branches
- Removing historical edges from the repo
- Replacing code review of migration operations

## Decision

Adopt a squash-first default posture with a Squash Advisor implemented on the Advisors framework (ADR 101)

**Relationship to ADR 028:**
- ADR 028 defines the migration structure (file model, schemas, on-disk formats) and available operations (squash, rebase, prune)
- This ADR defines the policy layer: when, why, and how teams should use those operations
- Together, these ADRs implement graph hygiene as composable primitives (structure + policy)

### Policy defaults

- Suggest squashing when the newest edge since the last baseline is older than 14 days
- Suggest squashing when >20 edges exist since the last baseline
- Do not suggest until there are at least 5 edges since the last baseline
- Require green preflight on a shadow DB and shadow proof that applying the current migration history yields the same destination contract as the proposed baseline before suggesting automation

Teams can tune or disable these defaults

### Advisor rules

- **squash.age-window** evaluates newest migration age since last baseline and emits a warn advisory with evidence `{ lastBaselineAt, newestMigrationAt, days }`
- **squash.edges-since-baseline** evaluates migration count since last baseline and emits a warn advisory with evidence `{ count }`
- **squash.baseline-missing** warns when the repo has no baseline and more than minEdgesBeforeSuggest migrations exist

### Suggested actions

- `migrate baseline create` invokes the baseline creation mechanics defined in ADR 028. The advisor recommends when to run this command based on policy thresholds (age, edge count, etc.)
- In PPg, a "Generate baseline PR" action opens a PR with the proposed baseline and a summary of migrations to be collapsed

### Safety rules

- Baselines are for new environments only
- The runner treats a baseline migration as a no-op on databases that already have a contract marker
- CI in enforce mode can block merges when thresholds are exceeded without an accompanying baseline PR

Technical enforcement of these rules is handled in ADR 028 (contract marker checks, baseline application logic).

## Configuration

```json
{
  "advisors": {
    "mode": "suggest",
    "rules": {
      "squash.age-window": { "level": "warn", "windowDays": 14, "minEdgesBeforeSuggest": 5 },
      "squash.edges-since-baseline": { "level": "warn", "maxEdgesSinceBaseline": 20 },
      "squash.baseline-missing": { "level": "warn" }
    }
  },
  "squashPolicy": {
    "exemptLabels": ["long-lived", "regulatory"],
    "requireGreenPreflight": true,
    "requireShadowProof": true
  }
}
```

- Teams that prefer long histories can set `advisors.mode: "off"` and optionally adopt a committed graph index
- Exempt labels may suppress suggestions for specific branches or edges

## Relationship to ADR 028

- **ADR 028** defines: migration structure, file formats, and available operations (squash, rebase, prune)
- **This ADR** defines: the policy layer that recommends when and how to use those operations
- **Together**: they form a complete graph hygiene system where 028 provides mechanisms and 102 provides policy

## Consequences

### Positive

- Keeps migration graphs small and pathfinding simple without enforcing a graph index
- Makes baseline creation predictable and auditable
- Reduces CI noise and increases determinism

### Negative

- Another decision point for teams with unique compliance requirements
- Additional CLI surface and PR automation to maintain

### Mitigations

- Advisor defaults are gentle and configurable
- Baseline creation is opt-in and requires green preflight and shadow proof by default
- Archived edges remain available for audit and visualization

## Alternatives considered

- **Mandatory graph index**
- **Aggressive automatic squashing**
- **Relying solely on documentation for migration hygiene**

## Implementation notes

- Implement `migrate graph status` to compute migrationsSinceBaseline and lastBaselineAt
- Implement `migrate baseline create` to produce ∅ → H_latest with embedded destination contract
- Mark previous migrations as archived: true and exclude from pathfinding
- PPg adds a PR annotation with a button to generate a baseline PR

## Testing

- Fixtures with and without baselines, varying migration counts and ages
- Preflight gating tests to ensure we only suggest when safe
- PPg PR flow tests creating a baseline PR from advisories

## References

- ADR 101 — Advisors framework
- ADR 028 — Migration ledger & squash semantics
- ADR 039 — Migration graph path resolution & integrity
- ADR 051 — PPg preflight-as-a-service contract
