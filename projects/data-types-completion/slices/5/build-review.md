# Slice 5 build review (TML-3389)

| Dispatch | Round | Commits | Must-fix | Should-fix | Low | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| a | 1 | `0f7e12d1ce..bd60550583` | 0 | 1 | 2 | ANOTHER ROUND NEEDED |
| a | 2 | `b820051918..d0642eb4ce` | 0 | 0 | 0 | SATISFIED |
| b | 1 | `d0642eb4ce..8dd61b8b21` | 0 | 0 | 0 | SATISFIED |
| c | 1 | `bc5265338a..d1dd5482ea` | 1 | 1 | 0 | ANOTHER ROUND NEEDED |
| c | 2 | `fc01dc5f4f`, `80c2950c68` | 0 | 0 | 0 | SATISFIED |
| d | 1 | `e8b28ec8e1..ca60a4a8a4` | 1 | 1 | 0 | ANOTHER ROUND NEEDED |
| d | 2 | `9863d741cc`, `5ba8816b9e` | 0 | 0 | 1 | SATISFIED |
| e | 1 | `5ba8816b9e..c4421f6562` | 0 | 2 | 2 | ANOTHER ROUND NEEDED |
| branch review fixes | 1 | `14335e1dd3..24528d379e` | 0 | 1 | 3 | SATISFIED once S5-BR-R1-1 is fixed |
| f (port onto ADR 275) | 1 | `9a3eeb66b2..656998d34d` | 0 | 1 | 3 | SATISFIED once S5-f-R1-1 is fixed |
| f (port onto ADR 275) | 2 | `abbf900bdd`, `cd161b2ba5`, `397205593b`, `fe4fe6a215` (+ ADR `9dbc5aac5e`) | 0 | 0 | 1 | SATISFIED |

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

## Dispatch c, round 1

Checks run on `d1dd5482ea`: `pnpm build`, root `typecheck:agent`, `lint:deps`, `check:publish-deps`, `lint:publishability` and `fixtures:check:agent` pass. `lint:framework-vocabulary` fails (finding 1). Tests and `pnpm lint` pass in framework-components, ids, contract-psl, contract-ts, contract-prisma7, family-sql, both adapters and the language server. Integration files pass: `authoring/generator-applicability`, `authoring/default-function-arguments`, `authoring/cli.emit-parity-fixtures`, `psl-print/generated-values-roundtrip` and `prisma7-source/supported`. No committed contract, snapshot or DDL changed. The slice's grep for `applicableCodecIds` and `FUNCTION_ARGUMENT_KEYS` in `packages` returns nothing.

Brief items 1 to 3 are built. At the base commit, nothing outside the files this dispatch touches read `applicableCodecIds`: not the TypeScript builder, the language server, Mongo or the docs. So item 3 needed no other change. SQLite has no `Char`/`VarChar` constructors, so its tests use `uuidString()` (`sqlite/character`) and `sql.String(36)` (`sqlite/character-varying`); this is accepted.

### Judgements on the implementer's decisions

1. **`@internal/ids` names no codec and only says `writesUuid`.** Right. Which columns can hold a generator's value is a fact about the target's data types, and the framework cannot know a target's data type ids. The one fact that does belong to the generator, that it writes a UUID, stays with the generator.
2. **`sqlBuiltinGeneratorDescriptors({ text, uuid })` in family-sql.** Right home. Both SQL targets build their descriptors the same way, and each passes only its data types: Postgres `pg/text`, `pg/char`, `pg/varchar` plus `pg/uuid`, and SQLite `sqlite/text`, `sqlite/character`, `sqlite/character-varying` with no UUID types.
3. **Comparing the codec's data type, and falling back to naming the codec.** The comparison is right. In a real stack the fallback cannot run: the column's codec id comes from the same codec lookup the check reads, and `data-type-default.ts` already throws an `InternalError` in the same situation. As a probe I replaced the fallback with a throw and ran the whole contract-psl suite (745 tests); nothing reached it. The probe was reverted. See finding 2.
4. **The "pack codec of `pg/text`" test fails on the old code.** Confirmed. With the old `psl-column-resolution.ts`, its codec id comparison fed the list `pg/text@1`, `sql/char@1`, only that test fails, with `... with codecId "pack/slug@1"`. The other five tests in the file pass. The probe was reverted.

### Notes for dispatch e's upgrade note

An extension that declares generators must change two things:
- **The descriptor field.** `MutationDefaultGeneratorDescriptor.applicableCodecIds` (codec ids such as `pg/text@1`) is now `applicableDataTypes`: data type ids built with `dataTypeId('pg/text')`. A column qualifies when its codec's data type is listed, so one entry covers every codec of that type, including codecs from other packs. A descriptor that still sets `applicableCodecIds` fails to compile when written as a typed object literal. Built any other way, it is treated as having no list, and its generator is refused in `@default(...)` with the misleading "not applicable to `@default(...)` lowering, use the field preset" message.
- **The published metadata.** `builtinGeneratorRegistryMetadata`, published as `@prisma/orm-framework/ids`, now gives `{ id, writesUuid }` instead of `{ id, applicableCodecIds }`.

