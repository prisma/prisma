# Slice 3: field presets removed

_Parent project: `projects/remove-field-presets/`. Linear: TML-3607. One PR. Design: ADR 275. Builds on slice 1 (PR #30780, merged) and slice 2 (PR #30819, in the merge queue). Every path below was checked on `main` at 95eeb76182 and on the slice 2 branch `tml-3607-alias-expansion` at c7e748f693; line numbers are from the slice 2 tip. The build starts from a fresh `main` after slice 2 merges. Outcome: no field preset exists in either family or either authoring surface; every preset call is refused in PSL with the exact rewrite, and its replacement stores the same contract; the `option`, `number` and `object` argument kinds, the `select` template node and the text parsers only they use are gone; the language server has no preset branches._

## Conflicts with the design

### C1. SQLite has no column type for the identifier presets

The SQL family contributes its presets to every SQL target (`packages/2-sql/9-family/src/exports/pack.ts:32`, `src/core/control-descriptor.ts:31`). Eleven of them store `sql/char@1` with a length: `uuidString`, `ulid`, `nanoid`, `cuid2`, `ksuid` and `id.uuidv4String`, `id.uuidv7String`, `id.ulid`, `id.nanoid`, `id.cuid2`, `id.ksuid` (`packages/2-sql/9-family/src/core/authoring-field-presets.ts:41-204`). SQLite registers that codec as `sqlite/character`, and committed SQLite contracts use these presets: `examples/prisma-8-demo-sqlite/src/prisma/contract.json` stores every `id` column as `{ "codecId": "sql/char@1", "dataType": "sqlite/character", "typeParams": { "length": 36 } }`, from `field.id.uuidv4String()` in `examples/prisma-8-demo-sqlite/prisma/contract.ts:14`.

SQLite has no type constructor that writes `sql/char@1`. Its constructors are the eight scalars (`packages/3-targets/3-targets/sqlite/src/core/type-constructors.ts:21-62`), `sql.String(n)` (`sql/varchar@1`, `packages/2-sql/9-family/src/core/authoring-type-constructors.ts:19-37`), `BigIntNumber`, `Raw` and the `temporal` aliases (`sqlite/src/core/authoring.ts:11-25`). The SQLite adapter exports no `charColumn` (`packages/3-targets/6-adapters/sqlite/src/exports/column-types.ts`). So on SQLite these eleven presets have no replacement, in PSL or in TypeScript, that stores the same contract. ADR 275 assumes `charColumn(36)` / `Char(36)`, which exist on Postgres only.

What this spec does: `sqlTargetTypeConstructors` gains `sql.Char(length)`, beside `sql.String(length)`, with output `{ codecId: 'sql/char@1', typeParams: { length } }` and the target's size type. Both SQL targets get it, so `sql.Char(36)` is one portable form, as `sql.String(n)` is. The replacement of every `sql/char@1` preset is written with it (D2). On Postgres `Char(36)` stays the printed and documented form; `contract print` keeps writing the `inferred` constructor. This adds one type constructor; it changes no decision of ADR 275. If Will prefers a SQLite-only `Char(n)`, only the name in D2's tables and messages changes.

No other part of ADR 275 or the plan conflicts with the code. Every other preset has a replacement that stores the same contract (D2).

## At a glance

PSL today, on Postgres:

```prisma
model Event {
  id        id.uuidv4String()
  code      nanoid({ size: 12 })
  seenAt    temporal.time(3, onUpdate: now)
  createdAt temporal.createdAt()
  payload   json()
}
```

PSL after this slice:

```prisma
model Event {
  id        Char(36)           @id @onCreate(uuid())
  code      Char(12)
  seenAt    Time(3)            @onUpdate(now())
  createdAt temporal.CreatedAt
  payload   Jsonb
}
```

Both store the same contract, with the same storage and execution hashes. The old form is refused, one diagnostic per field:

```
PSL_UNRESOLVED_REFERENCE: id.uuidv4String() was a field preset, and Prisma 8 removed field presets. Write sql.Char(36) @id @onCreate(uuid()).
PSL_UNRESOLVED_REFERENCE: temporal.time(3, onUpdate: now) was a field preset, and Prisma 8 removed field presets. Write Time(3) @onUpdate(now()).
```

TypeScript today:

```ts
fields: {
  id: field.id.uuidv4String(),
  code: field.nanoid({ size: 12 }),
  seenAt: field.temporal.time(3, undefined, 'now'),
  createdAt: field.temporal.createdAt(),
  payload: field.json(),
  slug: field.generated(nanoid({ size: 16 })),
}
```

TypeScript after:

```ts
fields: {
  id: field.column(type.Char(36)).id().onCreate(gen.uuid()),
  code: field.column(type.Char(12)),
  seenAt: field.column(type.Time(3)).onUpdate(gen.now()),
  createdAt: field.column(type.temporal.CreatedAt()),
  payload: field.column(type.Jsonb()),
  slug: field.column(type.Char(16)).onCreate(gen.nanoid(16)),
}
```

`field.id`, `field.temporal`, `field.text()` and the other preset helpers, and `field.generated`, no longer exist; TypeScript reports a missing property.

## Today

On the slice 2 tip:

- **Descriptor kind.** `AuthoringFieldPresetDescriptor` and `AuthoringFieldPresetOutput` (`packages/1-framework/1-core/framework-components/src/shared/framework-authoring.ts:165-178`), `AuthoringFieldNamespace` (`:205-207`), `isAuthoringFieldPresetDescriptor` (`:769-773`), the `fieldPreset` case of the descriptor guard (`:825-829`), `instantiateAuthoringFieldPreset` (`:2094-2123`) and the templates only presets resolve: `AuthoringColumnDefaultTemplate`, `AuthoringExecutionDefaultsTemplate` and their resolvers (`:146-163`, `:1870-1943`).
- **`AuthoringContributions.field`.** Merged by the control stack (`control/control-stack.ts:274-276`), checked for codecs (`:390-410`) and data types (`shared/data-type-support.ts:126`), merged with `type` by the PSL binder (`psl-parser/src/binder.ts:335`), and walked into TypeScript helpers by `createFieldHelpersFromNamespace` (`packages/1-framework/2-authoring/contract/src/field-preset-helpers.ts`). `AuthoringNamespaceKey` includes `'field'` (`contract/src/composed-helpers-scaffolding.ts:32`). `fieldPresetSpellings` and `getAuthoringFieldPreset` (`shared/field-preset-resolution.ts`) have no production caller.
- **Argument kinds.** `AuthoringArgumentDescriptor` is `value`, `number`, `object` or `option` (`framework-authoring.ts:79-95`; `AuthoringOption` in `shared/option-descriptor.ts`). After TML-3615 every type constructor takes only `value` arguments, and `assembleDataTypeSupport` refuses any other kind on a type constructor (`data-type-support.ts:279`). The last users of the other three: `number` and `object` in the family's `nanoid` presets (`authoring-field-presets.ts:27-39`), `option` in `TEMPORAL_ON_CREATE_ARG` and `TEMPORAL_ON_UPDATE_ARG` (`shared/temporal-presets.ts:81-93`). No extension in the repository uses them. Their readers: `validateAuthoringArgument` (`framework-authoring.ts:1667-1735`), `ArgTypeFromDescriptor`, `ObjectArgumentType` and `OptionalObjectArgumentKeys` (`packages/1-framework/2-authoring/contract/src/authoring-argument-types.ts:12-80`), `parsePslAuthoringArgumentText`, `parsePslObjectLiteral`, `parseJsLikeLiteral` and `unquoteStringLiteral` (`packages/1-framework/2-authoring/psl-parser/src/authoring-arguments.ts:13-333`), the hover label (`language-server/src/hover.ts:188-193`) and the snippet placeholder (`completion-snippets.ts:45`).
- **Templates.** `AuthoringSelectRef` (`framework-authoring.ts:53-58`), its guard (`:694-708`), its validation against option arguments (`:1481`, `:1503-1620`) and its resolution (`:1638-1650`). `AuthoringArgRef.path` and `.default` (`:32-37`) are used only by the family `nanoid` presets (`authoring-field-presets.ts:66-71`, `:148-165`); `ResolveTemplateValue` resolves them at the type level (`authoring-argument-types.ts:131-175`).
- **Preset maps.** SQL family (`authoring-field-presets.ts`), Postgres (`postgresAuthoringFieldPresets`, `packages/3-targets/3-targets/postgres/src/core/authoring.ts:868-1006`), SQLite (`sqliteAuthoringFieldPresets`, `sqlite/src/core/authoring.ts:27-36`), Mongo (`mongoAuthoringFieldPresets`, `packages/3-mongo-target/1-mongo-target/src/core/authoring.ts:12-17`). Builders: `temporalAuthoringPresets`, `temporalCodecPreset`, `temporalPhaseTemplate*`, `PresetStorageTemplate` (`shared/temporal-presets.ts`), `temporalStringAuthoringPresets` and `temporalCodecPresetWithPrecision` (`packages/2-sql/9-family/src/core/timestamp-now-generator.ts`, exported from `src/exports/pack.ts:20-23`). The same `temporal-presets.ts` holds `TIMESTAMP_NOW_GENERATOR_ID`, `timestampNowControlDescriptor` and slice 2's `temporalTypeAliases`, which stay.
- **PSL.** `instantiatePslFieldPreset` and `reportPresetNotCalled` (`psl-parser/src/field-presets.ts`, exported from `src/exports/interpret.ts:3`). `ContributedTypeDescriptor` includes `fieldPreset` (`contributed-type-scope.ts:42`). SQL: `FieldPresetContributions` and `instantiateFieldPreset` (`packages/2-sql/2-authoring/contract-psl/src/psl-column-resolution.ts:395-510`), the preset branch of `resolveFieldTypeDescriptor`, and five checks in `psl-field-resolution.ts` (`PSL_PRESET_NOT_LIST` `:363`, `PSL_PRESET_NOT_OPTIONAL` `:385`, `PSL_PRESET_AND_DEFAULT_CONFLICT` `:406` and `:505`, `PSL_PRESET_AND_ID_CONFLICT` `:550`). Mongo: `resolveFieldPreset` (`packages/2-mongo-family/2-authoring/contract-psl/src/field-presets.ts`), `PSL_PRESET_WITHOUT_EFFECT` (`interpreter.ts:184-219`), the preset branch at `:1391-1410`, `PSL_PRESET_AND_DEFAULT_CONFLICT` (`:1217`), and `resolvePresetExecutionDefaults` (`:1112-1160`), whose `PSL_PRESET_ON_VARIANT_FIELD` and `PSL_PRESET_CONFLICT` also fire for `@onCreate` and `@onUpdate`.
- **Removed-name refusals.** The family's `pslDiagnostics.describeUnresolvedType` (SQL: `packages/2-sql/2-authoring/contract-psl/src/unresolved-type.ts`, wired in `packages/2-sql/9-family/src/core/control-descriptor.ts:47-50`; Mongo: `packages/2-mongo-family/9-family/src/core/control-descriptor.ts:29-32`) already words the binder's `PSL_UNRESOLVED_REFERENCE` for `Unsupported("x")`, the Prisma 7 form, and names its replacement. Its factory receives the stack's contributions (`binder.ts:330-345`).
- **SQL TypeScript.** `buildFieldPreset` (`packages/2-sql/2-authoring/contract-ts/src/contract-dsl.ts:835-860`), `field.generated` and `GeneratedFieldSpec` (`:253-257`, `:795-818`, `:2651`), `createComposedFieldHelpers` (`composed-authoring-helpers.ts:294-330`), `createFieldPresetHelper` (`authoring-helper-runtime.ts:166-231`), the preset types in `authoring-type-utils.ts:10-181`. The messages of `generator-phase-set-twice` and `default-set-twice` name "a field preset" (`contract-dsl.ts:122`, `:136`).
- **Mongo TypeScript.** `FieldBuilderFromPresetDescriptor`, `buildFieldPreset` and the preset helper composition (`packages/2-mongo-family/2-authoring/contract-ts/src/contract-builder.ts:1040-1230`); the phase-set-twice message names a preset (`:1360`). The built-in helpers (`field.date()`, `field.string()`, … `:1475-1520`) are not presets and stay.
- **`@internal/ids`.** The TypeScript spec helpers `uuidv4()`, `uuidv7()`, `ulid()`, `nanoid()`, `cuid2()`, `ksuid()` and `GeneratedColumnSpec` (`packages/1-framework/2-authoring/ids/src/index.ts:100-150`) feed only `field.generated`. `generatedLength` (`:88-98`), which slice 1's length check reads (`packages/2-sql/9-family/src/core/generator-functions.ts`), and the limits stay. `@prisma/orm-framework/ids` re-exports the package.
- **Postgres facade.** `@prisma/orm-postgres/contract-builder` exports `field` and `gen` built from the family and target packs (`packages/3-extensions/postgres/src/contract/field.ts`, `src/exports/contract-builder.ts:44`). Query fragments (ADR 259) declare their fields with it: `field.temporal.timestamptz()`, `field.uuidNative()`, `field.text()`. It exports no `type`.
- **Language server.** `completion-scope.ts:94`, `:107-109` (a preset is callable and has the detail "Field preset"); `hover.ts:146` (a preset has no documentation) and `:188-193`; `completion-snippets.ts:45`.

## Decisions

### D1. `AuthoringContributions.field` is removed, and a component that still sets it is refused

With presets gone the `field` namespace holds nothing, so the key goes from `AuthoringContributions`, `ComponentMetadata.authoring` and `AuthoringNamespaceKey`. The binder reads `contributions.type` alone (`binder.ts:335`). `createFieldHelpersFromNamespace` and `field-preset-helpers.ts` go; the TypeScript `field` of both builders is the built-in helpers only (`column` and enum-handle `namedType` in SQL, the codec helpers in Mongo).

The control stack and `composePackAuthoringNamespace` throw `CONTRACT.PACK_CONTRIBUTION_INVALID` when a component's `authoring` has a `field` key: `Component "<id>" contributes authoring.field, which Prisma 8 removed with field presets. Contribute a type alias (kind: 'typeAlias') or a type constructor in authoring.type.`

Why refuse: an extension built against the old types would otherwise lose its presets with no error, and the project rule is hard errors that name the replacement (spec cross-cutting rule 3). The check is one key test at assembly.

### D2. Each preset is replaced by a type constructor or contributed alias, plus attributes

The tables below are the full list. Every replacement stores the same column (codec, data type, type params, nullability) and the same generators, so the storage and execution hashes do not change. Step 1 of the dispatch plan proves each row with a parity test before anything is removed (D9).

`sql.Char(n)` is C1's new constructor. On Postgres `Char(n)` is equal and is the form the examples and docs use; the refusal messages use `sql.Char(n)`, which both SQL targets accept.

**SQL family presets, on Postgres and SQLite**

| Preset (PSL; TypeScript adds `field.`) | Stores | PSL replacement | TypeScript replacement |
|---|---|---|---|
| `uuidString()` | `sql/char@1`, `{ length: 36 }` | `sql.Char(36)` (Postgres: `Char(36)`) | `field.column(type.sql.Char(36))` (Postgres: `type.Char(36)`) |
| `ulid()` | `sql/char@1`, `{ length: 26 }` | `sql.Char(26)` | `field.column(type.sql.Char(26))` |
| `nanoid()` | `sql/char@1`, `{ length: 21 }` | `sql.Char(21)` | `field.column(type.sql.Char(21))` |
| `nanoid({ size: n })` | `sql/char@1`, `{ length: n }` | `sql.Char(n)` | `field.column(type.sql.Char(n))` |
| `cuid2()` | `sql/char@1`, `{ length: 24 }` | `sql.Char(24)` | `field.column(type.sql.Char(24))` |
| `ksuid()` | `sql/char@1`, `{ length: 27 }` | `sql.Char(27)` | `field.column(type.sql.Char(27))` |
| `id.uuidv4String()` | as `uuidString()`, `@id`, `uuidv4` on create | `sql.Char(36) @id @onCreate(uuid())` | `field.column(type.sql.Char(36)).id().onCreate(gen.uuid())` |
| `id.uuidv7String()` | as above, `uuidv7` | `sql.Char(36) @id @onCreate(uuid(7))` | `….id().onCreate(gen.uuid(7))` |
| `id.ulid()` | `{ length: 26 }`, `@id`, `ulid` | `sql.Char(26) @id @onCreate(ulid())` | `field.column(type.sql.Char(26)).id().onCreate(gen.ulid())` |
| `id.nanoid()` | `{ length: 21 }`, `@id`, `nanoid` with no params | `sql.Char(21) @id @onCreate(nanoid())` | `field.column(type.sql.Char(21)).id().onCreate(gen.nanoid())` |
| `id.nanoid({ size: n })` | `{ length: n }`, `@id`, `nanoid` `{ size: n }` | `sql.Char(n) @id @onCreate(nanoid(n))` | `field.column(type.sql.Char(n)).id().onCreate(gen.nanoid(n))` |
| `id.cuid2()` | `{ length: 24 }`, `@id`, `cuid2` | `sql.Char(24) @id @onCreate(cuid(2))` | `field.column(type.sql.Char(24)).id().onCreate(gen.cuid(2))` |
| `id.ksuid()` | `{ length: 27 }`, `@id`, `ksuid` | `sql.Char(27) @id @onCreate(ksuid())` | `field.column(type.sql.Char(27)).id().onCreate(gen.ksuid())` |

A TypeScript `id` preset's trailing `{ name }` moves to `.id({ name })`. Slice 1's bindings give the same generator ids and params (`generator-functions.ts:51-56`, `:109-121`): `nanoid()` writes no params, as the preset's unset `size` path did after the empty-params omission. Each length equals what the generator writes, so slice 1's fit check passes.

**Postgres presets**

| Preset | Stores | PSL replacement | TypeScript replacement |
|---|---|---|---|
| `text()` | `pg/text@1` | `String` | `field.column(type.String())` |
| `int()` | `pg/int4@1` | `Int` | `field.column(type.Int())` |
| `bigint()` | `pg/int8@1` | `BigInt` | `field.column(type.BigInt())` |
| `float()` | `pg/float8@1` | `Float` | `field.column(type.Float())` |
| `decimal()` | `pg/numeric@1`, no params | `Decimal` | `field.column(type.Decimal())` |
| `boolean()` | `pg/bool@1` | `Boolean` | `field.column(type.Boolean())` |
| `json()` | `pg/jsonb@1` | `Jsonb` (not `Json`, which is `pg/json@1`) | `field.column(type.Jsonb())` |
| `bytes()` | `pg/bytea@1` | `Bytes` | `field.column(type.Bytes())` |
| `dateTime()` | `pg/timestamptz-temporal@1` | `DateTime` | `field.column(type.DateTime())` |
| `uuidNative()` | `pg/uuid@1` | `Uuid` | `field.column(type.Uuid())` |
| `id.uuidv4Native()` | `pg/uuid@1`, `@id`, `uuidv4` | `Uuid @id @onCreate(uuid())` | `field.column(type.Uuid()).id().onCreate(gen.uuid())` |
| `id.uuidv7Native()` | `pg/uuid@1`, `@id`, `uuidv7` | `Uuid @id @onCreate(uuid(7))` | `….id().onCreate(gen.uuid(7))` |
| `temporal.createdAt()` | `pg/timestamptz-temporal@1`, `instantNow` on create | `temporal.CreatedAt` | `field.column(type.temporal.CreatedAt())` |
| `temporal.updatedAt()` | same, on create and update | `temporal.UpdatedAt` | `field.column(type.temporal.UpdatedAt())` |
| `temporal.createdAtString()`, `updatedAtString()` | `pg/timestamptz-string@1` | `temporal.CreatedAtString`, `temporal.UpdatedAtString` | `field.column(type.temporal.CreatedAtString())`, … |
| `temporal.createdAtJsDate()`, `updatedAtJsDate()` | `pg/timestamptz-date@1` | `temporal.CreatedAtJsDate`, `temporal.UpdatedAtJsDate` | `field.column(type.temporal.CreatedAtJsDate())`, … |
| `temporal.timestamp(p, onCreate: now, onUpdate: now)` | `pg/timestamp-temporal@1`, `{ precision: p }`, `plainDateTimeNow` | `Timestamp(p) @onCreate(now()) @onUpdate(now())` | `field.column(type.Timestamp(p)).onCreate(gen.now()).onUpdate(gen.now())` |
| `temporal.timestamptz(…)` | `pg/timestamptz-temporal@1`, `instantNow` | `Timestamptz(p)` + the same attributes | `type.Timestamptz(p)` + the same calls |
| `temporal.timestampString(…)` | `pg/timestamp-string@1`, `timestampStringNow` | `TimestampString(p)` + attributes | `type.TimestampString(p)` + calls |
| `temporal.timestamptzString(…)` | `pg/timestamptz-string@1`, `timestamptzStringNow` | `TimestamptzString(p)` + attributes | `type.TimestamptzString(p)` + calls |
| `temporal.timestamptzJsDate(…)` | `pg/timestamptz-date@1`, `timestampNow` | `TimestamptzJsDate(p)` + attributes | `type.TimestamptzJsDate(p)` + calls |
| `temporal.date(onCreate: now, onUpdate: now)` | `pg/date-temporal@1`, `plainDateNow` | `Date` + attributes | `type.Date()` + calls |
| `temporal.dateString(…)` | `pg/date-string@1`, `dateStringNow` | `DateString` + attributes | `type.DateString()` + calls |
| `temporal.time(p, …)` | `pg/time-temporal@1`, `plainTimeNow` `{ precision: p }` | `Time(p)` + attributes | `type.Time(p)` + calls |
| `temporal.timeString(p, …)` | `pg/time-string@1`, `timeStringNow` `{ precision: p }` | `TimeString(p)` + attributes | `type.TimeString(p)` + calls |
| `temporal.timetz(p, …)` | `pg/timetz@1`, `timetzNow` `{ precision: p }` | `Timetz(p)` + attributes | `type.Timetz(p)` + calls |

For the codec presets: an omitted precision is omitted from the constructor (`Timestamp` with no arguments), and each phase the preset sets becomes its attribute; a phase it leaves out has no attribute. A codec preset with no phase is the bare constructor. In TypeScript the phases are positional (`field.temporal.timestamp(3, 'now', 'now')`, `field.temporal.date('now')`); the replacement is the same. The generator for each codec, and its `precision` param for the three time codecs, comes from the Postgres `now` binding, which is built from the same `postgresNowGeneratorIds` and `postgresNowGeneratorTakesPrecision` the presets used (ADR 275's table).

**SQLite presets**

| Preset | Stores | PSL replacement | TypeScript replacement |
|---|---|---|---|
| `temporal.createdAt()`, `temporal.updatedAt()` | `sqlite/datetime@1`, `timestampNow` | `temporal.CreatedAt`, `temporal.UpdatedAt` | `field.column(type.temporal.CreatedAt())`, … |
| `temporal.datetime(onCreate: now, onUpdate: now)` | `sqlite/datetime@1`, `timestampNow` | `DateTime @onCreate(now()) @onUpdate(now())` | `field.column(type.DateTime()).onCreate(gen.now()).onUpdate(gen.now())` |

**Mongo presets**

| Preset | Stores | PSL replacement | TypeScript replacement |
|---|---|---|---|
| `temporal.createdAt()` | `mongo/date@1`, `timestampNow` on create | `temporal.CreatedAt` | `field.date().onCreate(gen.now())` |
| `temporal.updatedAt()` | same, on create and update | `temporal.UpdatedAt` | `field.date().onCreate(gen.now()).onUpdate(gen.now())` |
| `temporal.timestamp(onCreate: now, onUpdate: now)` | `mongo/date@1`, `timestampNow` | `Date @onCreate(now()) @onUpdate(now())` | `field.date().onCreate(gen.now()).onUpdate(gen.now())` |

The Mongo TypeScript builder has no contributed aliases (slice 2 D9, `deferred.md`), so its replacements are written with `field.date()`.

**`field.generated(...)`, SQL TypeScript only**

| Today | Replacement |
|---|---|
| `field.generated(uuidv4())` | `field.column(type.sql.Char(36)).onCreate(gen.uuid())` |
| `field.generated(uuidv7())` | `field.column(type.sql.Char(36)).onCreate(gen.uuid(7))` |
| `field.generated(ulid())` | `field.column(type.sql.Char(26)).onCreate(gen.ulid())` |
| `field.generated(nanoid())` | `field.column(type.sql.Char(21)).onCreate(gen.nanoid())` |
| `field.generated(nanoid({ size: n }))` | `field.column(type.sql.Char(n)).onCreate(gen.nanoid(n))` |
| `field.generated(cuid2())` | `field.column(type.sql.Char(24)).onCreate(gen.cuid(2))` |
| `field.generated(ksuid())` | `field.column(type.sql.Char(27)).onCreate(gen.ksuid())` |

`.id()` after `field.generated(...)` stays `.id()` on the replacement.

### D3. A PSL preset call is refused with its exact rewrite

Each family's `describeUnresolvedType` recognises a removed preset by the path the field writes and returns the message `<call as written> was a field preset, and Prisma 8 removed field presets. Write <replacement>.` The binder reports it as `PSL_UNRESOLVED_REFERENCE`, as it does for `Unsupported("x")`. No new diagnostic code.

- The replacement is built from the call's arguments, as D2's tables give it: the precision (first positional or `precision:`), `onCreate: now` and `onUpdate: now` (named or positional), `{ size: n }` for `nanoid`. When an argument is not one the preset accepted, the message gives the replacement without arguments: `Write Timestamp(...) with @onCreate(now()) and @onUpdate(now()) for the phases the preset set.`
- The table that maps a preset path to its replacement lives next to each describer: `packages/2-sql/2-authoring/contract-psl/src/removed-field-presets.ts` (SQL family, Postgres and SQLite paths) and the Mongo equivalent in `@internal/mongo-contract-psl`. A row is used only when its replacement type resolves in the stack's contributions, so `json()` on SQLite, where it never was a preset, keeps the binder's message.
- A preset written without a call (`temporal.createdAt`, which `PSL_PRESET_NOT_CALLED` refused) is not a removed preset; the binder's message stands, unless the name is a contributed alias.

Why here: it is the place and mechanism the project already uses for a removed type name (`unresolved-type.ts`), it needs no new contribution surface, and the set of removed names is closed. The exact rewrite makes a script unnecessary (the plan decided against one), because each message is the edit. Why the family and not each target: only the family has the hook; the stack check above keeps a row from firing on a target it does not belong to.

### D4. TypeScript gets no runtime refusal for a removed helper

`field.text()`, `field.temporal.*`, `field.id.*` and `field.generated` are absent from the builder's type, so TypeScript refuses the call at compile time. A JavaScript caller gets `field.temporal is undefined`. The upgrade guide holds D2's tables.

Why: a missing property is already a hard error. Throwing stubs would keep every preset name in the public surface. Slice 2's `CONTRACT.TYPES_KEY_REMOVED` was needed because a callback's returned object is not checked for excess keys; that gap does not apply to a missing method.

### D5. Only the `value` argument kind is left, and argument references lose `path` and `default`

- `AuthoringArgumentDescriptor` becomes `{ readonly kind: 'value'; readonly dataType: string; readonly name?: string; readonly optional?: boolean }`. `kind: 'value'` stays so no pack's type constructors change. `AuthoringOption`, `option-descriptor.ts` and the `AuthoringValueArgument` alias, now identical to `AuthoringArgumentDescriptor`, are removed (one name per object).
- `validateAuthoringArgument` keeps only the missing-argument check. `ArgTypeFromDescriptor` keeps only the `value` branch; `ObjectArgumentType` and `OptionalObjectArgumentKeys` go.
- In `authoring-arguments.ts`, `unquoteStringLiteral`, `ParsedPslLiteral`, `parseJsLikeLiteral`, `isPlainObject`, `parsePslObjectLiteral`, `TextArgumentDescriptor` and `parsePslAuthoringArgumentText` go; `readPslHelperArgument` reads every argument as a value. `mapPslHelperArgs` stays, for type constructors.
- `AuthoringSelectRef`, `isAuthoringSelectRef`, the select validation and resolution go.
- `AuthoringArgRef.path` and `.default`, their runtime resolution and `ResolveTemplateValue`'s path and default types go. Only the family `nanoid` presets used them.

Why: agreed with chandragupta-43 on 2026-10-20 to delete these if presets are their last users. The check against `main` after TML-3615 shows they are (Today). `path` and `default` meet the same test.

### D6. What keeps preset vocabulary is renamed

- Mongo: `resolvePresetExecutionDefaults` → `resolveCollectionExecutionDefaults`, `PresetExecutionDefault` → `FieldExecutionDefault` without `fromPreset`, `FieldPresetContext` → `FieldResolutionContext`. `PSL_PRESET_ON_VARIANT_FIELD` → `PSL_GENERATOR_ON_VARIANT_FIELD` and `PSL_PRESET_CONFLICT` → `PSL_GENERATOR_CONFLICT`, with messages that start `Generated value on …`. The names follow slice 1's `PSL_GENERATOR_NOT_APPLICABLE`.
- `temporal-presets.ts` → `temporal-type-aliases.ts`, keeping `TIMESTAMP_NOW_GENERATOR_ID`, `timestampNowControlDescriptor` and `temporalTypeAliases`.
- The `generator-phase-set-twice` messages (SQL `contract-dsl.ts:122`, Mongo `contract-builder.ts:1360`) end `… with a type alias or alias constant that sets it.`; `default-set-twice` (`contract-dsl.ts:136`) ends `… with an alias constant that sets one.`
- Doc comments that say "type constructor or field preset" (`data-type-support.ts`, `control-stack.ts`, `spec-context.ts`, `authoring-arguments.ts`, `parse.ts:438`, `enum-type.ts:141`) drop the preset.

### D7. The Postgres facade exports `type`

`packages/3-extensions/postgres/src/contract/field.ts` also exports `type`, from the same `createComposedAuthoringHelpers` call, and `src/exports/contract-builder.ts` re-exports it. A query fragment writes `field.column(type.Timestamptz())`, as a contract does.

Why: ADR 259's fragments used presets because the facade's `field` had them. `field.column(timestamptzTemporalColumn)` from `adapter/column-types` keeps working, but the fragment would then use different words from the contract it targets. `type` is what the `defineContract` callback receives.

### D8. Removed with no replacement needed

`PSL_PRESET_NOT_CALLED`, `PSL_PRESET_NOT_LIST`, `PSL_PRESET_NOT_OPTIONAL`, `PSL_PRESET_AND_ID_CONFLICT`, `PSL_PRESET_AND_DEFAULT_CONFLICT` (SQL and Mongo) and `PSL_PRESET_WITHOUT_EFFECT` describe preset calls only. With D3 refusing every preset call first, none can fire. The Mongo error `preset-contribution-unsupported` and the SQL and Mongo preset collision checks (`composed-authoring-helpers.ts:316-325`, `contract-builder.ts:1188-1196`) go with the helpers.

### D9. Parity is proved before removal and kept after it

Step 1 adds `test/integration/test/authoring/parity/preset-replacements/`: one table with a row per D2 row and target (preset form and replacement form, in PSL and TypeScript), a test that emits both through the real packs and asserts equal contracts and equal storage and execution hashes, and a committed `expected/<target>.contract.json` holding the replacement forms' contract. On the pre-removal code the test passes, which is the proof. When the presets go (step 5), the preset column leaves the table, and the test asserts the replacement forms still emit the committed contracts, so the proof stays in the suite.

Why a characterization test first: the claim "same contract" cannot be red before the change, because both forms work today. Its value is that it runs while both forms exist, and that the committed contracts keep holding the replacements to it afterwards.

### D10. Pending upgrade fragments are corrected

These unreleased fragments show presets or say they keep working, and ship in the same release: `default-generators-to-on-create/app` (the TypeScript paragraph: `field.generated` "keeps working for now"), `data-typed-constructor-arguments/{app,extension}` (a field preset's precision; "A field preset keeps its `number`, `option` and `object` arguments"; `instantiatePslFieldPreset`, `temporalCodecPresetWithPrecision`), `now-generators-for-every-date-time-type/app` (the string presets), `remove-nocheck/{app,extension}` and `typescript-contract-include-row-types/app` (code samples with `field.text()` and `field.id.uuidv4String()`). Each is rewritten to the replacement forms or says the preset is removed and links the new fragment. Their scripts and detections do not change, except that a detection naming a removed symbol stays only if the fragment still tells the reader what to do about it.

Why: the release guide is assembled from pending fragments. Without this it would tell users to write what this slice refuses, as slice 1 found with `contract-print-generated-values`.

## Requirements covered

| Requirement | Decision |
|---|---|
| R25: `fieldPreset`, `instantiateAuthoringFieldPreset`, `option`, `select`, the temporal builders, every `field.*` preset, `field.generated`, the TypeScript spec helpers | D1, D2, D4, D5, D8; the codec-instance `namedType` and the `types` key went in slice 2 |
| R26: the two omission rules stay | D5 keeps empty-`typeParams` normalization in `resolveAuthoringStorageTypeTemplate` and `contract-lowering.ts:102`; tests pin both rules on type constructors and generator attributes; the rule text moves to the Data Contract doc (Docs) |
| R34: language server loses its preset and `option` branches | D5, Code changes |
| R36 rest: `PSL_PRESET_*` removed or renamed, error reference updated | D3, D6, D8 |
| Plan: rename preset vocabulary | D6 |
| Plan: move every preset use, query fragments included | D2, D7, Counts |
| Plan: upgrade fragments with the full table, no script | Upgrade instructions, D3 |
| Plan: ADR amendments | Docs |
| Project acceptance: same hashes for every preset's replacement | D2, D9 |
| Project acceptance: every preset call refused, naming its replacement | D3 (PSL), D4 (TypeScript) |
| Project acceptance: no source under `packages/` mentions `fieldPreset`, `kind: 'option'`, `kind: 'select'` | Acceptance criteria |

## Preset uses to move

Counted on the slice 2 tip by matching preset call patterns in every tracked file, leaving out released history (`skills/prisma-8/upgrading/`, `upgrade-instructions/releases/`, `docs/releases/`, `CHANGELOG.md`) and project folders:

| Kind | Code files | Calls | Doc files | Calls |
|---|---|---|---|---|
| PSL preset calls in `.prisma` files | 11 | 45 | | |
| PSL preset calls in TypeScript test strings and templates | about 20 | about 57 | | |
| TypeScript scalar presets (`field.text()`, `field.uuidString()`, …) | 30 | 144 | 17 | 77 |
| TypeScript `field.id.*` | 46 | 107 | 11 | 36 |
| TypeScript `field.temporal.*` | 29 | 111 | 10 | 41 |
| TypeScript `field.generated(...)` | 14 | 28 | 9 | 19 |
| Query fragments (ADR 259), included above | 5 | 11 | 3 | 18 |

The `.prisma` files are the Postgres and Mongo temporal fixtures (`test/integration/test/temporal-defaults/_fixture*/`, `test/integration/test/mongo/temporal-presets/_fixture/`), six `test/integration/test/ports/prisma/functional/*/_fixture/contract.prisma` and `packages/2-mongo-family/2-authoring/contract-prisma6/test/parity/prisma8.prisma`. The CLI's `prisma init` templates (`packages/1-framework/3-tooling/cli/src/commands/init/templates/code-templates.ts`) write presets into new projects and move with them. The fragment uses are `examples/prisma-8-demo/src/orm-client/fragments.ts`, `examples/prisma-8-demo/test/fixtures/declaration-library.ts`, `examples/prisma-8-demo/test/fragments.types.test-d.ts`, `packages/3-extensions/sql-orm-client/test/declared-fields-fragment.test.ts` and `test/integration/test/namespaced-accessors-fragments.integration.test.ts`, with ADR 259, `packages/3-extensions/sql-orm-client/README.md` and `skills/prisma-8/references/queries-postgres.md`. Mongo's built-in `field.json()` is not a preset and was left out of the count.

Test files that test only preset machinery are deleted, not moved: `framework-components/test/temporal-presets.test{,-d}.ts`, `contract/test/field-preset-helpers.test.ts`, `psl-parser/test/authoring-arguments.test.ts` (its value-argument cases live in `authoring-arguments.value.test.ts`), `mongo contract-psl/test/interpreter.temporal-presets.test.ts`, `sql contract-psl/test/interpreter.defaults.presets.test.ts` and `interpreter.defaults.preset-misuse.test.ts`, `contract-ts/test/authoring-uuid-native-presets.test.ts`, `nanoid-preset-mirror.ts`, `temporal-preset-mirror.ts`, `family-sql/test/authoring-field-presets.test.ts`, `temporal-codec-presets.test{,-d}.ts`, `postgres facade test/contract-builder/field-presets.test.ts`, the Postgres and SQLite targets' `test/authoring-field-presets.test.ts`. Their cases that pin a stored contract move into D9's table first. `test/integration/test/mongo/temporal-presets/` is renamed `temporal-generators/`; its preset `_fixture` becomes the attribute form, and the alias and attribute twins it was compared with stay.

## Code changes by package

| Package | Files | Change |
|---|---|---|
| `@internal/framework-components` | `src/shared/framework-authoring.ts`, `option-descriptor.ts` (deleted), `temporal-presets.ts` → `temporal-type-aliases.ts`, `field-preset-resolution.ts` (deleted), `data-type-support.ts`, `src/control/control-stack.ts`, `src/exports/{authoring,control}.ts` | D1, D5, D6 |
| `@internal/contract` | `src/authoring-argument-types.ts`, `src/field-preset-helpers.ts` (deleted), `src/composed-helpers-scaffolding.ts`, `src/index.ts`, `src/enum-type.ts` (comment) | D1, D5 |
| `@internal/ids` | `src/index.ts`, `README.md` | spec helpers and `GeneratedColumnSpec` removed; `generatedLength` keeps its lengths without `GeneratedStorage` |
| `@internal/psl-parser` | `src/authoring-arguments.ts`, `src/field-presets.ts` (deleted), `src/exports/interpret.ts`, `src/contributed-type-scope.ts`, `src/binder.ts`, `src/attribute-spec/spec-context.ts`, `src/parse.ts` (comment) | D1, D5 |
| `@internal/family-sql` | `src/core/authoring-field-presets.ts` (deleted), `src/core/timestamp-now-generator.ts` (deleted), `src/core/authoring-type-constructors.ts` (`sql.Char`), `src/core/control-descriptor.ts`, `src/exports/pack.ts`, `README.md` | C1, D1 |
| `@internal/sql-contract-psl` | `src/psl-column-resolution.ts`, `src/psl-field-resolution.ts`, `src/unresolved-type.ts`, new `src/removed-field-presets.ts`, `README.md` | D3, D8 |
| `@internal/sql-contract-ts` | `src/contract-dsl.ts`, `src/composed-authoring-helpers.ts`, `src/authoring-helper-runtime.ts`, `src/authoring-type-utils.ts`, `src/contract-lowering.ts` (comment), `README.md`, `API.md` | D1, D4, D6 |
| `@internal/mongo-contract-psl` | `src/field-presets.ts` (deleted), `src/interpreter.ts`, the Mongo `describeUnresolvedType` module and a removed-preset table | D3, D6, D8 |
| `@internal/mongo-contract-ts` | `src/contract-builder.ts`, `README.md` | D1, D4, D6 |
| `@internal/target-postgres`, `@internal/target-sqlite`, `@internal/mongo-target` | `src/core/authoring.ts`, `src/core/descriptor-meta.ts` (no `authoring.field`) | D1 |
| `@internal/language-server` | `src/completion-scope.ts`, `src/hover.ts`, `src/completion-snippets.ts` | D5, R34 |
| `@internal/postgres` (facade) | `src/contract/field.ts`, `src/exports/contract-builder.ts` | D7 |
| `@internal/sql-orm-client` | `src/fragments.ts` (two messages name `field.text()` and `field.temporal.timestamptz()`), `src/orm.ts` (doc comment), `README.md` | D7 |
| `@internal/cli` | `src/commands/init/templates/code-templates.ts` and its test | D2 |

Run `pnpm build` in `framework-components`, `contract`, `ids`, `psl-parser`, `family-sql` and `sql-contract-ts` after their exported types change.

## Tests (write them first; each must fail before its change)

D9's parity test is the one exception: it passes before the change by design.

Framework, `packages/1-framework/1-core/framework-components/test/`:
- `control-stack.test.ts`: a component with `authoring.field` is refused with D1's exact message; a type constructor with a `number` argument is still refused by `assembleDataTypeSupport`.
- `framework-components.authoring.test.ts`: the `select`, `option`, `object` and `number` cases are deleted; a type-level test (`.test-d.ts`) shows `{ kind: 'option', values: [] }` is not an `AuthoringArgumentDescriptor` and a template `{ kind: 'arg', index: 0, path: ['x'] }` is not an `AuthoringArgRef` (negative type tests with `@ts-expect-error`).

C1, `packages/2-sql/9-family/test/` and the SQLite target:
- `sql.Char(36)` on SQLite PSL stores `{ codecId: 'sql/char@1', dataType: 'sqlite/character', typeParams: { length: 36 } }` (red: unresolved today); `type.sql.Char(36)` in SQLite TypeScript emits the same column; `sql.Char(36) @id @onCreate(uuid())` on SQLite stores `uuidv4` on create.

PSL refusals, red until D3:
- `packages/2-sql/2-authoring/contract-psl/test/interpreter.removed-field-presets.test.ts`: on Postgres, one case per D2 Postgres and family row, each asserting the exact diagnostic, including the argument forms (`temporal.time(3, onUpdate: now)`, `temporal.timestamp(precision: 6, onCreate: now)`, `id.nanoid({ size: 16 })`, a bare `temporal.timestamptz()`), the fallback message for an argument the preset did not take, and that `json()` on SQLite keeps the binder's message. On SQLite: `temporal.datetime(onCreate: now)` and `id.uuidv4String()`.
- `packages/2-mongo-family/2-authoring/contract-psl/test/interpreter.removed-field-presets.test.ts`: the three Mongo rows.
- The Mongo variant and shared-collection tests assert `PSL_GENERATOR_ON_VARIANT_FIELD` and `PSL_GENERATOR_CONFLICT` with the new messages.

TypeScript, red until D4 and D7:
- `packages/2-sql/2-authoring/contract-ts/test/removed-field-presets.test-d.ts`: `field.text`, `field.id`, `field.temporal`, `field.generated` do not exist on the composed Postgres and SQLite `field` (`@ts-expect-error`).
- `packages/2-mongo-family/2-authoring/contract-ts/test/contract-builder.types.test-d.ts`: `field.temporal` does not exist.
- `packages/3-extensions/postgres/test/contract-builder/`: `type` is exported and `field.column(type.Timestamptz())` declares a fragment field that matches a `Timestamptz` column.
- The messages of D6 in `contract-dsl.alias-constants.test.ts` and the Mongo execution-defaults test.

Language server, `packages/1-framework/3-tooling/language-server/test/`: `completion-provider.test.ts` lists no preset in type position for the real Postgres pack (no item with the detail "Field preset", no `temporal.createdAt`); `hover.test.ts` drops its `option` label case.

R26, `packages/2-sql/2-authoring/contract-psl/test/` and `contract-ts/test/`: `Timestamp` with no arguments stores no `typeParams`; a field with no generator attribute and no alias has no `execution` entry, in PSL and TypeScript.

Integration, one file at a time with `pnpm test <file>` inside `test/integration`:
- D9's `test/integration/test/authoring/parity/preset-replacements/preset-replacements.test.ts`.
- `test/integration/test/temporal-defaults/` and `test/integration/test/mongo/temporal-generators/`: the rewritten fixtures emit the contracts already committed under `generated/` (`pnpm fixtures:check`).
- `test/integration/test/contract-parity/` (Postgres and SQLite TypeScript fixtures), `test/integration/test/sql-orm-client/fixtures/`, `test/integration/test/sql-builder/fixtures/`, the six `ports/prisma/functional/*` fixtures: rewritten, contracts unchanged.
- `test/integration/test/psl-print/every-postgres-contract-roundtrip.integration.test.ts`: unchanged and green.
- The CLI init template test: the generated project emits and its contract has the same hashes as before.

## Upgrade instructions

New fragment `upgrade-instructions/pending/remove-field-presets/`. Its prose holds D2's tables in full, under "Before" and "After".

`app/instructions.md`, changes:

- `psl-field-presets-removed`: detection `**/*.prisma` matching `\b(temporal|id)\.[a-z]\w*\s*\(` and `\s(text|int|bigint|float|decimal|boolean|json|bytes|dateTime|uuidString|uuidNative|ulid|nanoid|cuid2|ksuid)\s*\(`. Rewrite each call as the table says, or as `contract emit`'s message says. The contract does not change, so nothing is re-emitted, signed or migrated.
- `ts-field-presets-removed`: detection `**/*.{ts,mts,cts,tsx}` matching `\bfield\.(id|temporal)\.` and `\bfield\.(text|int|bigint|float|decimal|boolean|bytes|dateTime|uuidString|uuidNative|ulid|nanoid|cuid2|ksuid)\(`. Includes query fragments. Notes that Mongo's `field.json()`, `field.date()` and the other codec helpers are not presets.
- `ts-field-generated-removed`: detection `\bfield\.generated\(` and an import of `uuidv4`, `uuidv7`, `ulid`, `nanoid`, `cuid2` or `ksuid` from `@prisma/orm-framework/ids`.
- `postgres-contract-builder-exports-type` (no action): `@prisma/orm-postgres/contract-builder` exports `type`.
- `sqlite-sql-char` (no action): `sql.Char(n)` exists on every SQL target.

`extension/instructions.md`, changes:

- `authoring-field-namespace-removed`: a pack's `authoring.field` is refused (D1). Detection `kind:\s*['"]fieldPreset['"]` and `\bauthoring\.field\b`. Contribute a `typeAlias` in `authoring.type`, as `temporalTypeAliases` does, or a type constructor.
- `argument-kinds-removed`: only `kind: 'value'` arguments exist; `AuthoringOption` and `AuthoringValueArgument` are gone; `AuthoringArgRef` has no `path` or `default`. Detection `kind:\s*['"](option|number|object|select)['"]`, `\bAuthoring(Option|ValueArgument|SelectRef)\b`.
- `preset-builders-removed`: `instantiateAuthoringFieldPreset`, `instantiatePslFieldPreset`, `reportPresetNotCalled`, `temporalAuthoringPresets`, `temporalCodecPreset`, `temporalCodecPresetWithPrecision`, `temporalStringAuthoringPresets`, `PresetStorageTemplate`, `createFieldHelpersFromNamespace` and the `@internal/ids` spec helpers. Detection by those names.
- `preset-diagnostics-removed`: `PSL_PRESET_*` codes are removed; two are renamed (D6). Detection `PSL_PRESET_`.

D10 corrects the pending fragments that show presets. Run `pnpm check:upgrade-coverage --mode pr --prev origin/main --head HEAD`.

## Docs to update

- ADR 170: a status line "Superseded in part by ADR 275: the field-preset half". The preset sections get a one-line note pointing to ADR 275; the type constructor sections stand.
- ADR 246: status "Superseded by ADR 275, except its two omission rules", which move to `docs/architecture docs/subsystems/1. Data Contract.md` as canonicalization rules.
- ADR 181, ADR 257, ADR 258, ADR 259 (examples, and its consequence "The `field` that `@prisma/orm-postgres/contract-builder` exports has the Postgres presets", rewritten for D7), ADR 254 ("or field preset" at lines 349 and 353), ADR 126 (its `kind: 'option'` example), ADR 169 and ADR 241 (references to "field presets" in ADR 170's title stay, since that is the title).
- ADR 275: its "Less code" consequence and table rows match D2; add C1 (`sql.Char`) as an amendment dated with the build.
- `docs/reference/error-reference.md`: remove the six `PSL_PRESET_*` entries; add `PSL_GENERATOR_ON_VARIANT_FIELD`, `PSL_GENERATOR_CONFLICT`; under `PSL_UNRESOLVED_REFERENCE`, the removed-preset message; under `CONTRACT.PACK_CONTRIBUTION_INVALID`, D1's message.
- `docs/reference/scalar-types.md`: the preset columns go; `sql.Char(n)`.
- `docs/architecture docs/subsystems/6. Ecosystem Extensions & Packs.md`: packs contribute type constructors and type aliases, not presets.
- READMEs: `packages/2-sql/2-authoring/contract-ts/README.md` and `API.md`, `packages/2-sql/2-authoring/contract-psl/README.md`, `packages/2-sql/9-family/README.md` (`sql.Char`), `packages/2-mongo-family/2-authoring/contract-ts/README.md`, `packages/1-framework/2-authoring/ids/README.md`, `packages/3-extensions/sql-orm-client/README.md`, `packages/3-extensions/sqlite/README.md`, `packages/3-extensions/arktype-json/README.md`.
- `skills/prisma-8/references/contract.md`, `queries-postgres.md`.
- `projects/remove-field-presets/plan.md`: slice 3 points to this spec.

## Acceptance criteria

- Every row of D2 stores the same contract, with the same storage and execution hashes, on each target it applies to; D9's test proves it before and after removal.
- Every PSL preset call is refused with D3's message; every TypeScript preset helper and `field.generated` is a type error.
- `pnpm fixtures:check` is clean, and no committed `contract.json` changed except where a fixture was deleted with its test.
- `git grep -nE "fieldPreset|kind: 'option'|kind: 'select'|kind: 'object'|instantiateAuthoringFieldPreset|PSL_PRESET_" -- 'packages/**/src/**'` prints nothing. `git grep -n -i "preset" -- 'packages/**/src/**'` prints only the removed-preset tables and messages of D3.
- `prisma init` writes a project with no preset that emits and runs.
- The every-contract print round trip and the Supabase cross-space test pass.

## Non-goals

- A rewrite script (plan; D3 gives the exact rewrite).
- Contributed aliases in the Mongo TypeScript builder (`deferred.md`).
- Removing the `kind` field from `AuthoringArgumentDescriptor` (D5).
- Closing the project: TML-3607 Done, follow-ups filed and the folder deleted come in the close-out PR.

## Size

Medium. Most of the diff is the mechanical move of about 400 call sites in about 140 files, with no contract change, in its own commit after the parity proof. The removal itself touches about 40 source files.

## Slice Definition of Done

Inherits `drive/calibration/dod.md`. Slice-specific:

- [ ] Every test above was red before its change and is green after; D9's test was green before and after.
- [ ] Touched packages pass `pnpm typecheck`, `pnpm lint` and `pnpm test --coverage`; `pnpm lint:deps`, `pnpm lint:ratchets`, `pnpm fixtures:check`, `pnpm lint:throws` and `pnpm check:upgrade-coverage --mode pr` pass.
- [ ] `/drive-code-review` run on the branch tip and its findings fixed.
- [ ] Manual QA: emit the at-a-glance schema on Postgres and compare hashes with the preset form on `main`; write each removed form in the language server and read the diagnostic; run `prisma init` for Postgres and SQLite and emit; type `temporal.` and confirm no preset is offered.

## Dispatch plan

| # | Outcome | Hands to |
|---|---|---|
| 1 | C1: `sql.Char(n)` in `sqlTargetTypeConstructors`, with its tests. D9: the parity table and test for every D2 row and target, green on the current code, with the committed expected contracts. Preset-only test cases that pin a stored contract fold into the table. | Every replacement proven equal while presets still exist. |
| 2 | Move every preset use in the repository to its replacement: `.prisma` fixtures, TypeScript contracts, test strings, query fragments (with D7's `type` export and its test), `prisma init` templates, examples. `pnpm fixtures:check` shows no contract change. Rename `test/integration/test/mongo/temporal-presets/` to `temporal-generators/`. Run touched integration files one at a time. | Nothing in the repository writes a preset; presets still work. |
| 3 | PSL: the refusal tests (red), then D3's tables and describers for SQL and Mongo; remove PSL preset resolution in `psl-parser`, SQL and Mongo PSL; D6's Mongo renames; D8. | PSL refuses every preset with its rewrite. |
| 4 | TypeScript: the type tests (red), then remove `buildFieldPreset`, `createFieldPresetHelper`, the preset types and collision checks in both builders, `field.generated`, the `@internal/ids` spec helpers; D6's messages. | No preset helper on either TypeScript surface. |
| 5 | Framework and packs: the D1 refusal test (red), then remove the `fieldPreset` kind, `AuthoringContributions.field`, the preset maps in the family and three targets, `timestamp-now-generator.ts`, the temporal preset builders with the file rename, D5's argument kinds, `select`, `path` and `default`, the PSL text parsers, `field-preset-resolution.ts`, `field-preset-helpers.ts`; the language server branches. D9's table loses its preset column. | No preset machinery left; the acceptance greps pass. |
| 6 | Upgrade fragments (new, with the full table, and D10's corrections), error reference, ADR amendments, READMEs, skills references, `plan.md`; CI-equivalent checks; `/drive-code-review` and its fixes. | Branch ready for review. |
