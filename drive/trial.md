# Drive trial — framing + recording protocol

> **Trial window:** 2026-05-19 → 2026-06-02 (two weeks). Linear synthesis ticket: [TML-2567](https://linear.app/prisma-company/issue/TML-2567/drive-trial-synthesise-findings-and-prepare-upstream-pr-to-ignite).

## Why we're trialling

The Drive skill set (the `drive-*` family in `skills-contrib/`) and its supporting principles (under `docs/drive/principles/`, migrated from the `drive-domain-model` project) are new. They formalise a Kanban-shaped workflow around Agile-style triage, sizing, briefs, retros, and project-context memory. We want to validate them through real use before sending the canonical bodies upstream to `prisma/ignite` for cross-team adoption.

The trial answers three questions:

1. **Did it work?** Could the skills be invoked end-to-end against real work without the operator having to fight them?
2. **Did it provide value?** Did the rituals (triage verdicts, brief discipline, DoR/DoD, retros, health checks) measurably improve the way work moved, or were they ceremony?
3. **Did it solve the problems we set out to solve?** Specifically: agent drift, scope creep, lost context across runs, expensive operator-side recalibration, decisions evaporating between sessions.

The end-of-trial synthesis (per the Linear ticket) produces a report of problems + suggested actions, and is the basis for the single upstream PR to ignite.

## Recording protocol

While the trial is active, every `drive-*` skill execution may produce one or more **findings**. Findings get recorded in `drive/<category>/findings.md` (sibling of each category's `README.md`).

### Quality bar — when to record

Record a finding when **any** of these is true:

1. **Action-worthy by a maintainer.** Would a maintainer changing the canonical skill body (or its project-context README) act on this? If yes, record.
2. **Repeatable friction.** The next operator running this skill is likely to hit the same thing. If yes, record.
3. **First-use of a skill or skill combination.** The first end-to-end run is worth a brief "first-run notes" entry regardless of outcome — calibrates expectations and gives the synthesis report a baseline.

**Skip when:**

- Routine successful invocation with no surprises.
- One-off operator typo or external blocker (CI flake, network) not caused by the skill.
- The thing is already captured in a prior `findings.md` entry — cross-reference instead of duplicating.

### Tags

Each finding is tagged with one of:

- **`friction`** — slowed down the run or required operator intervention.
- **`gap`** — skill didn't know how to do something it arguably should.
- **`win`** — skill did something unexpectedly well; worth amplifying.
- **`surprise`** — skill behaved correctly per its spec but the spec felt wrong.
- **`boundary`** — friction at the boundary between two skills (handoff, naming, file convention).

### Format

One short stanza per finding. Brevity is a feature — if it needs more than a paragraph, it probably wants its own follow-up artefact (a wip note, a draft ADR, a Linear ticket) and a one-line pointer in `findings.md`.

````markdown
## 2026-05-21 · drive-create-spec · friction

Skill assumed the project already had a Linear ticket; spec creation
stalled when the operator hadn't filed one. The skill should offer to
file one inline when missing rather than refusing.

**Suggested action:** add a "no Linear ticket?" branch at DoR check that
offers to file one inline before proceeding.

**Upstream candidate?** Yes — affects every consumer with Linear.
````

Fields:

- Date (ISO).
- Skill name (the `drive-*` skill that surfaced the finding).
- Tag from the list above.
- One-paragraph summary.
- Optional: **suggested action** (what would resolve this for the next run).
- Optional: **upstream candidate?** — yes / no / maybe, one-line rationale. Influences how the synthesis ticket routes the finding.

## Where findings live

```text
drive/
  health/findings.md
  plan/findings.md
  pr/findings.md
  project/findings.md
  qa/findings.md
  retro/findings.md
  spec/findings.md
  triage/findings.md
```

Each file starts empty (with the header skeleton) and accumulates entries through the trial window.

## End-of-trial synthesis

The Linear synthesis ticket ([TML-2567](https://linear.app/prisma-company/issue/TML-2567/drive-trial-synthesise-findings-and-prepare-upstream-pr-to-ignite)) fires on or after 2026-06-02. The ticket body contains the full agent prompt; the high-level shape is:

1. Reads every `drive/*/findings.md`.
2. Synthesises the entries into a report under `wip/drive-trial-report.md` covering: did-it-work / did-it-provide-value / did-it-solve-the-problems, by skill family, with concrete problems and suggested actions.
3. Classifies each finding as project-specific (stays in `drive/<category>/README.md`), upstream-worthy (queued for the ignite PR), or already-resolved (referenced and closed out).
4. Drafts the upstream PR scope: which canonical drive-* skill bodies need to ship to ignite (verbatim from `skills-contrib/`), which long-lived docs from `docs/drive/` ship alongside, and how to sequence the upstream landing.

The trial doesn't "end" cleanly on a date — it ends when the synthesis ticket's PR merges and we're operating against canonical-from-ignite.

## Updating this doc

If the recording protocol needs to change mid-trial (clarify a tag, add a quality-bar item, change the synthesis target), update this doc directly. Don't fork the protocol per category — keep one source of truth.
