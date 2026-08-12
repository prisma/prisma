# Brief: QA Plan dispatch (post-slice manual-QA script authoring)

**Skill:** `drive-qa-plan` (read [`.claude/skills/drive-qa-plan/SKILL.md`](../../../.claude/skills/drive-qa-plan/SKILL.md) before starting; treat it as the binding spec for what you produce).

**Project context overlay:** [`drive/qa/README.md`](../../../drive/qa/README.md). Read it. It names the substrate locations (demo, examples, extension worked-examples), the standard pre-QA gate, and the where-QA-artefacts-live convention. Honour those.

**Slice DoD invariant (`SDoD4` in the slice spec):** the slice's PR cannot satisfy DoD without `projects/facade-import-surface-completion/manual-qa.md` + ≥1 run report. Your output is the script. The run subagent fires after you finish.

---

## What to author

`projects/facade-import-surface-completion/manual-qa.md` — a manual-QA script for the **TML-2526 facade-completion slice**, structured per `drive-qa-plan` (TOC-first; canonical scenario shape; isolation tags; oracle per scenario; coverage map; no severity pre-classification anywhere).

## Mandatory inputs to read before drafting

1. **Project spec:** [`projects/facade-import-surface-completion/spec.md`](../spec.md) — FRs, NFRs, scope boundary, assumptions A1-A8 (note A8: the deliberate workaround for the mongo facade wrap bug, deferred to TML-2633).
2. **Slice spec:** [`projects/facade-import-surface-completion/slices/facade-completion/spec.md`](../slices/facade-completion/spec.md) — in-scope file list, out-of-scope list, edge-case table (Example-Mapping dispositions), **SDoD1-SDoD9**.
3. **Slice plan:** [`projects/facade-import-surface-completion/slices/facade-completion/plan.md`](../slices/facade-completion/plan.md) — dispatch history (D0-D6, D5e deferred to TML-2633).
4. **Open PR description:** `gh pr view 557 --json title,body,url --jq '.body'` — for the user-facing claims you're QA'ing.
5. **The two mongo workaround files (TML-2633 carve-out):**
   - [`test/integration/test/mongo-runtime/query-builder.test.ts`](../../../test/integration/test/mongo-runtime/query-builder.test.ts) — top-of-file workaround comment.
   - [`test/integration/test/mongo/fixtures/contract.ts`](../../../test/integration/test/mongo/fixtures/contract.ts) — existing workaround comment, updated to reference TML-2633.
6. **Calibration:** [`drive/calibration/dod.md` § QA-side items](../../../drive/calibration/dod.md), [`drive/calibration/failure-modes.md` § QA coverage-gate gaps](../../../drive/calibration/failure-modes.md), [`drive/calibration/patterns.md` § Consumer audiences](../../../drive/calibration/patterns.md).

## Acceptance criteria for your script

The slice doesn't pre-enumerate AC-1/AC-2 IDs — instead the slice's verifiable surface is `SDoD1-SDoD9`, plus the per-edge-case dispositions in the slice spec's edge-case table. Derive your AC list from:

- The **two user-facing claims in the PR's `## Decision` section**: facade subpath parity across 3 targets; `defineContract` wraps that pre-bind `family` + `target`.
- The **`## Behavior changes & evidence` bullets** in the PR — each bullet is a user-observable behavioural claim.
- The **`## Compatibility / migration / risk` section** — the one genuine breaking change (mongo `.` barrel drop) and the backwards-compat claim (target subpaths still work).
- The **TML-2633 carve-out (A8 in project spec)** — known mongo inference regression with a documented workaround.

Number these AC-1, AC-2, … in the script's coverage map. The script's coverage outcome table will be filled by the run subagent against the same IDs.

## Litmus-test-passing scenario candidates (think these through; not a prescriptive list)

Apply the six-bucket litmus test from `drive-qa-plan § The litmus test`. Strong candidates I expect you to evaluate:

