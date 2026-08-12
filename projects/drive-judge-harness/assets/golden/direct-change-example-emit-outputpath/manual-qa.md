# Manual QA — direct-change-example-emit-outputpath

> **Be the user.** You maintain the example apps and run `prisma-next contract emit`
> expecting it to regenerate the contract the app actually imports — with a clean tree
> afterward.
>
> **Out of scope of this script.** Re-running the full package suite or CI lints (CI owns
> those).
>
> **Spec:** `brief.md` + `acceptance.md` (this case) · **Plan:** n/a (direct change) ·
> **PR:** _(filled at run time)_

## Table of contents

| # | Scenario | What it proves | Isolation | Covers |
| - | -------- | -------------- | --------- | ------ |
| 1 | Re-emit each example | Emit regenerates the tracked, imported artifacts; no stray files | working tree | AC-1, AC-2, AC-3 |
| 2 | App still builds | The app imports its contract from the unchanged path and typechecks | working tree | AC-4, AC-5 |

## Pre-flight

1. `git status` clean before starting.
2. Build per the repo getting-started doc.

## Scenario 1 — Re-emit each example

**From the user's seat:** running emit twice leaves the tree clean and updates the files the
app imports.

**Covers:** AC-1, AC-2, AC-3 · **Isolation:** working tree · **Oracle:** `acceptance.md`.

### Steps

1. Run the example emit (or `pnpm fixtures:emit`) for `paradedb-demo` and
   `prisma-8-demo-sqlite`.
2. `git status`.
3. Run emit a second time; `git status` again.
4. Run `pnpm fixtures:check`.

### What you should see

- Generated `contract.{d.ts,json}` land under each example's `src/prisma/` (the imported
  location).
- No stray untracked `prisma/contract.{d.ts,json}` appear after either emit.
- `pnpm fixtures:check` is clean.

### Failure modes (runner classifies)

- Stray `prisma/contract.*` files reappear after emit.
- `src/prisma/` copies are not updated by emit (still rely on manual copying).
- `fixtures:check` dirty.

## Scenario 2 — App still builds

**From the user's seat:** the import path is unchanged and the app typechecks against the
regenerated contract.

**Covers:** AC-4, AC-5 · **Isolation:** working tree · **Oracle:** `acceptance.md`.

### Steps

1. `pnpm --filter paradedb-demo typecheck` and `pnpm --filter prisma-8-demo-sqlite typecheck`.
2. Confirm the authoring source is still `prisma/contract.ts` and the app import path is
   unchanged.

### What you should see

- Both typechecks pass; authoring layout unchanged.

## Sign-off coverage map

| AC ID | Scenario(s) |
| ----- | ----------- |
| AC-1 | 1 |
| AC-2 | 1 |
| AC-3 | 1 |
| AC-4 | 2 |
| AC-5 | 2 |
