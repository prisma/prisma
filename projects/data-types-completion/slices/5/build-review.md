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
