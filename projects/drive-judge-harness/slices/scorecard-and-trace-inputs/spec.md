# Slice: scorecard-and-trace-inputs

_(In-project slice. Parent project `projects/drive-judge-harness/`. Outcome this slice contributes: the diagnostics report stops letting all-green metrics imply "good", and the trace vocabulary gains the two inputs the scorecard needs — a token-usage signal and an external-correctness feed.)_

## At a glance

The `drive-diagnose-run` report currently prints a static "Not computable" verdict and a disaggregated metrics dump; nothing in the report binds correctness to efficiency, and the token row claims "not instrumented". This slice makes the report headline a **two-tier scorecard** — Tier 1 is a binary correctness gate sourced from outside the run; Tier 2 (efficiency) renders only over runs that passed Tier 1 — and adds two new trace events (`tokens-recorded`, `correctness-recorded`) so the scorecard has real inputs to read. The judge that *fills* the correctness feed is a later slice; this slice builds only the slot and the honest verdict that reads `not computable` until the slot is populated.

## Chosen design

### Trace vocabulary (in `skills-contrib/drive-record-traces/schema.ts`, the single canonical schema)

Two new per-run event types, added to the `Slice1TraceEvent` union and `KNOWN_EVENT_TYPES`. Both keyed by `project_run_id` (one per run); snake_case fields to match the existing vocabulary, with the SDK's camelCase `TurnEndedUpdate.usage` field names mapped 1:1.

`tokens-recorded` — per-run token usage accumulated by the harness from the SDK's `TurnEndedUpdate.usage`. Hand-runs never emit it.

| Field | Type | Source |
|---|---|---|
| `input_tokens` | `number.integer>=0 \| null` | `usage.inputTokens` |
| `output_tokens` | `number.integer>=0 \| null` | `usage.outputTokens` |
| `cache_read_tokens` | `number.integer>=0 \| null` | `usage.cacheReadTokens` |
| `cache_write_tokens` | `number.integer>=0 \| null` | `usage.cacheWriteTokens` |

`correctness-recorded` — the external Tier-1 verdict feed the judge slice will populate. Until the judge exists, no such event is emitted.

| Field | Type | Meaning |
|---|---|---|
| `mechanical` | `"pass" \| "fail" \| null` | Validation gates (`typecheck` / `test` / `lint`) outcome. |
| `qa` | `"pass" \| "fail" \| null` | QA-run outcome (pre-written `drive-qa-plan`). |
| `intent` | `"pass" \| "fail" \| null` | Judge intent/requirements verdict. |

Why two separate events (not optional fields on `project-closed` / `slice-completed`): both feeds are written **after and outside** the orchestrated run — the harness accumulates tokens across the whole SDK run, and the judge grades correctness post-hoc. The lifecycle events fire at fixed in-run moments and routinely span sessions; coupling the feeds to them would force a writer that isn't present when the feed value becomes known. A discrete per-run event each writer appends independently is the minimal coherent shape, and it keeps the two feeds symmetric.

### Two-tier scorecard (in `skills-contrib/drive-diagnose-run/`)

A new `scorecard.ts` computes, per `project_run_id`, a correctness verdict (`correct` / `incorrect` / `not-computable` + named missing inputs) and the run's token totals. `report.ts` renders it as the headline, replacing the static `renderVerdict()` block:

- **Tier 1 — correctness gate.** Per-run verdict. No `correctness-recorded` event for a run → `not computable`, naming the missing input ("external correctness signal — no `correctness-recorded` event"). Event present but a component `null` → `not computable`, naming the null component(s) (`mechanical` / `qa` / `intent`). All three `pass` → `CORRECT`; any `fail` → `INCORRECT`. The summary verdict line refuses to imply "good" without a signal.
- **Tier 2 — efficiency (CORRECT runs only).** Hidden entirely when no run passed Tier 1, with a one-line reason. When ≥1 run is CORRECT: tokens (each component `n/a (no signal)` when `null` / absent), wall-clock, and rework, scoped to the CORRECT runs.

Worked example, default state (a hand-run trace, no correctness signal):

```
## Scorecard

### Tier 1 — correctness gate
Run verdict — not computable: external correctness signal absent
(no `correctness-recorded` event in the trace). Tier-1 correctness is
sourced outside the run; do not read the all-green metrics below as "good".

### Tier 2 — efficiency (CORRECT runs only)
Hidden — no run passed the Tier-1 correctness gate.
```

## Coherence rationale

One PR, one reviewer sitting: the scorecard is the *consumer* of the two new trace fields, so the vocabulary additions and the report changes are two halves of a single change — the schema fields are dead without the renderer that reads them, and the renderer's `not computable` / `n/a (no signal)` branches can't be tested without the fields existing. Splitting would land a schema with no reader or a reader with no schema.

## Scope

**In:**
- `skills-contrib/drive-record-traces/schema.ts` — two new event types + union + `KNOWN_EVENT_TYPES`.
- `skills-contrib/drive-record-traces/events.md`, `SKILL.md` — document the new events.
- `skills-contrib/drive-diagnose-run/scorecard.ts` (new) + `report.ts` — two-tier scorecard headline; drop the stale "token usage: not instrumented" operator row.
- Tests: schema accept/reject for new fields; scorecard `not computable` + named missing input; Tier-2 hidden for non-correct runs; `n/a (no signal)` for null tokens.
- `package.json` `test:scripts` — register new test files.

**Out:**
- The LLM judge that *fills* `correctness-recorded` (slice `llm-judge`, TML-2736).
- The k=N A/B engine, cross-run aggregation, composite ranker, dashboard, CI gate (slice `experiment-engine`, TML-2737).
- The golden-case library + SDK harness (parallel slice `golden-case-harness`, TML-2735) — do not touch `posthoc.ts`, do not add `@cursor/sdk`, do not create golden cases.
- Per-dispatch token attribution (deferred per spec Decision 3).

## Pre-investigated edge cases

| Edge case | Disposition | Notes |
|---|---|---|
| Existing `report.test.ts` asserts the old static verdict ("Run verdict", "Not computable", "not instrumented") | Update those assertions | The report headline is intentionally changing; the `not instrumented` token claim is now false. |
| Multiple `project_run_id`s in one trace | Per-run rows; Tier 2 over CORRECT runs only | Cross-run A/B *aggregation* stays out (experiment engine); per-run rows are the honest single-trace rendering. |

## Slice-specific done conditions

- [ ] A hand-run trace (no `correctness-recorded`) renders `not computable` naming the missing correctness signal, and Tier 2 is hidden — verified by a test over the report output.

## Open Questions

None remaining — shape settled against the project spec (Decisions 3 and 4) and design-notes (two-tier scorecard, honest verdict).

## References

- Parent project: `projects/drive-judge-harness/spec.md` (Decisions 3, 4; Cross-cutting requirements).
- Design notes: `projects/drive-judge-harness/design-notes.md` (§ Two-tier scorecard).
- Linear issue: TML-2720.
- Trace contract: `skills-contrib/drive-record-traces/` (`events.md`, `schema.ts`, `emission.md`).
