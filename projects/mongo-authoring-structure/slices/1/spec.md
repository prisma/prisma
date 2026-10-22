# Slice 1 spec — Mongo values under ADR 254

**Project:** [`../../spec.md`](../../spec.md) · **Linear:** TML-3647 (with TML-3671, TML-3673) · **Branch:** `tml-3647-mongo-authoring-structure` · **One PR**, which also carries the project's spec and plan.

## At a glance

Every enum member and discriminator value in a PSL schema, in both families, is read by one framework function: written syntax, then an authoring entry, then a cast, then the codec. Mongo gets the entries and casts that make this possible. Before:

```prisma
enum Ratio {
  @@type("mongo/double@1")
  Unknown = "NaN"      // Mongo PSL today: read as JSON text, accepted
  Half    = 0.5        // a JavaScript number
}
```

After:

```prisma
enum Ratio {
  @@type("mongo/double@1")
  Unknown = NaN        // a Decimal128-classified number, cast to a double; the validator still refuses non-finite members (TML-3470)
  Half    = 0.5
}
```

`Unknown = "NaN"` is refused at the member with `PSL_VALUE_TYPE_INCOMPATIBLE`: `mongo/double` has no cast from text. The message names what to write, exactly as SQL's does for the same value.

## Chosen design

### The framework reader for a codec

- **Where.** A new function lives in `packages/1-framework/1-core/framework-components/src/shared/written-value.ts`, beside `readWrittenValueAs`. Working name: `readWrittenValueInto(support, ref, written)`. `ref` is a framework `CodecRef`, a codec id and type parameters, resolved through a codec lookup.
- **What it does:**
  - reads `written` through `readWrittenValueAs` into the codec's data type;
  - builds the value with the data type's `valueFrom` under `ref`'s type parameters;
  - checks it with the codec's `fromDataTypeValue`;
  - returns the stored form, or a refusal.

  A written list is read element by element into the element types the receiving type's list cast names, then through the list cast. This is what `pgvector` defaults do in SQL today.
- **Refusal codes:**
  - syntax no entry reads: `PSL_INVALID_LITERAL`;
  - a value whose type the receiving type does not take and cannot cast from: `PSL_VALUE_TYPE_INCOMPATIBLE`;
  - a value the receiving type's parameters or the codec refuse: the new code `PSL_VALUE_REFUSED`, added to the error reference.

  Wording follows `describeRefusal`, including the "write …" rewrite. The function never names a default, a column or a field; the caller supplies the subject ("enum "Ratio" member "Half"").
- **Callers.** `readEnumBlockMembers` calls it for every member. Both families' PSL call it for `@@base` values, with the discriminator field's `CodecRef`.

`AuthoringEntityContext` gains `dataTypes: DataTypeSupport`, filled by both PSL interpreters and both legacy readers. The `readWrittenValueForCodec` hook and the JSON fallback in `readEnumBlockMembers` are deleted. A bare member is read from its name as text. A member that has a value but no `writtenValues` entry is a bug in whoever built the block, and throws an `InternalError`.

SQL's `@@base` reading stops going through `lowerDataTypeDefault`, so SQL `@@base` refusals take the new codes. SQL defaults are not touched.

### The grammar

`enumMemberValue()` (`packages/1-framework/2-authoring/psl-parser/src/attribute-spec/combinators/enum-member-value.ts`) accepts a list of scalar members, recorded in `writtenValues` as a written list. The Mongo enum block spec switches from `jsonValue()` to `enumMemberValue()`. A SQL enum member written as a list is refused by the cast rule, because no SQL enum codec's data type has a list cast.

### The legacy readers

The Prisma 6 reader (`packages/2-mongo-family/2-authoring/contract-prisma6/src/interpreter.ts`) and the Prisma 7 reader (`packages/2-sql/2-authoring/contract-prisma7/src/interpreter.ts`) build enum blocks with `values` only. They set `writtenValues` to `{ kind: 'string', text: <stored text> }` for each member, where the stored text is the member's `@map` value or else its name. Their enum fixtures do not change.

### Mongo values

In the Mongo target (`packages/3-mongo-target/1-mongo-target/src/core/`), as in project decision 4:
- **Casts:**
  - `mongo/int64` takes `int32`;
  - `mongo/decimal128` takes `int32` and `int64`;
  - `mongo/double` takes `int32`, `int64` and `decimal128`;
  - `mongo/objectid` takes `string`;
  - `mongo/vector` has a list cast from `int32`, `int64`, `decimal128` and `double`, and refuses non-finite elements.

  The cast helpers come from the framework after the move.
