# Dispatch d: `Unsupported(...)` leaves Prisma 8

Read `common-rules.md` first. Design: section 13.6 and inventory `projects/data-types-completion/inventory/type-constructors.md` sections 5.1, 5.2 and 5.4 (line numbers are old; check against the branch).

## Build

1. Remove what is left of `Unsupported` in Prisma 8 production code: the PSL printer's `isUnsupported` (`packages/1-framework/2-authoring/psl-printer/src/ast-to-print-document.ts`, `types.ts`) and anything dispatch c left.
2. The Prisma 8 PSL interpreter reports a field typed `Unsupported("x")` with the existing code `PSL_UNSUPPORTED_FIELD_TYPE` (see `packages/2-sql/2-authoring/contract-psl/src/psl-column-resolution.ts`) and this message, at the field's type: `Unsupported("x") is not a Prisma 8 type. Write the column's type with a type constructor, or add the extension pack that declares "x" to extensionPacks in the config.` Today the same input gets the generic message for an unknown type; find where, and add the case there. A field of any other unknown type keeps today's message. If the language server shows interpreter diagnostics, it shows this one with no extra code; check and report.
3. Rewrite the tests in inventory 5.2 that still mention `Unsupported(`: an assertion that output does not contain `Unsupported(` stays only where it still tests something (an enum column must not fall through to the failure); otherwise replace it with an assertion on the actual output.
4. Update `scorecard/03-psl-schema-language.md`'s `Unsupported("...")` row to say Prisma 8 refuses it and `contract infer` fails on unclaimed types.

## Tests

- Emit test: `Unsupported("hstore")` gives the new message at the right position; `Foo` (an unknown name) keeps the old message.

## Check

`git grep -nE '(^|[^A-Za-z])Unsupported\(' -- packages test examples` shows only: the Prisma 6 and Prisma 7 readers, their fixtures, tests and READMEs; `packages/3-extensions/postgres/README.md`; the new message and its test.
