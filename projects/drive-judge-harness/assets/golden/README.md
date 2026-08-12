# Golden-case library

Canonical Drive briefs with co-located acceptance sets and pre-written QA plans. The `run-one-brief` harness (`skills-contrib/drive-judge-harness/`) spawns an orchestrator run on a brief; the resulting natively-instrumented trace accretes the corpus the LLM judge (TML-2736) calibrates against, and the acceptance set + QA plan supply the Tier-1 correctness signal (validation gates + QA run + judge intent).

These are **durable** project assets and migrate to `docs/drive/` at project close-out.

## Anatomy of a case

Each `<case-slug>/` directory holds:

| File | Role |
|---|---|
| `case.json` | Machine-readable metadata. The harness reads `slug`, `title`, `shape`, `recommended_model`, `summary`. Real-history cases also carry `source` (`linear` id + `prs` + `merge_shas`) and `base_sha` — the harness loader ignores the extra fields today; the experiment-engine slice will wire `base_sha` into a checkout. |
| `brief.md` | The Drive entry-point — the work description an orchestrator runs. For real-history cases this is the task **as posed** (the Linear ticket), solution-scrubbed so the run still has to do the design/planning work. |
| `acceptance.md` | The acceptance set: expected triage verdict, expected outcome / requirements, and the **correctness oracle**. |
| `reference.md` | _(real-history cases)_ The **known-good output** — the merged PR(s) by SHA, a prose description of what the shipped solution did, and why it's the reference standard. The output itself is fetchable via `git diff <base_sha> <merge_sha>`. |
| `manual-qa.md` | A pre-written `drive-qa-plan` script so the QA-run correctness signal is deterministic at run time. |

## The cases (Drive-shape spread)

The three normal-shape cases are drawn from **real merged history** — authentic briefs, real
base/merge SHAs, and a reference output — so the corpus measures runs against work the team
actually shipped, not synthesised tasks. The two pathological cases stay synthetic: no clean
merged PR exhibits a halted or spiked run, so those shapes have to be constructed.

| Slug | Drive shape | Provenance | Why it's in the corpus |
|---|---|---|---|
| `direct-change-example-emit-outputpath` | direct change | real — TML-2722 / #618 | The smallest legitimate Drive unit — verify directly, no spec/plan ceremony. Tests root-cause discipline + scope (don't promote to a project). |
| `slice-dedupe-generated-imports` | single in-project slice | real — TML-2714 / #614 | One coherent PR (spec + plan + one build loop). Tests design quality: converge two renderers, don't patch the symptom. |
| `project-reap-subsumed-ir-surfaces` | multi-slice project | real — TML-2727 / #630, #631, #629 | Tests the **planner**: three disjoint surfaces that should be scheduled in **parallel**, with structurally-coupled surfaces correctly **deferred**. |
| `i12-halt-storage-assumption` | I12 halt / re-plan | synthetic | The brief's load-bearing assumption is false; a correct run **halts and re-plans** rather than inventing the missing capability. |
| `spike-first-flaky-test` | spike-first triage | synthetic | Unknown root cause; a correct run **spikes before sizing** rather than guessing a fix. |

The spread is deliberate: floor-raising needs a handful of high-signal cases covering the shape space, not hundreds of speculative briefs (project design-notes § Alternatives considered).
