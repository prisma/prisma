# ADR 275 grounding notes (TML-3607)

Code read on the tip of PR A, prisma/orm#30742 (branch `tml-3267-generated-values-resume`), which TML-3607 builds on. Paths are repo-relative. Line numbers are from that tip.

## Corrections to the brief

1. **Native enums are not in `storage.types`.** `storage.types` holds only `kind: 'codec-instance'` entries: `packages/2-sql/1-core/contract/src/validators.ts:59-75` ("Document-scoped `storage.types`: codec triples only") and `packages/2-sql/1-core/contract/src/ir/sql-storage.ts:169-204` (throws on any other kind). Native enums are `storage.namespaces[ns].entries.native_enum` entries (`packages/3-targets/3-targets/postgres/src/core/postgres-native-enum.ts:35`), since ADR 157's amendment of 2026-10-12. The comment at `validators.ts:60-64` that names `'postgres-enum'` is stale. Ruling (coordinator, 2026-10-16): `storage.types` stays only for database types a contract space registers, which today are pgvector's `vector` (`packages/3-extensions/pgvector/src/contract.ts:61-68`) and PostGIS's `geometry` (`packages/3-extensions/postgis/src/contract.ts`). User aliases never enter it.
2. **Codec instances are not per alias today.** The runtime keys codec instances by content, `${codecId}:${canonicalizeJson(typeParams)}` (`packages/2-sql/5-runtime/src/sql-context.ts:483-560`). Two aliases with equal params already share one instance (comment at line 522), and an inline column with the same params shares it too. Expanding aliases changes only the instance's `name` (alias name becomes `<col:Table.column>`). No production codec reads `CodecInstanceContext.name` or `usedAt` (`git grep` over `packages/**/src`). So the brief's "one instance per column" does not happen.
3. **Applicability lists are incomplete.** `packages/1-framework/2-authoring/ids/src/index.ts:58-82` lists only `pg/text@1`, `sql/char@1` and (for uuid) `pg/uuid@1`. SQLite's `String` is `sqlite/text@1` (`packages/3-targets/3-targets/sqlite/src/core/type-constructors.ts:22-26`), and Postgres `VarChar` is `sql/varchar@1`, so `@default(uuid())` on either is refused today with `PSL_INVALID_DEFAULT_APPLICABILITY` (`packages/2-sql/2-authoring/contract-psl/src/psl-column-resolution.ts:930-936`). Resolution by codec needs complete codec lists per function.
4. **The `now` codec map is a Postgres constant, not a stack contribution.** `postgresNowGeneratorIds` and `postgresNowGeneratorFor` (`packages/3-targets/3-targets/postgres/src/core/now-generators.ts:28-70`) are imported directly by the Postgres presets and the Prisma 7 binding. SQLite (`packages/3-targets/3-targets/sqlite/src/core/authoring.ts`) and Mongo (`packages/3-mongo-target/1-mongo-target/src/core/authoring.ts`) hard-code `timestampNow` through `temporalAuthoringPresets`. The ADR must add a stack-assembled map from function name and codec to generator.
5. **The upgrade cannot rely on `migration plan`.** Expanding aliases changes the storage hash but no DDL. `migration plan` refuses a plan with no operations unless statements were given (`packages/1-framework/3-tooling/cli/src/control-api/operations/migration-plan.ts:207-216`). The precedent for a hash-only storage change is `upgrade-instructions/pending/remove-nocheck/`: a script rewrites stored contracts and snapshots, then the user runs `db sign`.

None of the six decided points is contradicted. Points 1 and 2 above change what the ADR says about `storage.types` and codec instances.

## 1. Every field preset today, and its form after

No preset sets a database default, `nullable` or `unique`. Only `id.*` presets set `id: true`. No extension contributes presets.

