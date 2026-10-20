# Slice 5 build review (TML-3389)

| Dispatch | Round | Commits | Must-fix | Should-fix | Low | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| a | 1 | `0f7e12d1ce..bd60550583` | 0 | 1 | 2 | ANOTHER ROUND NEEDED |
| a | 2 | `b820051918..d0642eb4ce` | 0 | 0 | 0 | SATISFIED |
| b | 1 | `d0642eb4ce..8dd61b8b21` | 0 | 0 | 0 | SATISFIED |

## Dispatch a, round 1

Checks run: `pnpm build`, root `typecheck:agent`, `lint:deps`, `lint:framework-vocabulary`, `check:publish-deps`, `lint:publishability`, `check:error-reference`, `fixtures:check:agent`: all pass. Package tests pass in `ids`, `psl-parser`, `language-server`, `sql-contract-psl`, `sql-contract-ts`, `family-sql`, `contract-prisma7`, both adapters. The language server run had one unhandled `Connection is disposed` error in `test/server.test.ts` with all 1191 tests green; three reruns of that file passed, so it is unrelated. Integration files pass: `authoring/default-function-arguments`, `authoring/cli.emit-parity-fixtures`, `psl-print/generated-values-roundtrip`, `authoring/attribute-specs.lsp-consumability`, `authoring/data-type-value`. No committed contract, snapshot, migration or DDL changed.

Brief items 1 to 6 are built as written. The limits are written once, in `packages/1-framework/2-authoring/ids/src/argument-limits.ts`; the remaining literal `2`/`255`/`7` hits are test assertions of message text, the contract-psl README's usage list, and Postgres psl-print test fixtures.

### Judgements on the implementer's decisions

1. **Two signature shapes.** Right answer. Default function registries are static descriptor metadata, written before a stack exists, while the data types are assembled from every component when the stack is created. The two meet only in the consumer, `scalarDefaultArms`, which already has `ctx.dataTypes`; building the signature there matches how attribute specs are built (factories of the spec context, ADR 249). Building the registry with the data types would change `ComponentMetadata.controlMutationDefaults` for every component and still needs a function. Keeping the plain shape matters because `ControlMutationDefaultEntry` is published through `@prisma/orm-framework/components/control` with `signature: unknown`, so an extension that registers a plain object (the slugid pack in the integration tests is the example) would fail at runtime, not at compile time, if only the function shape were accepted. The new published type `DefaultFunctionSignature` in `contract-psl/attribute-specs` is fine.
2. **`suggestions` on `dataTypeValue`.** Right layer. Completion reads offered values from the argument type's metadata everywhere (`num` value, `str` value, identifier name, tags), and `oneOf(num(4), num(7))` offered `4`/`7` the same way. The existing completion test (`uses actual adapter default-function signatures through the SQL factory`) still asserts `['4', '7']` and `['2']` against the real Postgres registry and passes. The construction is the weak part; see finding 2.
3. **`printArguments` stays Postgres-only.** Acceptable. Its content is target-neutral, but the printers are read only by `contract print` and `contract infer`, and only the Postgres target has `buildPslContract`/`inferPslContract`. Registering them on SQLite would add printers nothing reads. They now import the limits, so nothing is duplicated.
4. **Dependencies.** `@internal/psl-parser` is gone from both adapters' runtime dependencies; Postgres keeps it as a devDependency because its tests import it. `@internal/ids` in `family-sql` is a framework package below the family. `lint:deps`, `check:publish-deps` and `lint:publishability` pass.

The `uuidString()` column in the new integration test is fine until dispatch c.

### S5-a-R1-1 (should-fix): contract-psl tests still assert the old argument messages

Where: `packages/2-sql/2-authoring/contract-psl/test/fixtures.ts` (`uuidSig`, `cuidSig`, `nanoidSig` in `createBuiltinLikeControlMutationDefaults`) and `packages/2-sql/2-authoring/contract-psl/test/interpreter.defaults.functions.test.ts`, test `reports invalid default function arguments with the diagnostics of the function`.

What is wrong: the "builtin-like" fixture still declares `uuid`, `cuid` and `nanoid` with the old shape combinators, so the test asserts `Expected one of: 4 | 7` and `Expected an integer between 2 and 255` with `PSL_INVALID_ATTRIBUTE_SYNTAX`. The shipped stack no longer produces either message. Every fixture registers the plain shape, so no contract-psl test covers the function branch of `signatureFor`, the code this dispatch added to contract-psl.

Change: contract-psl cannot import family-sql, so do not copy the shipped signatures. Register a signature written as a function of the data types whose argument is a `dataTypeValue` of an integer type in the fixture's data types, with a function-specific check, and assert that its diagnostic, code and span come through at the argument. Drop or rewrite the assertions of the old messages. The real messages stay covered by the integration test.

### S5-a-R1-2 (low): `checkedInteger` builds the `dataTypeValue` variant by hand

Where: `packages/2-sql/9-family/src/core/default-function-signatures.ts`, `checkedInteger`.

