# Slice plan: golden-case-harness

**Spec:** `projects/drive-judge-harness/slices/golden-case-harness/spec.md`
**Linear:** [TML-2735](https://linear.app/prisma-company/issue/TML-2735)

Sequential dispatches; each hands a stable state to the next. Test-first where there is testable logic (dispatches 3–5). Built as one driver run, but decomposed here so the build is legible and the hand-offs are explicit.

## Dispatch plan

### Dispatch 1: Golden-case library

- **Outcome:** `projects/drive-judge-harness/assets/golden/<slug>/` exists for all 5 cases, each with `brief.md`, `acceptance.md`, `manual-qa.md`, `case.json`; cases span direct-change / single-slice / multi-slice-project / I12-halt / spike-first.
- **Builds on:** the spec's chosen design (case table + shape spread).
- **Hands to:** a set of realistic briefs + machine-readable `case.json` the harness's `load-brief` can read, and acceptance/QA artefacts the judge slice will consume.
- **Focus:** brief realism + acceptance oracles + conformant `drive-qa-plan` scripts. Not the harness wiring.

### Dispatch 2: Brief loader + manifest writer (test-first)

- **Outcome:** `load-brief.ts` (`loadCase(dir) -> {meta, briefText}`) and `manifest.ts` (`RunManifest` + `writeManifest`) exist with unit tests green under `node --test`.
- **Builds on:** Dispatch 1's `case.json` shape.
- **Hands to:** typed case-loading + a manifest sink the run entry point writes to.
- **Focus:** pure I/O + shapes. No SDK, no token logic.

### Dispatch 3: Token accumulator (test-first)

- **Outcome:** `usage.ts` — `accumulateUsage(updates: TurnUsage[]) -> TokenTotals` sums the four token counts; unit tests cover empty, single, multi-update, and missing-field cases.
- **Builds on:** the spec's token-signal definition (4 SDK usage fields).
- **Hands to:** a pure accumulator the run loop feeds turn-ended usage into.
- **Focus:** pure arithmetic + the `TokenTotals` shape. No SDK import.

### Dispatch 4: `run-one-brief` core + gate + SDK adapter (test-first)

- **Outcome:** `runOneBrief(config, deps)` with the dry-run-by-default gate (`--live` + `CURSOR_API_KEY` required for live); `sdk-adapter.ts` reaches `@cursor/sdk` only via dynamic import on the live path; CLI `main`. Tests: dry-run writes `status:"dry-run"`/`tokens:null` and never calls the injected `createAgent`; a mock-`createAgent` live path accumulates tokens and writes `status:"finished"` with no network.
- **Builds on:** Dispatches 2 (manifest) + 3 (accumulator).
- **Hands to:** a runnable entry point + a `drive:run-brief` package.json script; the no-API-key/no-dep CI guarantee.
- **Focus:** orchestration + gating + dependency isolation. Not the real SDK call (operator-gated).

### Dispatch 5: Post-hoc parser validation (clears TML-2728)

- **Outcome:** ≥3 transcript fixtures + `validate-parser.ts` tallying `parseTranscript` output by event_type × confidence; `parser-validation.md` records the per-event confidence results.
- **Builds on:** existing `drive-diagnose-run/posthoc.ts` (read-only) + the golden briefs (fixtures synthesised from their expected runs).
- **Hands to:** a recorded validation artefact that clears TML-2728, and a re-runnable validator.
- **Focus:** validation corpus + recorded confidence. Does not change `posthoc.ts` behaviour unless a clear bug surfaces.

### Dispatch 6: Wire-up + gates

- **Outcome:** new test files added to `test:scripts`; `drive:run-brief` script added; `SKILL.md` written; `pnpm typecheck` / `lint:deps` / `lint:casts` / `node --test` green with no `CURSOR_API_KEY` and no `@cursor/sdk` installed.
- **Builds on:** Dispatches 1–5.
- **Hands to:** the PR.
- **Focus:** integration + gate-green. No new behaviour.

## Hand-off completeness

The final dispatch's hand-off (gates green, no-key/no-dep guarantee, recorded validation artefact) adds up to the slice-DoD: parser-validation recorded (D5) and harness green with no key/dep (D4 + D6).
