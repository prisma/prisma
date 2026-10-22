# Project spec — Mongo authoring follows the Postgres structure

**Linear:** [Mongo authoring follows the Postgres structure](https://linear.app/prisma-company/project/mongo-authoring-follows-the-postgres-structure-562462c05580) (P-TML-1162) · **Branch:** `tml-3647-mongo-authoring-structure` · **Approved:** Will, 2026-10-22, then revised after the architect and principal-engineer reviews (`wip/mongo-research/arch-review-2.md`, `pe-review.md`).

## Terms

- **Data type:** the type of a value Prisma stores, such as `pg/int8` or `mongo/double`. It owns how its values are read, spelled and stored (ADR 254).
- **Written value:** a literal in a schema that becomes a database value: a default, an enum member, a discriminator value.
- **Cast rule:** ADR 254's rule for written values. The literal gets a data type of its own, and the receiving data type must be that type or declare a cast from it.
- **Authoring entry:** what a target registers to say which data type a piece of PSL syntax is: a quoted string, a number, `true`/`false`, or a tag such as `` date`2024-01-01T00:00:00Z` ``.
- **The stack:** the family, target, adapter and extension packs a contract is built with.
- **Definition:** plain data that describes a contract before it is built. **Builder:** the function that turns a definition into a contract.

## Purpose

A developer who knows how Postgres contract authoring works should be able to read Mongo's and find the same structure, with only Mongo's specifics different. That is the architecture's rule "familiar with one target, fluent in another". Today it does not hold for authoring.

Mongo departs from the Postgres reference in two places, and neither departure comes from documents being different from tables:
- **Values.** Mongo data types cannot be written in PSL. They have no casts and no authoring entries, so Mongo PSL reads enum members and discriminator values outside the cast rule.
- **Build.** Mongo has no definition and no shared builder. Its three sources (`defineContract`, PSL and the Prisma 6 reader) each assemble the contract, so its rules are written two or three times and drift apart.

Each departure produces its own stream of tickets, and fixing tickets one at a time only moves the drift around. This project removes both departures, so that Mongo authoring is built the way Postgres authoring is and new rules land in one place.

## At a glance

After slice 1, a Mongo PSL schema writes values in the syntax of their data types, as a Postgres schema does:

```prisma
enum Ratio {
  @@type("mongo/double@1")
  Half  = 0.5
  Third = 0.333
}

enum Level {
  @@type("mongo/int32@1")
  Low  = 1
  High = "10"
}

model Asset {
  id   ObjectId @id @map("_id")
  kind String
  @@discriminator(kind)
}

model Photo {
  ownerId ObjectId
  @@base(Asset, "photo")
}
```

`High = "10"` is refused at the member: a quoted value is text, and `mongo/int32` has no cast from text. SQL gives the same code and wording, because both families read enum members through the same framework function. `kind` is accepted because `mongo/string` is one of the stack's text data types, not because its type is named `String`. `"photo"` is read into `kind`'s data type and checked by its codec.

Two kinds of enum stay refused, by the collection validator, on every collection PSL writes:
- enums of Int64, Date, Decimal128, Binary and ObjectId;
- Double members that are `NaN` or infinite.

Listing them is TML-3470. Slice 1 gives those types the entries and casts that TML-3470 needs, so their members can already be written correctly.

After slice 2, three Mongo sources build through one function, as SQL's do:

```text
defineContract(...)     ─┐
Mongo PSL interpreter   ─┼─>  MongoContractDefinition  ─>  buildMongoContractFromDefinition  ─>  Contract
Prisma 6 reader         ─┘
```

Each rule is then checked once, in the builder, and returns its refusals as data. TypeScript throws the first refusal. PSL reports every refusal at its source position, as `mongoContractRefusalsOf` already does for the collection validator.

## Decisions

The reasoning and the alternatives rejected are in [`design-notes.md`](./design-notes.md). The research behind them is in `wip/mongo-research/` on the project branch.

1. **Fix the structure, not the cases.** TML-3647 alone would have taught one more path to read one more value. Instead, Mongo gets the whole value layer and the whole build layer of the reference.
2. **Two slices, values first.** Slice 2 builds on slice 1: field resolution in slice 2 reads written values through slice 1's entries.
3. **One framework function reads a written value into a codec.**
   - The framework already has `readWrittenValueAs` (`written-value.ts`), which reads a written value as one fixed data type through entries and casts.
   - Slice 1 adds one function beside it, for a receiving codec reference (`CodecRef`: codec id and type parameters). It reads the value with `readWrittenValueAs` into the codec's data type, builds it under the type parameters, and checks it with the codec. A list is read element by element through the receiving type's list cast.
   - Enum members and `@@base` values use this function in both families. So SQL and Mongo give the same codes and wording for the same value, by construction. The refusal codes name the problem, not a default.
   - `AuthoringEntityContext` carries the stack's `DataTypeSupport`, in place of the `readWrittenValueForCodec` hook. The hook and the "read as JSON" fallback in `readEnumBlockMembers` are deleted. The Prisma 6 and Prisma 7 readers, which build enum blocks themselves, pass each member as written text.
   - SQL's default reader (`data-type-default.ts`) stays in SQL PSL. It reads defaults, which on SQL also admit a `sql` expression and value-object documents. Building it on the new function is deferred.
4. **Mongo values follow ADR 254 as Postgres values do,** with Mongo's own types.
   - **Casts,** each declared by the type that receives the value:
     - `mongo/int64` takes `int32`;
     - `mongo/decimal128` takes `int32` and `int64`;
     - `mongo/double` takes `int32`, `int64` and `decimal128`, keeps `NaN` and the infinities as text, and refuses a magnitude no double holds;
     - `mongo/objectid` takes `string`;
     - `mongo/vector` has a list cast from `int32`, `int64`, `decimal128` and `double`, and refuses `NaN` and the infinities, as `pgvector` does.
   - **Entries:**
     - a quoted string is `mongo/string`;
     - `true` and `false` are `mongo/bool`;
     - a number goes through the shared number classifier, wrapped by the Mongo target. A whole number in 32 bits is `int32`, including `-0`. A whole number in 64 bits is `int64`. A number Decimal128 holds exactly is `decimal128` as text, and this includes `NaN` and the infinities. Any other number is `double`. "Holds exactly" is a round trip: the text read back from Decimal128 equals the text written.
     - three tags: `date` (the instant text `Date.toISOString()` writes), `binary` and `json`.
   - `mongo/bson` has no entry and no cast, on purpose. No position takes a BSON value written in PSL.
5. **`mongo/decimal128` spells values as MongoDB does.** A `spell` rewrites leading zeros (`007.5` is `7.5`) and keeps `-0`, because MongoDB keeps negative zero and ADR 254 says the database's spelling wins. Its reader refuses a value that does not survive a Decimal128 round trip, instead of letting it round.
6. **One discriminator rule, in the framework, for both families.** A framework function decides whether a field can be a discriminator:
   - it is required, and not a list;
   - its codec's data type is one of the stack's `textDataTypes`;
   - when it is typed by an enum, each `@@base` value must be a member.

   Mongo contributes `textDataTypes` (`mongo/string`). Both families' PSL call the function, and the Mongo builder calls it in slice 2. A `@@base` value is read into the discriminator field with the function of decision 3.
7. **One plain-data definition per family, polymorphism included.** SQL's `ContractDefinition` has no polymorphism, and SQL PSL patches `discriminator`, `variants` and `base` onto the built contract afterwards. Mongo does not copy that gap: its definition carries polymorphism, embedded models, collection options and control policies. Mongo already uses "definition" for two other things: the builder-object input to `defineContract`, and `MongoModelDefinition`, a built model. Slice 2 renames both so that "definition" means plain data only, and names the new types after SQL's nodes.
8. **Rules return refusals as data.** The Mongo builder checks each rule once and returns its refusals as data, the way `mongoContractRefusalsOf` already works. #30813 made this the repository's rule: production code does not decide by reading text written for people. Every refusal names its subject by a key the definition carries (model, field, enum member, or an index's position in its model), so PSL can report it at its position. TypeScript throws the first refusal with today's error codes.

## Non-goals

- No change to which BSON types or values a collection validator can list for an enum (TML-3470).
- No change to how the Mongo ORM reads and writes discriminator values. Writes already go through the codec. The `variant()` filter and the read-side variant choice do not, but with `mongo/string` as the only Mongo text type the result is the same. Deferred.
- No Mongo `contract infer` or `contract print`, and no Mongo codec conformance test kit.
- No new Mongo PSL syntax: no `@@owner` or embedded models (TML-2250), no `@@control`, no collection options, no named storage types, and no Mongo type constructor with arguments. Mongo type aliases (#30819) already exist; slice 2 carries them as they are.
- No change to SQL's builder or SQL's default reader, no move of SQL polymorphism into `ContractDefinition`, and no discriminator check in SQL `defineContract`.
- No rename of the `authoring.dataTypes` key (TML-3659).
- No change to the contract format. Mongo fields still record no `dataType`.
- TML-3653 (a SQL enum member the CHECK cannot write is thrown, not reported) is not in this project. It goes as its own small PR, because it is SQL-only.

## Place in the larger world

- **ADR 254** is the value design. Its "Not decided here" section lists "Mongo casts and written values" and "Mongo discriminator values", and the paragraph on enum members says Mongo PSL reads them as JSON. Slice 1 settles all three.
- **ADR 181, ADR 210 (Index-type registry) and ADR 267** prescribe one definition and one builder for every source, so that parity between TypeScript and PSL holds by construction and not only through fixture tests. All three are written for SQL. Slice 2 applies them to Mongo.
- **The MongoDB Family subsystem doc** describes Mongo's current approach: helpers in `@internal/mongo-contract` that each source calls (`deriveCollectionValidators`, `mongoContractRefusalsOf`, `buildMongoStorage`). Those helpers stay, and the builder calls them.
- **The Mongo target** (`packages/3-mongo-target/1-mongo-target/src/core/data-types.ts`) declares twelve data types with `read`, `spell` and `bsonTypes`, and no casts. The package requires 100% test coverage.
- **Shared helpers in the wrong packages.** Mongo may not import SQL or target packages, so these move to `framework-components`, unchanged apart from names:
  - from `@internal/sql-contract`: the number classifier, `parseJsonText`, `printJsonText`, `numeral-text.ts`, and `date-time-stored-form.ts` (`dateTimeStoredText`), with its owner id made a parameter;
  - private to the Postgres target: the cast helpers `asNumeralText`, `asFloat` and `unchanged`;
  - from the SQLite target: `sqliteDatetimeText`, as a reader of the instant text `Date.toISOString()` writes, which `mongo/date` stores too.
- **Data-type assembly** (`assembleDataTypeSupport`, `framework-components/src/shared/data-type-support.ts`) checks entries and casts for any family. The control stack runs it, and so does SQL `defineContract`. Mongo `defineContract` does not, so in slice 1 Mongo's entries and casts are checked on the CLI path only. Slice 2 adds the call.
- **The Mongo builder** (`packages/2-mongo-family/2-authoring/contract-ts/src/contract-builder.ts`, 3,083 lines) has a private `buildContractFromDefinition` that reads builder objects, not plain data. Mongo PSL (`contract-psl/src/interpreter.ts`, 2,110 lines, plus `type-aliases.ts`) and the Prisma 6 reader (1,556 lines) assemble the contract separately.

## Cross-cutting requirements

1. **One way to read a written value.** Every enum member and discriminator value in a Mongo or SQL schema is read by the framework function of decision 3. No family reads a written value as JSON.
2. **Mongo data types own their values as Postgres data types do.** Every Mongo data type except `mongo/bson` has an authoring entry or a cast from one. Assembly checks Mongo's entries and casts with the same rules as Postgres's.
3. **No family words in the framework.** Code that moves into or is added to `packages/1-framework` is named for what it does. The family-vocabulary count in `pnpm lint:ratchets` does not rise.
4. **One discriminator rule.** Both families' PSL, and the Mongo builder, decide discriminators with the framework function of decision 6.
5. **One builder per family.** Every Mongo contract source builds through the Mongo definition and one builder. No Mongo source assembles a contract, derives roots, collections or execution defaults, or checks a rule the builder checks. Rules about PSL syntax alone, such as those on type aliases, stay in PSL.
6. **Each rule in one place, reported in each source's own form.** A Mongo rule is written once, returns its refusals as data, and names its subject. TypeScript throws the first; PSL reports each at its source position; the Prisma 6 reader reports in its own diagnostics.
7. **Same contract from equivalent sources.** A PSL schema and a `defineContract` contract that say the same thing produce the same `contract.json` and hashes. A Mongo parity suite covers every rule the builder checks.

## Transitional-shape constraints

- Slice 1 adds Mongo casts and Mongo entries in the same commit, or assembly refuses the stack (`CONTRACT.DATA_TYPE_NOT_WRITABLE`).
- Slice 1's first commit moves the shared helpers with renames only and no change in behaviour, so it can be reviewed with `git diff --color-moved` on its own.
- Slice 1 changes no hash of any PSL contract that main accepts and slice 1 still accepts. Every member and discriminator that slice 1 starts to refuse is listed below and in its upgrade note, each with a test.
- Slice 2 changes no hash by itself. Each behaviour difference in [`plan.md`](./plan.md) is decided in the slice spec. Any decision that changes a fixture contract is stated in the PR, with the fixtures it regenerates.
- Neither slice deletes a Mongo PSL diagnostic without a replacement that reports the same problem at a source position.

## Contract-impact

**Slice 1.** These are valid on main and refused after slice 1. Each goes in the upgrade note with what to write instead, and has a test:
- a quoted member of a type with no cast from text: `"NaN"` or `"Infinity"` on Double, or a quoted member on an Int64, Decimal128, Date or Binary enum that no field uses (such enums are refused by the validator when a field uses them);
- a quoted Decimal128 `"-0"`: negative zero can no longer be written as a Decimal128 member, because `-0` reads as an Int32 zero;
- an Int32 or Int64 member written with a fraction, such as `1.0`: it is now a Decimal128 value, and no integer type casts from Decimal128, as on Postgres;
- a `@@discriminator` on an optional field (TML-3673) or a list field, in either family;
- a `@@discriminator` on an enum-typed field whose `@@base` value is not a member.

Two changes affect a contract that is loaded or built rather than written in PSL:
- a `contract.json` that stores a Decimal128 value with leading zeros is refused when it is loaded, and is fixed by emitting it again;
- a `contract.json` or TypeScript Decimal128 value that Decimal128 cannot hold exactly, such as `1.` followed by 36 zeros, is refused: main accepted it, and MongoDB would have stored it rounded;
- a TypeScript contract with such a member, such as `'007.5'`, gets the new spelling and so a new hash.

**Slice 2.** No change by design. The behaviour differences may change the contracts of schemas that hit them. Those are listed and regenerated in the slice's PR.

**Types.** `MongoContractResult` is computed from the builder generics, so it is unchanged in both slices.

## Adapter-impact

- **Mongo target:** casts and entries on its data types, the number classifier wrapper, the `decimal128` spelling and exactness check, the vector element check, and `textDataTypes`.
- **Postgres and SQLite targets:** the cast helpers and the instant reader move out to the framework. Their behaviour does not change.
- **Mongo adapter:** none.

## ADR pointer

- Slice 1 amends ADR 254:
  - remove "Mongo casts and written values" and "Mongo discriminator values" from "Not decided here";
  - add the Mongo entries and casts, and the framework function that reads a written value into a codec;
  - rewrite the paragraph on enum members and the discriminator paragraph for both families;
  - state that a Mongo collection validator still cannot list some members.
- Slice 2 amends ADR 181, or adds a short ADR, so that one definition and one builder applies to every family. It also rewrites the authoring sections of the MongoDB Family subsystem doc.

## Project DoD

In addition to the team DoD floor in [`drive/calibration/dod.md`](../../drive/calibration/dod.md):

- **Values on a real database.** `test/integration/test/enum-members/enum-round-trip.mongo.test.ts` writes each member in its data type's syntax, through the entry's `print`. It still applies each enum to mongodb-memory-server and reads every member back unchanged, and its expected refusals match the new behaviour.
- **Every Mongo value can be written.** Unit tests in the Mongo target read a written value into every Mongo data type except `mongo/bson`, through each entry and each cast. Each test fails on main. This includes:
  - an unquoted Int64 member past 2^53;
  - `NaN` on Double;
  - a `date` tag;
  - Decimal128 with leading zeros;
  - a Decimal128 value that rounds;
  - ObjectId from a quoted string;
  - a 39-digit whole number on Double;
  - a vector with `NaN` refused.
- **Same refusals in both families.** Each item in Contract-impact is refused at the member or field, and the same enum member refused on SQL and on Mongo gives the same code and wording.
- **Old readers still read enums.** The Prisma 6 and Prisma 7 readers' enum tests and fixtures pass unchanged.
- **One read path.** `readEnumBlockMembers` has no JSON path, the `readWrittenValueForCodec` hook is gone, and the Mongo enum block no longer uses `jsonValue()`.
- **One discriminator rule.** Optional, list and enum-typed discriminators are refused as decision 6 says, by Mongo PSL, SQL PSL and Mongo `defineContract`.
- **One build path.**
  - Mongo PSL and the Prisma 6 reader call the Mongo builder.
  - Mongo `defineContract` runs `assembleDataTypeSupport`.
  - `git grep` finds no `buildMongoStorage` or `deriveCollectionValidators` call outside the builder.
- **Parity suite.** The Mongo suite comparing TypeScript and PSL covers every rule the builder checks, type aliases included, and each case's two contracts are byte-identical.
- **Hashes unchanged.** Every fixture contract keeps its hash, except the ones a PR lists against a decided change.
- **Repo checks.** These pass:
  - `pnpm lint:deps`;
  - `pnpm lint:ratchets`, with the family-vocabulary count not rising;
  - `pnpm check:upgrade-coverage`, with a detection test for slice 1's upgrade note;
  - `pnpm test --coverage` in every touched package.
- **Docs.** The ADR amendments and the MongoDB Family doc rewrite are merged.

## Open questions

Settled in the slice specs, not here:
- the names in slice 2: the plain-data Mongo definition and its nodes, and the new names for Mongo's builder-object input and `MongoModelDefinition`;
- the tag body for `binary`: base64, as MongoDB prints bytes, or hex, as SQLite's `blob`;
- the name and codes of the framework function of decision 3.

## References

- [`design-notes.md`](./design-notes.md): the reasoning and the alternatives rejected.
- [`plan.md`](./plan.md): the slices.
- `wip/mongo-research/` on the project branch: the research report, its three code audits, the re-check against `bca8cc1473`, and three reviews of this spec.
- [ADR 254](../../docs/architecture%20docs/adrs/ADR%20254%20-%20Data%20types%20and%20casts.md), [ADR 181](../../docs/architecture%20docs/adrs/ADR%20181%20-%20Contract%20authoring%20DSL%20for%20SQL%20TS%20authoring.md), [ADR 129](../../docs/architecture%20docs/adrs/ADR%20129%20-%20Template-Tagged%20Literals%20for%20Extensions.md), [MongoDB Family](../../docs/architecture%20docs/subsystems/10.%20MongoDB%20Family.md).
- prisma/orm#261: the PR that put SQL PSL on one definition and builder, the template for slice 2.
