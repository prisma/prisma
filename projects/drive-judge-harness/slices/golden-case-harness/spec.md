# Slice: golden-case-harness

_Parent project `projects/drive-judge-harness/`. Outcome this slice contributes: a usable artefact that produces natively-instrumented Drive runs on demand — the corpus generator the judge later calibrates against, and the run-spawning mechanism the experiment engine builds on._

## At a glance

Curate a **golden-case library** (5 canonical Drive briefs with co-located acceptance sets + pre-written QA plans) under `projects/drive-judge-harness/assets/golden/`, and wire a **minimal `run-one-brief` harness** (`skills-contrib/drive-judge-harness/`) that spawns one orchestrator run on a golden brief with a pinned model, accumulates per-run token usage, and writes a run manifest. Then **validate the post-hoc trace parser** (`drive-diagnose-run/posthoc.ts`) against ≥3 instrumented-run transcript fixtures with per-event confidence recorded, clearing TML-2728.

## Chosen design

Three coherent pieces, each minimal:

### 1. Golden-case library — `projects/drive-judge-harness/assets/golden/<case-slug>/`

Each case is a directory of three durable files (migrate to `docs/drive/` at close-out):

| File | Role |
|---|---|
| `brief.md` | The Drive entry-point an orchestrator would run — a realistic, self-contained project/slice/direct-change description. |
| `acceptance.md` | The acceptance set: expected triage verdict, expected outcome/requirements, and the **correctness oracle** the run is judged against. |
| `manual-qa.md` | A pre-written `drive-qa-plan` script (TOC-first, isolation-tagged) so the Tier-1 QA-run correctness signal is deterministic at run time, not authored mid-run. |
| `case.json` | Machine-readable metadata (`slug`, `title`, `shape`, `recommended_model`, `summary`) the harness loads. |

Five cases spanning the Drive shape space (the judge corpus needs spread, not volume):

| Slug | Drive shape | One-line |
|---|---|---|
| `direct-change-diagnostic-wording` | direct change | Reword one user-facing diagnostic string; ~30-second-verifiable. |
| `slice-cli-list-flag` | single in-project slice | Add a `--json` output flag to one CLI command. |
| `project-retry-policy` | small multi-slice project | Add a configurable retry policy to the adapter runtime (2–3 slices). |
| `i12-halt-storage-assumption` | I12 halt / re-plan | Brief asserts a storage capability that does not exist → orchestrator must halt and re-plan, not invent it. |
| `spike-first-flaky-test` | spike-first triage | An intermittently-failing test with unknown root cause → triage to a time-boxed spike before sizing. |

### 2. `run-one-brief` harness — `skills-contrib/drive-judge-harness/`

A skill-contrib tooling cluster (sibling to `drive-diagnose-run`; uses the workspace-root `node_modules`, lives outside `packages/` so the dependency-cruiser layering rules do not apply). Modules:

```
skills-contrib/drive-judge-harness/
  SKILL.md            # frontmatter + usage + the live-execution gate contract
  load-brief.ts       # read a golden case's case.json + brief.md
  usage.ts            # accumulateUsage(updates) -> TokenTotals  (pure; unit-tested)
  manifest.ts         # RunManifest type + writeManifest()       (unit-tested)
  run-one-brief.ts    # runOneBrief(config, deps) core + CLI main (unit-tested w/ mock deps)
  sdk-adapter.ts      # the ONLY file that touches @cursor/sdk, via dynamic import
  test/               # node --test suites + transcript fixtures
```

**Live-execution gate (the central design constraint).** Live runs require **both** `--live` **and** `CURSOR_API_KEY`. Default is a **dry-run** path that never imports `@cursor/sdk`, never makes a network call, and writes a manifest with `status: "dry-run"`, `tokens: null`. The SDK is reached only through `sdk-adapter.ts`'s **dynamic** `import('@cursor/sdk')`, invoked solely on the live path — so module evaluation, typecheck, tests, and lint never require the package to be installed. `runOneBrief` takes an injected `createAgent` dependency; tests pass a mock that yields synthetic stream events (including a turn-ended usage payload), so token accumulation and manifest-writing are verified with **zero** live calls.

**Token signal.** `accumulateUsage` sums `inputTokens` / `outputTokens` / `cacheReadTokens` / `cacheWriteTokens` across the run's turn-ended updates into a `TokenTotals`. Because the canonical trace `tokens` field is owned by the parallel slice TML-2720 (which owns `schema.ts`) and does not exist yet, the harness writes the totals to a **run manifest** (`run-<id>.json`) beside the trace — the transitional home for the token signal — rather than emitting an unvalidatable trace line through the fail-closed emitter. When TML-2720 lands the `tokens` trace field, the manifest's `tokens` migrates into the validated trace via `emit.ts`. (Dependency noted; their files are untouched.)

