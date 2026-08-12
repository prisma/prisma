# Slice: run-setup

_Parent project `projects/drive-judge-harness/`. Outcome this slice contributes: the **skill bundle under test becomes a first-class, pinned run input** — the harness can produce a Drive run against a known base with a specified skill version materialized into an isolated checkout, and collect that run's trace + diff cleanly. The run-production foundation under both corpus generation and the A/B engine._

## At a glance

Add a `prepare-run` → spawn → `collect-run` pipeline to the existing `skills-contrib/drive-judge-harness/` harness. `prepare-run` creates an **isolated git checkout** of the repo-under-test at a pinned base ref, **overlays a skill bundle** (a git ref of `skills-contrib/` + `.agents/rules/` + `AGENTS.md`/`CLAUDE.md`), **materializes** it via the repo's own `prepare` hook so the gitignored `.cursor/`/`.claude/`/`.agents/skills/` trees exist, and finalizes with a **baseline commit** so the agent's diff is cleanly separable from the injected skills. `run-one-brief` then spawns the orchestrator with `cwd` set to that checkout (today it is hard-pinned to `process.cwd()`), and `collect-run` harvests the emitted `trace.jsonl` + the agent's diff. The skill bundle and base ref become recorded manifest fields — an A/B arm is now expressible as `(brief+base, model, skill-bundle)` with one axis varied.

## Chosen design

Three new modules beside the existing harness, plus a small thread-through of an existing one. None imports `@cursor/sdk`; the live-execution gate (slice 2's central invariant — SDK reached only via `sdk-adapter.ts`'s dynamic import on the `--live` path) is preserved.

### 1. `prepare-run.ts` — isolate + inject + materialize

```ts
export type SkillBundleRef = { repoDir: string; ref: string };   // git ref defining the bundle
export type PrepareRunConfig = {
  repoUnderTestDir: string;     // the repo whose code the orchestrator changes
  baseRef: string;             // commit/branch/tag to check out (e.g. "main", a historical base_sha)
  skillBundle: SkillBundleRef; // canonical-home dirs overlaid onto the base checkout
  runDir: string;              // isolated working dir to create
};
export type PreparedRun = {
  runDir: string;
  baseRef: string;
  baseSha: string;             // resolved
  skillBundleSha: string;      // resolved
  prepareCommit: string;       // baseline commit AFTER overlay+materialize; the agent's diff is taken against this
  materialized: boolean;       // false when the prepare hook could not run against this base/toolchain
};
export type PrepareRunDeps = {
  git?: (args: string[], cwd: string) => { stdout: string };  // injectable for tests
  materialize?: (runDir: string) => { ok: boolean; log: string }; // runs `pnpm install` (prepare hook); mockable
};
export function prepareRun(config: PrepareRunConfig, deps?: PrepareRunDeps): PreparedRun;
```

Steps, all local (git + fs + one `pnpm install`); no network, no SDK:

1. `git worktree add --detach <runDir> <baseRef>` off the repo-under-test (cheap — shares the object store; `--detach` sidesteps the "branch already checked out" limitation so parallel arms on the same base are fine).
2. Overlay the bundle's canonical homes: `git -C <repoDir> archive <bundle-ref> -- skills-contrib .agents/rules AGENTS.md CLAUDE.md | tar -x -C <runDir>` (extract over the base checkout; when `baseRef == bundle-ref` this is a no-op).
3. Materialize: run the repo's `prepare` hook (`pnpm install`) in `<runDir>` so `skills add` + `sync-agent-rules` regenerate the gitignored trees. If it fails (an old base against the current toolchain), set `materialized: false` and record the log — the case is simply not replayable rather than silently mis-instrumented.
4. **Baseline commit**: `git -C <runDir> add -A && git -C <runDir> commit -m "prepare-run baseline"`. This is the cut point — everything we injected lives in this commit, so `collect-run`'s diff is exactly the agent's work, not the skill overlay.

### 2. `run-one-brief.ts` — spawn in the isolated checkout (thread-through)

`RunOneBriefConfig` gains `runDir: string`; `CreateAgent` opts gain `cwd: string`; `createCursorAgent` passes `local: { cwd }` instead of the hard-pinned `process.cwd()`. Mocked tests already inject `createAgent`, so the thread-through is verified without a live call. Dry-run still writes a manifest and spawns nothing.

### 3. `collect-run.ts` — harvest trace + diff

```ts
export type CollectedRun = {
  tracePaths: string[];   // *.jsonl under runDir whose first line validates against the trace schema
  matchedTrace: string | null; // the one matching the spawned run (by orchestrator_agent_id; else newest)
  diff: string;           // `git -C runDir diff <prepareCommit>` — the agent's changes, overlay excluded
  diffStat: { filesChanged: number; insertions: number; deletions: number };
  untraced: boolean;      // true when no schema-valid trace was emitted (e.g. a pre-instrumentation bundle)
};
export function collectRun(prepared: PreparedRun, opts?: { agentId?: string | null }): CollectedRun;
```

