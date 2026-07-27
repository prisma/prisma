# Brief: D2 R2 remove duplicated article

## Task

Resolve reviewer finding F3 by removing the duplicated article in the active Prisma Next `0.16-to-0.17` upgrade instructions, leaving the sentence grammatically correct and otherwise unchanged.

## Scope

**In:** `skills/upgrade/prisma-next-upgrade/upgrades/0.16-to-0.17/instructions.md` at the sentence that currently folds to “The The removed `@db.Json` spelling…”.

**Out:** All other documentation, skills, implementation, tests, project artifacts, and unrelated cleanup.

## Completed when

- [ ] The sentence contains a single “The”, F3 is resolved, `git diff --check` passes, and the focused file contains no `The The` sequence.

## Standing instruction

Stay focused on the goal; control scope. Anything beyond this one prose correction halts and surfaces.

## Operational metadata

- **Model tier:** `implementer/fast` (`mid`) — mechanical one-line review repair.
- **Time-box:** 10 minutes.
- **Halt conditions:** The cited text is absent, the repair requires touching another file, or repository state differs from the reviewer’s finding.

## Constraints

- Explicitly stage only the one upgrade instruction file.
- New signed-off commit; no amend and no push.
- Do not touch project artifacts or unrelated untracked paths.