### 3. Post-hoc parser validation (clears TML-2728)

`validate-parser.ts` runs `drive-diagnose-run/posthoc.ts`'s `parseTranscript` over a corpus of ≥3 realistic transcript fixtures and tallies reconstructed events by `event_type` × `confidence`, plus notes. The recorded results land in `parser-validation.md` (this slice dir). Fixtures are transcript-shaped (`role`/`message`/`content` JSONL with `Task` / `Write` tool-uses) synthesised from the golden cases' expected Drive runs — honestly labelled as synthesised, since live capture needs the API key.

## Coherence rationale

One reviewer holds this in one sitting: it is the single "corpus generator" deliverable from the project plan's `golden-case-harness` entry — briefs + run-one-brief wiring + parser validation are the three inseparable parts of *being able to produce and read an instrumented run*. Splitting them would ship a harness with nothing to run, or briefs nothing runs. It rolls back as one unit (a new skill-contrib dir + a new assets dir + one slice-doc set); it touches no existing production package.

## Scope

**In:** `projects/drive-judge-harness/assets/golden/**` (5 cases × {brief, acceptance, manual-qa, case.json}); `skills-contrib/drive-judge-harness/**` (harness modules + tests + fixtures + SKILL.md); `parser-validation.md` artefact; a `drive:run-brief` package.json script + the new test files wired into `test:scripts`; the slice-scoped `trace.jsonl`.

**Out (deliberately, owned elsewhere):**
- The k=N A/B / experiment engine, cross-run aggregation, dashboard, CI regression gate — TML-2737.
- The LLM judge / calibration — TML-2736.
- The two-tier scorecard + the `tokens` / external-correctness **schema** additions — TML-2720 owns `schema.ts`, `metrics.ts`, `report.ts`. **Not edited.**
- Adding `@cursor/sdk` to the committed dependency tree — blocked by the repo trust policy (see Open Questions); operator-gated alongside the API key.

## Pre-investigated edge cases

| Edge case | Disposition | Notes |
|---|---|---|
| `@cursor/sdk` transitively trips `trustPolicy: no-downgrade` (`undici@5.29.0`) | Surfaced as operator-gated open question | The harness is built so the dep is never needed for typecheck/test/lint/CI; live execution is gated on the operator admitting the dep + key. |
| The fail-closed emitter rejects a `tokens` field absent from the current schema | Designed around | Token totals go to a run manifest, not an emitted trace line, until TML-2720's schema lands. |
| `posthoc.ts` parses **transcripts**, not `trace.jsonl` | Reflected in the validation corpus | Validation fixtures are Cursor-transcript-shaped, not trace-shaped. |

## Slice-specific done conditions

- [ ] Parser-validation results recorded in `parser-validation.md` over ≥3 transcript fixtures with per-event confidence.
- [ ] Harness typechecks, tests, and lints **with no `CURSOR_API_KEY` set and `@cursor/sdk` not installed** (dry-run path + mocked tests prove it).

## Open Questions

1. **Admit `@cursor/sdk` (and a `trustPolicyExclude` for `undici@5.29.0`) into the lockfile?** Working position: **defer to operator.** `pnpm add @cursor/sdk` fails the repo's `trustPolicy: no-downgrade` guard on a transitive `undici@5.29.0`. The documented escape hatch is a `trustPolicyExclude` entry (as already exists for `chokidar` / `evlog` / `semver`), but admitting a supply-chain-flagged package + weakening a deliberate security control is an operator decision with repo-wide blast radius. Live execution is blocked without a `CURSOR_API_KEY` regardless, so the harness ships fully functional in dry-run/mock form and the live path is operator-gated.

## References

- Parent project: `projects/drive-judge-harness/spec.md`
- Linear issue: [TML-2735](https://linear.app/prisma-company/issue/TML-2735)
- Clears: [TML-2728](https://linear.app/prisma-company/issue/TML-2728) (post-hoc parser validation)
- Dependency note: TML-2720 owns the `tokens` trace-schema field this harness will populate once landed.
- Trace contract: `skills-contrib/drive-record-traces/` · Parser under validation: `skills-contrib/drive-diagnose-run/posthoc.ts`
- SDK usage: the `sdk` skill (`@cursor/sdk` — `Agent.create`, `run.stream`, turn-ended `usage`).
