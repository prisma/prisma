# Design notes — Mongo authoring follows the Postgres structure

## How this project started

The follow-up TML-3647 asked for Mongo PSL enum members to be read through ADR 254's cast rule. The first design taught the Mongo enum block one more way to read one value. Will rejected it on 2026-10-21: "Why are we backporting this single edge case? Can we modify the Mongo implementation to use the same structure/process as the postgres reference implementation?" He then asked for thorough research, with the architecture docs read first.

## What the research found

The full findings are in `wip/mongo-research/report.md` on the project branch, with three code audits and a re-check against `bca8cc1473`. In short:

- **Mongo has the first half of ADR 254 and not the second.** It has data types, codecs linked to them, `equalityKey` and `keepsWrittenForm`. It has no casts, no written-value entries and no `textDataTypes`. Every symptom on the value side follows from that: members read as JSON, `NaN` written as `"NaN"`, large integers rounded, discriminators checked by type name, `dataTypeValue` unusable for Mongo types.
- **Mongo has no definition and no shared builder.** The two Mongo paths are kept in step only partly, by helpers in `@internal/mongo-contract`. Everything else is written two or three times, and the paths disagree on duplicate indexes, index shapes, variant collections, presets, roots and extensions. Only one TS-against-PSL test exists.
- **SQL is not a complete reference.** SQL PSL patches polymorphism onto the contract after its builder runs. SQL maps only one builder error back to a source position, which is why TML-3653 exists. SQL's TypeScript builder does not check the discriminator field's type.

## Principles

- **Same form, different specifics.** Mongo has the same layers as Postgres (data types with entries and casts, one definition, one builder). Only the contents are Mongo's.
- **Copy the reference's intent, not its gaps.** Where SQL falls short (polymorphism outside the definition, errors mapped by catching), Mongo follows the better shape. SQL's gaps get their own tickets.
- **A rule lives in one place, and each source reports it in its own form.** This is the `mongoContractRefusalsOf` model, extended to every rule.

## Alternatives considered

- **Patch TML-3647 alone.** Pass the SQL reader into the Mongo context and change the grammar. Rejected by Will: it adds a third way of reading values and leaves the cause in place.
- **Keep Mongo's shared-helper route and add more helpers.** This is what #30733, #30773 and #30779 did. It shares the validator and storage rules, but model assembly, polymorphism, execution defaults and enum checks are still written per source. Every new rule would need another helper and three call sites.
- **Copy SQL's builder exactly, polymorphism patch included.** Rejected: Mongo `defineContract` already handles polymorphism in its builder, so a patch step would be a step backwards.
- **One cross-family definition.** Rejected by the three-layer IR pattern: a builder definition is a family-layer type. Each family has its own definition, built the same way.
- **Map builder errors to source positions by catching them, as SQL does for foreign-key indexes.** Rejected: it ties PSL to error codes and wording, and covers only the errors someone remembered to map. Refusals as data cover every rule.
- **Move SQL's whole default reader (`data-type-default.ts`, 546 lines) into the framework.** This was the first plan. Rejected after the principal-engineer review. Enum members never have type parameters, and the framework already reads a written value as one data type (`readWrittenValueAs`). A small function on top of it, which builds the value under a codec reference's parameters and checks it with the codec, is enough for enum members and discriminator values in both families. Moving the whole reader would have dragged 47 uses of "column", the `sql` expression suggestion and a default-named error code into the framework. SQL's default reader stays in SQL until it is rebuilt on the new function.
- **Change the shared number classifier to know about Decimal128.** Rejected: the framework cannot depend on `bson`. The Mongo target wraps the shared classifier with its own round-trip check, the same way an entry's `classify` is already a plain function.
- **Keep `-0` as a Decimal128 member.** Rejected: the classifier would then send `-0` to Decimal128, and every Int32 and Int64 member written `-0` would be refused. A negative-zero enum member is rare; integer members are not.
- **Classify fractions as `mongo/double`, as the MongoDB shell does.** Rejected: a double loses digits before the receiving type sees them. Postgres classifies fractions as `numeric` and lets `float8` cast from it; Mongo does the same with `decimal128`, and `mongo/double` casts from it. Decimal128 holds 34 digits where `numeric` has no limit, so any number Decimal128 cannot hold exactly is classified as `mongo/double`, the one type that takes it. That keeps every Double member valid on main, long whole numbers included.
- **Copy the Postgres `numeric` spelling rule for Decimal128, which refuses `-0`.** Rejected: ADR 254 says the stored spelling is the database's. PostgreSQL prints negative zero as `0`; MongoDB keeps `-0`. Both drop leading zeros.
- **Change how the Mongo ORM reads discriminator values in slice 1.** Deferred: writes already go through the codec, and with `mongo/string` as the only Mongo text type a codec-reading filter gives the same result, so no test could fail before the change.
- **Keep TML-3653 in slice 1, as one PR for every follow-up.** Rejected after review: it is SQL-only, and slice 1 is already large. It goes as its own small PR.
- **Read `@@base` values with `dataTypeValue(mongo/string)`.** Rejected after #30792: SQL now reads them as a default of the discriminator column, so column parameters apply. Mongo follows SQL.

## Open questions

Listed in [`spec.md`](./spec.md#open-questions). None blocks slice 1.
