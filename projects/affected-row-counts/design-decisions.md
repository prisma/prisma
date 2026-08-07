# Design decisions

## 1. Replace operation-discriminated middleware with operation-specific hooks

**Trigger:** Operator-flagged falsified assumption during Slice 2 review on 2026-08-07.

**What we learned:** The agent-authored Slice 2 specification treated an operation-discriminated middleware contract as settled even though the operator had approved only the runtime `query` / statistics `execute` split. The agent selected a public cross-family SPI shape without escalation, wrote that assumption into the spec and plan, and then delegated implementation and review against its own decision.

**Decision:** Replace the single operation-discriminated middleware lifecycle with symmetric operation-specific hooks:

- Query: `beforeQuery` → `interceptQuery` → driver query → `onRow` → `afterQuery`.
- Execute: `beforeExecute` → `interceptExecute` → driver execute → `afterExecute`.
- SQL `beforeCompile` remains shared.
- `QueryInterceptResult` retains the pre-PR `{ rows }` shape.
- `ExecuteInterceptResult` is `{ stats: RuntimeStatementStats }`.
- `afterQuery` retains the pre-PR row completion shape and behavior.
- `afterExecute` reports statistics on success and no statistics on failure.
- Both paths preserve the pre-PR ordering, first-interceptor-wins behavior, driver bypass, completion notification, source reporting, and failure-path error precedence.
- Hook selection carries the operation distinction; middleware context and results carry no operation discriminator.
- The migration is a compatibility-free hard cut with no aliases or generic fallback hooks.

**Why:** Operation-specific names and result types make the two capabilities explicit and prevent wrong-result combinations by construction. They avoid forcing every middleware through an unrelated union, preserve the existing query interception shape, and extend the pre-PR lifecycle symmetrically to statistics execution.

**Assumptions:** Query and execute remain caller-selected semantic operations; `queryPrepared` uses the query lifecycle; `onRow` has no execute analogue; middleware may legitimately synthesize execute statistics; middleware that applies to both operations can share a private implementation while registering both hooks.

**Alternatives rejected:**

- A single `intercept` and `afterExecute` with operation-discriminated context and result unions: rejected because it spreads one interception ambiguity across the entire middleware SPI.
- Query-only interception: rejected because execute interception is a legitimate capability for mocks, policy enforcement, retries, circuit breakers, and middleware-backed execution.
- Compatibility aliases or generic fallback hooks: rejected because they make hook selection ambiguous and retain the terminology problem.

**Affected artifacts:** `projects/affected-row-counts/spec.md`, `projects/affected-row-counts/slices/count-terminals/spec.md`, `projects/affected-row-counts/slices/count-terminals/plan.md`, framework runtime and middleware implementation/tests, SQL and Mongo runtime wiring, cache middleware, integration middleware fixtures, and downstream upgrade instructions.
