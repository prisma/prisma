# Slice 2: aliases are expanded

_Parent project: `projects/remove-field-presets/`. Linear: TML-3607. One PR. Design: ADR 275. Builds on slice 1 (PR #30780, merged 2026-10-20). Every path below was checked on `main` at dd160d117b, after TML-3389 (#30792), TML-3585 (#30745), TML-3247 (#30779) and TML-3553 (#30773). Outcome: a `types {}` alias in SQL and Mongo PSL, and a TypeScript alias constant, is expanded into each column that uses it, and may carry `@default`, `@onCreate` and `@onUpdate`; no contract stores a user alias or a `typeRef`; Postgres, SQLite and Mongo contribute `temporal.CreatedAt` and `temporal.UpdatedAt`; TypeScript gets a `type.*` helper for every PSL type constructor; an upgrade script rewrites stored contracts and snapshots. Field presets keep working._

## Conflicts with the design

### C1. Removing the TypeScript `types` key leaves pgvector and PostGIS no way to register their database type

ADR 275 ("The TypeScript builder") removes "the `types` key for codec instances". It also says `storage.types` keeps pgvector's `vector` and PostGIS's `geometry`, and that their storage hashes do not change. Those two entries are written through the `types` key itself:

- `packages/3-extensions/pgvector/src/contract.ts:62` returns `types: { [PGVECTOR_NATIVE_TYPE]: { kind: 'codec-instance', codecId: VECTOR_CODEC_ID, typeParams: {} } }`.
- `packages/3-extensions/postgis/src/contract.ts:57` does the same for `geometry`.
- `packages/3-extensions/pgvector/src/contract.ts:13-37` explains why: PSL has no syntax for an extension to register the base type, so the space contract is written in TypeScript.

So the `types` key cannot simply go. Nothing else in the builder writes `storage.types`.

What this spec does: the key stays, renamed `databaseTypes`, and its meaning narrows to "register a database type in this contract space". No column can reference an entry, because `field.namedType(...)` loses its codec-instance and string forms (D6). `defineContract` throws `CONTRACT.TYPES_KEY_REMOVED` when the definition has a `types` key, with a message that says to write `field.column(type.X(...))` for an alias and `databaseTypes` to register a database type. pgvector and PostGIS move to `databaseTypes`; their contracts and hashes do not change. The rename makes the narrowed meaning visible: an existing `types` key is a user alias in almost every case, and keeping its name would silently turn every such alias into a registered database type in `storage.types`, which R17 forbids.

This is a gap in the ADR, not a change to a decision. ADR 275 is amended to say so (Docs). If Will prefers keeping the name `types`, only D6 and the error code change.

No other part of ADR 275 or the plan conflicts with the code.

## At a glance

PSL today, on Postgres:

```prisma
types {
  Slug = VarChar(64)
}

model Post {
  id        String @id @onCreate(uuid())
  slug      Slug
  createdAt temporal.createdAt()
  updatedAt temporal.timestampString(3, onCreate: now, onUpdate: now) @default(now())
}
```

The contract stores `storage.types.Slug = { kind: "codec-instance", codecId: "sql/varchar@1", dataType: …, typeParams: { length: 64 } }`, and the column `slug` as `{ codecId: "sql/varchar@1", dataType: …, nullable: false, typeRef: "Slug" }` with no params. An attribute on an alias is refused with `PSL_UNSUPPORTED_NAMED_TYPE_ATTRIBUTE`, and the alias is dropped (`packages/2-sql/2-authoring/contract-psl/src/psl-named-type-resolution.ts:42-69`, `:106`, `:169`).

After this slice:

```prisma
types {
  Slug      = VarChar(64)
  UpdatedAt = TimestampString(3) @onCreate(now()) @onUpdate(now())
}

model Post {
  id        String             @id @onCreate(uuid())
  slug      Slug
  createdAt temporal.CreatedAt
  updatedAt UpdatedAt          @default(now())
}
```

- `slug` is stored as `{ codecId: "sql/varchar@1", dataType: …, nullable: false, typeParams: { length: 64 } }`. `storage.types` is absent.
- `createdAt` is stored exactly as `temporal.createdAt()` stores it: `pg/timestamptz-temporal@1`, no params, `instantNow` on create.
- `updatedAt` is stored exactly as the preset form above: `pg/timestamp-string@1` with `{ precision: 3 }`, the database default `now()`, and `timestampStringNow` on create and on update.
- The storage hash changes only because `Slug` is no longer stored.

Refused:

```
PSL_UNSUPPORTED_NAMED_TYPE_ATTRIBUTE: Type alias "Key" cannot carry @id. @id and @unique belong to a model's field, not to its type; write them on the field.
PSL_DUPLICATE_ATTRIBUTE: Field "Post.updatedAt" writes @onUpdate, which its type alias "UpdatedAt" already sets. Remove one of them.
```

TypeScript today:

```ts
const types = { Slug: type.sql.String(64) } as const;
// …
slug: field.namedType(types.Slug),
updatedAt: field.temporal.timestampString(3, 'now', 'now').default(now()),
```

TypeScript after:

```ts
const UpdatedAt = field.column(type.TimestampString(3)).onCreate(gen.now()).onUpdate(gen.now());

slug: field.column(type.VarChar(64)),
createdAt: field.column(type.temporal.CreatedAt()),
updatedAt: UpdatedAt.default(now()),
```

## Today

- **PSL aliases.** `resolveNamedTypeDeclarations` (`packages/2-sql/2-authoring/contract-psl/src/psl-named-type-resolution.ts:71`, one caller at `interpreter.ts:2431`) turns each alias into a `storage.types` entry (`storageTypeOf`, `:77-84`) and a field descriptor `{ codecId, typeRef }` with no params (`toNamedTypeFieldDescriptor`, `psl-column-resolution.ts:105-110`). An alias's base is a type constructor call or a bare constructor or enum (`:90-175`). An alias of an alias fails, because the base scope drops named types (`packages/1-framework/2-authoring/psl-parser/src/scope.ts:160-162`). A preset call as a base is `PSL_UNSUPPORTED_NAMED_TYPE_CONSTRUCTOR` (`:110-121`).
- **Where params are read through the alias.** `resolvedTypeParams(descriptor, namedTypes)` (`packages/2-sql/1-core/contract/src/ir/storage-type-instance.ts:51-62`) at `psl-field-resolution.ts:515` (`@default`), `:537` (slice 1's generators), `interpreter.ts:1551` (value-object members) and `:2585` (discriminators). `lower-column.ts:127` and `:154-156` (`packages/2-sql/2-authoring/contract-ts/src/`) write `typeRef` onto the column.
- **Slice 1's generators.** `lowerGeneratorAttributesForField` (`psl-column-resolution.ts:913-992`) reads only `field.attributes`. A repeated `@onCreate` on one field is `PSL_DUPLICATE_ATTRIBUTE` (`:943-951`).
- **Registered types.** pgvector's `vector` and PostGIS's `geometry` are in their own space contracts (`packages/3-extensions/pgvector/src/contract.json`, `packages/3-extensions/postgis/src/contract.json`), with no params and no column that references them. Every `typeRef` in a committed contract names a user alias, including `Embedding1536 = pgvector.Vector(1536)` in `examples/prisma-8-demo/src/prisma/contract.prisma:3-5` and `WgsGeometry = postgis.Geometry(4326)` in `examples/prisma-8-postgis-demo/src/prisma/contract.prisma:6`. No code tells a registered type from an alias (`StorageTypeInstance`, `storage-type-instance.ts:15-20`).
- **Codec hooks.** `planTypeOperations` and `verifyType` (`packages/2-sql/9-family/src/core/migrations/types.ts:104-121`) run for every `storage.types` entry by codec id (`packages/2-sql/9-family/src/core/diff/schema-verify.ts:227-251`, `packages/3-targets/3-targets/postgres/src/core/migrations/planner-strategies.ts:405-450`). No production codec implements them; only tests do.
- **TypeScript.** `ContractInput.types` (`contract-dsl.ts:2234`, `:2295`), `field.namedType` with a string, a codec instance or an enum handle (`:728-743`, `:790-811`), lowered by `resolveFieldDescriptor` (`contract-lowering.ts:111-149`) to `{ codecId, typeRef }`. `type.*` is built by `createTypeHelpersFromNamespace` (`authoring-helper-runtime.ts:42-76`) from the packs' `authoring.type`; it holds only `Raw`, `sql.String`, `BigIntNumber`, `UnboundedInt`, `pg.enum`, `pgvector.Vector`, `postgis.Geometry`. The PSL scalar and native constructors (`postgresPslTypeConstructors`, 31 entries, `packages/3-targets/3-targets/postgres/src/core/type-constructors.ts:250-275`; SQLite 8 entries, `packages/3-targets/3-targets/sqlite/src/core/type-constructors.ts:21-57`) are contributed by the adapters (`packages/3-targets/6-adapters/postgres/src/exports/control.ts:13`, `.../sqlite/src/exports/control.ts:12`), which the TypeScript builder does not see, on purpose (the doc comment at `type-constructors.ts:260`). `field.column(type.X(...))` already works.
- **Runtime.** `ExecutionContext.types` (`packages/2-sql/4-lanes/relational-core/src/query-lane-context.ts:70`, `:96`) is filled by `initializeTypeHelpers` (`packages/2-sql/5-runtime/src/sql-context.ts:328-366`), read only by tests. `buildContractCodecRegistry` names alias-typed codec instances after the alias (`sql-context.ts:505-528`) and skips alias columns in its second pass (`:534`). `codecRefForStorageColumn` resolves `typeRef` (`codec-ref-for-column.ts:26-55`).
- **Migrations.** `sameStorageColumn` (`packages/2-sql/9-family/src/core/migrations/field-event-planner.ts:271-288`) compares `typeRef` (`:279`) and raw `typeParams`. `contractToSchemaIR` resolves `typeRef` through the alias (`contract-to-schema-ir.ts:205-235`). The Postgres and SQLite DDL builders read `storageTypes` (`postgres/src/core/migrations/planner-type-resolution.ts:7-13`, `planner-ddl-builders.ts:17-20`, `sqlite/src/core/migrations/planner-ddl-builders.ts:26-77`).
- **Emitter.** `readonly types` and `readonly typeRef` in `contract.d.ts` (`packages/2-sql/3-tooling/emitter/src/index.ts:144-145`, `:326-358`, `:414-420`). Type level: `value-type-maps.ts:11-17` resolves params through `TypeRef`.
- **Validator.** `typeRef` is optional on a column and exclusive with `typeParams` (`packages/2-sql/1-core/contract/src/ir/storage-entry-schemas.ts:38-53`). Removed keys from older formats are refused with an upgrade message (`validators.ts:233-261`, `nativeType` then `noCheck`).
- **Print.** `buildTypesBlock` (`packages/3-targets/3-targets/postgres/src/core/psl-print/domain-types.ts:147-180`) writes one declaration per `storage.types` entry. `refuseColumnDifferingFromNamedType` (`psl-print/refusals.ts:385-405`) and `scalar-fields.ts:133-145` print a `typeRef` column as the alias. Only Postgres prints.
- **Mongo PSL.** A `types {}` block is accepted but a field that uses an alias is `PSL_UNSUPPORTED_FIELD_TYPE` (`packages/2-mongo-family/2-authoring/contract-psl/src/interpreter.ts:1295-1306`). The bare type constructor branch keeps `codecId` and drops `typeParams` (`:1353-1358`). Generators: `lowerGeneratorAttributes` (`:1160-1250`), merged into `resolvePresetExecutionDefaults` (`:1103-1153`) by stored name (`:1767`, TML-3247). Validators derive from each field's `codecId` (TML-3553, `packages/2-mongo-family/1-foundation/mongo-contract/src/derive-collection-validators.ts:22`).
- **Contributed names.** `mergeContributedTypes(contributions.field, contributions.type)` (`psl-parser/src/binder.ts:335`, `contributed-type-scope.ts:41-88`) merges both namespaces, case-sensitive. `isContributedTypeDescriptor` (`contributed-type-scope.ts:35-39`) knows only `typeConstructor` and `fieldPreset`; any other leaf is read as a namespace. `temporal` is a `field` namespace in all three targets (`postgres/src/core/authoring.ts:895-956`, `sqlite/src/core/authoring.ts:20-29`, `packages/3-mongo-target/1-mongo-target/src/core/authoring.ts:10-15`). Language server type completion renders items in `completion-scope.ts:84-107`.
- **Hints.** SQL `@updatedAt`: `psl-field-resolution.ts:230-238`. Mongo: `mongo-attribute-specs.ts:70-74`.
- **Supabase.** `scripts/generate-contract.ts` introspects a database, prints PSL with nine aliases from `NAMED_TYPE_ALIASES` (`:296-306`) to `src/contract/contract.prisma`, then runs `prisma contract emit` (`:486`). The head ref hash is read from the contract at runtime (`src/pack/index.ts:17`).
- **Committed contracts with `typeRef`.** 33 contract files plus the JSON schema `packages/2-sql/2-authoring/contract-ts/schemas/data-contract-sql-v1.json`. Among them: 7 snapshots in `examples/prisma-8-demo/migrations/snapshots/`, 2 files in `examples/prisma-8-postgis-demo/`, `examples/prisma-8-demo-sqlite`, Supabase `src/contract/` and its copy `test/integration/test/fixtures/contract-format/supabase-before-dbgenerated-removal.contract.json`, parity fixtures (`core-surface`, `pgvector-named-type`, `callback-mode-scalars`), `contract-parity/postgres`, planner goldens (`postgres`, `sqlite`), three `ports/` fixtures, `collection-methods/generated` in two places, and the fixtures of two earlier upgrade fragments (`test/integration/test/upgrade-instructions/data-type-in-contract/`, `data-type-values/sqlite-project/`).
- **TypeScript contracts.** 10 committed `contract.ts` files use the `types` key, 8 call `field.namedType` on a codec instance (listed under Tests). None uses the string form.

## Decisions

### D1. An alias expands to a column type plus attributes, resolved once at the declaration

`resolveNamedTypeDeclarations` keeps its two base forms (a type constructor call, or a bare constructor or enum) and returns, per alias, a resolved column descriptor `{ codecId, typeParams?, valueSet? }` and its attributes. Nothing goes to `storage.types`. `toNamedTypeFieldDescriptor` goes; a field typed by an alias gets the alias's descriptor with params inline, so `resolvedTypeParams` has nothing to resolve and is removed with its callers' second argument.

The alias's `@default`, `@onCreate` and `@onUpdate` are lowered at the declaration, by the same functions a field uses (`lowerDefaultForField`, `lowerGeneratorAttributesForField`), with the alias's descriptor and params. Each diagnostic is reported once, on the alias, not once per field. The lowered default and generators are then copied into every field typed by the alias, and merged with the field's own.

Why at the declaration: the alias fixes the codec and every type param, so the result cannot differ per field. Lowering per field would repeat one error at every use.

Lists: a list field typed by an alias that sets a generator is refused at the field, with slice 1's `PSL_LIST_EXECUTION_DEFAULT_UNSUPPORTED`, because the alias itself is not a list. An optional field may use such an alias in SQL, as slice 1 allows for attributes (slice 1 D9).

### D2. Which attributes an alias may carry

- `@default`, `@onCreate`, `@onUpdate`: accepted (R20).
- `@id`, `@unique`: `PSL_UNSUPPORTED_NAMED_TYPE_ATTRIBUTE`, message as in "At a glance".
- `@db.*`: keeps its existing refusal and message.
- Any other attribute (`@map`, `@relation`, …): keeps the existing "uses unsupported attribute" refusal.
- A refused attribute is dropped and the alias is kept. Today the whole alias is dropped (`:106`, `:169`), so every field that uses it then fails to resolve, which buries the one real error under many.

A field that writes an attribute its alias sets is `PSL_DUPLICATE_ATTRIBUTE` (R21), the code slice 1 uses for a repeated `@onCreate` on one field. The message names the alias. A field may add any attribute its alias does not set, including `@id` and `@unique`.

Why reuse `PSL_DUPLICATE_ATTRIBUTE`: from the reader's side it is one attribute written twice for one column; a new code would say nothing more. Mixins (ADR 269) use `PSL_DUPLICATE_DECLARATION` for a repeated field, which is a different thing.

### D3. An alias's base stays one level deep

An alias may not name another alias or a contributed alias (`types { X = temporal.UpdatedAt }` is refused with `PSL_UNSUPPORTED_NAMED_TYPE_BASE`, as `B = A` is today). A preset call stays refused.

Why: one level is today's rule, and ADR 275 defines an alias as a type constructor with attributes. Nesting would need a rule for which level's attribute wins, which D2 already refuses at one level. Allowing it later is additive.

### D4. The contract stores no `typeRef`, and the validator refuses one

- `StorageColumn.typeRef` (`packages/2-sql/1-core/contract/src/ir/storage-column.ts:12`, `:24`, `:69`) and `ColumnTypeDescriptor.typeRef` (`packages/1-framework/1-core/framework-components/src/shared/column-spec.ts:23`) are removed, and the column schema loses the key (`storage-entry-schemas.ts:38-53`).
- A stored contract with a column `typeRef` is refused, in the removed-keys pattern of `validators.ts:233-261`, after the `nativeType` and `noCheck` checks: `contracts no longer store type aliases, so re-emit the contract from its source, or rewrite a stored contract such as a migration snapshot with expand-type-aliases.ts, which ships in the expand-type-aliases scripts of the Prisma 8 upgrade guide.`, followed by the first five paths.
- `storage.types` keeps its schema. Every entry left is a registered database type, because nothing writes a user alias any more (D1, D6).

Why refuse rather than resolve: every reader below drops its `typeRef` branch. A contract that still had one would lose its params silently, so a codec with params (such as `pgvector.Vector(1536)`) would run with none. The project's hard-error rule applies, and the upgrade script gives the way forward.

### D5. Every reader of `typeRef` loses its branch

- Emitter (`index.ts:414-420`): no `typeRef` in `contract.d.ts`. `readonly types` is written only when `storage.types` is non-empty, as today. Type level: `value-type-maps.ts:11-17` loses the `TypeRef` resolution.
- Runtime: `ExecutionContext.types`, `TypeHelperRegistry`, `initializeTypeHelpers` and `collectTypeRefSites` (`sql-context.ts:307-366`) are removed. `buildContractCodecRegistry` loses its alias pass (`:505-528`) and the skip at `:534`, so every parameterized column instance is named `<col:Table.column>`. `codecRefForStorageColumn` loses its `typeRef` branch (`codec-ref-for-column.ts:47-51`), which also fixes the `many` flag that branch drops.
- Migrations: `contractToSchemaIR` loses `resolveColumnTypeMetadata`'s alias lookup (`contract-to-schema-ir.ts:205-235`) and reads the column's own codec and params. The Postgres and SQLite DDL builders lose their `typeRef` lookups. `storageTypes` still flows to the planner for the codec hooks.
- Field event planner: `sameStorageColumn` drops the `typeRef` comparison (`field-event-planner.ts:279`). It already compares data type, normalized params, list-ness, nullability, codec-owned params and default (`:271-301`). No resolution against `storage.types` is needed, because a validated contract has no `typeRef` (D4). An upgraded snapshot and the re-emitted contract therefore compare equal and fire no `altered` event (R18); a test pins it.
- Codec hooks: `planTypeOperations` and `verifyType` keep iterating `storage.types` by codec id. After this slice only registered types are there (R19). No production codec implements them, so no behavior changes.
- Other production readers to update: `packages/2-sql/9-family/src/core/contract-stack-checks.ts:58-60`, `:132`; `reported-defaults.ts:156-161`; `ir/sql-contract-serializer-base.ts:136-145`; `packages/2-sql/2-authoring/contract-ts/src/derived-checks.ts:126`; `postgres/src/core/migrations/issue-planner.ts:978`, `:1024`, `planner-identity-values.ts:41-43`, `column-ddl-rendering.ts`; `postgres-contract-serializer.ts:183-185`; `sqlite-contract-serializer.ts:50`; `packages/3-extensions/supabase/src/runtime/supabase.ts:289` (doc comment).

### D6. TypeScript: aliases are constants, `type.*` covers every PSL constructor

- `ContractInput.types` becomes `databaseTypes` (C1). `defineContract` throws `CONTRACT.TYPES_KEY_REMOVED` on a `types` key, since a callback's returned object is not checked for excess keys by TypeScript.
- `field.namedType` keeps only its enum-handle overload (`contract-dsl.ts:728-743`). The codec-instance and string forms are removed, with `resolveFieldDescriptor`'s reverse map and the `instance-not-in-definition-types` error (`contract-lowering.ts:100-136`) and the string-form warning (`contract-warnings.ts:134-161`).
- `postgresPslTypeConstructors` and the SQLite constructors move from the adapters' `authoring.type` to the targets' (`packages/3-targets/3-targets/{postgres,sqlite}/src/core/descriptor-meta.ts`). PSL sees the same names, because the binder merges every component's contributions. The TypeScript builder builds `type.*` from the target, so it gains `type.String()`, `type.VarChar(64)`, `type.TimestampString(3)` and the rest. The doc comment at `type-constructors.ts:260` is replaced.
- A user alias is a field builder constant, as ADR 275 shows. Field builders are immutable (`contract-dsl.ts:351`), so one constant serves every model. `.onCreate` or `.onUpdate` on a constant that already sets that phase throws `generator-phase-set-twice` (slice 1 D5). `.default()` on a builder that already has a default throws `CONTRACT.DEFAULT_INVALID` with `reason: 'default-set-twice'`; today the second call overwrites. This mirrors D2.

Why move the constructors to the target: ADR 275 says `type.*` gets a helper for every PSL type constructor of the stack, and the TypeScript builder has pack refs, not the adapter (slice 1 D2 states the same constraint for generator functions). The doc comment names exactly this move as what a target contribution would do. Why `default-set-twice`: an alias constant with a default plus `.default()` at the field is the TypeScript form of D2's duplicate, and silently overwriting would let the two surfaces disagree.

### D7. A contributed alias is a new descriptor kind

`packages/1-framework/1-core/framework-components/src/shared/framework-authoring.ts` gains:

```ts
interface AuthoringTypeAliasDescriptor {
  readonly kind: 'typeAlias';
  readonly documentation?: string;
  readonly output: {
    readonly type: AuthoringTypeConstructorOutput;
    readonly onCreate?: GeneratorFunctionCall;
    readonly onUpdate?: GeneratorFunctionCall;
  };
}
```

It may appear in `AuthoringContributions.type` (`AuthoringTypeNamespace`, `:165`). It has no `args` (R23). Its output names the codec and fixed params directly, as a type constructor's output does, plus generator calls from slice 1's `GeneratorFunctionCall`, resolved by the column's codec like any attribute. Assembly checks the fixed params against the codec's params schema, as a type constructor's params are checked, and resolves each call against the assembled generator function registry for the codec and the length the fixed params give. It throws `CONTRACT.PACK_CONTRIBUTION_INVALID` when either fails, so a broken pack never surfaces while a user's schema is read. The family gives the length (`ControlFamilyDescriptor.fieldLength`); Mongo gives none.

Amended 2026-10-21: a contributed alias carries a type and generators only. It has no database default: no contributed alias needs one, and a default is a SQL concept Mongo cannot use. A database default can be added to the descriptor later, when a pack needs one, with its own check at assembly.

- PSL: `isContributedTypeDescriptor` and the `ContributedTypeDescriptor` union (`contributed-type-scope.ts:6-8`, `:35-39`) add `typeAlias`. A field typed `temporal.CreatedAt` resolves to the alias's descriptor and attributes, then follows D1 and D2. It is written bare. `temporal.CreatedAt(3)` is refused with the message `temporal.CreatedAt is a type alias and takes no arguments.`, under the code the interpreter already uses for wrong type constructor arguments; the implementer names that code in the test.
- TypeScript: `createTypeHelpersFromNamespace` gives `type.temporal.CreatedAt()`, which returns the column descriptor plus `generatorCalls`. `field.column(...)` copies them into the builder state, and its return type sets `FieldDefaultPresence.execution` when the alias generates on create, as `.onCreate` does.
- Language server: `completion-scope.ts:84-107` renders a `typeAlias` as a non-callable type with its documentation.

Why `field.column(type.temporal.UpdatedAt())` and not `type.temporal.UpdatedAt()` as the field itself, as ADR 275's table shows: every `type.*` helper returns a column type that `field.column` takes, and a field needs the builder for `.optional()`, `.id()`, `.default()` and the rest. A helper that returned a builder would be the one `type.*` member that is not a type. ADR 275's table is amended.

### D8. What each target contributes

Each contributed alias stores exactly what the matching preset stores today, so slice 3 can replace the preset with no hash change.

| Target | Alias | Type | Generators |
|---|---|---|---|
| Postgres | `temporal.CreatedAt`, `temporal.UpdatedAt` | `Timestamptz` (`pg/timestamptz-temporal@1`, no params) | `now()` on create; `UpdatedAt` also on update |
| Postgres | `temporal.CreatedAtString`, `temporal.UpdatedAtString` | `TimestamptzString` (`pg/timestamptz-string@1`) | same |
| Postgres | `temporal.CreatedAtJsDate`, `temporal.UpdatedAtJsDate` | `TimestamptzJsDate` (`pg/timestamptz-date@1`) | same |
| SQLite | `temporal.CreatedAt`, `temporal.UpdatedAt` | `DateTime` (`sqlite/datetime@1`) | same |
| Mongo | `temporal.CreatedAt`, `temporal.UpdatedAt` | `Date` (`mongo/date@1`) | same |

None sets a database default, because none of the presets does. The variant names follow the preset names (`createdAtString`, `createdAtJsDate`, `postgres/src/core/authoring.ts:895-956`). Mongo's constructor is `Date`, because `DateTime` is deprecated there (`packages/3-mongo-target/2-mongo-adapter/src/exports/control.ts:115-120`); the codec is the same `mongo/date@1` ADR 275 means.

`temporal.UpdatedAt` and the preset `temporal.updatedAt()` coexist until slice 3. They are different keys, and assembly refuses only identical paths in `type` and `field` (`framework-authoring.ts:1364-1393`).

### D9. Mongo PSL accepts aliases, and the Mongo TypeScript builder gets no contributed aliases

- The Mongo interpreter resolves a `namedType` field (`interpreter.ts:1295-1306`) through the shared alias resolution: the same base forms and attribute rules as D1 to D3, with Mongo's own refusals applied at the field (no `@default` at all, an optional field with a generator refused, variant fields and shared collections checked in `resolvePresetExecutionDefaults`). An alias with `@default` is refused at the declaration with the existing Mongo `@default` hint. Generators go through the stored-name path (`:1767`), and validators follow from the resolved `codecId` with no change.
- The bare type constructor branch (`:1353-1358`) keeps `typeParams`, so an alias of a parameterized constructor stores its params. Today no Mongo constructor has params, so no contract changes.
- Where the alias resolution lives: the PSL-side logic that both interpreters need (classify the base, check attributes, report duplicates) moves to a family-neutral helper in `@internal/psl-parser`, next to the binder's named-type handling. Each family lowers the resolved descriptor and attributes with its own functions.
- The Mongo TypeScript builder has no `type.*` and no `field.column` (`packages/2-mongo-family/2-authoring/contract-ts/src/contract-builder.ts:1111-1131`). It does not get contributed aliases in this slice. Its replacement for `field.temporal.updatedAt()` is `field.date().onCreate(gen.now()).onUpdate(gen.now())`, which slice 1 made possible. This narrows R23 for Mongo TypeScript only; it is recorded in `deferred.md`.

Why: adding a type-constructor surface to the Mongo builder is a design of its own, and nothing in slice 3 needs it.

### D10. `contract print`

`buildTypesBlock` (`domain-types.ts:147-180`), its call at `psl-contract.ts:353`, `refuseColumnDifferingFromNamedType` (`refusals.ts:385-405`) and the `namedType` branch of `scalar-fields.ts:133-145` are removed. Print writes each column as its type constructor and attributes (R31). It never writes a contributed alias name (ADR 275).

A contract whose `storage.types` is non-empty is refused with `refuseRegisteredDatabaseTypes`: `This contract registers the database types <names>, which PSL cannot declare. It is an extension's contract space, written in TypeScript.` Only pgvector's and PostGIS's space contracts have entries, and printing them would drop the entries and change their hash. `every-postgres-contract-roundtrip.integration.test.ts` skips contracts print refuses this way and asserts that the skipped set is exactly those two spaces and their snapshot copies.

### D11. The upgrade script

New fragment `upgrade-instructions/pending/expand-type-aliases/`, following `remove-nocheck`:

- `app/scripts/expand-type-aliases/expand-type-aliases.ts` and a byte-identical copy under `extension/`, with a test that they are equal.
- It finds files and verifies old hashes as `remove-nocheck.ts` does (`listFiles`, `:304-356`; hashing copied in plain JS, `:237-266`; verify before writing, `:675-684`; write nothing unless every check passes, `:787-790`).
- In each SQL contract it replaces every column `typeRef` with the referenced entry's `typeParams` (omitted when empty, by ADR 246's rule), checks the column's `codecId` and `dataType` equal the entry's, and removes every `storage.types` entry a column referenced. An entry no column references is kept and listed in the summary: the script cannot tell an unused alias from a registered type, and pgvector's space snapshot (`examples/prisma-8-demo/migrations/snapshots/4a96b488…`) must keep `vector`.
- It rewrites `contract.d.ts` next to each rewritten contract: the referenced entries leave `readonly types`, and `readonly typeRef: "X"` becomes the entry's `readonly typeParams`. It uses the block scanner of `remove-nocheck.ts:511-606`.
- It renames snapshot directories and rewrites `migration.json` `from`/`to`, `migrationHash`, refs, `migration.ts` and hash tokens, as `remove-nocheck.ts:722-785` does.
- It leaves the `contract.prisma` copies in migration packages alone. They stay valid: aliases are still PSL.
- The prose says: run the script, then re-emit, then `prisma db sign` against every database. The migration ledger keeps old migration hashes, as with `remove-nocheck` (its `instructions.md:69-77`). Either fragment's script may run first, because each verifies the hash of the content it reads.

Why keep unreferenced entries: removing them would break pgvector's and PostGIS's snapshot copies. An unused alias in a historical snapshot keeps a consistent hash, and the app's own `contract.json` is re-emitted anyway.

### D12. Supabase keeps its aliases in PSL and is re-emitted

`src/contract/contract.prisma` keeps its nine aliases, because aliases are still valid authoring shorthand. `contract.json` and `contract.d.ts` are re-emitted with `prisma contract emit` (`generate-contract.ts:486`), which needs no database. `generate-contract.ts` does not change. `cross-contract-fk.integration.test.ts` keeps passing unchanged: the foreign key carries column names only (R39).

`test/integration/test/fixtures/contract-format/supabase-before-dbgenerated-removal.contract.json` is a stored historical contract read by `supabase-before-dbgenerated-removal.test.ts` and `cli-contract-loading.test.ts`. The upgrade script is run over it, and those tests then assert the new refusal for the old copy where they assert refusals today.

### D13. The fixtures of earlier upgrade fragments

The `after` trees of `test/integration/test/upgrade-instructions/data-type-in-contract/` and `data-type-values/sqlite-project/` carry `typeRef`, and their tests deserialize the `after` contracts with the current validator. Their fixture projects drop the alias and write the column type inline. Those fragments test other rewrites, and the alias was incidental. Each fixture generator re-builds its trees. The scripts themselves do not change.

### D14. The `@updatedAt` hint

SQL (`psl-field-resolution.ts:230-238`) and Mongo (`mongo-attribute-specs.ts:70-72`): `Use @onCreate(now()) @onUpdate(now()), or type the field temporal.UpdatedAt.` The suppression when the field already has `@onUpdate` stays (R35).

## Requirements covered

| Requirement | Decision |
|---|---|
| R16 aliases expanded in PSL and TypeScript | D1, D6, D9 |
| R17 `storage.types` keeps registered types only; their hashes unchanged | C1, D4, D6 |
| R18 field event planner compares resolved storage | D5 |
| R19 `ExecutionContext.types` removed; hooks for registered types only | D5 |
| R20 attributes an alias may carry | D1, D2 |
| R21 a field may add, may not repeat | D2, D6 |
| R22 Mongo PSL aliases | D9 |
| R23 contributed alias descriptor | D7 (Mongo TypeScript narrowed in D9) |
| R24 the temporal aliases | D8 |
| R31 print writes no `types {}` block | D10 |
| R35 second half: hint names `temporal.UpdatedAt` | D14 |
| R38 new storage hash and the upgrade script | D11, D13 |
| R39 Supabase re-generated; cross-space foreign key verifies | D12 |

## Code changes by package

| Package | Files | Change |
|---|---|---|
| `@internal/framework-components` | `src/shared/framework-authoring.ts`, `src/shared/column-spec.ts`, `src/control/control-stack.ts` (alias call validation) | D4, D7 |
| `@internal/psl-parser` | `src/contributed-type-scope.ts`, `src/binder.ts`, new shared alias resolution | D7, D9 |
| `@internal/sql-contract` | `src/ir/storage-column.ts`, `src/ir/storage-entry-schemas.ts`, `src/ir/storage-type-instance.ts`, `src/validators.ts`, `src/value-type-maps.ts` | D4, D5 |
| `@internal/sql-contract-psl` | `src/psl-named-type-resolution.ts`, `src/psl-column-resolution.ts`, `src/psl-field-resolution.ts`, `src/interpreter.ts`, `src/sql-attribute-specs.ts` | D1, D2, D3, D14 |
| `@internal/sql-contract-ts` | `src/contract-dsl.ts`, `src/contract-lowering.ts`, `src/lower-column.ts`, `src/build-contract.ts`, `src/contract-warnings.ts`, `src/derived-checks.ts`, `src/authoring-helper-runtime.ts`, `src/composed-authoring-helpers.ts`, `schemas/data-contract-sql-v1.json` | D6, D7 |
| `@internal/sql-emitter` | `packages/2-sql/3-tooling/emitter/src/index.ts` | D5 |
| `@internal/relational-core`, `@internal/sql-runtime` | `src/codec-ref-for-column.ts`, `src/query-lane-context.ts`; `packages/2-sql/5-runtime/src/sql-context.ts` | D5 |
| `@internal/family-sql` | `src/core/migrations/field-event-planner.ts`, `src/core/migrations/contract-to-schema-ir.ts`, `src/core/contract-stack-checks.ts`, `src/core/reported-defaults.ts`, `src/core/ir/sql-contract-serializer-base.ts` | D5 |
| `@internal/target-postgres` | `src/core/descriptor-meta.ts`, `src/core/type-constructors.ts`, `src/core/authoring.ts` (aliases), `src/core/migrations/*` (D5 list), `src/core/postgres-contract-serializer.ts`, `src/core/psl-print/{domain-types,psl-contract,scalar-fields,refusals,column-defaults}.ts` | D5, D6, D8, D10 |
| `@internal/target-sqlite` | `src/core/descriptor-meta.ts`, `src/core/type-constructors.ts`, `src/core/authoring.ts`, `src/core/migrations/planner-ddl-builders.ts`, `src/core/sqlite-contract-serializer.ts` | D5, D6, D8 |
| `@internal/adapter-postgres`, `@internal/adapter-sqlite` | `src/exports/control.ts` | D6: no `authoring.type` |
| `@internal/mongo-target` | `src/core/authoring.ts`, `src/core/descriptor-meta.ts` | D8 |
| `@internal/mongo-contract-psl` | `src/interpreter.ts`, `src/mongo-attribute-specs.ts` | D9, D14 |
| `@internal/language-server` | `src/completion-scope.ts` | D7 |
| Extensions | `packages/3-extensions/{pgvector,postgis}/src/contract.ts` (`databaseTypes`), `packages/3-extensions/supabase/src/contract/contract.{json,d.ts}`, `src/runtime/supabase.ts` (comment) | C1, D12 |

Run `pnpm build` in `framework-components`, `psl-parser`, `sql-contract`, `sql-contract-ts` and `family-sql` after their exported types change, before checking downstream packages.

## Tests (write them first; each must fail before its change)

SQL PSL, `packages/2-sql/2-authoring/contract-psl/test/`:
- New `interpreter.alias-expansion.test.ts`: the at-a-glance schema stores the stated columns with no `typeRef` and no `storage.types`; an alias of `pgvector.Vector(1536)` stores `{ length: 1536 }` on the column; an enum-based alias stores the enum's codec and value set; `B = A` and `X = temporal.UpdatedAt` are `PSL_UNSUPPORTED_NAMED_TYPE_BASE`; a discriminator and a value-object member typed by an alias store inline params.
- New `interpreter.alias-attributes.test.ts`: an alias with `@default`, `@onCreate`, `@onUpdate` gives each using field the same lowered values as writing them on the field; `@id` and `@unique` on an alias refused with the exact message; a field repeating each of the three is `PSL_DUPLICATE_ATTRIBUTE` naming the alias; a field adding `@id` or `@default` the alias does not set is accepted; an alias `Bytes @onCreate(uuid())` reports `PSL_GENERATOR_NOT_APPLICABLE` once, on the alias, with two fields using it; a refused attribute keeps the alias, so its fields report nothing; a list field typed by a generating alias is refused; an optional one is accepted.
- New `interpreter.contributed-aliases.test.ts`: each Postgres row of D8 stores the same column and generators as the matching preset (whole-contract parity); `temporal.CreatedAt(3)` is refused; `temporal.CreatedAt @onCreate(now())` is a duplicate.
- Existing tests that assert `typeRef` or alias refusals (`interpreter.named-types*.test.ts` and the rest a grep for `typeRef` finds) are rewritten.
- `psl-field-resolution` hint test: the new `@updatedAt` text.

SQL TypeScript, `packages/2-sql/2-authoring/contract-ts/test/`:
- New `contract-dsl.alias-constants.test.ts`: the at-a-glance TypeScript emits the same contract as the PSL; one constant used in two models; `.default()` twice throws `default-set-twice`; `field.column(type.temporal.UpdatedAt()).onUpdate(gen.now())` throws `generator-phase-set-twice`; a `types` key throws `CONTRACT.TYPES_KEY_REMOVED`; `databaseTypes` writes `storage.types`.
- New `.test-d.ts`: `field.column(type.temporal.CreatedAt())` is optional on create; `field.namedType(type.sql.String(5))` is a type error; `type.TimestampString(3)` exists on a Postgres stack and `type.Timestamptz` does not exist on SQLite.
- `ts-psl-parity.real-packs.test.ts`: every PSL type constructor of Postgres and SQLite has a `type.*` helper with the same output for the same arguments.

Contract, runtime, migrations:
- `packages/2-sql/1-core/contract/test/validators*.test.ts`: a column `typeRef` is refused with the exact message and five-path list; a contract with `nativeType` is still refused for that first.
- `packages/2-sql/3-tooling/emitter/test/`: no `typeRef` in emitted `.d.ts`; `readonly types` only for registered entries.
- `packages/2-sql/5-runtime/test/parameterized-types.test.ts`, `sql-context.test.ts`, `execution-stack.test.ts`: drop the `context.types` assertions; a parameterized column's codec instance is named `<col:Table.column>`, and two columns with equal params share one instance.
- `packages/2-sql/4-lanes/relational-core/test/`: `codecRefForStorageColumn` keeps `many` for a list column with params.
- `packages/2-sql/9-family/test/field-event-planner*.test.ts`: a snapshot rewritten by the upgrade script and the re-emitted contract plan no events; a real param change still fires `altered`.
- `packages/3-extensions/pgvector/test/migrations/planner.storage-types.test.ts`: the hooks still run for `vector`.

Mongo, `packages/2-mongo-family/2-authoring/contract-psl/test/`:
- New `interpreter.aliases.test.ts`: an alias of `ObjectId` and of `Date @onCreate(now()) @onUpdate(now())` expands; `temporal.UpdatedAt` stores what `temporal.updatedAt()` stores; an alias with `@default` refused with the Mongo hint; an optional field typed by a generating alias refused; a `@map`-ped field typed by a generating alias keys its generators by stored name; the derived validator is unchanged. `interpreter.test.ts:423` changes from refusal to expansion.

Print, `packages/3-targets/3-targets/postgres/test/psl-print/`:
- A former alias column prints as its constructor (`VarChar(64)`); no `types {}` block; a contract with `storage.types` entries is refused with `refuseRegisteredDatabaseTypes`.

Language server: `completion-provider.test.ts`: `temporal.` in type position lists `CreatedAt` and `UpdatedAt` as types, with documentation.

Integration, run one file at a time with `pnpm test <file>` inside `test/integration`:
- `test/integration/test/temporal-defaults/`: a new `_fixture-aliases/contract.prisma` using `temporal.CreatedAt`, `temporal.UpdatedAt` and the variants; a case asserts its storage and execution hashes equal the preset fixture's. Same for `test/integration/test/mongo/temporal-presets/`.
- `test/integration/test/authoring/parity/`: `core-surface`, `pgvector-named-type`, `callback-mode-scalars` move to `field.column(type.X(...))` and constants; their `expected.contract.json` is re-emitted with no `typeRef`. A new `alias-attributes/` case compares PSL and TypeScript for the at-a-glance schema.
- `test/integration/test/psl-print/every-postgres-contract-roundtrip.integration.test.ts`: D10's skip rule and its assertion.
- `packages/3-extensions/supabase/test/cross-contract-fk.integration.test.ts`: unchanged, passes on the re-emitted contract.
- Planner goldens (`test/integration/test/planner-golden/`): fixtures move off `types`; goldens re-generated; the DDL must not change, only hashes.
- New `test/integration/test/upgrade-instructions/expand-type-aliases/`, shaped like `remove-nocheck/` (`fixture-generator.ts`, `fixtures/before`, `fixtures/after`, `test-helpers.ts` with `SCRIPT_PATHS`): a project with a Postgres alias, a pgvector alias, an unused alias and a pgvector space snapshot; the script gives exactly `after` and the summary; `after` contracts deserialize and equal a re-emit; no-op, resume, hash-mismatch and codec-mismatch cases; the two script copies are equal.
- `contract-format/supabase-before-dbgenerated-removal.test.ts` and `cli-contract-loading.test.ts` per D12; the two earlier fragments' tests per D13.

## Upgrade instructions

`upgrade-instructions/pending/expand-type-aliases/app/instructions.md`, changes:

- `stored-contracts-expand-type-aliases` (script): detection `**/contract.json` matching `"typeRef"\s*:`. Run the script, re-emit, `prisma db sign`.
- `psl-alias-attributes` (no action needed; listed so the guide states it): aliases may now carry `@default`, `@onCreate`, `@onUpdate`; `temporal.CreatedAt` and `temporal.UpdatedAt` exist.
- `ts-types-key-removed`: detection `**/*.{ts,mts,cts,tsx}` matching `\btypes\s*:` and `field\.namedType\(`. Replace `types: { X: type.Y(...) }` plus `field.namedType(types.X)` with a constant `field.column(type.Y(...))`. The before and after are in the prose.
- `supabase-contract-expanded`: detection `**/package.json` matching `"@prisma/orm-extension-supabase"`. The Supabase space's storage hash changes; run `prisma db sign`.

`upgrade-instructions/pending/expand-type-aliases/extension/instructions.md`, changes:

- `types-key-is-database-types`: a contract space that registers a database type writes `databaseTypes`. Detection: `types:\s*\{` in `**/contract.ts`.
- `column-type-ref-removed`: `ColumnTypeDescriptor.typeRef`, `StorageColumn.typeRef`, `ExecutionContext.types` are gone; a codec instance's `name` is `<col:Table.column>`. Detection: `\btypeRef\b`, `context\.types\b`.
- `type-alias-descriptor`: a pack may contribute `kind: 'typeAlias'` in its `type` namespace. No detection.
- The stored-contract script, same as the app's.

Run `pnpm check:upgrade-coverage --mode pr --prev origin/main --head HEAD`.

## Docs to update

- ADR 275: C1 (the `types` key becomes `databaseTypes`), D7's table row (`field.column(type.temporal.UpdatedAt())`), D8's Mongo `Date`, D9's Mongo TypeScript narrowing.
- ADR 104 ("Named storage type for reuse", "Enforceable coupling"), ADR 208 (the `CodecInstanceContext` paragraph and "How it composes" §2 to §4), ADR 212 (`codecRefForColumn` no longer resolves `typeRef`), ADR 241 (the grounding example's `storage.types` and `typeRef`), ADR 254 (the `storage.types` sentence in "Columns and type constructors").
- `docs/architecture docs/subsystems/` Data Contract and Contract Emitter docs: `storage.types` holds registered types only; no `typeRef`.
- `docs/reference/error-reference.md`: `CONTRACT.TYPES_KEY_REMOVED`; the new `PSL_UNSUPPORTED_NAMED_TYPE_ATTRIBUTE` and `PSL_DUPLICATE_ATTRIBUTE` messages; `CONTRACT.DEFAULT_INVALID` reason `default-set-twice`.
- READMEs: `packages/2-sql/2-authoring/contract-psl/README.md` (alias attributes), `packages/2-sql/2-authoring/contract-ts/README.md` (alias constants, `type.*`, `databaseTypes`), `packages/2-mongo-family/2-authoring/contract-psl/README.md` (aliases), `packages/3-extensions/pgvector/README.md` and `postgis/README.md` if they show `types`.
- `skills/prisma-8/references/contract.md`: aliases with attributes, `temporal.CreatedAt`.
- `projects/remove-field-presets/deferred.md`: Mongo TypeScript contributed aliases (D9).

## Acceptance criteria

- The at-a-glance PSL and TypeScript emit the stated contract on Postgres; the SQLite and Mongo rows of D8 store what their presets store.
- No committed `contract.json` outside pgvector's and PostGIS's spaces and their snapshot copies has a `storage.types` entry, and none has a `typeRef`.
- pgvector's and PostGIS's storage hashes do not change.
- The upgrade script turns every stored contract and snapshot in `examples/` into what a re-emit gives, and `pnpm fixtures:check` is clean afterwards.
- The planner goldens show no DDL change, and an upgraded contract plans no field events.
- The Supabase cross-space foreign key test passes.
- `contract print` writes no `types {}` block, and every committed Postgres app contract round-trips.
- No source under `packages/` reads `typeRef` or `ExecutionContext.types`.

## Non-goals

- Removing presets (slice 3).
- Parameterized contributed aliases (project non-goal).
- Contributed aliases in the Mongo TypeScript builder (D9).
- An alias of an alias (D3).
- A PSL syntax for an extension to register a database type.

## Size

The slice is one PR. It is large, but most of the diff is re-emitted fixtures and snapshot renames, which come in their own commits after the code. Splitting the authoring features (D2, D7, D8) from the storage change (D4, D5, D11) was considered and not chosen: an alias that carries a generator only works once aliases are expanded, so the second PR would depend on the first, and Will prefers fewer PRs.

## Slice Definition of Done

Inherits `drive/calibration/dod.md`. Slice-specific:

- [ ] Every test above was red before its change and is green after.
- [ ] Touched packages pass `pnpm typecheck`, `pnpm lint` and `pnpm test --coverage`; `pnpm lint:deps`, `pnpm fixtures:check`, `pnpm lint:throws` and `pnpm check:upgrade-coverage --mode pr` pass.
- [ ] `/drive-code-review` run on the branch tip and its findings fixed.
- [ ] Manual QA: run the upgrade script on a copy of `examples/prisma-8-demo` at `main`, then re-emit, `db sign` and `db verify` against a local database; emit and print the at-a-glance schema; type `temporal.` in the language server.

## Dispatch plan

| # | Outcome | Hands to |
|---|---|---|
| 1 | D1, D2, D3 in SQL PSL, with the shared alias resolution in `psl-parser`; SQL PSL tests; D14's SQL hint. | SQL PSL emits no `typeRef`; repository fixtures stale. |
| 2 | D6: constructors move to the targets, `type.*` parity test, `databaseTypes`, `namedType` narrowed, `default-set-twice`; the 10 TypeScript contracts moved by hand. | TypeScript emits no `typeRef`. |
| 3 | D7, D8: the descriptor kind, binder, assembly check, TypeScript helper, language server, the three targets' aliases; parity tests against the presets. | Contributed aliases in PSL and SQL TypeScript. |
| 4 | D9 Mongo PSL and its hint; Mongo tests; the Mongo alias twin fixture. | Mongo on aliases. |
| 5 | D4, D5, D10: validator refusal, every reader, emitter, runtime, planners, field event planner, print; their tests. | No reader of `typeRef`; stored contracts refused until upgraded. |
| 6 | D11 script and its tests; run it over the repository; re-emit with `pnpm fixtures:check`; D12 Supabase; D13 earlier fragments; planner goldens; one integration file at a time. | Every committed contract expanded; green. |
| 7 | Upgrade instructions, docs and ADR amendments, `deferred.md`; CI-equivalent checks; `/drive-code-review`. | Branch ready for review. |
