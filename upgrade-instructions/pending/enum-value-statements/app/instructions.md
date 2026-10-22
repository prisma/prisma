---
changes:
  - id: removed-enum-value-questions
    summary: |
      On Postgres and SQLite, when the contract removes a member of an enum, or changes the value a member stores, `migration plan` and `db update` now rewrite the rows that hold the old stored value, and ask about it first. Before, Postgres failed at apply on the new check when a row held the old value, and SQLite planned nothing. If the member was renamed, say so with `--rename Status.ARCHIVED:Status.RETIRED`, which changes the stored value in every row and list that holds it. Answer with `--delete Status.ARCHIVED` to set it to NULL in optional columns and take it out of lists.
---

# A removed enum value is asked about

If your contract removes a member of an enum, for example `ARCHIVED` from `Status`, the next `migration plan` or `db update` asks about it, as it asks about a model or field you remove: once, however many columns hold it.

If you renamed the member, give the rename, and the rows that held the old stored value hold the new one:

```bash
prisma db update --rename Status.ARCHIVED:Status.RETIRED
```

Otherwise the value is removed. A script that runs without a terminal fails with `CLI.CONSENT_REQUIRED`, naming the value. To let it go, add `--delete Status.ARCHIVED`: optional columns that hold it are set to NULL, and lists lose it. A required column cannot take NULL, so while rows of a required column hold the value, the apply fails with `MIGRATION.PRECHECK_FAILED`, changes nothing, counts the rows, and says how to keep them: rename the value to a new member, or set those rows to another value first.

A member renamed with its stored value kept, for example with `RETIRED = "archived"`, changes nothing in the rows, and is not asked about. A member that keeps its name but stores a new value is asked about with `--delete` only; to keep the rows, plan the change with `prisma migration plan --delete Status.ARCHIVED` and replace the `this.removeStoredValue(...)` call in the `migration.ts` it writes with the `this.replaceStoredValue(...)` call the question gives.

Native Postgres enums (`pg.enum(...)`) are unchanged.
