# Drive trial — findings

> **Trial window:** 2026-05-19 → 2026-06-02. See [`drive/trial.md`](../trial.md) for the quality bar, tags, and format. Record only what meets the bar — `friction`, `gap`, `win`, `surprise`, `boundary`. One stanza per finding.

## 2026-05-19 · drive-close-project · gap

Close-out classified files as long-lived based on filename patterns (principles/, model.md, workflow.md, *-conventions.md) and silently migrated them into `docs/<project>/`. Worked for files whose content was steady-state methodology; failed in two ways for files written *during* the project:

1. **Project-shaping voice survived migration.** `problem-statement.md` (a proposal letter to canonical maintainers), `skill-conventions.md` (titled "Skill restructuring plan", with a "What changes from current to final" section + "Build sequencing" + "Upstream promotion (later)"), and `workflow.md`'s "Bold = new (this project adds it); plain = exists today; italic = exists but gets augmented" framing all read as project-execution artefacts but were filed as long-lived methodology. A fresh reader has no baseline for "new vs existing"; the framing becomes incoherent the moment the project closes.
2. **Worked-example pollution.** `principles/definition-of-ready.md` and `definition-of-done.md` each contain a "Worked example for `prisma-next`:" block enumerating overlays — the *exact same content* that was lifted out of `calibration/prisma-next.md` into `drive/<category>/README.md`. The principle docs were migrated; the worked examples weren't reclassified as project context. Result: the same overlay lives in two homes (long-lived + project-context), drifts independently, and the long-lived copy ties methodology to a specific repo's conventions.

Compounding: `trial.md` is named long-lived but documents a specific 2026-05-19 → 2026-06-02 window with a specific Linear ticket — it's transient by construction.

**Suggested action:** add a prose-audit step to `drive-close-project` between Classify and Confirm. For every file classified `long-lived`, the operator (or skill) reads the file and checks for: (a) project-shaping voice (`what we did`, `what's new`, `what changes`, `status under restructure`, `before the restructure`); (b) status blocks tied to the project lifecycle; (c) `Worked example for <repo>` sections that duplicate project-context content; (d) worked examples anchored to specific real-world incidents (specific dates / project names / ticket IDs). Each match yields a per-file disposition: rewrite-at-migration, lift-example-to-context, or reclassify-as-transient. Done concretely in PR #522 as Slices A + B following this finding.

**Upstream candidate?** Yes — affects every consumer of `drive-close-project`. Worth proposing a pattern catalogue in the canonical skill body when this trial synthesises.

