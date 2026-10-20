# Dispatch a: one set of default function signatures; arguments are typed values

Read `common-rules.md` first. Plan decisions 4; design 14.1 to 14.3.

## Today

The six signatures are declared twice, in `packages/3-targets/6-adapters/postgres/src/core/control-mutation-defaults.ts` and the SQLite adapter's file of the same name (identical but for Postgres's `printArguments`); lowering sits in the same files. Arguments use shape combinators (`optional(oneOf(num(4), num(7)))`, `num(2)`, `optional(int({ min: 2, max: 255 }))`) with code `PSL_INVALID_ATTRIBUTE_SYNTAX`. The limits are written in both adapters, `packages/1-framework/2-authoring/ids/src/index.ts` (the TypeScript `nanoid` helper), `packages/2-sql/9-family/src/core/authoring-field-presets.ts` and a test mirror. Arity messages say `Attribute "nanoid"` (`psl-parser` `interpret.ts`). `dataTypeValue` lives in `psl-parser/src/attribute-spec/combinators/data-type-value.ts`.

## Build

1. `packages/2-sql/9-family/src/core/default-function-signatures.ts` exports `sqlDefaultFunctionSignatures({ integer })`, returning the signatures of `autoincrement`, `now`, `ulid`, `uuid`, `cuid`, `nanoid`. Postgres calls it with `pg/int4`, SQLite with `sqlite/integer`. The adapters' copies are deleted; lowering functions stay in the adapters; Postgres keeps `printArguments` if it needs it (move it into the shared signatures if it is target-neutral).
2. The limits are exported once from `@internal/ids` (`packages/1-framework/2-authoring/ids`): `uuid` versions 4 and 7, `cuid` version 2, `nanoid` size 2 to 255. The TypeScript helper, the field presets, the signatures and any test import them; no other file writes them.
3. `uuid(version?)`, `cuid(version)`, `nanoid(size?)` each take one `dataTypeValue` of the integer type, then the function's own check on the value. Messages: `uuid: version must be 4 or 7, got <n>`; `cuid: version must be 2, got <n>`; `nanoid: size must be between 2 and 255, got <n>`. Code `PSL_INVALID_DEFAULT_FUNCTION_ARGUMENT`, at the argument. A value the cast rule refuses (`nanoid(8.5)`) reports the missing cast as `dataTypeValue` does elsewhere.
4. Arity messages for a default function say `Default function "nanoid"`, not `Attribute "nanoid"`. Attributes keep their wording.
5. `oneOf` refuses a `dataTypeValue` arm when it is built, with an `InternalError` naming the arm.
6. Add `PSL_INVALID_DEFAULT_FUNCTION_ARGUMENT` to `docs/reference/error-reference.md` in the form of its neighbours.

## Tests

Each message on Postgres and SQLite (`nanoid(1000)`, `nanoid(1)`, `nanoid(8.5)`, `uuid(5)`, `cuid(1)`, a missing `cuid` version), at the argument's position; valid calls still lower as today. `oneOf` with a `dataTypeValue` arm throws. A grep in the report shows the limits written in one file.

## Done when

Touched packages' tests, both adapters, root `typecheck:agent`, `lint:deps`, `check:error-reference`, `fixtures:check:agent`. The language server's completion and hover for default functions still work (its tests).