The applicability message now names the column's data type, not its codec id.

### S5-c-R1-1 (must-fix): `lint:framework-vocabulary` fails

Where: `scripts/lint-framework-vocabulary.config.json`.

What is wrong: removing the codec ids from `@internal/ids` lowers the count of target words in `packages/1-framework` from 243 to 237. The ratchet fails until the threshold is lowered, and it runs in CI.

Change: set the `packages/1-framework` threshold to 237, as the script says.

### S5-c-R1-2 (should-fix): the applicability check handles a codec with no descriptor as a user error

Where: `packages/2-sql/2-authoring/contract-psl/src/psl-column-resolution.ts`, `lowerDefaultForField`, and the `dataType === undefined` arm of its message.

What is wrong: when the column's codec has no descriptor, the check reports `PSL_INVALID_DEFAULT_APPLICABILITY` naming the codec. A real stack cannot get there, because the column was resolved from that lookup. No test reaches it. `data-type-default.ts` treats the same situation as an `InternalError`.

Change: throw an `InternalError`, as `data-type-default.ts` does, and drop the codec arm of the message.

## Dispatch c, round 2

S5-c-R1-1: the `packages/1-framework` threshold is 237, and `lint:framework-vocabulary` passes. S5-c-R1-2: a column with no codec descriptor now throws an `InternalError` with the same wording as `data-type-default.ts`. The message names only the data type. A new contract-psl test checks the throw. Checks run on `ca60a4a8a4` (below) include both.

Verdict: SATISFIED.

## Dispatch d, round 1

Brief as ruled in `e8b28ec8e1`: discriminators stay text-typed, and the contract shape does not change.

Checks run on `ca60a4a8a4`: `pnpm build`, root `typecheck:agent`, `lint:deps`, `lint:framework-vocabulary`, `check:publish-deps`, `lint:publishability` and `fixtures:check:agent` pass. The first `fixtures:check:agent` run timed out at 300 seconds with the machine's load average at 105; the second passed. Tests and `pnpm lint` pass in SQL contract-psl, Mongo contract-psl and sql-orm-client. The language server's `attribute-spec-consumability` and `completion-provider` files pass. In two full runs of the language server suite, two or three `server.membership-races`/`server.test.ts` tests timed out at 500 ms under that load; neither file is touched by this diff. Integration files pass: `authoring/discriminator-values`, `sql-orm-client/polymorphism-char-discriminator`, `polymorphism`, `polymorphism-variant-create`, `polymorphism-include`, `polymorphism-namespaces`, `mongo/target-runner/runner-polymorphism` and `psl-print/authored-contract-roundtrip`. No committed contract, snapshot or DDL changed.

### Judgements on the implementer's decisions

1. **Discriminator columns beyond `String`.** `Char` and `VarChar` are needed: the brief's own tests use `VarChar(5)` and `Char(6)`. The rule as written accepts more than the text types, though; see finding 1.
2. **The ORM runtime needed no change.** Confirmed in the code. Writes put the variant's value into the row, and `query-plan-mutations.ts` binds every column through `codecRefForStorageColumn`. The `variant()` filter binds the value with `paramRefForStorageColumn` (`collection.ts`). Rows are read through each projection's codec ref, including the hidden discriminator projection (`buildHiddenDiscriminatorProjection` in `query-plan-select.ts`). `mapPolymorphicRow` and `createPolymorphicRowMapper` then compare the decoded value with the contract's text keys. The `Char(6)` test exercises all three paths on PGlite: `variant('box').all()` filters, `select` without `kind` uses the hidden projection, and the raw query shows the stored `'box   '` padding.
3. **Mongo unchanged.** The conclusion holds, for a simpler reason than the one given. A Mongo discriminator must be `String` (Mongo `interpreter.ts`), and the Mongo `@@base` keeps its own `str()` spec. The value its codec writes is the string itself, so the `$jsonSchema` enum already holds the codec's value, and a quoted string is the only value a `String` column admits.
4. **The `VarChar(5)` length test is Postgres-only.** Accepted. SQLite has no `VarChar` constructor, and its `character-varying` does not enforce a length. The length refusal is reported on the whole `@@base` attribute with the default's wording ("pg/varchar JSON value must be a string of at most 5 characters"), exactly as for a default. The cast refusal for a number is at the value. Both match "with the diagnostics of a default".
5. **Accepting `string | number | boolean` at the parser.** Not the right shape now that discriminators are text only; see finding 2.

### S5-d-R1-1 (must-fix): a discriminator may now be a UUID, bit string or IP address column

