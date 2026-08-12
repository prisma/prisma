# Slice plan: run-setup

**Spec:** `projects/drive-judge-harness/slices/run-setup/spec.md`
**Linear:** [TML-2755](https://linear.app/prisma-company/issue/TML-2755) (blocks TML-2737)

Sequential, test-first dispatches; each hands a stable state to the next. None imports `@cursor/sdk`; the slice-2 live-execution gate (SDK only via `sdk-adapter.ts` dynamic import on the `--live` path) is preserved throughout. Built as one driver run, decomposed here so hand-offs are explicit.

## Dispatch plan

### Dispatch 1: `prepare-run.ts` — isolate + inject + materialize (test-first)

- **Outcome:** `prepareRun(config, deps)` creates a detached worktree at `baseRef`, overlays the bundle's canonical homes (`skills-contrib`, `.agents/rules`, `AGENTS.md`, `CLAUDE.md`), runs the injectable `materialize`, and finalizes a baseline commit; returns `PreparedRun` (`runDir`, `baseSha`, `skillBundleSha`, `prepareCommit`, `materialized`). Tests drive a tiny temp git fixture with `git`/`materialize` real-for-git, mocked-for-materialize; verify the overlay lands and `materialized:false` is recorded when the mock fails.
- **Builds on:** the spec's chosen design (steps 1–4).
- **Hands to:** an isolated, skill-injected checkout with a clean diff cut point.
- **Focus:** git/fs orchestration + the baseline-commit cut point. No SDK, no live call.

### Dispatch 2: `collect-run.ts` — harvest trace + diff (test-first)

- **Outcome:** `collectRun(prepared, opts)` globs `runDir` for `*.jsonl`, keeps lines validating against the canonical trace schema (imported from `drive-record-traces`), matches by `orchestrator_agent_id` (else newest), and returns `diff`/`diffStat` taken **against `prepareCommit`** plus `untraced`. Tests use a fixture `runDir` (baseline commit + a post-baseline agent change + a valid trace + a junk `.jsonl`); assert the diff excludes injected skill files and the junk jsonl is rejected.
- **Builds on:** Dispatch 1's `PreparedRun` shape + the trace schema.
- **Focus:** post-hoc collection + the diff/overlay separation. No SDK.

### Dispatch 3: spawn-in-checkout thread-through (test-first)

- **Outcome:** `RunOneBriefConfig` gains `runDir`; `CreateAgent` opts gain `cwd`; `createCursorAgent` passes `local: { cwd }` instead of the hard-pinned `process.cwd()`. A mocked-`createAgent` test asserts `cwd === runDir` is threaded; dry-run still writes a manifest and spawns nothing.
- **Builds on:** existing `run-one-brief.ts` / `sdk-adapter.ts` (slice 2).
- **Hands to:** a spawn that executes in the prepared checkout.
- **Focus:** the one-line `cwd` thread-through + its test. No behaviour change to the gate.

### Dispatch 4: manifest fields + `run-arm.ts` wrapper (test-first)

- **Outcome:** `RunManifest` gains additive `base_ref`/`base_sha`/`skill_bundle_ref`/`skill_bundle_sha`/`run_dir`/`collected_trace_paths`/`diff_stat`/`materialized`; `run-arm.ts` composes `prepareRun → runOneBrief({runDir,…}) → collectRun` and writes the enriched manifest + a CLI `main`. Tests compose the pipeline with mocked `createAgent`+`materialize` and assert the enriched manifest round-trips.
- **Builds on:** Dispatches 1–3.
- **Hands to:** a single entry point that produces a reproducible, pinned-input run record.
- **Focus:** composition + additive manifest shape. No SDK on the tested path.

### Dispatch 5: wire-up + gates

- **Outcome:** new test files added to `test:scripts`; a `drive:run-arm` package.json script; `SKILL.md` documents the pinned skill-bundle input + the prepare/collect pipeline; `pnpm typecheck` / `lint:deps` / `lint:casts` / `node --test` green **with no `CURSOR_API_KEY` and `@cursor/sdk` not installed**.
- **Builds on:** Dispatches 1–4.
- **Hands to:** the PR.
- **Focus:** integration + gate-green. No new behaviour.

## Hand-off completeness

The final dispatch's hand-off (gates green with no key/dep) plus Dispatch 2's diff-exclusion test add up to the slice-DoD: harness green with the SDK absent (D1–D5) and the collected diff excludes injected skills (D2).
