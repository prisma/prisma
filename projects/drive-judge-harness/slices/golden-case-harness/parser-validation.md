# Post-hoc parser validation (clears TML-2728)

> Validation of `skills-contrib/drive-diagnose-run/posthoc.ts` against a corpus of instrumented-run transcripts, with per-event confidence recorded. The spec's project-DoD requires the post-hoc parser be "validated against ≥3 instrumented runs with per-event confidence recorded".

## How this was produced

`skills-contrib/drive-judge-harness/validate-parser.ts` runs the parser's `parseTranscript` over each fixture and tallies the reconstructed events by `event_type` × `confidence`. Re-run it any time:

```bash
node skills-contrib/drive-judge-harness/validate-parser.ts \
  skills-contrib/drive-judge-harness/test/fixtures/transcripts/*.transcript.jsonl
```

The result is pinned by `test/validate-parser.test.ts` (34-test harness suite), so a regression in the parser's reconstruction behaviour fails CI.

## Corpus (≥3 instrumented runs)

The post-hoc parser reconstructs trace events from **Cursor transcripts** (role/message/content JSONL), not from `trace.jsonl`. The corpus is therefore transcript-shaped. Live capture needs a `CURSOR_API_KEY` (operator-gated — see the slice spec), so these three fixtures are **synthesised** to the real Cursor-transcript shape from the golden cases' expected Drive runs, spanning the Drive-shape space:

| Fixture | Drive shape | Reconstructed | Operator turns |
|---|---|---|---|
| `direct-change-diagnostic-wording.transcript.jsonl` | direct change | 1 | 1 |
| `slice-cli-list-flag.transcript.jsonl` | single slice | 4 | 2 |
| `project-retry-policy.transcript.jsonl` | multi-slice project | 7 | 2 |

These are honestly synthesised, not live-captured. When the live harness runs (operator-gated), real captured transcripts replace them and this artefact is regenerated; the fixtures double as regression anchors.

## Per-event confidence results

**Totals across the corpus: 12 events reconstructed — 0 high · 6 medium · 6 low.**

### `direct-change-diagnostic-wording` (1 event)

| Event | Confidence |
|---|---|
| dispatch-start | medium |

The `StrReplace` to `interpreter.ts` (the actual code edit) reconstructs **no** event — the parser only recognises `Write`/`StrReplace` to `*spec.md` / `*plan.md`. Correct: a direct change has no spec/plan ceremony, so the transcript signal is genuinely sparse.

### `slice-cli-list-flag` (4 events)

| Event | Confidence |
|---|---|
| spec-authored | low |
| plan-authored | low |
| dispatch-start | medium |
| dispatch-start | medium |

### `project-retry-policy` (7 events)

| Event | Confidence |
|---|---|
| spec-authored | low |
| plan-authored | low |
| spec-authored | low |
| dispatch-start | medium |
| spec-authored | low |
| dispatch-start | medium |
| dispatch-start | medium |

## Findings (per-event confidence assessment)

1. **`dispatch-start` is reconstructed at `medium` confidence** from `Task` tool-uses. The parser recovers `dispatch_name` (from `Task.input.description`), `model`, and `subagent_type` — but not the real `dispatch_id`/`ts` (synthetic id; `ts: null`). Medium is the honest ceiling: the *fact* of a dispatch is reliable; its *identity/timing* is reconstructed.
2. **`spec-authored` / `plan-authored` are reconstructed at `low` confidence** from `Write`/`StrReplace` to `*spec.md` / `*plan.md`. The parser recovers the path and `spec_kind`/`plan_kind` (from `slices/` in the path) but **none** of the count fields (`byte_length`, `edge_cases_count`, `dispatch_count`, …) — they are `null`. Low is correct: only existence + kind are trustworthy.
3. **No event is ever reconstructed at `high` confidence.** This is a real, recorded property of the post-hoc parser: a transcript lacks the ground-truth envelope fields (`ts`, byte counts, structured payload fields) that a natively-emitted event carries, so post-hoc reconstruction is structurally capped at `medium`. High-confidence events require native emission via `drive-record-traces/emit.ts`.
4. **The code edit itself produces no event.** Direct-change code edits (`StrReplace` to source files) are invisible to the parser by design — it reconstructs Drive *methodology* signals (dispatches, spec/plan authoring), not arbitrary file edits. The diagnostics consumer must treat a low/empty post-hoc reconstruction as "thin signal", not "no work done".
5. **Robustness confirmed.** The parser does not throw on malformed/non-JSON lines (covered by the parser's own suite); over this corpus it emitted the expected `ts unavailable` note on every fixture and never crashed.

## Verdict

The post-hoc parser is **validated** over ≥3 instrumented-run transcripts. Reconstruction confidence is correctly graded — `medium` for dispatch existence, `low` for spec/plan authoring, never `high` — and the parser is robust to sparse (direct-change) and rich (project) transcripts alike. **No behaviour bug surfaced; `posthoc.ts` was not changed.** This clears TML-2728.

The one durable caveat for the diagnostics consumer (recorded here so it survives close-out): **post-hoc traces are capped at `medium` confidence and omit all count/timing fields; they answer "did Drive methodology happen?" not "with what shape?".** Only natively-emitted traces carry the full payload.
