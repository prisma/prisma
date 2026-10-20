# Dispatch e: docs, upgrade note, checks

Read `common-rules.md` first. Dispatches a to d are done.

## Build

1. List for me every statement in ADR 254 (and ADR 231 if it describes default function arguments) that no longer holds, with the line and what is now true; I edit the ADRs.
2. Upgrade note under `upgrade-instructions/pending/` for applications reading a Prisma 7 schema: an out-of-range default function argument (`uuid(5)`, `nanoid(1)`) is now refused instead of lowered to something else, and a named argument such as `nanoid(size: 8)`, which the reader used to accept, is refused as in Prisma 8. For extension authors: every published name this slice removed or renamed (`applicableCodecIds`, the adapters' signature exports, anything else), with before-and-after samples, and detection tests, following `upgrade-instructions/pending/column-types-through-data-types/`.
3. Package READMEs that describe default functions, generators or `@@base`.
4. A grep check row for this slice in `projects/data-types-completion/plan.md`: `applicableCodecIds`, `FUNCTION_ARGUMENT_KEYS`, and the nanoid limits outside `@internal/ids`.

## Done when

Root `typecheck:agent`, `lint:agent`, `lint:deps`, `lint:docs`, `fixtures:check:agent`, `check:error-reference`, `check:upgrade-coverage --mode pr --prev a65442a06b`, and `mise exec -- pnpm test --coverage` in every package the slice touched against its thresholds. Report every result.
