# Slice plan: scorecard-and-trace-inputs

**Spec:** `projects/drive-judge-harness/slices/scorecard-and-trace-inputs/spec.md`
**Linear:** TML-2720

Test-first throughout: each dispatch writes the failing test, then the implementation that turns it green. Tests use `node --test` matching the existing `skills-contrib/drive-diagnose-run/test/` and `skills-contrib/drive-record-traces/test/` patterns.

## Dispatch plan

### Dispatch 1: trace vocabulary additions

- **Outcome:** `tokens-recorded` and `correctness-recorded` event types exist in `schema.ts`, are in the `Slice1TraceEvent` union and `KNOWN_EVENT_TYPES`, and the emitter accepts well-formed instances and rejects malformed ones (wrong-typed component, out-of-range token count). Verified by new cases in `drive-record-traces/test/emit.test.ts`.
- **Builds on:** the spec's chosen design (field shapes).
- **Hands to:** a canonical schema the scorecard can import and read; the emitter emits both new events.
- **Focus:** `schema.ts` only on the code side. Not the report. Docs deferred to dispatch 3.

### Dispatch 2: two-tier scorecard

- **Outcome:** `scorecard.ts` computes per-run correctness verdicts + token totals; `report.ts` renders the two-tier scorecard as the headline. A hand-run trace renders `not computable` naming the missing correctness signal; Tier 2 is hidden for non-correct runs; null/absent tokens render `n/a (no signal)`; a fully-`pass` `correctness-recorded` run shows Tier 2 with token values. The stale "token usage: not instrumented" operator row is gone. Verified by new `scorecard.test.ts` + updated `report.test.ts`.
- **Builds on:** Dispatch 1's schema (the two new events).
- **Hands to:** the honest two-tier report — the scorecard shape the judge slice populates and the experiment engine reads.
- **Focus:** `scorecard.ts` (new), `report.ts`, and the two test files. Not `metrics.ts` internals (reused as-is for Tier-2 wall-clock/rework), not `posthoc.ts`.

### Dispatch 3: docs + script registration

- **Outcome:** `events.md` documents both new events (envelope merge, field tables, JSONL examples) and updates the "At a glance" count; `drive-record-traces/SKILL.md` and `drive-diagnose-run/SKILL.md` reflect the new vocabulary + scorecard; `package.json` `test:scripts` registers the new test file(s). `pnpm typecheck`, `pnpm lint:deps`, `pnpm lint:casts`, and the diagnose-run + record-traces tests are green.
- **Builds on:** Dispatches 1–2 (the code is final, so docs describe the shipped shape).
- **Hands to:** slice DoD — a documented, tested, lint-clean change ready for PR.
- **Focus:** docs + `package.json`. No behaviour change.