| Package and file | Preset | Codec | Type params | Generators | id | After |
| --- | --- | --- | --- | --- | --- | --- |
| SQL family `packages/2-sql/9-family/src/core/authoring-field-presets.ts` | `uuidString` | `sql/char@1` | length 36 | none | no | `Char(36)` |
| same | `ulid`, `cuid2`, `ksuid` | `sql/char@1` | length 26, 24, 27 | none | no | `Char(n)` |
| same | `nanoid({size})` | `sql/char@1` | length = size, default 21 | none | no | `Char(n)` |
| same | `id.uuidv4String`, `id.uuidv7String` | `sql/char@1` | length 36 | onCreate `uuidv4` / `uuidv7` | yes | `Char(36) @id @onCreate(uuid())` / `uuid(7)` |
| same | `id.ulid`, `id.cuid2`, `id.ksuid` | `sql/char@1` | 26, 24, 27 | onCreate `ulid`, `cuid2`, `ksuid` | yes | `Char(n) @id @onCreate(ulid())` and so on; `ksuid()` needs a new function entry (no `ksuid` default function exists in `packages/3-targets/6-adapters/{postgres,sqlite}/src/core/control-mutation-defaults.ts`) |
| same | `id.nanoid({size})` | `sql/char@1` | length = size | onCreate `nanoid` with `size` | yes | `Char(n) @id @onCreate(nanoid())`, size from the column's length |
| Postgres `packages/3-targets/3-targets/postgres/src/core/authoring.ts:836-985` | `text`, `int`, `bigint`, `float`, `decimal`, `boolean`, `json`, `bytes`, `dateTime`, `uuidNative` | `pg/text@1` … `pg/uuid@1` | none | none | no | PSL already has `String`, `Int`, … (`type-constructors.ts`); TS needs `type.*` helpers |
| same | `temporal.createdAt`, `temporal.updatedAt` | `pg/timestamptz-temporal@1` | none | onCreate (+ onUpdate) `instantNow` | no | target aliases `temporal.CreatedAt`, `temporal.UpdatedAt` (new) |
| same | `temporal.createdAtString`, `updatedAtString` | `pg/timestamptz-string@1` | none | `timestamptzStringNow` | no | `temporal.CreatedAtString`, `temporal.UpdatedAtString` (new) |
| same | `temporal.createdAtJsDate`, `updatedAtJsDate` | `pg/timestamptz-date@1` | none | `timestampNow` | no | `temporal.CreatedAtJsDate`, `temporal.UpdatedAtJsDate` (new) |
| same | `temporal.timestamp`, `timestamptz`, `timestampString`, `timestamptzString`, `timestamptzJsDate` (precision, onCreate, onUpdate options) | the matching codec | precision | per `postgresNowGeneratorIds` | no | `Timestamp(3) @onCreate(now()) @onUpdate(now())` and so on |
| same (PR A) | `temporal.date`, `dateString` | `pg/date-temporal@1`, `pg/date-string@1` | none | `plainDateNow`, `dateStringNow` | no | `Date @onCreate(now())`, `DateString @onCreate(now())` |
| same (PR A) | `temporal.time`, `timeString`, `timetz` | `pg/time-temporal@1`, `pg/time-string@1`, `pg/timetz@1` | precision | `plainTimeNow`, `timeStringNow`, `timetzNow`, each with `{precision}` | no | `Time(3) @onUpdate(now())`; precision reaches the generator from the column |
| same | `id.uuidv4Native`, `id.uuidv7Native` | `pg/uuid@1` | none | `uuidv4` / `uuidv7` | yes | `Uuid @id @onCreate(uuid())` / `uuid(7)` |
| SQLite `packages/3-targets/3-targets/sqlite/src/core/authoring.ts` | `temporal.createdAt`, `updatedAt`, `datetime` | `sqlite/datetime@1` | none | `timestampNow` | no | aliases `temporal.CreatedAt`, `temporal.UpdatedAt` (new); `DateTime @onCreate(now())` |
| Mongo `packages/3-mongo-target/1-mongo-target/src/core/authoring.ts` | `temporal.createdAt`, `updatedAt`, `timestamp` | `mongo/date@1` | none | `timestampNow` | no | aliases `temporal.CreatedAt`, `temporal.UpdatedAt` (new); `DateTime @onCreate(now())` |

