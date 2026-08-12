# Acceptance set — direct-change-example-emit-outputpath

## Expected triage verdict

`direct-change`. The fix is a config alignment in two example apps; it is verifiable in well
under a minute (re-emit, confirm no stray files, confirm fixtures clean). A correct run does
**not** stand up a project spec/plan or a multi-slice plan for it. A small companion change
(teaching one family's `defineConfig` to accept the output-path option, with a test) is still
within the direct-change envelope — it's the minimal enabling change, not scope inflation.

## Expected outcome / requirements

- **AC-1** — After the change, `prisma-next contract emit` for both examples writes the
  generated `contract.{d.ts,json}` to the **tracked** location the app imports from
  (`src/prisma/`), not to `prisma/`.
- **AC-2** — A second emit leaves the working tree clean: no stray untracked
  `prisma/contract.{d.ts,json}` files appear.
- **AC-3** — `pnpm fixtures:check` passes with no manual copying.
- **AC-4** — Both example apps still typecheck and import their contract correctly; the app
  import path is unchanged.
- **AC-5** — The authoring source stays at `prisma/contract.ts` (the fix realigns the output
  path; it does not relocate the authoring layout).

## Correctness oracle

- **Mechanical:** `pnpm fixtures:check` clean; `pnpm --filter paradedb-demo typecheck` and
  `pnpm --filter prisma-8-demo-sqlite typecheck` pass; any config-package tests pass.
- **Requirements:** AC-1…AC-5 against the diff.
- **Intent:** the root cause (emit output path diverged from the tracked, imported location)
  is fixed at the source — not papered over with a copy step in tooling. A correct run
  identifies that the output path, not the authoring path, is misaligned and decouples the
  two.

## Failure modes a correct run avoids

- Adding a copy/sync step to the fixtures tooling instead of fixing the misaligned output
  path (papers over the root cause).
- Relocating the authoring `contract.ts` into `src/prisma/` (larger churn, changes the
  examples' deliberate authoring layout, no functional gain).
- Leaving the stray untracked `prisma/` artifacts behind.
- Promoting a one-config-line fix into a project/slice with spec + plan ceremony.

## Reference

See `reference.md` — the known-good resolution shipped as PR #618 (TML-2722).