Where: `packages/2-sql/2-authoring/contract-psl/src/interpreter.ts`, `isTextColumn`.

What is wrong: the rule accepts a column whose data type is the type a quoted string is written as, or any type that casts from it. On Postgres, `pg/uuid`, `pg/bit`, `pg/varbit` and `pg/inet` all cast from `pg/text`. A probe, run through the integration test's authoring helper and then deleted, emitted these without errors:
- `kind Uuid` with `@@base(Shape, "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11")`
- `kind Bit(4)` with `@@base(Shape, "1010")`
- `kind Inet` with `@@base(Shape, "10.0.0.1")`

Today all three are refused. The ruling says discriminators stay text-typed, and the report's "`String`, `Char`, `VarChar` or a named type over them" does not describe what the code accepts. None of these columns has an ORM round-trip test.

Change: accept only the target's text data types. Have the target name them, as it does for `sqlBuiltinGeneratorDescriptors({ text })`, rather than deriving them from casts. Add tests that `Uuid` and `Inet` discriminators are refused. A wider rule would need a ruling first.

### S5-d-R1-2 (should-fix): signature help offers numbers and booleans for a text-only value

Where: `packages/2-sql/2-authoring/contract-psl/src/sql-attribute-specs.ts`, `baseModelSpec`; `language-server/test/attribute-spec-consumability.test.ts`.

What is wrong: the value is `oneOf(writtenScalar(str()), writtenScalar(numLiteral()), writtenScalar(bool()))`, so signature help shows `@@base(model reference, string | number | boolean)`. No text discriminator takes a number or a boolean; the parser accepts them only for the cast to refuse them.

Change: take `writtenScalar(str())`, so the label is `string` as on Mongo. Keep the cast into the column's type for the length and padding checks. Update the number test to the parser's refusal at the value.

## Dispatch d, round 2

S5-d-R1-1 is fixed. Each SQL target names its text data types (`postgresTextDataTypes`, `sqliteTextDataTypes`: text, character, character varying). Its adapter contributes them as `authoring.textDataTypes` and passes the same list to `sqlBuiltinGeneratorDescriptors`. The discriminator check accepts only those types. New tests refuse `Uuid` and `Inet` on Postgres and `Int` on SQLite, and assembly is tested to merge and deduplicate the lists. S5-d-R1-2 is fixed: `@@base`'s value is `writtenScalar(str())`, signature help reads `@@base(model reference, string)`, and a number is refused at the value with `Expected a string literal`.

**A new framework contribution as the home.** Acceptable. `AuthoringContributions` is how a component tells authoring about its data types, and "which types hold text" is not specific to SQL. The adapter declares it beside `valueObjectStorageType`, and the same list feeds the generator descriptors, so there is one source per target. A flag on each data type's authoring entry would put the fact where the type is declared. The list is a reasonable choice for now, and nothing published depends on it yet.

### S5-d-R2-1 (low): the assembled `textDataTypes` is optional although assembly always sets it

Where: `AssembledAuthoringContributions.textDataTypes` in `framework-components/src/control/control-stack.ts`; `input.authoringContributions?.textDataTypes ?? []` in contract-psl `interpreter.ts`.

What is wrong: `assembleAuthoringContributions` always returns a list, as it does for `dataTypes`, which is required. Because the field is optional, any authoring contributions not built by assembly lose the list silently, and every discriminator is then refused with "must be text". Those are 11 typed sites in tests and tools.

Change: make it required, as `dataTypes` is, and drop the `?? []`. Acceptable to leave if the orchestrator prefers not to touch the hand-built fixtures.

Verdict: SATISFIED.

## Dispatch e, round 1

Checks run on `c4421f6562`:
- **Repo checks:** `pnpm build`, root `typecheck:agent`, `lint:agent`, `lint:deps`, `lint:docs`, `lint:framework-vocabulary`, `check:publish-deps`, `lint:publishability`, `check:error-reference` and `check:upgrade-coverage --mode pr --prev a65442a06b` pass.
- **Fixtures:** `fixtures:check:agent` timed out twice at its 300-second wrapper limit, at load average 80 to 150. Run directly as `pnpm fixtures:check`, it passed and left the tree clean.
- **Integration files:** the upgrade detection test passes (46 tests; each change has a positive and a negative sample), and so does `authoring/discriminator-values`.
- **Coverage:** `pnpm test --coverage` passes, thresholds included, in ids, psl-parser, framework-components, SQL contract-psl, contract-ts, contract-prisma7, family-sql, both adapters and both targets.
- **Language server:** it has no coverage thresholds (`"thresholds": {}`). Two full coverage runs at load average 40 to 55 failed 2 and 4 tests, all in `server.membership-races` and all on its 500 ms test timeout. Run alone, that file and `server.directive-membership` passed three times out of three at the same load. Neither file nor the server code is touched by the slice, so these are load failures, not regressions.
- **Grep rows:** the slice's two rows in `plan.md` return what they say.

