# Dispatch b: the Prisma 7 reader binds default function arguments through the signatures

Read `common-rules.md` first. Plan decision 2; design 14.4. Dispatch a is done.

## Today

`packages/2-sql/2-authoring/contract-prisma7/src/defaults.ts`: `FUNCTION_ARGUMENT_KEYS` names each function's argument keys by position, `literalArgument` accepts any string, number or boolean, and `lowerFunction` calls the registry entry's `lower` directly with no checks (`cuid` is forced to version 2). So `uuid(5)` lowers to version 4 and `nanoid(1)` passes through.

## Build

1. `lowerFunction` binds arguments through the same signatures dispatch a built (the target's registry), so each argument is read and checked exactly as in Prisma 8 PSL, including the function's own limit.
2. Delete `FUNCTION_ARGUMENT_KEYS`.
3. A refusal keeps the code `PSL.PRISMA7_UNKNOWN_DEFAULT`, with the function's message (`uuid: version must be 4 or 7, got 5`), at the argument.
4. Prisma 7's `cuid()` with no argument means Prisma 7's cuid; keep whatever it lowers to today, and say in the report how it is bound now that `cuid`'s version is required.

## Tests

`uuid(5)`, `nanoid(1)`, `nanoid(1000)`, `nanoid(8.5)` through the Prisma 7 reader, each refused with its message; `uuid()`, `uuid(7)`, `cuid()`, `nanoid()`, `nanoid(12)` accepted and lowered as today.

## Done when

`contract-prisma7` tests with no change to any expected-contract fixture; the `test/integration/test/fixtures/prisma7-source/` journeys; root `typecheck:agent`, `lint:deps`.
