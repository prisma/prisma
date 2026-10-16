# Review fixes: findings from the branch review

Read `common-rules.md` first. The findings are in `reviews/system-design-review.md` (D01 to D06) and `reviews/code-review.md` (F01 to F06), next to this folder. Fix each as ruled below, tests first where behaviour changes, one commit per finding or per closely related group.

## Rulings

1. **F01 and F02, the fix text.** The config key is `extensions` in `prisma.config.ts`, not `extensionPacks`. Every user-facing text changes: the infer error's `fix`, the `Unsupported("x")` diagnostic, the error reference entry, the Postgres target README, the tests that pin them. The infer error's `fix` also covers a configured pack that does not support that form of the type. Wording: `If a type comes from a database extension, add the extension's pack to extensions in prisma.config.ts. If the pack is already there, it does not support this form of the type; change the column's type or remove the column from the database.` The `Unsupported("x")` message becomes: `Unsupported("x") is not a Prisma 8 type. Write the column's type with a type constructor, or add the pack of the database extension that declares "x" to extensions in prisma.config.ts.` The error reference entry lists the forms known to stay unclaimed with their pack configured (bare `vector`, `geometry(Point,<srid>)` and other geometry subtypes) and the types with no data type (`interval year to month`, `"char"`, domains, `hstore`).
2. **F03.** Infer prints constructor arguments the way print does: reuse print's `typeArgumentText` (move it where both reach it), so a string argument is quoted.
3. **F04.** The failing pgvector journey asserts `contract.prisma` is unchanged after the failed infer (or absent, if it did not exist).
4. **F05.** Add a language server test: open a document with `Unsupported("hstore")` in a project whose config uses the Postgres target, and assert the diagnostic's message and code. Follow the existing language server diagnostics tests.
5. **F06.** Remove the stale mentions of the type map.
6. **D01.** Move the target-agnostic pieces to the SQL family's `psl-build` (`packages/2-sql/9-family/src/core/psl-build/`): finding the marked constructor of a data type, printing the fewest-arguments call, resolving a column's type through the data types, and the `CONTRACT.INFER_COLUMN_TYPE_UNCLAIMED` error. The Postgres target keeps what is Postgres-specific (enum handling, the walk over its schema tree) and calls them. If a piece turns out to need a Postgres fact, leave it in the target and say why in the report.
7. **D02.** Export the framework's constructor walker and a per-constructor `argumentsFor` from `@internal/framework-components/authoring`, and use them instead of the copies and the one-entry namespace in print. Keep `lint:framework-vocabulary` passing.
8. **D03.** Infer recognises an enum column by `reportedType.kind === 'enum'` and finds its block by `reportedType.schema` and `reportedType.name`, instead of looking up `nativeType` in a set of enum names (including the schema-qualified aliases). Remove the name set if nothing else needs it. Enum tests must pass unchanged in output.
9. **D04.** Fix the `reportedType` doc comment: on Postgres the catalog text of the element type; on SQLite the declared type from `PRAGMA table_info`. The three-field overlap stays until slice 4 renames `nativeType`; no code change.
10. **D05.** A named helper in the SQL data type module computes, once per data type, which parameters may be negative; the resolver uses it.
11. **D06.** Rename `InferredTable` and `InferredColumnTypes` to names that say what they are (introspected input; a lookup function). Export `describeUnresolvedSqlType` from an entry point whose name fits it, not `attribute-specs`; if a fitting one exists use it, otherwise add `./diagnostics`.

## Checks

The touched packages' tests and lint, root `typecheck:agent`, `lint:deps`, `lint:framework-vocabulary`, `check:error-reference`, `lint:docs`, the integration files the slice added or touched, and `mise exec -- pnpm test --coverage` in each touched package compared with its `coverage.config.json` thresholds on the `src` rows.