### Judgements

1. **ADR list (brief item 1):** not judged; the orchestrator is editing ADRs 254 and 231.
2. **App upgrade note, read cold.** It is accurate and usable: it says what changed, shows before and after, and tells the reader which value keeps today's stored data (`uuid(5)` made version 4 UUIDs). The detection patterns match each refused form and skip the valid ones; the test proves both. One inaccuracy; see finding 3.
3. **Extension upgrade note, read cold.** Every published import path it names exists: `@prisma/orm-framework/components/codec` (`dataTypeId`), `/components/control`, `/ids`, `/psl-parser`, `@prisma/orm-family-sql/family/control`, `/contract-psl/attribute-specs` and `@prisma/orm-postgres/target/data-types`. The samples match the code. One wrong claim; see finding 2.
4. **Hover regression.** Yes, the label should list the allowed values again; see finding 1.

### S5-e-R1-1 (should-fix): signature help and hover lost the allowed versions

Where: `packages/2-sql/9-family/src/core/default-function-signatures.ts`, `checkedInteger`; the `language-server` README.

What is wrong: the argument's label is now the integer data type's ("a number"). Signature help and hover therefore show `uuid(a number?)`, `cuid(a number)` and `nanoid(a number?)`, where they showed `uuid((4 | 7)?)`, `cuid(2)` and `nanoid(integer?)`. Completion still offers `4`/`7` and `2`, so the label and the completion list now disagree. The dispatch e README edit wrote the regression into the docs as the example.

Change: give the checked argument the label of the values the function takes: `4 | 7` for `uuid` and `2` for `cuid`, from the limits already imported. For `nanoid`, use a label for the range or keep the data type's. A `label` option on `dataTypeValue` (beside `suggestions`), or setting it on the refined argument, would do. Restore `uuid((4 | 7)?)` in the README. Add a language server test asserting the hover or signature label for `uuid`.

### S5-e-R1-2 (should-fix): the extension note says an extension can extend the built-in generators

Where: `upgrade-instructions/pending/default-function-arguments-and-generator-data-types/extension/instructions.md`, change `text-data-types`.

What is wrong: it says an extension that wants "the built-in ID generators to apply to" its text type names it "in the `text` list of its generator descriptors". An extension cannot do that. The built-in generators' descriptors are registered once, by the target's adapter, and a second descriptor with the same id is refused at assembly (`Duplicate mutation default generator id`). Only `@@discriminator` reads `textDataTypes`.

Change: say that `textDataTypes` makes the extension's type usable as a discriminator column. Say that the built-in generators apply to the target's own text types only, and that an extension's own generators list the types they apply to in `applicableDataTypes`.

### S5-e-R1-3 (low): the discriminator message change is SQL only

Where: app note, change `discriminator-must-be-text`.

What is wrong: Mongo's interpreter still says `must be of type String`. The note and its detection pattern read as if every family changed, so a Mongo project's test matching the old text is flagged for a change it does not have.

Change: say "a SQL `@@discriminator` field". If possible, narrow the detection, or note that Mongo is unchanged.

### S5-e-R1-4 (low): the contract-psl README overstates SQLite's text types

Where: `packages/2-sql/2-authoring/contract-psl/README.md`, Polymorphism.

What is wrong: "on Postgres and SQLite `String`, `Char(n)` and `VarChar(n)`". SQLite has no `Char`/`VarChar` constructors; its fixed and bounded text columns come from `uuidString()` and `sql.String(n)`, as the tests use.

Change: name SQLite's own spellings, or say "the target's text types (on Postgres `String`, `Char(n)`, `VarChar(n)`)".

## Branch review fixes, round 1

Rulings: `slices/5/briefs/review-fixes.md`, for findings D01 to D09 and F01 to F05 in `slices/5/reviews/`.

Checks run on `24528d379e`:
- **Repo checks:** `pnpm build`, root `typecheck:agent`, `lint:deps`, `lint:framework-vocabulary`, `lint:docs`, `check:publish-deps`, `lint:publishability`, `check:error-reference` and `check:upgrade-coverage --mode pr --prev a65442a06b` pass.
- **Fixtures:** `pnpm fixtures:check`, run directly because of the load, passes and leaves the tree clean.
- **Package tests:** tests and `pnpm lint` pass in ids, framework-components, psl-parser, SQL contract-psl, contract-prisma7, family-sql, both adapters and both targets. The Postgres adapter's full run had one 8-second timeout in `render-typescript.roundtrip`; that file passed alone (8 of 8), at load average 110 to 126.
- **Integration files:** these pass: `authoring/generator-applicability`, `default-function-arguments`, `discriminator-values`, `extension-text-type`, the upgrade detection test (52), `sql-orm-client/polymorphism-char-discriminator`, `psl-print/generated-values-roundtrip` and `authoring/cli.emit-parity-fixtures`.

