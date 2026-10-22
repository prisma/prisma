# Project plan — Mongo authoring follows the Postgres structure

**Spec:** [`spec.md`](./spec.md) · **Linear:** P-TML-1162

## At a glance

Two slices, built one after the other. Each slice is one PR.

| Slice | Outcome | Linear | Builds on | Hands to |
| --- | --- | --- | --- | --- |
| 1. Mongo values under ADR 254 | Every written value in a Mongo PSL schema is read by the framework's cast rule, through Mongo entries and casts | TML-3647, TML-3671, TML-3673 | `main` | The framework codec reader; Mongo entries, casts and `textDataTypes` |
| 2. One Mongo definition and builder | Every Mongo source builds through `MongoContractDefinition`, and each rule is checked once | TML-3616, TML-3583 | Slice 1 | Project close-out |

Slice 2 builds on slice 1. Its field resolution reads written values through slice 1's entries, and both slices change Mongo PSL's enum and discriminator handling.

TML-3653 is SQL-only and outside this project. It goes as its own small PR, independent of both slices.

## Slice 1 — Mongo values under ADR 254

**Outcome.** A Mongo PSL schema writes enum members and `@@base` values in the syntax of their data types. When it doesn't, it is refused with the code and wording SQL gives the same value. Every family reads written values through one framework reader.

**What it covers, in commit order:**
1. **Move shared helpers into `framework-components`, renames only, no behaviour change.** These are:
   - the number classifier, `parseJsonText` and `printJsonText`;
   - `numeral-text.ts` and `date-time-stored-form.ts`, from `@internal/sql-contract`;
   - the cast helpers `asNumeralText`, `asFloat` and `unchanged`, from the Postgres target;
   - the `Date.toISOString()` instant reader, from the SQLite target.

   Callers in SQL, Postgres and SQLite are updated. Reviewed with `git diff --color-moved`.
2. **The framework reader for a codec.** One function beside `readWrittenValueAs` reads a written value into a `CodecRef`, including lists through a list cast (spec decision 3). Then:
   - `AuthoringEntityContext` carries `DataTypeSupport`;
   - `readEnumBlockMembers` uses the new function, and the hook and the JSON fallback are deleted;
   - `enumMemberValue()` learns list members;
   - the Prisma 6 and Prisma 7 readers pass members as written text;
   - SQL enum members move onto the new function.
3. **Mongo entries, casts and spelling,** in one commit:
   - the casts and entries of spec decision 4, with the Mongo number classifier wrapper and its round-trip check;
   - the `mongo/decimal128` spelling and exactness check of decision 5;
   - the vector element check.
4. **Mongo enum members.** The Mongo enum block reads members with `enumMemberValue()`.
5. **The discriminator rule.** The framework function of spec decision 6. Mongo contributes `textDataTypes`. Both families' PSL call the rule, and read `@@base` values through the new function (TML-3671, TML-3673).
6. **Tests that move with the behaviour:**
   - `enum-round-trip.mongo.test.ts` writes members in their syntax;
   - tests with fake codecs get data types with entries;
   - the published upgrade detection test that calls Mongo PSL members "unchanged" is updated.
7. **Docs and upgrade note.** The ADR 254 amendments, and the error reference. An `app` upgrade fragment lists every item in the spec's Contract-impact, with detection patterns and a detection test.

**Checks:** `pnpm test --coverage` in every touched package (the Mongo target requires 100%). `lint:deps`, `lint:ratchets`, `check:upgrade-coverage`, `check:error-reference` and `fixtures:check`, which shows no diff. The integration files the slice touches, run singly.

## Slice 2 — One Mongo definition and builder

**Outcome.** `defineContract`, Mongo PSL and the Prisma 6 reader all build through `MongoContractDefinition` and one builder. Each Mongo rule is written once.

**What it covers:**
- **A plain-data Mongo definition** in `@internal/mongo-contract-ts`. It carries:
  - models with polymorphism, owner and storage relations;
  - indexes as written;
  - collection options and control policies;
  - execution-default inputs, including those from type aliases;
  - value objects, enums, and optional explicit roots.

  Mongo's builder-object input type and `MongoModelDefinition` are renamed, so "definition" means plain data only (spec decision 7).
- **Refusals with keys.** A builder refusal type that includes today's validator refusals. Every refusal names its subject by a key the definition carries, so PSL can find its position.
- **The builder in two steps,** as SQL's is: builder objects to definition, then definition to contract. The builder takes the codec and data-type lookups as arguments, and runs `assembleDataTypeSupport`, as SQL `defineContract` does.
- **Rules checked once, in the builder.** Every rule returns refusals as data, as `mongoContractRefusalsOf` does. TypeScript throws the first; PSL reports each one at its span.
  - `assertMongoFieldTypeParams` becomes a per-field check (the example in TML-3616).
  - The discriminator checks (text data type, required) move into the builder, so Mongo `defineContract` gets them too. The builder words its refusals in TypeScript terms: `describeDiscriminatorRefusal` is PSL wording and does not fit `defineContract`.
- **Mongo PSL produces the definition,** and its own assembly is deleted. It instantiates type constructors through the shared path SQL PSL uses, so a pack's constructor arguments are read. A test-only pack proves it; no Mongo constructor gains arguments.
- **The Prisma 6 reader** builds through the definition too, in the same PR.
- **TML-3583.** The preset rules (an optional preset, a preset beside a default) follow SQL's.
- **Parity suite.** A Mongo suite comparing TypeScript and PSL, like `test/integration/test/authoring/parity/`. The slice spec lists its cases, one or more for every rule the builder checks.
- **Docs.** ADR 181 is widened to every family, or a short ADR is added. The authoring sections of the MongoDB Family subsystem doc are rewritten.

**Behaviour differences to settle in the slice spec.** Today the two Mongo paths disagree in seven places, and each needs one answer. My recommendation for each is below; the slice spec records the final answer and the fixtures it changes.

| Difference | Recommendation |
| --- | --- |
| Duplicate index after variant scoping: TypeScript throws, PSL drops it silently | Refuse in both |
| `extensions`: TypeScript records the packs, PSL writes `{}` | Record the packs in both |
| Roots: TypeScript accepts explicit roots, PSL derives them | Explicit roots are an optional definition field; PSL leaves it empty |
| A variant's collection: PSL inherits the base's and refuses another; TypeScript restates it and checks nothing | Inherit, and refuse another, in both |
| An index on a field the variant inherits: TypeScript refuses it | Allow it in both |
| Enum key check and `ENUM_UNKNOWN`: TypeScript only | One check, in the builder |
| Namespace id: TypeScript hard-codes `__unbound__`, PSL reads the default namespace | Use the target's default namespace in both |

## Close-out (required)

- [ ] Verify the project DoD in [`spec.md`](./spec.md).
- [ ] Map every decision in `spec.md` and `design-notes.md` to its durable home: ADR 254, ADR 181 or the new ADR, the MongoDB Family doc, or a Linear ticket.
- [ ] File or confirm the deferred items in [`deferred.md`](./deferred.md).
- [ ] Strip repo-wide references to `projects/mongo-authoring-structure/**`.
- [ ] Delete `projects/mongo-authoring-structure/`.
