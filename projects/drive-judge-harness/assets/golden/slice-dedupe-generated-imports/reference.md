# Reference output — slice-dedupe-generated-imports

The known-good resolution that shipped for this brief. This is the **reference**, not a
required reproduction: a correct run need not be byte-identical, but it should land in the
same place — one canonical import renderer, fixtures clean.

## Source of truth

- Linear: **TML-2714**
- PR: **#614** — `generate one import per module in contract.d.ts by reusing the shared renderer`
- Base SHA (run the brief against this tree state): `485d437978ba2b558e273a84c42e811cde1a9e97`
- Landed commits (the known-good output):
  - `0b027171cba9ce49983036cb5676fcfe3bb6e10c` — `fix(emitter): dedupe generated import lines via ts-render renderImports`
  - `034ac56fc1f54f302846f9e9e19980830e707f65` — `fix(ts-render): preserve distinct aliases and split invalid type-only default+named imports`

Fetch the real diff with:

```bash
git diff 485d437978ba2b558e273a84c42e811cde1a9e97 034ac56fc1f54f302846f9e9e19980830e707f65
```

## What the known-good solution did

The duplication had a single root cause: **two independent import renderers**. The migration
renderers used `renderImports` in `@internal/ts-render`, which aggregates all named imports
for a module onto one statement (correct); the emitter used its own `generateImportLines`,
which emitted one line per import spec with no per-module aggregation (the bug).

- `generateImportLines` now maps the emitter's `TypesImportSpec[]` to `ImportRequirement[]`
  and delegates to `renderImports` — one canonical renderer serves both call sites.
- `renderImports` gained the only two capabilities the emitter needed that it lacked:
  per-symbol **aliases** (`CodecTypes as MongoCodecTypes`) and **type-only** (`import type`)
  imports, with stable sort order.
- All affected generated fixtures were regenerated.

## Why this is the reference standard

It treats the bug as what it is — renderer drift — and collapses the two renderers to one,
rather than teaching the emitter's private renderer to dedupe (which would leave the two free
to drift again). The fix is family-agnostic by construction: every call site that emits
imports now goes through the same aggregator.