- **Entries:** under `authoring.dataTypes` on the Mongo target descriptor:
  - a plain string is `mongo/string`;
  - a plain boolean is `mongo/bool`;
  - a plain number goes through the Mongo classifier;
  - tags `date` → `mongo/date`, `binary` → `mongo/binary` and `json` → `mongo/json`. The `binary` body is base64, which is how MongoDB prints bytes.
- **The Mongo classifier** wraps the shared `createNumberClassifier`:
  - a whole number in 32 bits, `-0` included, is `int32`; in 64 bits, `int64`;
  - otherwise `decimal128` as text, when Decimal128 holds it exactly by round trip;
  - otherwise `double`, as a JSON number.

  `NaN`, `Infinity` and `-Infinity` are `decimal128`.
- **`mongo/decimal128`.** A `spell` drops leading zeros and keeps `-0`. `read` refuses text that does not survive a round trip through `Decimal128.fromString`.
- **`mongo/vector`.** `readVectorJson` refuses a non-finite element.
- **`textDataTypes`.** `[mongo/string]`, contributed by the Mongo target, as Postgres and SQLite contribute theirs.

### The discriminator rule

One framework function, in `framework-components`, takes a field's codec reference, its `nullable` and `many`, whether it is enum-typed with the enum's member values, and the stack's `textDataTypes`. It returns refusals as data:
- `optional`;
- `list`;
- `not-text`;
- for each `@@base` value, `not-a-member`.

Both PSL interpreters call it instead of their own checks. These are SQL's `isTextColumn` and Mongo's `isStringTyped` with its `scalarTypeCodecIds.get('String')` lookup, and both are deleted. Each interpreter words the refusals at the attribute's position, with the codes they use today for the discriminator, plus one for `@@base` values that are not members.

## Coherence rationale

One subject: every written enum member and discriminator value goes through the cast rule, in both families. The parts depend on each other:
- the reader needs Mongo's entries to read Mongo values;
- the Mongo enum block needs the reader and the list grammar;
- deleting the JSON fallback needs the legacy readers to pass written text;
- the discriminator rule needs the reader for `@@base` values.

The first commit, a move with renames only, is reviewed on its own with `git diff --color-moved`. The rest is about 1,500 lines of behaviour and tests, which one reviewer can hold.

## Scope

**In:**
- the move;
- the reader, the context field and the deletions;
- the list grammar and the legacy readers;
- Mongo entries, casts, classifier, `decimal128` and vector checks, and `textDataTypes`;
- the discriminator rule in both families' PSL;
- these tests:
  - `enum-round-trip.mongo.test.ts` written in syntax;
  - tests with fake codecs given data types with entries;
  - the upgrade detection test that calls Mongo PSL members unchanged;
- ADR 254, the error reference, and an `app` upgrade fragment with detection.

**Deliberately out:**
- SQL defaults and `data-type-default.ts`;
- the Mongo builder and the Mongo `defineContract` discriminator check (slice 2);
- validator listing (TML-3470);
- the Mongo ORM discriminator read;
- TML-3653.

## Pre-investigated edge cases

| Case | Expected |
| --- | --- |
| Double member `9007199254740993` | `int64`, cast to double `9007199254740992`, as on main |
| Double member, 39-digit whole number | `double` by fallback, accepted as on main |
| Decimal128 member `0.1000000000000000000000000000000000000001` | `double` by classifier; `decimal128` has no cast from `double`, so refused |
| Int32 member `-0` | `int32` `0`, as on main |
| Int32 member `1.0` | `decimal128`, refused (listed in the upgrade note) |
| Vector member `[1, 2.5, -0]` | accepted, same stored values as main |
| Vector member `[NaN]` | refused |
| Bare member on an Int32 enum | refused at the member, code `PSL_ENUM_BARE_MEMBER_NON_STRING_CODEC` kept |
| `kind String?` / `kind String[]` discriminator | refused, in both families |
| `kind Status` (enum on `mongo/string`) with `@@base(Asset, "photo")`, `photo` not a member | refused at the `@@base` value |
| Prisma 6 and Prisma 7 enums | read as before, fixtures unchanged |

## Slice-specific done conditions

- Every row above has a test. Each test of a new acceptance fails on `main`.
- `pnpm fixtures:check` shows no diff.
- The family-vocabulary ratchet does not rise.
