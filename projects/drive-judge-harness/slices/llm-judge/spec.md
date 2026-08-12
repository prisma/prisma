# Slice: llm-judge

_Parent project `projects/drive-judge-harness/`. Outcome this slice contributes: the Tier-1 correctness signal becomes **computable** — a bespoke LLM judge scores requirements/intent correctness, classifies failure modes and operator turns, and emits the `intent` correctness component the scorecard already reads. Calibration against the instrumented-run corpus is **parked** (corpus-gated, operator approves the spend)._

## At a glance

Build a **bespoke-minimal LLM judge** under `skills-contrib/drive-judge-harness/judge/` that grades one Drive run from its artifacts (the produced diff/PR + the run's `trace.jsonl`) against a golden case's `acceptance.md` correctness oracle. The judge runs three prompt sets — (a) a correctness rubric (requirements + intent), (b) a failure-mode classifier, (c) an operator-turn classifier — through a **cross-family** judge model (default GPT 5.5, pinned per experiment), parses structured verdicts, and emits the `intent` component as a `correctness-recorded` trace event the slice-1 scorecard consumes. It ships with a **calibration harness** (judge-vs-human agreement tally with an ≥80% gate) whose actual run is **deferred** until the corpus exists.

The spike that chose bespoke-minimal over Inspect / Braintrust / promptfoo is recorded in the project `design-notes.md` (§ Alternatives considered) and `spec.md` (Decision 6); promptfoo is the recorded escape hatch.

## Chosen design

Four coherent pieces, each minimal:

### 1. Judge model access — injected interface, mockable

```
skills-contrib/drive-judge-harness/judge/
  judge-model.ts      # JudgeModel interface: grade(prompt) -> structured text; injected
  judge-model-sdk.ts  # live adapter — reuses the harness SDK path with a pinned judge model id
```

The judge takes an injected `JudgeModel` (same pattern as `run-one-brief`'s `createAgent`): tests pass a mock that returns canned structured verdicts, so **no real-dollar model calls happen in tests / typecheck / lint / CI**. The live adapter pins the model to the cross-family judge id (default GPT 5.5) and reuses `sdk-adapter.ts`'s SDK access — **no new dependency**, and the live path stays behind the same `--live` + key gate as the harness.

### 2. The three prompt sets + verdict parsers

```
  rubric-correctness.ts   # requirements + intent; structured {requirements: pass|fail, intent: pass|fail, reasons}
  classify-failure.ts     # failure-mode classifier (F1–F9 + scope traps + QA coverage-gate gaps)
  classify-operator.ts    # operator-turn classifier (the measurement-model's 5 canonical buckets: legitimate-design / legitimate-authorisation / illegitimate-asked / illegitimate-correction / illegitimate-rescue)
```

Each renders a prompt from the run inputs (`acceptance.md` oracle + diff + relevant trace slices), calls the `JudgeModel`, and parses a **structured, schema-validated** verdict (arktype). The rubric scores **requirements** (acceptance criteria met) and **intent** (the run did the right thing, design-quality) — **mechanical** correctness stays gate-sourced (validation gates), not judged. Reasons/evidence are captured for the auto-retro surface.

### 3. Emit the `intent` correctness signal (merge-preserving)

The judge's rubric verdict (requirements folded into the single `intent` component the schema carries) is emitted as a **`correctness-recorded`** trace event through the existing **deterministic emitter** (`drive-record-traces/emit.ts`). The slice-1 scorecard already reads `correctness-recorded` and composes `mechanical ∧ qa ∧ intent` → verdict. **No edits to `drive-diagnose-run` or `schema.ts`** — the judge is a producer of an event the scorecard already consumes.

**The one non-obvious constraint:** the scorecard is **last-write-wins per run** — a `correctness-recorded` event replaces the *whole* `{mechanical, qa, intent}` triple; it does not merge components. So the judge cannot emit `{mechanical:null, qa:null, intent:pass}` — that would clobber any `mechanical`/`qa` already recorded by the gate/QA step. The judge's emit step therefore **reads the run's latest recorded `{mechanical, qa}` (if any) and emits a merged triple** that fills `intent` while preserving the others. A small `emit-correctness.ts` helper does the read-merge-emit so the merge rule lives in one place.

### 4. Calibration harness — built, run deferred

```
  calibration.ts          # agreementRate(judgeVerdicts, humanLabels) -> {rate, n, passes>=0.8}
  calibration/labels.md   # human-label store (held-out subset); seeded empty/with the 1 accreting run
```

`calibration.ts` computes judge-vs-human agreement over a held-out labelled subset and reports whether it clears the ≥80% gate (borrowing promptfoo's documented workflow: label → measure agreement → validate on holdout → lock + monitor drift). Pure + unit-tested with synthetic label/verdict pairs. **The actual calibration run is parked**: it needs ~10–20 instrumented runs, the corpus is operator-gated on real-dollar spend, and only one run is accreting. Until then the judge's `intent` signal is emitted but flagged **uncalibrated**, and the project-DoD calibration item stays unchecked.

## Coherence rationale

One reviewer holds this in one sitting: it is the single "make Tier-1 computable" deliverable — the three prompt sets, the model interface, the correctness-event emission, and the calibration machinery are the inseparable parts of *a judge that produces a trusted-once-calibrated correctness signal*. It rolls back as one unit (a new `judge/` subtree + tests); it touches no existing production package and no sibling slice's files. The judge is useless without prompts; the prompts are unmeasurable without the calibration harness; splitting them ships half a judge.

## Scope

**In:** `skills-contrib/drive-judge-harness/judge/**` (model interface + live adapter + three prompt-set modules + parsers + calibration + tests + fixtures); emission of `correctness-recorded` via the existing emitter; judge usage + the parked-calibration status documented in `SKILL.md`; new test files wired into `test:scripts`; the slice-scoped `trace.jsonl`.

**Out (deliberately, owned elsewhere):**
- **Actual calibration to ≥80%** — corpus-gated; parked behind operator approval of corpus-generation spend. The machinery lands; the run does not.
- The k=N A/B / experiment engine, cross-run aggregation, dashboard, CI regression gate — TML-2737.
- The two-tier scorecard + `correctness-recorded` / `tokens` **schema** — TML-2720 (landed). The judge **emits** the event; it does not edit the scorecard or schema.
- Spawning the runs the judge grades — TML-2735 (landed); the judge consumes harness output.
- Real-dollar live judge calls — gated on `--live` + key, same as the harness.

## Pre-investigated edge cases

| Edge case | Disposition | Notes |
|---|---|---|
| Judge model returns malformed / non-structured output | Designed for | Verdicts are arktype-validated; a parse failure yields an explicit `intent: null` (→ scorecard `not-computable`), never a silent `pass`. |
| The judge is uncalibrated (no corpus yet) | Reflected in status + DoD | The `intent` event is emitted but flagged uncalibrated; the project-DoD calibration item stays unchecked; the scorecard still composes it (honest, with the caveat surfaced). |
| Same-family grading bias | Guarded by design | Judge model is a pinned cross-family parameter (default GPT 5.5 vs the Claude orchestrator); the live adapter rejects a same-family judge id. |
| Tests must not make real model calls | Designed for | `JudgeModel` is injected; tests pass a mock; the live SDK adapter is reached only on `--live` + key. |
| Scorecard is last-write-wins on the whole `{mechanical, qa, intent}` triple | Designed around | `emit-correctness.ts` reads the run's latest recorded `{mechanical, qa}` and emits a merged triple filling `intent` — never nulls out a sibling component. End-to-end test asserts a prior `mechanical:pass` survives the judge's emission. |

## Slice-specific done conditions

- [ ] The judge produces arktype-validated verdicts for all three prompt sets over fixture runs (golden `acceptance.md` + a transcript/diff fixture), using a **mocked** `JudgeModel` — green with no key and `@cursor/sdk` not installed.
- [ ] The rubric's `intent` verdict is emitted as a `correctness-recorded` event through the deterministic emitter and is picked up by the slice-1 scorecard (verified end-to-end with a mock judge).
- [ ] A malformed judge response yields `intent: null` (→ `not-computable`), never a false `pass`.
- [ ] `calibration.ts` computes agreement + the ≥80% gate over synthetic label/verdict pairs (unit-tested).
- [ ] **Parked, explicitly:** actual calibration against the corpus is **not** run this slice; the project-DoD calibration item remains unchecked, and `SKILL.md` records the deferral + the operator-spend gate.

## Open Questions

None blocking. The corpus-spend gate is an operator decision already taken (hold), recorded as the parked calibration above.

## References

- Parent project: `projects/drive-judge-harness/spec.md` · design rationale + spike outcome: `projects/drive-judge-harness/design-notes.md`
- Linear issue: [TML-2736](https://linear.app/prisma-company/issue/TML-2736)
- Consumes: the slice-1 scorecard + `correctness-recorded` schema event (`skills-contrib/drive-diagnose-run/scorecard.ts`, `skills-contrib/drive-record-traces/schema.ts`) — **not edited**.
- Emits via: the deterministic emitter (`skills-contrib/drive-record-traces/emit.ts`).
- Grades runs produced by: the golden-case harness (TML-2735, landed).
- Judge-model access: the `sdk` skill / `sdk-adapter.ts` (cross-family judge model, pinned).