Shared builders: `packages/1-framework/1-core/framework-components/src/shared/temporal-presets.ts` (`temporalAuthoringPresets`, `temporalCodecPreset`, `temporalPhaseTemplate`, `temporalPhaseTemplateWithParams`, `TEMPORAL_ON_CREATE_ARG`, `TEMPORAL_ON_UPDATE_ARG`), `packages/2-sql/9-family/src/core/timestamp-now-generator.ts` (`temporalStringAuthoringPresets`, `temporalCodecPresetWithPrecision` with `nowTakesPrecision`). Instantiation: `instantiateAuthoringFieldPreset` in `framework-authoring.ts:1934`; PSL resolution `packages/1-framework/2-authoring/psl-parser/src/field-presets.ts`, `packages/2-sql/2-authoring/contract-psl/src/psl-field-resolution.ts`, `packages/2-mongo-family/2-authoring/contract-psl/src/field-presets.ts`. All of these go.

## 2. How `@default(fn())` lowers today, and how `now()` would resolve by codec

- The registry: `ControlMutationDefaultRegistry`, a map from function name to `ControlMutationDefaultEntry` (`signature`, `lower`, `usageSignatures`, and on PR A `printArguments`), in `packages/1-framework/1-core/framework-components/src/shared/mutation-default-types.ts:62-95`. Postgres entries: `autoincrement`, `now`, `uuid`, `cuid`, `ulid`, `nanoid` (`packages/3-targets/6-adapters/postgres/src/core/control-mutation-defaults.ts:~110-160`). SQLite has the same names. Mongo's registry is empty.
- `lower({ call, context })` returns `{ kind: 'storage', defaultValue }` (a database default; `now` and `autoincrement`) or `{ kind: 'execution', generated }` (a client generator; `uuid`, `cuid`, `ulid`, `nanoid`). The registry entry, not the attribute position, decides which.
- `DefaultFunctionLoweringContext` (`mutation-default-types.ts:26-31`) has `sourceId`, `modelName`, `fieldName`, `columnCodecId`. It has no type params, though the caller has them (`psl-column-resolution.ts:886-892`).
- Applicability: after lowering an execution result, `psl-column-resolution.ts:908-939` looks up the generator descriptor and refuses it when `applicableCodecIds` is missing (preset-only generators such as `timestampNow`, with a hint to use a preset) or does not include the column's codec.
- `now()` in `@default` always lowers to the database `now()`. No `@onCreate` or `@onUpdate` attribute exists (`git grep '@onCreate'` finds nothing in `src`).
- Codec to generator for `now`: `postgresNowGeneratorIds` maps ten Postgres codecs to nine generators (`now-generators.ts:28-39`); many codecs to one generator (`timestampNow` serves `pg/timestamptz-date@1`; earlier versions mapped three). `postgresNowGeneratorTakesPrecision` (`:50-54`) and `postgresNowGeneratorFor(column)` (`:57-70`) give the generator with `{ precision }` from the column's type params for time codecs. This is the per-codec resolution `@onCreate(now())` needs; it must become a contribution the control stack assembles for every target.
- Type params to generator params: today through the preset template `temporalPhaseTemplateWithParams(index, id, { precision: { kind: 'arg', index: 0 } })` (`temporal-presets.ts:97-108`), which reads the preset's own precision argument, and through `postgresNowGeneratorFor`, which reads the column's `typeParams.precision`. After: only the second form.
- Runtime: generators are cached by id plus params on PR A (`packages/1-framework/1-core/framework-components/src/execution/mutation-defaults.ts`), so `{ id: 'plainTimeNow', params: { precision: 3 } }` and `precision: 6` are distinct.

## 3. Function names that mean different things by position