What is wrong: family-sql copies `kind`, `label`, `dataType`, `tags` and `documentation` out of a `dataTypeValue` into a new object to set `suggestions`, which every other `dataTypeValue` sets to `[]`. psl-parser no longer owns how its own variant is built.

Change: let `dataTypeValue` take `{ suggestions }`, and wrap the value check with a small psl-parser helper that keeps the argument type's metadata (as `mapArg` does) and can refuse. Then family-sql only supplies the check.

### S5-a-R1-3 (low): the new integration test leaves temporary folders behind

Where: `test/integration/test/authoring/default-function-arguments.test.ts`, `author`.

What is wrong: each call creates a folder with `mkdtempSync` in the OS temp folder and never removes it; 27 of the 35 sibling tests that do this remove theirs.

Change: remove the folders after the tests, as the sibling tests do.

Verdict: ANOTHER ROUND NEEDED (finding 1).

## Dispatch a, round 2

All three findings are fixed. S5-a-R1-1: the contract-psl fixture builds `uuid`, `cuid` and `nanoid` as functions of the data types, reading a `pg/int4` value and checking it. The interpreter test now expects the new messages and `PSL_INVALID_DEFAULT_FUNCTION_ARGUMENT`. A new test in `composed-mutation-defaults.test.ts` registers one plain signature and one built from the data types, and checks that both lower and that the built one's refusal is reported at the argument. S5-a-R1-2: `dataTypeValue` takes `{ suggestions }`, and the new `refineArg` in psl-parser keeps the argument type's details and may refuse. Both are tested, including that a refusal of the value skips the check. `checkedInteger` now uses them. S5-a-R1-3: the integration test removes its folders in `afterAll`.

The fixture repeats the three functions' messages instead of importing them. contract-psl cannot import family-sql, so this is accepted. The real messages are covered by the integration test.

Verdict: SATISFIED.

## Dispatch b, round 1

Checks run on `8dd61b8b21`: `pnpm build`, root `typecheck:agent`, `lint:deps`, `lint:framework-vocabulary`, `check:publish-deps`, `lint:publishability`, `fixtures:check:agent`, and `pnpm lint` in contract-prisma7, contract-psl, psl-parser and family-sql: all pass. Package tests pass in psl-parser, contract-psl, contract-prisma7, family-sql, both adapters and the language server. Integration and e2e files pass: `prisma7-source/{supported,relations,implicit-many-to-many-names,verify-against-prisma7-ddl}`, `cli-journeys/prisma7-source.e2e`, `cli-journeys/prisma7-source.remove-nocheck-upgrade.e2e`, `authoring/default-function-arguments`. No expected-contract fixture, committed contract or snapshot changed.

Brief items 1 to 4 are built. `FUNCTION_ARGUMENT_KEYS` and `literalArgument` are gone. The list of Prisma 7 function names is kept as a set, so an extension's function such as `slugid` is still refused as a function Prisma 7 does not have. The new tests fail on the old code: `uuid(5)` lowered to version 4, `cuid(1)` was forced to version 2, and `nanoid(1)` passed through.

### Judgements on the implementer's decisions

1. **`defaultFunctionCall` exported from contract-psl.** Right home. It is the code that builds the `@default` function arm, so Prisma 8 PSL and the Prisma 7 reader now bind arguments through one path. contract-prisma7 already depends on `@internal/sql-contract-psl` (it imports `readDataTypeDefault` from `/resolution`), so no new dependency direction appears. The function is exported from the `attribute-specs` subpath, which is published; that is acceptable.
2. **An empty binder per document.** Sound. Among the argument parsers, only `entityRef` and `fieldRef` read `ctx.binder`. A default function's arguments are literals, and the reader only accepts the six Prisma 7 functions, whose signatures use neither. The binder with no attribute specs still records the document's declarations and fields, and its diagnostics are thrown away. Cost: it is built lazily, at most once per document, on the first default function call that goes through the signature. Almost every real schema has one (`uuid()`, `now()`, `autoincrement()`), so in practice each document pays one extra pass over its attributes, linear in its size. That is acceptable for a reader that runs once per emit.
3. **Refusals.** Each refusal is `PSL.PRISMA7_UNKNOWN_DEFAULT`, spanned at the argument through `mapPslDiagnostics`, with the `Field "Row.value": ` prefix the reader uses for its other default refusals. Arity errors keep the call's span. A missing cast (`nanoid(8.5)`) reports the Prisma 8 message, which names `pg/int4` and `pg/numeric`; this matches Prisma 8 PSL and is accepted.
4. **`cuid`.** A `cuid()` with no arguments is short-circuited to `{ version: 2 }` before the signature, so it still lowers to `cuid2`. `cuid(2)` is bound through the signature, and `cuid(1)` is refused with `cuid: version must be 2, got 1`, as plan decision 2 says. All three are tested.

Named arguments: the old reader accepted `nanoid(size: 8)`; the signature has only positional parameters, so this is now refused as an unknown argument. No fixture or test in the repository writes a named argument to these functions, and Prisma 8 PSL refuses it the same way, so this is not a finding. dispatch e should mention it in the upgrade note next to plan decision 2.

Verdict: SATISFIED.
