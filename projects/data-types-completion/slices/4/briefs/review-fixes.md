# TML-3387: fixes from the branch review

Read `common-rules.md` first. Findings: `slices/4/reviews/system-design-review.md` (D01 to D10) and `slices/4/reviews/code-review.md` (F01 to F05). One commit per item, tests first where behaviour changes. I edit ADR 254 and the plan; tell me what they now get wrong.

## Code

1. **D01.** Delete `SqlColumnIR.dataType` if nothing in production reads it; `storedType` is the column's type for every comparison. If a reader exists, report it instead of deleting.
2. **D02.** Rename the column's normal-form `typeParams` to `storedTypeParams`, so it is not confused with `codecRef.typeParams` (as written, used for DDL).
3. **D03.** Postgres `safe-widenings.ts` reads `storedType` on both sides.
4. **D04.** `field-event-planner`'s and the many-to-many check's (`validators.ts`) comparisons of two contract columns compare parameters in normal form.
5. **D05.** `typeText` gets a doc comment that says what it is on each side and who reads it (display, DDL, and the targets' default parsing); fix any doc that calls it display-only.
6. **D08.** The resolver returns the `DataType` object, not an id its callers look up again.
7. **F03.** The mismatch message reads well for a type text that contains double quotes (`"char"`) and for an empty SQLite declared type (`The database column has no declared type, which no data type in the configured stack declares.`).
8. **F04.** A committed PGlite test builds a table with other spellings of each claimed type (`int`, `integer`, `character varying(20)`, `timestamp(3) with time zone`, `numeric(10,0)`, `character(1)`, `double precision`, a two-dimensional array, an enum in another schema off the search path, pgvector in an `extensions` schema), then `migration plan` (or the planner) against a matching contract plans no operations and `db verify` is clean. A SQLite counterpart for its declared types.

## Upgrade text

9. **F01.** The extension fragment covers the `PostgresControlAdapter` and `SqliteControlAdapter` constructors, which now require the stack's declared data types, with a before-and-after sample (published at `@prisma/orm-postgres/adapter/control` and the SQLite path).
10. **F02.** The app text says exactly what `typeText` is (the database's reported text, lower-cased on SQLite; an enum named as the contract names it; an extension type without its schema), and notes that `CONTRACT.DEFAULT_INVALID`'s `meta.nativeType` is now `meta.typeText`.

## Not now

- D06 (the Postgres DDL default renderer's list of type names): I record it in `deferred.md`.
- D07 (renaming the `native-type-normalizer` module): its path is published; not worth an upgrade entry now.

## Checks

The touched packages' tests, the new tests, the upgrade-instruction tests, `check:upgrade-coverage --mode pr --prev 90959561c4`, root `typecheck:agent`, `lint:deps`, the slice 4 grep checks. Push to `bot` (never force). Report one line per item with its commit.