`now` is a database function in `@default(now())` (`lowerNow` returns a storage default) and a client generator in a preset's `now` option. Today the option token is preset vocabulary, mapped by the `select` template (ADR 246). After: the attribute selects the registry. `@default(fn())` looks up the database default function registry, whose entries all lower to storage defaults. `@onCreate(fn())` and `@onUpdate(fn())` look up a new generator function registry (new), whose entries map the column's codec to a generator. A name may be in both (`now`). `@default(uuid())` then finds no database function `uuid` and is refused with a message naming `@onCreate(uuid())`.

## 4. Every use of `storage.types` and `typeRef`

| Use | File | After |
| --- | --- | --- |
| PSL alias resolution | `packages/2-sql/2-authoring/contract-psl/src/psl-named-type-resolution.ts` (`resolveNamedTypeDeclarations` builds `storageTypes`; `validateNamedTypeAttributes` refuses every attribute, `PSL_UNSUPPORTED_NAMED_TYPE_ATTRIBUTE`) | aliases expand into each column; `@default`, `@onCreate`, `@onUpdate` accepted; `@id`, `@unique` refused |
| PSL column typeRef | `psl-field-resolution.ts`, `psl-column-resolution.ts` | no `typeRef` written |
| TS builder | `packages/2-sql/2-authoring/contract-ts/src/contract-lowering.ts:112-139, 1040`, `lower-column.ts:135-166`, `build-contract.ts:220`, `field.namedType` in `contract-dsl.ts:2567-2571` | `types:` and `field.namedType` for codec instances go; aliases are constants |
| `contract.d.ts` emission | `packages/2-sql/3-tooling/emitter/src/index.ts:144, 323, 342-354` | emits types only for registered database types |
| Runtime codec instances | `packages/2-sql/5-runtime/src/sql-context.ts:38-45, 328-360 (initializeTypeHelpers), 483-560`; `packages/2-sql/4-lanes/relational-core/src/codec-ref-for-column.ts:27-58` | instances unchanged (content keyed); `ExecutionContext.types` removed (only tests read it: `packages/2-sql/5-runtime/test/parameterized-types.test.ts`, `execution-stack.test.ts`, `sql-context.test.ts`). `codecRefForColumn` drops `many: true` for a `typeRef` column (line 48-51); expansion removes that path |
| Migration planner | `packages/2-sql/9-family/src/core/migrations/contract-to-schema-ir.ts:77-79, 179-200`; `packages/3-targets/3-targets/postgres/src/core/migrations/planner-type-resolution.ts`; `planner-strategies.ts:403-450` (`storageTypePlanCallStrategy`, `planTypeOperations` hook) | schema IR already resolves `typeRef`, so DDL is unchanged. Hooks stay for registered types; no production codec implements them today |
| Field events | `packages/2-sql/9-family/src/core/migrations/field-event-planner.ts:262-270` (`sameStorageColumn` compares `typeRef` by name) | must compare resolved codec, data type and params, or an upgraded contract fires `altered` for every formerly aliased column. No production codec implements `onFieldEvent` today |
| `db verify` | `packages/2-sql/9-family/src/core/diff/schema-verify.ts:228-250` (`verifyType` per entry) | stays for registered types; column checks run on the schema IR, which has no `typeRef` |
| Contract stack checks | `packages/2-sql/9-family/src/core/contract-stack-checks.ts:46-48` | unchanged for registered types |
| `contract print` | `packages/3-targets/3-targets/postgres/src/core/psl-print/domain-types.ts:147-180` (`buildTypesBlock`), `scalar-fields.ts:104-135`, `refusals.ts:441-453` | no `types {}` block; columns print expanded |
| `contract infer` | `packages/3-targets/3-targets/postgres/src/core/psl-infer/*` | writes no `types {}` block and no generators today; unaffected |
| Prisma 7 reader | `packages/2-sql/2-authoring/contract-prisma7/src/interpreter.ts:332-334` refuses `types` | unaffected; it writes no `typeRef` |
| Contract spaces | Supabase `packages/3-extensions/supabase/src/contract/contract.prisma` (9 aliases), `contract.json` (85 `typeRef`), generator `packages/3-extensions/supabase/scripts/generate-contract.ts`; pgvector and PostGIS register `vector` and `geometry` | Supabase re-generates expanded, its space hash changes. pgvector and PostGIS keep their entries and hashes |
| Stored contracts | about 36 `contract.json` files hold codec-instance entries, including migration snapshots `examples/prisma-8-demo/migrations/snapshots/*/contract.json` (8) and `prisma-8-postgis-demo` (2) | upgrade script rewrites them |