### Each item against its ruling

1. **D01, D02 (`d06855b763`): closed.** Each target's descriptor meta contributes `textDataTypes`, and the adapters no longer do; a test asserts the target names them and the adapter does not. Built-in generators carry `writesText: true`, and `lowerDefaultForField` checks them against the `textDataTypes` it is given when the default is checked, not against a list fixed in the registry. `sqlBuiltinGeneratorDescriptors({ uuid })` takes only the UUID types. `extension-text-type.test.ts` adds a test pack's text type through `textDataTypes` and shows it works as a discriminator and takes `uuid()`.
2. **F01 (`4d9654cd62`, `24528d379e`): closed, with SQLite open (S5-BR-R1-2).** Each generator's stated length comes from `generatedStorage` in `@internal/ids` under the lowered params. I checked those against what the runtime generators (`uniku`) actually write, over 200 values each: `uuidv4` and `uuidv7` 36, `ulid` 26, `cuid2` 24, `ksuid` 27, `nanoid()` 21, `nanoid({ size: 8 })` 8, `nanoid({ size: 255 })` 255. All match. The check uses the same params the runtime receives, so `nanoid(n)` is checked against `n`. A column with no length (`VarChar`, `String`, `Uuid`) is never refused. A bare `Char` is `character(1)` in normal form and refuses `uuid()`. On Postgres, `VarChar(5) @default(uuid())`, a named type over `VarChar(3)` with `cuid(2)`, `Char(5) @default(nanoid())` and `Char(10) @default(nanoid(20))` are refused naming both lengths; `VarChar(36)` and `Char(36)` with `uuid()` emit.
3. **F02 (`a546c32f92`): closed.** The `@@base` value's codec refusal is spanned at the value; the test was updated.
4. **F03 (`0709f88f92`): closed.** `nanoid(8.0)`, `uuid(4.0)`, `uuid(7.0)` and `cuid(2.0)` are tested as `PSL_VALUE_TYPE_INCOMPATIBLE` at the argument on both targets. The app note has a `default-function-argument-with-fraction` change with the fix and detection samples.
5. **F05 (`114139a562`): closed.** `nanoid(3000000000)` is tested on both targets: Postgres reports that `pg/int4` cannot hold it (`got pg/int8`), and SQLite gives nanoid's own range message.
6. **D06 (`3f1937d116`): closed.** `sqlDefaultFunctions({ integer })` in family-sql holds each function's signature, usage and lowering. The lowering moved unchanged (the two adapter copies were identical), and the adapters keep only Postgres's `printArguments`. The fixtures emit unchanged.
7. **D07 (`1e2d8fe3fb`): closed at the discriminator.** An empty list throws an `InternalError` there, and a test covers it. The same class remains in the generator check (S5-BR-R1-1).
8. **D09 (`f228e94d9d`): closed.** The file is `generator-limits.ts`; no reference to `argument-limits` remains.
9. **F04 (the plan's Outcome): closed** in the plan.

### ADRs 254 and 231 against the code

They match on what this slice changed:
- **Function arguments** are values of the target's integer type, followed by each function's own check.
- **Signatures** may be a `FuncCallSig` or a function of the data types, and `defaultFunctionCall` builds the call from either.
- **Labels and checks:** `dataTypeValue`'s `{ suggestions, label }` and `refineArg` are described as built.
- **`oneOf`** refuses a `dataTypeValue` arm.
- **Generators** apply by data type, through the text data types and the UUID type.
- **Length:** a generator is refused on a column too short for what it writes, measured in normal form.
- **Discriminators** are settled as text types read through the codec.
- **Plain signatures:** an extension may still declare a plain signature.

Two small gaps are listed below: S5-BR-R1-2 (the ADR does not spell out what normal form means on SQLite) and S5-BR-R1-4 (one stale sentence in ADR 231).

### S5-BR-R1-1 (should-fix): the generator check still treats missing text data types as an empty list

Where: `packages/2-sql/2-authoring/contract-psl/src/psl-field-resolution.ts`, `textDataTypes: authoringContributions?.textDataTypes ?? []`, which feeds `lowerDefaultForField`.

What is wrong: this is the same defect D07 ruled on, in the other place that reads the list. With no text data types, every `String @default(uuid())` is refused with `Default generator "uuidv4" is not applicable to ... with data type "pg/text"`, a user error that blames the schema for a broken stack.

Change: treat an empty list the same way at the generator check: an `InternalError` with the discriminator's wording, thrown when a text-writing generator is checked. Better still, make `AssembledAuthoringContributions.textDataTypes` required (S5-d-R2-1), so both readers drop the `?? []`.

### S5-BR-R1-2 (low): on SQLite no column refuses a generator for length, and nothing says so

Where: `lowerDefaultForField` with `24528d379e`; `test/integration/test/authoring/generator-applicability.test.ts`; the app note `generator-fits-column`; ADR 254's "A call" item.

What is wrong: SQLite's `character` and `character varying` drop `length` in normal form (`withoutLength`), so the check never fires there. A probe (deleted) emitted `sql.String(5) @default(uuid())` and `uuidString() @default(nanoid(40))` on SQLite with no diagnostic. That is defensible, because SQLite stores the longer value. But no test records it. The app note says such a column "failed at the first insert before", which is true only on Postgres. The ADR's "in its type's normal form" leaves the reader to work out the SQLite case.

Change:
- Add a SQLite case to the length tests that emits `sql.String(5) @default(uuid())`.
- Say "on Postgres" in the app note.
- Add one clause to ADR 254, such as: "SQLite's text types have no length in normal form, so no SQLite column refuses a generator for its length."

### S5-BR-R1-3 (low): the extension note does not mention `writtenLength`

Where: `upgrade-instructions/pending/default-function-arguments-and-generator-data-types/extension/instructions.md`, `builtin-generator-metadata-writes-uuid` and `generator-applicable-data-types`.

What is wrong: `builtinGeneratorRegistryMetadata` now gives `{ id, writesUuid, writtenLength }`, but the note says `{ id, writesUuid }`. `MutationDefaultGeneratorDescriptor` gained an optional `writtenLength(params)`, which an extension's own generator can set to get the column-length check; the note does not say so.

Change: list `writtenLength` in both places.

### S5-BR-R1-4 (low): one ADR 231 sentence names the old arm

Where: `docs/architecture docs/adrs/ADR 231 - Declarative attribute specifications.md`, "SQL defaults", first paragraph.

What is wrong: it says scalar fields take "one pinned `funcCall(name, signature)` arm for every active default-function registry entry". The paragraph and sample right after it say the arm is `defaultFunctionCall(name, entry, dataTypes)`.

Change: name `defaultFunctionCall` in that sentence.

Verdict: SATISFIED once S5-BR-R1-1 is fixed; the lows can go with it.

## Dispatch f, round 1: port onto ADR 275

Range: merge `9a3eeb66b2` (main at `016a661799`, which is `bot/main`), the commits after it up to `785b756074`, and the ADR edits in `656998d34d`. Brief: `slices/5/briefs/dispatch-f-port-onto-adr-275.md`.

Checks run on `656998d34d`, at load average 6 to 20:
- **Repo checks:** `pnpm build`, root `typecheck:agent`, `lint:agent`, `lint:deps`, `lint:framework-vocabulary`, `lint:docs`, `check:publish-deps`, `lint:publishability`, `check:error-reference`, `check:upgrade-coverage --mode pr` and `fixtures:check:agent` pass, and the tree stays clean.
- **Package tests:** tests and `pnpm lint` pass in ids, framework-components, psl-parser, the language server, SQL contract, SQL contract-psl, contract-ts, contract-prisma7, family-sql, both adapters, both targets and Mongo contract-psl.
- **Integration files:** these pass: `authoring/generator-column-length` (34), `authoring/generator-function-arguments` (88), `authoring/discriminator-values`, `authoring/extension-text-type`, `sql-orm-client/polymorphism-char-discriminator`, `psl-print/generated-values-roundtrip`, `authoring/cli.emit-parity-fixtures` and `prisma7-source/supported`. The detection tests of both `generator-function-arguments-and-column-length` (48) and main's `default-generators-to-on-create` (10) pass.

### The merge

`git merge-tree` of the two parents gives 21 conflicted files. I diffed each against `bot/main` at the head.
- **Main won outright** in ten of them, which are identical to main: `mutation-default-types.ts`, `temporal-presets.ts`, contract-prisma7 `test/support.ts`, contract-psl's `composed-mutation-defaults`, `interpreter.defaults.generator-storage`, `interpreter`, `provider.interpret` and `semantic-diagnostics` tests, the Postgres adapter's `control-mutation-defaults.test.ts`, and the slugid pack.
- **Every other line removed from main** is one the brief says to replace:
  - main's local nanoid limits and messages, now taken from `@internal/ids` with this slice's wording;
  - the two adapters' copies of the `autoincrement`/`now` signatures, now `sqlDefaultFunctions()` in the family;
  - the Prisma 7 reader's `FUNCTION_ARGUMENT_KEYS`/`literalArgument` binding;
  - `@@base`'s `str()`, now `writtenScalar(str())`.
- **Main's Prisma 7 behaviour is kept** for calls that pass the argument check: refused generators still give `PSL.PRISMA7_GENERATOR_REFUSED` with main's `@default(<written>) cannot fill its column:` wording, and a function that does not apply to the codec keeps main's message.

### Ported, as the brief asks

- **Typed arguments on main's generator functions.** Each target declares `sqlIntegerArgumentGeneratorFunctions({ integer })` with `pg/int4` or `sqlite/integer`; the family's own declarations of `uuid`, `cuid` and `nanoid` carry no signature. Each argument is a `dataTypeValue` of that type, refined by the function's check, with code `PSL_INVALID_GENERATOR_ARGUMENT` (renamed; the error reference has it) and the labels `4 | 7`, `2` and `integer from 2 to 255`. Arity diagnostics say `Generator function "<name>"`, through `generatorFunctionCall` in psl-parser. Main's generator registry accepts a signature or a function of the data types.
- **The length check in every identifier binding.** `fittingColumn` wraps the bindings of `uuid`, `cuid`, `ulid`, `ksuid` and `nanoid`. It compares `generatedLength(id, params)` from `@internal/ids`, the lengths I checked against the real generators in the previous round, with `GeneratorFunctionField.length`. `sqlColumnLength` computes that length in normal form: a bare `Char` gives 1, and SQLite's text types give `undefined`, so SQLite is never refused.
  - **Who fills `length`:** the PSL reader (`lowerGeneratorAttributesForField`), the TypeScript builder (`columnLengthOf`, when the lookups are present, which they are on the `defineContract` path), and the Prisma 7 reader (client-function path).
  - **Tests:** every generator on Postgres, a named type, a bare `Char`, SQLite taking short columns, the TypeScript builder, and Prisma 7.
- **`sqlDefaultFunctions()`** keeps only `autoincrement` and `now`, in the family.
- **The Prisma 7 reader** binds client-function arguments through `generatorFunctionCall`. `uuid(5)`, `nanoid(1)`, `nanoid(1000)`, `nanoid(8.5)` and `cuid(1)` are refused, each as `PSL.PRISMA7_UNKNOWN_DEFAULT` at the argument, and so is a named argument. `cuid()` still reads as `cuid(2)`.

### Dropped, and gone

A grep for `applicableDataTypes`, `writesText`, `writtenLength`, `writesUuid`, `builtinGeneratorRegistryMetadata`, `sqlBuiltinGeneratorDescriptors`, `applicableCodecIds`, `FUNCTION_ARGUMENT_KEYS`, `sqlDefaultFunctionSignatures` and `PSL_INVALID_DEFAULT_FUNCTION_ARGUMENT`, outside `projects/` and the released notes, finds them only in main's own ADRs (169, 275), main's pending `default-generators-to-on-create` note and the released skills. `generator-applicability.test.ts` is gone. `extension-text-type.test.ts` now tests the discriminator only.

### Discriminators

Unchanged since `24528d379e`: no discriminator line changed in contract-psl `interpreter.ts`, and the three discriminator test files differ only by one stack field and the removed generator case.

### Upgrade notes

The app and extension notes under `generator-function-arguments-and-column-length/` cover what main's `default-generators-to-on-create` does not: the argument checks, the code rename, fractions, the length check, the Prisma 7 refusals, the target declaring the integer-argument signatures, the signature form, `GeneratorFunctionField.length`, `ArgBindingSpec.label`, `oneOf`, and `textDataTypes`. Main's note covers only moving `@default(fn())` to `@onCreate` and `contract print`, so there is no overlap. Nothing in the new notes names a dropped name. The samples use `@onCreate`.

### ADRs 254, 231 and 275 against the code

They match:
- **ADR 254, "A call":** arguments are values of the integer type, `PSL_INVALID_GENERATOR_ARGUMENT`, each target declares the signatures, and applicability and length are decided by the codec binding.
- **ADR 231:** a signature or a function of the data types, for both registries; `generatorFunctionCall`; the `Generator function "<name>"` label; `defaultFunctionCall` named in "SQL defaults".
- **ADR 275, generator entries:** the length check, a bare `Char` counting as one character, no refusal on SQLite, and the typed arguments.

One ADR 275 sentence is now incomplete; see S5-f-R1-4.

### S5-f-R1-1 (should-fix): `GeneratorFunctionField.length` is optional, so a caller that forgets it silently skips the length check

Where: `framework-components/src/shared/generator-functions.ts`, `GeneratorFunctionField.length?`. The callers that leave it out are `postgres/src/core/psl-print/generated-values.ts` (`contract print`'s read-back), the Prisma 7 `nowGeneratorFor`, and Mongo's resolvers. The TypeScript builder passes `undefined` whenever `LoweringInput`'s lookups are absent (`columnLengthOf`).

What is wrong: "no length" and "the caller did not compute one" look the same to `fittingColumn`. This is the defect class D07 and S5-BR-R1-1 were about, and `.agents/rules/required-key-undefined-fields.mdc` asks for a required key typed `| undefined` on such inputs. Today, `contract print` of a contract whose `Char(5)` column carries a `uuidv4` generator prints `@onCreate(uuid())`, and the printed file then fails to emit.

Change: make it `readonly length: number | undefined`, so every caller states it. `contract print` should pass the column's length too, either refusing such a column or printing it knowingly. Bindings only read the field, so extension bindings are unaffected; update the extension note's wording, which says callers pass it "to have the check".

### S5-f-R1-2 (low): an orphaned doc comment in `psl-column-resolution.ts`

Where: `packages/2-sql/2-authoring/contract-psl/src/psl-column-resolution.ts`, around line 912.

What is wrong: the merge put the new `columnLength` between main's doc comment for `lowerGeneratorAttributesForField` and that function. Two doc blocks now sit back to back above `columnLength`, and `lowerGeneratorAttributesForField` has none.

Change: move main's comment back above `lowerGeneratorAttributesForField`.

### S5-f-R1-3 (low): the slice's first grep row expects matches its scope cannot find

Where: `projects/data-types-completion/plan.md`, the first slice-5 grep row.

What is wrong: the expected result names "the upgrade notes under `upgrades/` that ship them", but the grep searches only `packages` and `test` and returns nothing.

Change: expect "nothing".

### S5-f-R1-4 (low): ADR 275 says the Prisma 7 reader's contracts do not change

Where: ADR 275, the paragraph on the Prisma 7 reader ("The contracts it builds do not change").

What is wrong: it is still true for schemas that build, but the reader now refuses several schemas it used to accept. These are out-of-range, fractional or named arguments, and columns too short for the generator.

Change: add that the reader checks client-function arguments and column length as Prisma 8 does (TML-3389), so those schemas are refused.

Verdict: SATISFIED once S5-f-R1-1 is fixed; the lows can go with it.

## Dispatch f, round 2

All four round 1 findings are closed.
- **S5-f-R1-1:** `GeneratorFunctionField.length` is now a required `number | undefined`, so the root typecheck proves every caller of `resolve` and `callFor` states it. The SQL callers compute it with the new `sqlCodecColumnLength(dataTypes, codecId, typeParams)` in `@internal/sql-contract/data-type`: the PSL reader, the Prisma 7 reader (client functions and `nowGeneratorFor`) and Postgres `contract print`. The TypeScript builder uses `columnLengthOf`, whose lookups are now required: `buildContractDefinition` takes `codecLookup` and `dataTypeLookup`, which the orchestrator accepted, with an extension note. Mongo's three resolvers pass `length: undefined`, which is right, because Mongo strings have no length.
- **`sqlCodecColumnLength`** maps the codec to its data type and returns `sqlColumnLength`, the length in normal form. The integration tests show both edges: a bare `Char` with `uuid(7)` is refused as "a column of 1 character", and SQLite's `sql.String(5)` and `sql.String(3)` take generators.
- **`contract print`:** `generated-values.test.ts` tests the refusal for `uuidv4` on `char(5)` (`CONTRACT.PRINT_UNSUPPORTED`).
- **S5-f-R1-2, R1-3 and R1-4:** the doc comment is back above `lowerGeneratorAttributesForField`, the grep row expects nothing, and ADR 275 notes the Prisma 7 reader's new refusals (`9dbc5aac5e`).

Checks run on `fe4fe6a215`, at load average 8 to 20:
- **Repo checks:** `pnpm build`, root `typecheck:agent`, `lint:agent`, `lint:deps`, `lint:framework-vocabulary`, `lint:docs`, `check:publish-deps`, `lint:publishability`, `check:error-reference`, `check:upgrade-coverage --mode pr` and `fixtures:check:agent` pass, and the tree stays clean.
- **Package tests:** `pnpm test --coverage` with thresholds, and `pnpm lint`, pass in framework-components, SQL contract, SQL contract-psl, contract-ts, contract-prisma7, family-sql, both targets, both adapters, Mongo contract-psl, Mongo contract-ts, Mongo contract-prisma6 and sql-orm-client.
- **Integration files:** these pass: `authoring/generator-column-length`, `authoring/generator-function-arguments`, `sql-orm-client/unmapped-storage`, the `generator-function-arguments-and-column-length` detection test (52), `psl-print/generated-values-roundtrip`, `prisma7-source/supported` and `authoring/discriminator-values`.

### S5-f-R2-1 (low): the `contract print` refusal does not say why the call reads back as nothing

Where: `packages/2-sql/9-family/src/core/psl-build/generator-calls.ts` (`reads-back-differently`), and the message the Postgres target builds from it.

What is wrong: for `uuidv4` on `char(5)` the message is `... but @onCreate(uuid()) reads back as no generator.` The binding's own reason, `uuid() writes 36 characters, which does not fit a column of 5 characters.`, is dropped, so the reader is not told the column is too short.

Change: carry the read-back refusal's message into the refusal, and append it. This can be a follow-up; it does not block manual QA.

Verdict: SATISFIED. Dispatch f is closed, and the slice is ready for manual QA.
