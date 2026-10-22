# Slice 2 spec — one Mongo definition and builder

**Project:** [`../../spec.md`](../../spec.md) · **Linear:** TML-3616 (with TML-3583) · **Branch:** `tml-3616-mongo-definition-builder`, from `main` after slice 1 (#30832). **One PR.**

Grounding, with every claim cited against `6af54250f1`: `wip/slice2/` (`grounding.md`, `rules.md` with 77 rules, `differences.md`, `spans-and-tests.md`).

## At a glance

Today three Mongo sources each assemble a contract. After this slice they all build through one function, as SQL's do:

```text
defineContract(...)    ─┐
Mongo PSL interpreter  ─┼─>  ContractDefinition (plain data)  ─>  buildMongoContractFromDefinition  ─>  Contract
Prisma 6 reader        ─┘
```

Each Mongo rule is checked once, in the builder, and returns its refusals as data. `defineContract` throws the first refusal with today's error codes. PSL reports every refusal at its source position. No committed Mongo `contract.json` changes, and no migration snapshot folder is renamed.

## Chosen design

### Names

Every name below comes from SQL's `contract-ts`, so the two families read the same.
- **Builder input.** Mongo's builder-object input, today exported as `ContractDefinition`, becomes `ContractInput`, which is SQL's name for the same thing.
- **Plain data.** The new plain-data type takes `ContractDefinition`. Its nodes are `ModelNode`, `FieldNode`, `IndexNode`, `RelationNode` and `ValueObjectNode`.
- **The builder** is `buildMongoContractFromDefinition(definition, codecLookup, dataTypes)`, as SQL's is `buildSqlContractFromDefinition`.
- **The built model.** `MongoModelDefinition` is an alias for a built model, `ContractModel<MongoModelStorage>`. SQL has no such alias, so it is deleted and its 72 uses take `ContractModel<MongoModelStorage>`.

Both renames are public: the first through `@prisma/orm-mongo/contract-builder`, the second through `orm-family-mongo`. Each gets an upgrade fragment.

### The definition

`ContractDefinition` is plain data, with names already resolved. It carries:
- **The stack:** family, target, extension pack refs and `defaultControlPolicy`.
- **Models:**
  - collection (a variant's is its base's);
  - owner and storage relations;
  - control policy and collection options;
  - indexes as written, in the order the source wrote them.
- **Fields:**
  - stored name, field type, nullable, list, and an enum reference by name;
  - execution defaults from presets and type aliases;
  - unresolved generator calls.
- **Relations,** as each source writes them. PSL pairs back-relations before it builds the definition, because pairing is about PSL syntax.
- **Polymorphism:** the base's discriminator field, and each variant's base and its value as written. A TypeScript string becomes `{ kind: 'string', text }`.
- **Value objects, enums** (`EnumTypeHandle`, as SQL) **and optional explicit roots.**
- **Whether collections get validators.** The Prisma 6 reader says no, because a Prisma 6 database has none; every other source says yes. Without this, 15 Prisma 6 fixtures would change.
- **Warnings,** as SQL's definition carries them.

### The builder

The builder works in two steps, as SQL's does: `defineContract` turns builder objects into a definition, then the builder turns the definition into a contract. The builder:
- takes the codec lookup and the assembled `DataTypeSupport` as arguments;
- runs `assembleDataTypeSupport` for `defineContract`, as SQL's `defineContract` does.

### Rules

Every family rule moves into the builder and returns refusals as data. TypeScript throws the first, with today's codes. PSL maps each refusal to a source position and reports all of them. The Prisma 6 reader reports in its own diagnostics.
- **Keys.** Each refusal names its subject by a key the definition carries: a model, a field (`FieldOwner` plus field name), an enum, an enum member, an index (its model and its position in that model's list), a relation, a discriminator, a base or a collection. PSL keeps, per model, the source position of each index and of each `@@base` value, so it can find every key.
- **Validator refusals.** `mongoContractRefusalsOf` refusals are one part of the builder's refusal type.
- **The discriminator rule.** The builder calls the framework's `applyDiscriminatorRule`. An "unreadable" refusal carries PSL wording, so the builder turns it into a TypeScript error for `defineContract`. `describeDiscriminatorRefusal` stays PSL's wording.
- **Type parameters** are checked per field. `assertMongoFieldTypeParams`'s walk after the build goes away (TML-3616's example).
- **What stays in PSL.** Rules about PSL syntax only stay there:
  - `@id` placement;
  - back-relation pairing;
  - type-alias syntax;
  - unresolved references;
  - the deprecated scalar name warning.

### Behaviour differences, decided

None of these changes a committed contract or renames a snapshot folder (`differences.md`).

| # | Today | Decision |
| --- | --- | --- |
| 1 | Duplicate index (after variant scoping): TypeScript refuses; PSL and Prisma 6 keep both, except one variant case where PSL drops one | The builder refuses it in every source. The Prisma 6 reader merges two identical indexes (`@unique` and `@@unique` on one field) first, because the Prisma 6 database holds one index for both |
| 2 | `extensions`: TypeScript records the packs; PSL and Prisma 6 write `{}`. Emit overwrites both with the stack's packs | Every source records its packs |
| 3 | Roots: TypeScript takes explicit roots or derives them; PSL and Prisma 6 derive | Explicit roots are an optional definition field; PSL and Prisma 6 leave it empty |
| 4 | Variant collection: PSL inherits the base's and refuses another; TypeScript requires it restated, and only the read-back check refuses another | A variant inherits its base's collection in every source; a different collection is refused by the builder. TypeScript may omit it |
| 5 | Index on a field the variant inherits: both already refuse it (TypeScript in the builder, PSL at the binder) | Keep refusing; the builder check covers TypeScript and Prisma 6 |
| 6 | Enum key check and `ENUM_UNKNOWN`: TypeScript only, model fields only | One builder check, model and value-object fields |
| 7 | Namespace id: TypeScript hard-codes `__unbound__`; PSL reads the target's default (also `__unbound__`) | The target's default namespace in every source |
| 8 | Discriminator checks: PSL only; TypeScript accepts an Int32 or optional discriminator | In the builder, for every source |
| 9 | Index shape checks (unique wildcard, wildcard with hashed/2d/2dsphere, hashed on several fields, TTL with wildcard, collation without locale, a second text index): PSL only | In the builder, for every source |
| 10 | Preset rules (TML-3583): PSL refuses any optional or list preset; TypeScript only one that generates values | The builder follows SQL's rules |
| 11 | Preset without effect: a PSL warning only | A builder warning, for every source |
| 12 | Index order: PSL puts field `@unique` first and variant indexes last; TypeScript keeps author order. The storage hash does not sort indexes | Each source keeps its order; the builder does not reorder. Reordering would change storage hashes |

### Parity suite

A Mongo suite comparing TypeScript and PSL, built like SQL's `test/integration/test/authoring/parity/` harness. Each case writes the same contract both ways and checks the two `contract.json` files are byte-identical. It covers:
- indexes in matching order, and duplicate indexes refused;
- variant index scoping;
- field `@map`;
- presets, generators and type aliases;
- int and string enums, and value-object enums;
- lists;
- polymorphism and the discriminator rules;
- `_id` types.

The temporal-presets parity test drops its validator and `storageHash` exclusion, which slice 1's shared validator derivation probably made obsolete.

## Coherence rationale

One subject: every Mongo source builds through one definition and one builder. The renames, the definition, the rules moving into the builder and the three sources moving onto it depend on each other. The parity suite proves the result. The diff is large but mostly moves code: the grounding estimates about 1,200 to 1,600 lines added to `contract-ts` and 900 to 1,200 deleted from Mongo PSL. Each dispatch below is reviewable on its own.

## Scope

**In:**
- the two renames, with upgrade fragments;
- the definition and the two-step builder;
- the rules moving into the builder;
- Mongo PSL and the Prisma 6 reader on the builder;
- the twelve decisions;
- the parity suite;
- ADR 181 widened to every family, or a short new ADR;
- the MongoDB Family doc's authoring sections.

**Deliberately out:**
- new PSL syntax for collection options, control policies or embedded models;
- SQL's builder;
- splitting PSL contributions out of the runtime packs (deferred);
- TML-3470.

## Pre-investigated edge cases

| Case | Expected |
| --- | --- |
| Every committed Mongo `contract.json` and snapshot | unchanged hash |
| A Prisma 6 schema with `@unique` and `@@unique` on one field | one index, as today's database holds |
| A TypeScript variant that omits its collection | inherits the base's |
| A TypeScript variant with another collection | refused by the builder, not later on read-back |
| A TypeScript discriminator that is optional or Int32 | refused |
| A value-object field with an undeclared enum | refused, in TypeScript too |
| PSL schema with every refusal kind | each refusal reported at its own source position |

## Slice-specific done conditions

- Mongo PSL and the Prisma 6 reader call `buildMongoContractFromDefinition`. `git grep` finds no `deriveCollectionValidators` or `buildMongoStorage` call outside the builder.
- `pnpm fixtures:check` shows no diff.
- The parity suite passes, and each case fails when the builder's matching rule is removed.

## Dispatch plan

| # | Outcome |
| --- | --- |
| D1 | The two renames (`ContractInput`; `MongoModelDefinition` → `ContractModel<MongoModelStorage>`), with upgrade fragments. No behaviour change |
| D2 | The plain-data `ContractDefinition` and its nodes. The builder split into builder objects → definition → contract, taking lookups as arguments and running `assembleDataTypeSupport`. `defineContract` output byte-identical (hash pin test) |
| D3 | Rules into the builder, returning refusals as data with keys; the decided behaviour differences for TypeScript; the discriminator rule; per-field type parameters; preset rules and warning |
| D4 | Mongo PSL builds the definition and calls the builder; its assembly and duplicated rules are deleted; every refusal reported at its position |
| D5 | The Prisma 6 reader on the builder: no validators, duplicate indexes merged; fixtures unchanged |
| D6 | The Mongo parity suite, and the temporal-presets exclusion dropped |
| D7 | ADR 181 (or a short ADR), the MongoDB Family doc, the error reference, upgrade notes |

Checks per dispatch:
- `pnpm build`, `typecheck:all`, and `test --coverage` with lint in every touched package;
- `lint:deps`, `lint:ratchets` and `fixtures:check`;
- the integration files the dispatch touches, run one at a time, after a `pnpm install`, which the package move in #30829 requires.

Before the PR:
- merge `main`;
- `test:packages`;
- `check:upgrade-coverage` and `check:error-reference`;
- `/drive-code-review` without the walkthrough;
- manual QA.