User aliases are the `codec-instance` entries from PSL `types {}` and TS `types:`. Database objects are pgvector's `vector` and PostGIS's `geometry` registrations. Native enums are not in the slot.

Supabase cross-space foreign keys: `packages/3-extensions/supabase/test/cross-contract-fk.integration.test.ts`, test "cross-schema FK is in pg_constraint; confdeltype=c; dbVerify passes with zero issues". Its app column is inline `pg/uuid@1` (`field.column(pgUuid)`) and references `auth.users.id`, which is `typeRef: "Id"` in the Supabase space. `db verify` passes with zero issues, so a foreign key between an inline column and a column of the same resolved type already verifies. Foreign keys across spaces carry column names only. Expansion makes both sides inline.

## 5. The TypeScript builder

Today (`packages/2-sql/2-authoring/contract-ts/src/contract-dsl.ts`): `field.column(descriptor)`, `field.generated(spec)` (onCreate only, `:694-724`), `field.namedType(typeRef)`, plus pack presets composed into `field.*` (`composed-authoring-helpers.ts`, `buildFieldPreset` at `contract-dsl.ts:754`). `type.*` helpers come from a pack's `type` namespace (Postgres: `BigIntNumber`, `UnboundedInt`, `pg.enum`; SQLite: `BigIntNumber`) and produce `storage.types` entries. `.default(value)` takes a literal or `now()` / `autoincrement()` from `default-functions.ts`, both database defaults. No TS path sets `onUpdate` except presets. Column descriptors for plain types come from `@internal/adapter-postgres/column-types` (`textColumn`, `charColumn(n)`, `timestampTemporalColumn` with no precision, `timeTemporalColumn(p)`).

Proposed API (names marked new):

```ts
const UpdatedAt = field.column(type.TimestampString(3)).onCreate(gen.now()).onUpdate(gen.now());

model('Post', {
  fields: {
    id: field.column(textColumn).id().onCreate(gen.uuid()),
    updatedAt: UpdatedAt.default(now()),
  },
});
```

- `.onCreate(g)` and `.onUpdate(g)` (new) on the field builder, immutable like `.default()`.
- `gen.now()`, `gen.uuid(7)`, `gen.nanoid(16)`, `gen.cuid(2)`, `gen.ulid()`, `gen.ksuid()` (new) return a generator function call; lowering resolves it by codec through the same registry PSL uses.
- `type.*` gets a helper for every PSL type constructor (new for most, such as `type.TimestampString(3)`), and `field.column` accepts its result.
- A TS alias is a plain constant (builders are immutable). Target aliases arrive as `type.temporal.UpdatedAt()` (new).
- `field.generated(spec)`, `field.namedType` for codec instances, the `types:` key for codec instances and every preset helper go.

Before and after:
- `field.temporal.timestamp(3, 'now', 'now')` becomes `field.column(type.Timestamp(3)).onCreate(gen.now()).onUpdate(gen.now())`.
- `field.id.uuidv4String()` becomes `field.column(charColumn(36)).id().onCreate(gen.uuid())`.

## 6. Mongo

