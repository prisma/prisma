# Slice plan: llm-judge

**Spec:** `projects/drive-judge-harness/slices/llm-judge/spec.md`
**Linear:** [TML-2736](https://linear.app/prisma-company/issue/TML-2736)

Sequential dispatches; each hands a stable state to the next. Test-first throughout (the judge is pure logic over an injected model). No real-dollar model call happens in any dispatch — the `JudgeModel` is mocked; the live adapter stays behind the `--live` + key gate. Calibration machinery lands; the calibration **run** is parked (corpus-gated).

## Dispatch plan

### Dispatch 1: Judge-model interface + live adapter (test-first)

- **Outcome:** `judge/judge-model.ts` (`JudgeModel` interface: `grade(prompt) -> Promise<string>`, injected) and `judge/judge-model-sdk.ts` (live adapter pinning a cross-family judge model id, default GPT 5.5, reusing `sdk-adapter.ts`; **rejects a same-family judge id**). Tests use a mock `JudgeModel`; the live adapter is reached only on `--live` + key.
- **Builds on:** the spec's injected-model design + the landed `sdk-adapter.ts`.
- **Hands to:** a mockable model boundary every prompt-set module calls.
- **Focus:** the boundary + cross-family guard. No prompts yet, no real SDK call.

### Dispatch 2: Correctness rubric prompt-set + parser (test-first)

- **Outcome:** `judge/rubric-correctness.ts` renders the requirements+intent rubric from `acceptance.md` + a diff + relevant trace slices, calls `JudgeModel`, and parses an **arktype-validated** `{requirements: pass|fail, intent: pass|fail, reasons}`. A malformed response yields `intent: null` (never a false `pass`). Unit tests with a mock model cover pass / fail / malformed.
- **Builds on:** Dispatch 1.
- **Hands to:** the rubric verdict the correctness-event emitter consumes.
- **Focus:** prompt rendering + strict parse + the fail-to-null invariant.

### Dispatch 3: Failure-mode + operator-turn classifiers (test-first)

- **Outcome:** `judge/classify-failure.ts` (F1–F9 + scope traps + QA coverage-gate gaps) and `judge/classify-operator.ts` (five operator-turn buckets), each rendering a prompt, calling `JudgeModel`, and parsing an arktype-validated verdict. Unit tests with a mock model.
- **Builds on:** Dispatch 1.
- **Hands to:** the diagnostic/auto-retro classifications (consumed later by the experiment engine / retro surface).
- **Focus:** the two classifier prompt sets + strict parse. Not wired into a report.

### Dispatch 4: Emit the `intent` correctness signal (test-first, end-to-end)

- **Outcome:** a thin emitter step takes the Dispatch-2 rubric verdict and writes a `correctness-recorded` event (carrying `requirements` + `intent`) through the deterministic emitter (`drive-record-traces/emit.ts`). An end-to-end test: mock judge → emitted event → `computeScorecard` (slice 1, read-only) composes the `intent` component into its verdict.
- **Builds on:** Dispatch 2 + the landed scorecard/schema.
- **Hands to:** a computable Tier-1 `intent` signal in the scorecard.
- **Focus:** producer wiring + the scorecard round-trip. **No edits** to `scorecard.ts` / `schema.ts`.

### Dispatch 5: Calibration harness (test-first), run parked

- **Outcome:** `judge/calibration.ts` — `agreementRate(judgeVerdicts, humanLabels) -> {rate, n, passes>=0.8}` — plus `judge/calibration/labels.md` (held-out human-label store, seeded). Unit tests over synthetic label/verdict pairs cover agree / disagree / threshold-boundary. The **actual calibration run is not executed** (corpus-gated); the uncalibrated status is represented.
- **Builds on:** Dispatch 2's verdict shape.
- **Hands to:** the ≥80% gate machinery the project-DoD calibration item will use once the corpus exists.
- **Focus:** the agreement tally + gate + the explicit parked status. Not a passing calibration.

### Dispatch 6: Wire-up + gates + SKILL.md

- **Outcome:** new test files added to `test:scripts`; `SKILL.md` documents the judge, the cross-family requirement, and the **parked-calibration deferral + operator-spend gate**; `pnpm typecheck` / `lint:deps` / `lint:casts` / `node --test` green with no `CURSOR_API_KEY` and no `@cursor/sdk` installed.
- **Builds on:** Dispatches 1–5.
- **Hands to:** the PR.
- **Focus:** integration + gate-green + the honest deferral note. No new behaviour.

## Hand-off completeness

The final hand-off (gates green with no key/dep; the `intent` signal computable end-to-end; calibration machinery present but its run parked) adds up to the slice-DoD: judge produces validated verdicts for all three prompt sets (D2+D3), emits the intent signal the scorecard reads (D4), the fail-to-null invariant holds (D2), the calibration gate is computable (D5), and the calibration run is explicitly parked with the project-DoD item left unchecked (D5+D6).
