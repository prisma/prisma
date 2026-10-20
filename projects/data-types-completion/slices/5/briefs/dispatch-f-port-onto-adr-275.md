# Dispatch f: merge main and port this slice onto ADR 275's generators

Read `common-rules.md` first, then the plan's amendment (decision 6), then `docs/architecture docs/adrs/ADR 275 - Client generators are field attributes, and a type alias is expanded into each column.md` on `bot/main`, and how `main` implements it (`packages/2-sql/9-family/src/core/generator-functions.ts`, `GeneratorFunctionBinding`, the adapters' bindings, the Prisma 7 reader's client-function path).

## Build

1. Merge `bot/main` (`mise exec -- git merge --no-ff --signoff --no-edit FETCH_HEAD`, never rebase). Where this slice and ADR 275 collide, ADR 275 wins: generators are `@onCreate`/`@onUpdate`, resolved through codec bindings. Remove this slice's `applicableDataTypes`, `writesText`, generators reading `textDataTypes`, and their tests, notes and README lines.
2. Port the typed arguments onto main's generator-function signatures: `uuid(version?)`, `cuid(version)`, `nanoid(size?)` take a `dataTypeValue` of the target's integer type, then the function's own check, with this slice's messages, code and hover labels; the limits come from `@internal/ids` and main's local constants go. A signature that needs the stack's data types uses this slice's "a signature or a function of the data types" form; extend main's registry type to accept it. Follow `main`'s vocabulary for names and messages (`Generator function "nanoid"` if `main` calls them that); if the code `PSL_INVALID_DEFAULT_FUNCTION_ARGUMENT` no longer fits, rename it and its error reference entry, and say what you chose.
3. Length check inside the bindings: every generator states how many characters it writes (`@internal/ids`), and a binding refuses a column whose length, in its type's normal form, is shorter, with a message that names both lengths. `main` already does this for `nanoid` against `Char(n)`/`VarChar(n)`; extend it to every generator and to a bare `Char`. SQLite columns are never refused for length.
4. `sqlDefaultFunctions` keeps only the database defaults `main` keeps (`autoincrement`, `now`); keep its single home in the family.
5. The Prisma 7 reader checks its client functions' arguments through main's registry, with this slice's messages; `uuid(5)`, `nanoid(1)`, `nanoid(8.5)`, `cuid(1)` refused; a named argument refused.
6. Dispatch d (discriminators, `textDataTypes`) stays as built.
7. Rewrite the upgrade notes under `upgrade-instructions/pending/default-function-arguments-and-generator-data-types/` for what survives (rename the folder if the name no longer fits), and drop what ADR 275's own notes already cover.
8. List for me every statement in ADRs 254, 231 and 275 that is now wrong; I edit them.

## Done when

Root `typecheck:agent`, `lint:agent`, `lint:deps`, `lint:framework-vocabulary`, `fixtures:check`, `check:error-reference`, `check:upgrade-coverage --mode pr`, the slice's grep rows (update them to what survives), the tests of every touched package, and the slice's integration files rewritten to `@onCreate`. Push to `bot` (never force). Report what you ported, what you dropped, and the merge's conflicts and how you resolved them.