- Presets: `temporal.createdAt`, `updatedAt`, `timestamp` on `mongo/date@1`, all `timestampNow` (`packages/3-mongo-target/1-mongo-target/src/core/authoring.ts`). PSL resolution `packages/2-mongo-family/2-authoring/contract-psl/src/field-presets.ts`; TS `FieldBuilderFromPresetDescriptor` in `packages/2-mongo-family/2-authoring/contract-ts/src/contract-builder.ts:986-1047`.
- No `@default` attribute, an empty default function registry (`provider.ts:44`), no `types {}` (named types rejected, `interpreter.ts:1185`), no `storage.types`.
- `@updatedAt` and `@default(now())` are refused with hints pointing at presets (`packages/2-mongo-family/2-authoring/contract-psl/src/mongo-attribute-specs.ts:69-83`).
- The Prisma 6 reader maps `@updatedAt` and `@default(now())` to `binding.timestampGeneratorId` (`packages/2-mongo-family/2-authoring/contract-prisma6/src/interpreter.ts:1078-1084`).
- After: Mongo gets `@onCreate`/`@onUpdate` specs and a `now` generator function for `mongo/date@1`; `types {}` aliases expanded at authoring (no storage); `temporal.CreatedAt`/`UpdatedAt` aliases; the TS builder gets `.onCreate`/`.onUpdate`. The Prisma 6 reader resolves through the same registry.

## 7. The Prisma 7 reader

- `@updatedAt`: `binding.updatedAtGenerator(resolved.descriptor)` (`packages/2-sql/2-authoring/contract-prisma7/src/interpreter.ts:1170-1229`; Postgres binding `prisma7-binding.ts:74` = `postgresNowGeneratorFor`). Lowers to `{ onCreate: g, onUpdate: g }`. A column with no generator is refused.
- `@default(uuid())`, `cuid()`, `ulid()`, `nanoid()`: through the default function registry's `lower` (`packages/2-sql/2-authoring/contract-prisma7/src/defaults.ts:337-397`), result `onCreate`.
- `@default(now())`: database default `now()`.
- PR A allows `@updatedAt` beside `@default(now())` (fixture `test/fixtures/updated-at-with-default`).
- After: the reader resolves `@updatedAt` as `now` for both phases, and Prisma 7's client generators in `@default` as `onCreate`, through the generator function registry. `binding.updatedAtGenerator` goes. The contract it builds is unchanged.

## 8. `contract print`

- Today (PR A): `buildExecutionDefault` (`packages/3-targets/3-targets/postgres/src/core/psl-print/generated-values.ts`) first tries `fieldPresetCallFor` (`packages/2-sql/9-family/src/core/psl-build/generated-values.ts:211`) to write a preset call; else writes `@default(<fn>(...))` for a create-only generator from `defaultFunctionPrintersByGenerator`; else refuses (`refusals.ts`: `refuseGeneratorOnUpdate`, `refuseGeneratorsNoPresetWritesTogether`, `refuseUnwritablePresetCall`, `refusePresetCallReadingBackDifferently`, `refuseGeneratorWithoutPslFunction`). Named types print as a `types {}` block (`domain-types.ts:147-180`) and columns name them.
- After: no `types {}` block for aliases. Each generated column prints its type plus `@onCreate(fn(...))` and `@onUpdate(fn(...))`, from the reverse map generator → function and arguments. Only `refuseGeneratorWithoutPslFunction` remains. Target alias names are not printed: the contract does not store them, and printing one would need a match from column back to alias, which cannot tell a contributed alias from the same attributes written by hand. The expanded form is deterministic.

## 9. Contract hashes

- The database marker records `storageHash` and `profileHash` only (`packages/1-framework/3-tooling/cli/src/control-api/operations/db-sign.ts:97, 169-170`). `executionHash` is not in the marker (ADR 158).
- Presets to attributes: no hash changes when the column and generators are identical.
- `@default(uuid())` to `@onCreate(uuid())`: no hash changes.
- Contracts with `types {}` or TS `types:`: the storage hash changes (`typeRef` goes, params inline, `storage.types` entries go).
- Supabase's space contract hash changes. pgvector and PostGIS do not change.
- Users: rewrite stored contracts and snapshots with the upgrade script, re-emit, run `db sign` against every database. `migration plan` alone fails with "plan produced no operations" (`migration-plan.ts:207-216`).

