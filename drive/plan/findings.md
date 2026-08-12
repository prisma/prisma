# Drive trial — findings

> **Trial window:** 2026-05-19 → 2026-06-02. See [`drive/trial.md`](../trial.md) for the quality bar, tags, and format. Record only what meets the bar — `friction`, `gap`, `win`, `surprise`, `boundary`. One stanza per finding.

## 2026-05-20 · drive-build-workflow · gap

Initial dispatches in the project's slice loop omitted the `model` parameter when calling the `Task` tool. Sub-agents silently inherited the orchestrator's tier (claude-opus-4-7-thinking-high in this run) — expensive and over-specified for mechanical implementer/specialist work. Caught by operator's review of cost; established a per-dispatch model-selection policy.

**Suggested action:** add an explicit `Model:` field to the three delegate templates under `skills-contrib/drive-build-workflow/templates/` so authors can't omit it without noticing. (Landed in the same PR as this finding.)

**Upstream candidate?** Yes — model inheritance is a feature of multiple harnesses (Cursor, Claude Code at minimum); the dispatch templates should treat model selection as required everywhere.
