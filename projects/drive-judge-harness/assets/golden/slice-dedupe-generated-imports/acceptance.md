# Acceptance set — slice-dedupe-generated-imports

## Expected triage verdict

`in-project-slice` (or `orphan-slice` if run standalone). One coherent PR: a focused fix to
the emitter's import generation plus regenerated fixtures, one reviewer sitting, one rollback
unit. **Not** a direct change (it touches generation logic + regenerates many fixtures + needs
tests, more than ~30 seconds to verify) and **not** a multi-slice project.

## Expected outcome / requirements

- **AC-1** — Generated contract output imports each module on a **single** statement; the
  repeated-import pattern (same module on multiple `import type` lines) is gone.
- **AC-2** — Per-symbol aliases are preserved on the merged line (e.g.
  `CodecTypes as MongoCodecTypes`).
- **AC-3** — The `import type` (type-only) modifier is preserved.
- **AC-4** — Import order is stable/deterministic (re-emitting is idempotent; no fixture
  churn between two emits).
- **AC-5** — No semantic change to *what* is imported — only how the imports are grouped.
- **AC-6** — Affected generated fixtures are regenerated; `pnpm fixtures:check` is clean.

## Correctness oracle

- **Mechanical:** `pnpm build` + `pnpm fixtures:check` clean; emitter/`ts-render` tests pass,
  including coverage for aliases and type-only imports.
- **Requirements:** AC-1…AC-6 against the diff.
- **Intent / design quality:** the strongest signal is **whether the run recognises the bug is
  family-agnostic and converges the two import renderers to one**. The duplication was
  reported against Mongo, but the same pattern appears anywhere a module contributes more than
  one imported type (SQL and Document targets alike). The root cause is two independent import
  renderers — the migration renderers aggregate correctly via a shared aggregator, while the
  emitter had its own per-spec renderer that didn't. A high-quality run routes the emitter
  through the **shared** aggregator (teaching it aliases + type-only) rather than patching the
  emitter's private renderer in place. A patch-in-place fix satisfies AC-1…AC-6 but leaves the
  two renderers to drift again.

## Failure modes a correct run avoids

- Fixing only the Mongo-reported symptom, leaving SQL/Document output still duplicating.
- Bolting a dedup pass onto the emitter's private renderer instead of converging on the shared
  aggregator (re-introduces the drift that caused the bug).
- Dropping an alias or the `type` modifier while merging (changes meaning / breaks types).
- Non-deterministic merge order producing fixture churn.

## Reference

See `reference.md` — the known-good resolution shipped as PR #614 (TML-2714).
