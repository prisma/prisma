# Manual QA — slice-dedupe-generated-imports

> **Be the user.** You run `prisma-next contract emit` and read the generated `contract.d.ts`,
> expecting clean, non-redundant imports — and you re-emit expecting no churn.
>
> **Out of scope of this script.** Re-running the full package suite or CI lints (CI owns
> those).
>
> **Spec:** `brief.md` + `acceptance.md` (this case) · **Plan:** _(filled at run time)_ ·
> **PR:** _(filled at run time)_

## Table of contents

| # | Scenario | What it proves | Isolation | Covers |
| - | -------- | -------------- | --------- | ------ |
| 1 | Emit a Mongo contract, read imports | Each module is imported once; aliases + `type` preserved | `tmpdir` | AC-1, AC-2, AC-3, AC-5 |
| 2 | Re-emit / fixtures:check | Output is deterministic; no churn | working tree | AC-4, AC-6 |
| 3 | Exploratory: SQL / Document output | The fix is family-agnostic, not Mongo-only | `read-only` | (no AC; charter) |

## Pre-flight

1. `git status` clean. Build per the getting-started doc.
2. Have (or scaffold) a contract that imports more than one symbol from a single module —
   e.g. a Mongo contract pulling `CodecTypes` + `Vector` from `adapter-mongo/codec-types`.

## Scenario 1 — Emit and read the generated imports

**From the user's seat:** the emitted `contract.d.ts` imports each module on one line.

**Covers:** AC-1, AC-2, AC-3, AC-5 · **Isolation:** `tmpdir` · **Oracle:** `acceptance.md`.

### Steps

1. In a scratch project, run `prisma-next contract emit`.
2. Open the generated `contract.d.ts` and read the import block.

### What you should see

- The previously-duplicated module appears on a **single** `import type` statement.
- Aliases survive (`CodecTypes as MongoCodecTypes`); the `type` modifier is present.
- The set of imported symbols is unchanged from before the fix.

### Failure modes (runner classifies)

- A module still spread across multiple `import type` lines.
- An alias or the `type` modifier dropped during the merge.
- A symbol added or removed (meaning changed).

## Scenario 2 — Re-emit is deterministic

**From the user's seat:** emitting twice produces no diff.

**Covers:** AC-4, AC-6 · **Isolation:** working tree · **Oracle:** `acceptance.md`.

### Steps

1. `pnpm fixtures:emit` (or the example emit), then `git status`.
2. Emit again; `git status`. Run `pnpm fixtures:check`.

### What you should see

- No fixture churn between the two emits; `fixtures:check` clean.

## Scenario 3 — Exploratory: other families

**Charter.** Spend ~15 minutes inspecting SQL and Document generated output for the same
repeated-import pattern. A correct fix removes it everywhere, not just in Mongo output. Log any
remaining duplication as a finding.

**Covers:** (no specific AC; surfaces whether the fix generalised).

## Sign-off coverage map

| AC ID | Scenario(s) |
| ----- | ----------- |
| AC-1 | 1 |
| AC-2 | 1 |
| AC-3 | 1 |
| AC-4 | 2 |
| AC-5 | 1 |
| AC-6 | 2 |