## 10. ADRs superseded or amended

- ADR 170 — Pack-provided type constructors and field presets: field-preset half superseded ("What this looks like" preset examples, the preset bullets of "Why we need this" and "What we are doing", "What can a preset do?", "How this fits TS and PSL together"). Type constructors, "How names work", "Who gets the short names?" stand.
- ADR 246 — Option arguments and select templates: superseded. The `option` argument kind (`option-descriptor.ts`) and the `select` template node are used only by temporal presets (`git grep "kind: 'option'"`, `"kind: 'select'"`) and go. Its two omission rules (no empty `executionDefaults`, no empty `typeParams`) stand as canonicalization rules.
- ADR 169 — Declared applicability for mutation default generators: §1 amended (applicability still keyed by codec id, now declared on the generator function entry rather than the generator descriptor); §3 note and the `@default(uuid(7))` bullet superseded.
- ADR 158 — Execution mutation defaults: §1 ("onUpdate is future work") amended; §3 compatibility amended; §4 precedence already says a database default and a generator may coexist with no diagnostic (PR A), and ADR 275 restates it for `@default` with `@onCreate`.
- ADR 104 — PSL extension namespacing & syntax: "Named storage type for reuse" and "Enforceable coupling" amended; an alias is authoring shorthand, checks run on the expanded column.
- ADR 241 — Scalar types use the type-constructor channel: the grounding example's `storage.types` JSON (`Slug`) and `typeRef` superseded; its "Amends ADR 170" now points at a partly superseded ADR.
- ADR 208 — Higher-order codecs for parameterized types: the paragraph that makes a `storage.types` entry the unit of a shared codec instance, and "How it composes" §2–§4, amended; sharing is by content, `name` is the column sentinel.
- ADR 212 — AST-bound codec resolution: the `codecRefForColumn` sentence on resolving `typeRef` amended. ADR 212 — Contract spaces: unaffected (pgvector keeps its registration).
- ADR 231 — Declarative attribute specifications, ADR 249 — Central attribute-spec registry: `@default`'s `funcCall` arms list only database functions; new `@onCreate`/`@onUpdate` specs. ADR 249's construction-time context gains the generator function registry.
- ADR 254 — Data types and casts: assembly item 6 ("or field preset") and the `storage.types` sentence in "Columns and type constructors" amended.
- ADR 269 — PSL mixins: stands; its example `updatedAt DateTime @default(now())` never advances and should read `@onCreate(now()) @onUpdate(now())`.
- Examples to update: ADR 181 (TS presets), ADR 226, ADR 244, ADR 257, ADR 259.
- ADR 239: unrelated (skipped as instructed). ADR 256 (runtime generators): unaffected.

## 11. The language server

- `packages/1-framework/3-tooling/language-server/src/completion-scope.ts:84-108` treats `descriptor.kind === 'fieldPreset'` as callable and labels it "Field preset"; that branch goes.
- Option-argument snippets (`completion-snippets.ts`) lose the `option` kind.
- New attribute specs for `@onCreate` and `@onUpdate` give argument completion and hover through the attribute-spec registry (ADR 249), listing the generator functions.
- Contributed aliases (`temporal.UpdatedAt`) complete in type position like type constructors.

## Diagnostics to rewrite

- SQL `@updatedAt` hint (`psl-field-resolution.ts:206-230`, "Use `temporal.updatedAt()` as a field-preset call instead") → "Use `@onCreate(now()) @onUpdate(now())` or the type `temporal.UpdatedAt`".
- Mongo hints (`mongo-attribute-specs.ts:69-83`).
- `@default(<preset-only generator>)` refusal (`psl-column-resolution.ts:920-928`) goes.
- `describe-model.ts` preset wording.
- `PSL_PRESET_*` codes go.