| Candidate | Likely bucket | Why it earns its place |
|---|---|---|
| End-to-end fresh-app journey on SQLite (`pnpm prisma-next init` if it exists, else manual scaffold → write `prisma-next.config.ts` + `prisma/contract.ts` using facade form → `pnpm prisma-next migrate dev` → inspect rendered `migration.ts`) | Journey smoke | Sqlite's surface went from `/runtime`-only to full parity — biggest new surface. Rendered migration's import line is observable evidence the renderer flip works end-to-end. |
| End-to-end fresh-app journey on Postgres mirroring the SQLite one | Journey smoke | The flagship target; confirms `defineContract` wrap + `/migration` re-export + renderer flip line up. |
| Mongo `.` barrel drop — negative control | Negative control | The PR's one genuine breaking change. Plant `import x from '@internal/mongo'` in a scratch file; observe the import fail with a useful diagnostic. State coverage boundary (proves the top-level barrel is gone, not that every adjacent ergonomic survives). |
| Mongo `defineContract` inference regression — known-bug re-enactment | Re-enacts originally-failing flow | Open the two workaround-comment files; confirm the comments accurately describe the regression by attempting the facade form first and observing the inference collapse; confirm the workaround in the comments restores correct inference. The script does NOT mark this a failure — the bug is documented and deferred to TML-2633; the scenario proves the workaround comment is honest. |
| Backwards-compat: a pre-existing user repo with a rendered `migration.ts` importing `@internal/target-postgres/migration` continues to work | Journey smoke | NFR2 in project spec. Use one of the example apps' existing committed migrations as the "pre-existing user repo". |
| Tree-shaking observable check: bundle a tiny consumer that imports only one symbol from `@internal/mongo/bson`; verify the bundle doesn't pull the rest of the BSON surface | Observable-quality judgement | The architectural justification for dropping the `.` barrel. Use `esbuild --bundle --metafile` or equivalent; inspect the meta output. |
| Read of skill cluster + READMEs for facade-form-only language | Durable-doc read | D6 swept these. Reader-pass for any "use `target-*`" rhetoric that snuck back in. |
| Exploratory charter on the three facade `/contract-builder` subpaths | Exploratory | 30-min charter. Try authoring contracts with enums, embedded relations, FK chains, capability flags — probe the inference behaviour beyond what scripted scenarios enumerate. |

If you discard any of these, name it in the "Scenarios deliberately not in this script" table with a one-line rationale.

## Isolation-tag discipline

Apply the strictest tag the scenario *actually* needs (per `drive-qa-plan § Isolation tags`). Most scenarios above are `tmpdir`. The "Read of skill cluster + READMEs" is `read-only`. The exploratory charter is `tmpdir`. The "pre-existing user repo" backwards-compat scenario is `tmpdir` (use a copy under `$PN_QA_TMP/scenario-N`).

## Constraints

- **Place the script at `projects/facade-import-surface-completion/manual-qa.md`** (NOT `wip/`).
- **Do not pre-classify finding severity.** Severity belongs to the run report, not the script.
- **Include at least one exploratory charter** with a time budget.
- **Honour SDoD4.** Your script must exist and be runnable for the slice DoD to be satisfiable.
- **Do not run** the script. The run subagent fires separately.
- **Do not edit anything outside `projects/facade-import-surface-completion/manual-qa.md`.** If you discover the slice spec or PR description has drift, surface it in your final report — don't fix it inline.

## Heartbeats + reporting

- Write a heartbeat to `wip/heartbeats/qa-plan.txt` every ~5 min with: current step, time elapsed, blockers.
- On completion, your final message to the orchestrator must include:
  - Path to the script.
  - Line count.
  - The AC-N enumeration you derived (so the orchestrator can sanity-check coverage).
  - The TOC table verbatim.
  - Any 📝 findings about the slice spec / PR description / drive-qa-plan skill itself that you noted but did not fix inline.

## Done-when gates

- [ ] `projects/facade-import-surface-completion/manual-qa.md` exists.
- [ ] First ~50 lines satisfy the TOC-first requirement (frame paragraph + out-of-scope + spec/plan/PR links + TOC table).
- [ ] Every scripted scenario carries all canonical subsections (What you're proving / Covers / Isolation / Oracle / Preconditions / Steps / What you should see / Failure modes / Restore-if-applicable).
- [ ] At least one negative-control scenario (the mongo `.` barrel drop is the obvious candidate).
- [ ] At least one exploratory charter with time budget.
- [ ] "Scenarios deliberately not in this script" table is filled in honestly (don't pad).
- [ ] Sign-off coverage map present; no result column.
- [ ] Self-checklist at end of `drive-qa-plan` § Checklist all green.