Post-hoc collection (design-notes § Run setup): the spawned orchestrator emits per the standard `drive-record-traces` protocol inside `<runDir>`; we glob `<runDir>` for `*.jsonl`, keep those whose first line validates against the canonical trace schema (imported from `drive-record-traces`), and match by `orchestrator_agent_id` (falling back to newest). `emit.ts` and the emission protocol are untouched; an env-pinned destination is the recorded escape hatch.

### 4. `RunManifest` extensions + `run-arm.ts` wrapper

`RunManifest` gains `base_ref`, `base_sha`, `skill_bundle_ref`, `skill_bundle_sha`, `run_dir`, `collected_trace_paths`, `diff_stat`, `materialized` (all additive; slice 2's existing fields untouched). A thin `run-arm.ts` CLI composes the pipeline: `prepareRun` → `runOneBrief({ runDir, … })` → `collectRun` → write the enriched manifest. `run-one-brief.ts`'s own CLI stays as the spawn-only entry.

## Coherence rationale

One reviewer holds this in one sitting: it is the single "make a run reproducible" deliverable — isolate, inject, materialize, spawn-in-place, collect — and the parts are inseparable (a checkout with no skill overlay runs the wrong skills; an overlay with no baseline commit pollutes the collected diff; a spawn still pinned to `process.cwd()` ignores the checkout). It rolls back as one unit (three new files + additive manifest fields + a one-line `cwd` thread-through) and touches no production package. It is the first half of the always-anticipated split of `experiment-engine` (project plan § Sequencing rationale), landing ahead of the k=N A/B loop.

## Scope

**In:** `skills-contrib/drive-judge-harness/prepare-run.ts`, `collect-run.ts`, `run-arm.ts` (+ tests); additive `RunManifest` fields in `manifest.ts`; `runDir`/`cwd` thread-through in `run-one-brief.ts` + `sdk-adapter.ts`; a `drive:run-arm` package.json script + new test files wired into `test:scripts`; the slice-scoped `trace.jsonl`; SKILL.md update documenting the pinned skill-bundle input.

**Out (deliberately, owned elsewhere):**
- The k=N A/B loop, cross-run aggregation, dashboard, CI regression gate — TML-2737.
- The LLM judge / calibration — TML-2736 (landed).
- The two-tier scorecard + `tokens`/external-correctness **schema** additions — TML-2720.
- Admitting `@cursor/sdk` into the committed lockfile + a live run — operator-gated (slice 2 open question); this slice ships fully exercisable with the SDK absent (git + fs + mocked materialize).
- An env-pinned trace destination (modifying `emit.ts`) — recorded escape hatch, not built unless post-hoc matching proves ambiguous.

## Pre-investigated edge cases

| Edge case | Disposition | Notes |
|---|---|---|
| Skill overlay pollutes the agent's collected diff | Designed out | The baseline commit after overlay+materialize is the diff cut point; `collect-run` diffs against it, not against `baseRef`. |
| A pre-instrumentation skill bundle emits no trace | Recorded, not failed | `collectRun.untraced = true`; falls back to slice 2's post-hoc parser. Matches the accepted historical-replay limitation. |
| Old base ref won't materialize against the current toolchain | Recorded, not failed | `PreparedRun.materialized = false` + log; the case is not replayable. |
| `git worktree add` on a base already checked out elsewhere | Avoided | `--detach` checks out a commit, not a branch, so no "already checked out" conflict; parallel arms on one base are fine. |

## Slice-specific done conditions

- [ ] `prepare-run`, `collect-run`, `run-arm` typecheck, test, and lint **with no `CURSOR_API_KEY` set and `@cursor/sdk` not installed** (git + fs + mocked materialize; no SDK import on these paths).
- [ ] A test proves the collected diff **excludes the injected skill files** (baseline-commit cut point) when `baseRef != bundle-ref`.

## Open Questions

1. **Isolation: `git worktree --detach` vs full `git clone`?** Working position: **worktree** — cheap (shared object store), and `--detach` removes the branch-conflict limitation. Fall back to clone only if a concrete worktree limitation bites (e.g. the materialized `node_modules` must not be shared — it isn't, worktrees have independent working trees).
2. **Trace collection: post-hoc glob+match vs a-priori env-pin?** Working position: **post-hoc** (glob `*.jsonl`, schema-validate, match by `orchestrator_agent_id`, else newest), keeping `emit.ts` untouched. Env-pin is the escape hatch if matching proves ambiguous on a real run.
3. **Materialization cost in tests.** Working position: **mock the materializer** in unit tests (it shells `pnpm install`); gate any real-materialize test behind an opt-in env flag against a tiny throwaway git fixture, skipped by default so CI stays fast and offline.

## References

- Parent project: `projects/drive-judge-harness/spec.md` · Design: `projects/drive-judge-harness/design-notes.md` § Run setup (skill injection)
- Linear issue: [TML-2755](https://linear.app/prisma-company/issue/TML-2755) (blocks TML-2737)
- Builds on slice 2 (`golden-case-harness`): `skills-contrib/drive-judge-harness/{run-one-brief,sdk-adapter,manifest}.ts`
- Trace schema (collection validation): `skills-contrib/drive-record-traces/`
- Skill/rule materialization: the repo `prepare` hook (`package.json` — `skills add` + `scripts/sync-agent-rules.mjs`)
