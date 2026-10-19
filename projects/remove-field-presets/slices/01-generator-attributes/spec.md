# Slice 1: generator attributes

_Parent project: `projects/remove-field-presets/`. Linear: TML-3607. One PR. Design: ADR 275. Every path below was checked on `main` at da82c8c864. Outcome: a client generator is written `@onCreate(fn())` or `@onUpdate(fn())` in SQL and Mongo PSL, and `.onCreate(gen.fn())` or `.onUpdate(...)` in both TypeScript builders, resolved from the column's codec through one registry; `@default` means a database default only; `contract print` writes generated columns as attributes. Field presets keep working._

## At a glance

Today, on Postgres:

```prisma
model Event {
  id        String   @id @default(uuid(7))
  code      VarChar(32) @default(nanoid())
  seenAt    temporal.time(3, onUpdate: now)
  createdAt DateTime @default(now())
}
```

`code` is refused: `Default generator "nanoid" is not applicable to "Event.code" with codecId "sql/varchar@1"` (`packages/2-sql/2-authoring/contract-psl/src/psl-column-resolution.ts`, the `applicableCodecIds` check). After this slice:

```prisma
model Event {
  id        String      @id @onCreate(uuid(7))
  code      VarChar(32) @onCreate(nanoid())
  seenAt    Time(3)     @onUpdate(now())
  createdAt DateTime    @default(now()) @onCreate(now())
}
```

- `id` gets `{ "kind": "generator", "id": "uuidv7" }` on create, as `@default(uuid(7))` gave before.
- `code` gets `nanoid` with no params: a `VarChar(32)` holds the default 21 characters.
- `seenAt` gets `{ "id": "plainTimeNow", "params": { "precision": 3 } }` on update, read from the column's `precision`, exactly what `temporal.time(3, onUpdate: now)` gives.
- `createdAt` gets the database default `now()` and the generator `instantNow` on create. A create through the client writes the client's time; any other insert gets the database's.

`@default(uuid(7))` is now refused:

```
PSL_GENERATOR_IN_DEFAULT: Field "Event.id": uuid(7) is a value the client generates, and @default sets a database default only. Write @onCreate(uuid(7)) instead.
```

TypeScript gains the same:

```ts
id: field.column(textColumn).id().onCreate(gen.uuid(7)),
seenAt: field.column(timeTemporalColumn(3)).onUpdate(gen.now()),
```

`contract print` writes all four fields as above. Today it refuses `seenAt` unless a preset writes it, and refuses `createdAt` outright (`refuseGeneratorWithDatabaseDefault` in `packages/3-targets/3-targets/postgres/src/core/psl-print/refusals.ts`).

## Today

- **Default functions.** `ControlMutationDefaultEntry` (`packages/1-framework/1-core/framework-components/src/shared/mutation-default-types.ts`) has `signature`, `lower`, `usageSignatures` and `printArguments`. `lower` returns `{ kind: 'storage' }` or `{ kind: 'execution' }`, so the registry entry, not the attribute, decides who writes the value.
- **Where the entries live.** The Postgres and SQLite adapters each register `autoincrement`, `now`, `uuid`, `cuid`, `ulid`, `nanoid` with the same signatures, duplicated in `packages/3-targets/6-adapters/postgres/src/core/control-mutation-defaults.ts` and `packages/3-targets/6-adapters/sqlite/src/core/control-mutation-defaults.ts`. They reach the stack through each adapter's control descriptor (`src/exports/control.ts`). Mongo registers none (`packages/3-mongo-target/1-mongo-target/src/core/descriptor-meta.ts`).
- **Applicability.** `MutationDefaultGeneratorDescriptor.applicableCodecIds` lists `pg/text@1`, `sql/char@1`, and `pg/uuid@1` for the uuid generators (`packages/1-framework/2-authoring/ids/src/index.ts`). `sqlite/text@1`, `sql/varchar@1`, `pg/char@1` and `pg/varchar@1` are missing. `buildPhases` on the same descriptor has no caller.
- **`now` per codec.** `postgresNowGeneratorIds`, `postgresNowGeneratorTakesPrecision` and `postgresNowGeneratorFor` (`packages/3-targets/3-targets/postgres/src/core/now-generators.ts`) map ten Postgres codecs to nine generators and add `precision` for the three time codecs. The Postgres presets (`packages/3-targets/3-targets/postgres/src/core/authoring.ts`) and the Prisma 7 binding (`prisma7-binding.ts`, `updatedAtGenerator`) import them directly. SQLite and Mongo hard-code `timestampNow`.
- **Assembly.** `assembleControlMutationDefaults` (`packages/1-framework/1-core/framework-components/src/control/control-stack.ts`) merges each component's `controlMutationDefaults` and refuses a duplicate function name or generator id. It also builds `defaultFunctionPrintersByGenerator` from `printArguments` for `contract print`.
- **PSL lowering.** `lowerDefaultForField` (`packages/2-sql/2-authoring/contract-psl/src/psl-column-resolution.ts`) lowers `@default(fn())` through `lowerDefaultFunctionWithRegistry` (`default-function-registry.ts`), then checks `applicableCodecIds` for an execution result. `psl-field-resolution.ts` merges the result with a preset's generators and refuses a preset and `@default` that both generate on create (`PSL_PRESET_AND_DEFAULT_CONFLICT`). No `@onCreate` or `@onUpdate` attribute exists.
- **Attribute specs.** `defaultFieldSpec` in `packages/2-sql/2-authoring/contract-psl/src/sql-attribute-specs.ts` builds one `funcCall` arm per registered default function from `AttributeSpecContext.defaultFunctionRegistry` (`packages/1-framework/2-authoring/psl-parser/src/attribute-spec/spec-context.ts`). `FieldAttributeSpecContext.typeConstructor` gives the field's codec.
- **Mongo PSL.** No `@default`. `@updatedAt` and `@default(now())` are refused with hints that name presets (`packages/2-mongo-family/2-authoring/contract-psl/src/mongo-attribute-specs.ts`). Generated values come only from presets, collected and checked in `resolvePresetExecutionDefaults` (`packages/2-mongo-family/2-authoring/contract-psl/src/interpreter.ts`).
- **TypeScript.** The SQL field builder (`ScalarFieldBuilder` in `packages/2-sql/2-authoring/contract-ts/src/contract-dsl.ts`) has `.default()` and `field.generated(spec)`, which sets `onCreate` only. The type-level `FieldDefaultPresence.execution` makes a field optional on create. `.default()` takes `now()` and `autoincrement()` from `default-functions.ts`. The Mongo builder (`packages/2-mongo-family/2-authoring/contract-ts/src/contract-builder.ts`) gets generators only from presets, through `__executionDefaults`.
- **Readers.** The Prisma 7 reader lowers `@default(uuid())` and the other client functions through the default function registry (`lowerFunction` in `packages/2-sql/2-authoring/contract-prisma7/src/defaults.ts`) and `@updatedAt` through `binding.updatedAtGenerator` (`interpreter.ts`, `target-binding.ts`). The Prisma 6 Mongo reader uses `binding.timestampGeneratorId` (`packages/2-mongo-family/2-authoring/contract-prisma6/src/interpreter.ts`, `target-binding.ts`; `packages/3-mongo-target/1-mongo-target/src/core/prisma6-binding.ts`).
- **Print.** `buildExecutionDefault` (`packages/3-targets/3-targets/postgres/src/core/psl-print/generated-values.ts`) tries a preset call first (`fieldPresetCallFor` in `packages/2-sql/9-family/src/core/psl-build/generated-values.ts`, over `fieldPresetsByCodecAndGenerator` from `packages/1-framework/1-core/framework-components/src/shared/field-preset-print-form.ts`), then `@default(fn())` for a create-only generator, then refuses. `scalar-fields.ts` refuses a generator beside a database default.
- **Language server.** `lsp-control-stack.ts`, `attribute-spec-resolution.ts` and `config-resolution.ts` (in `packages/1-framework/3-tooling/language-server/src/`) pass only `defaultFunctionRegistry` to the spec context. `completion-provider.test.ts` asserts `uuid`, `cuid`, `ulid`, `nanoid` inside `@default(`.

## Decisions

### D1. `@default(uuid())` is refused in this slice

`@default(uuid())`, `@default(cuid(2))`, `@default(ulid())` and `@default(nanoid(...))` are refused now with `PSL_GENERATOR_IN_DEFAULT`, whose message gives the `@onCreate` form. They are not kept with a warning until slice 3.

Why: every use can move in this PR, and moving changes no contract. The count on `main`:

- 88 Prisma 8 `.prisma` files with 224 uses: 67 under `test/integration` (mostly `test/ports/prisma/functional/*/_fixture/contract.prisma`), 18 in `examples/` (including the migration-package copies in `examples/prisma-8-demo/migrations/app/*/contract.prisma` and `examples/prisma-8-postgis-demo/migrations/`), 3 in `packages/3-extensions/supabase/`.
- 19 TypeScript test files with inline PSL, listed under Tests, and two doc comments in `packages/3-targets/3-targets/postgres/src/core/type-constructors.ts` and `packages/3-targets/3-targets/sqlite/src/core/type-constructors.ts`.
- Current docs: ADR 169, 226, 231, 244, `docs/architecture docs/subsystems/6. Ecosystem Extensions & Packs.md`, `packages/1-framework/2-authoring/psl-parser/README.md`, `packages/2-sql/2-authoring/contract-psl/README.md`, `packages/3-extensions/postgis/README.md`, `packages/3-extensions/postgres/README.md`, `examples/prisma-8-postgis-demo/README.md`, `skills/prisma-8/references/contract.md`, `skills/prisma-8/references/supabase.md`, `scorecard/03-psl-schema-language.md`.

Not moved: the Prisma 7 and Prisma 6 dialect fixtures (`packages/2-sql/2-authoring/contract-prisma7/test/fixtures/*`, `test/integration/test/fixtures/prisma7-source/*`, `packages/2-mongo-family/2-authoring/contract-prisma6/test/fixtures/*`), where `@default(uuid())` is valid Prisma 7; past release notes, published upgrade guides under `skills/prisma-8/upgrading/`, `projects/*`, and the `*.md` copies of engine tests under `test/integration/test/ports/engines/`.

A rewrite gives the same `executionDefaults`, so `pnpm fixtures:check` shows no `contract.json` diff. That proves R37 for every moved fixture. The rewrite is done by the script the app upgrade fragment ships, run over an explicit file list, so the script is tested on the whole repository.

Keeping `@default(uuid())` with a warning was rejected: it would need a warning channel the PSL interpreter uses nowhere for this, it contradicts the project rule "hard errors", and every user would still have to rewrite in slice 3.

### D2. The registry shape lives in the framework; definitions and bindings come from family, target and extension pack refs

New file `packages/1-framework/1-core/framework-components/src/shared/generator-functions.ts`, exported from `src/exports/control.ts`:

```ts
interface GeneratorFunctionColumn {
  readonly codecId: string;
  readonly typeParams: Readonly<Record<string, unknown>> | undefined;
}

type GeneratorResolution =
  | { readonly ok: true; readonly generator: ExecutionMutationDefaultValue }
  | { readonly ok: false; readonly message: string };

interface GeneratorFunctionBinding {
  readonly codecIds: readonly string[];
  readonly resolve: (input: {
    readonly args: Readonly<Record<string, unknown>>;
    readonly column: GeneratorFunctionColumn;
  }) => GeneratorResolution;
  /** The arguments that produce `generator` on `column`, or `undefined` when this binding never produces it. */
  readonly printArguments: (
    generator: ExecutionMutationDefaultValue,
    column: GeneratorFunctionColumn,
  ) => { readonly args: Readonly<Record<string, unknown>>; readonly text: string } | undefined;
}

interface GeneratorFunctionContribution {
  readonly name: string;
  /** A FuncCallSig, typed unknown as `ControlMutationDefaultEntry.signature` is. Exactly one contribution per name sets it. */
  readonly signature?: unknown;
  readonly bindings: readonly GeneratorFunctionBinding[];
}

interface GeneratorFunctionCall { readonly name: string; readonly args: Readonly<Record<string, unknown>> }

interface GeneratorFunctionRegistry {
  functionsFor(codecId: string): readonly { readonly name: string; readonly signature: unknown }[];
  has(name: string): boolean;
  resolve(call: GeneratorFunctionCall, field: GeneratorFunctionField):
    | { readonly ok: true; readonly generator: ExecutionMutationDefaultValue }
    | { readonly ok: false; readonly reason: 'refused'; readonly message: string }
    | { readonly ok: false; readonly reason: 'unknown-function' | 'not-bound'; readonly boundCodecIds: readonly string[] };
  callFor(generator, field): { readonly call: GeneratorFunctionCall; readonly text: string } | undefined;
}

function assembleGeneratorFunctions(
  descriptors: ReadonlyArray<GeneratorFunctionComponent>,
): GeneratorFunctionRegistry;
```

A binding's `resolve` returns a `BindingResolution`. One call type, `GeneratorFunctionCall`, is what `gen` builds, what `.onCreate(...)` takes, what `resolve` reads and what `callFor` gives back. The vocabulary lives in `src/shared/generator-functions.ts` and is exported once, from `@internal/framework-components/components`.

`ComponentMetadata` (`packages/1-framework/1-core/framework-components/src/shared/framework-components.ts`) gains `generatorFunctions?: readonly GeneratorFunctionContribution[]`. `ControlStack` (`control-stack.ts`) gains `generatorFunctions: GeneratorFunctionRegistry`, assembled from `allDescriptors`. The registered generator ids come from each component's `controlMutationDefaults.generatorDescriptors`, so every caller, the TypeScript builders included, runs the same checks. `ContractSourceContext.generatorFunctions` is required.

Assembly throws `CONTRACT.PACK_CONTRIBUTION_INVALID`, naming both components, when: two contributions set a signature for one name; a binding's name has no signature anywhere; two bindings cover one name and codec; two names print the same generator id for one codec; a generator id a binding can print is not registered by any component. `resolve` throws `InternalError` when a binding returns a generator id it does not list in `generatorIds`.

Who contributes what:

- `@internal/family-sql`: new `packages/2-sql/9-family/src/core/generator-functions.ts` declares `now`, `uuid`, `cuid`, `ulid`, `nanoid`, `ksuid` with their signatures (moved from the two adapters) and binds the id functions to the family codecs `sql/char@1` and `sql/varchar@1`. It is added to `sqlFamilyPack` (`src/exports/pack.ts`) and `SqlFamilyDescriptor` (`src/core/control-descriptor.ts`).
- `@internal/target-postgres`: binds `now` to the ten codecs in `now-generators.ts` (which becomes the binding and loses `postgresNowGeneratorFor`'s other callers), and the id functions to `pg/text@1`, `pg/char@1`, `pg/varchar@1`, plus `uuid` to `pg/uuid@1`. Added to `postgresTargetDescriptorMeta` (`src/core/descriptor-meta.ts`).
- `@internal/target-sqlite`: binds `now` to `sqlite/datetime@1` (`timestampNow`) and the id functions to `sqlite/text@1`. Added to its `descriptor-meta.ts`.
- `@internal/mongo-target`: declares `now` and binds it to `mongo/date@1` (`timestampNow`), in `packages/3-mongo-target/1-mongo-target/src/core/descriptor-meta.ts`.

Why the framework holds the shape: ADR 275 says the control stack assembles the registry from each component, and the framework may not name families or targets (`.agents/rules/no-family-vocabulary-in-framework.mdc`). Why pack refs and not adapter control descriptors, where default functions live today: the TypeScript builder has the family, target and extension pack refs (`packages/3-extensions/postgres/src/contract/define-contract.ts`) but no adapter control descriptor, and PSL and TypeScript must resolve the same way. Why the family declares the signatures: today they are duplicated in two adapters; the family is the one place both SQL targets share. Why a binding can come from a component other than the declaring one: an extension that adds a text codec, or a target, binds its own codecs to `uuid` without redeclaring it.

The `generatorDescriptors` live on the pack ref of the component that contributes the binding: the SQL family registers the identifier generators its `idGeneratorFunctionBindings` produce, and each target registers its own `now` generators. So the TypeScript builders, which have the pack refs, run the registered-generator check too, and a SQL target that binds the identifier functions registers nothing for them. The adapters register none. A generator function signature may not declare `named` parameters, because a `gen` call passes its arguments by position; assembly refuses one. The database default functions still live on the adapters (see `projects/remove-field-presets/deferred.md`).

### D3. Generator params come from the column's type params, by binding

Each binding's `resolve` reads `column.typeParams`:

- **`now` on time codecs.** `pg/time-temporal@1`, `pg/time-string@1`, `pg/timetz@1` give `params: { precision }` when the column has a numeric `precision`, as `postgresNowGeneratorFor` does today. Other date and time codecs take no params. This matches what `temporalPhaseTemplateWithParams` gives the time presets, so `Time(3) @onUpdate(now())` and `temporal.time(3, onUpdate: now)` lower to the same generator.
- **`nanoid` on every codec**: the size is the call's, or the default 21. It never comes from the column's `length`. The `size` param is written only when the call gives one. A size larger than the length of a `Char(n)` or `VarChar(n)` column is refused, because the identifier does not fit: `nanoid(16) writes 16 characters, which does not fit a column of 10 characters.` So `Char(36) @onCreate(nanoid())` lowers to `{ id: 'nanoid' }`, as the Prisma 7 reader's `@db.Char(36) @default(nanoid())` does on main.
- **Argument checks.** `resolve` also checks the argument ranges the PSL signature checks (`uuid` version 4 or 7, `cuid` version 2, `nanoid` size 2 to 255), because the TypeScript builder does not parse a signature.

Why size is never read from the length: read literally for `VarChar(255)`, every identifier would be 255 characters, and the Prisma 7 reader would change `@db.VarChar(191) @default(nanoid())` from a 21-character identifier to a 191-character one. Reading it for `Char(n)` only would change the contract of `@db.Char(36) @default(nanoid())`, which main lowers to `{ id: 'nanoid' }`. A shorter identifier in a `Char(n)` column is stored padded, as in Prisma 7. This refines ADR 275; it does not change a decision.

Fixed-length checks for the other id generators (`uuid()` on `Char(10)`) are a non-goal: ADR 275 names only `nanoid`. The Prisma 7 reader keeps reading the schemas Prisma 7 accepts, except a `nanoid` that does not fit its column (D11).

### D4. `ksuid()` is a new generator function with no arguments

`ksuid` is declared by the SQL family with the signature `{ documentation: 'Generates a KSUID when a value is not supplied.' }` and bound to the same text codecs as `ulid`. `printArguments` writes `''` for the generator `ksuid`.

Why: the generator exists (`builtinGeneratorIds` in `packages/1-framework/2-authoring/ids/src/generator-ids.ts`, runtime in `ids/src/runtime.ts`), but only the preset `id.ksuid()` and the TypeScript helper `ksuid()` reach it. Slice 3 removes the preset, so the attribute form must exist first, and `contract print` can then write a `ksuid` column, which it refuses today. Prisma 7 has no `ksuid()`, so the Prisma 7 reader does not read it.

### D5. A preset and a generator attribute that set the same phase are refused

A field typed by a preset that sets a generator for a phase cannot also write the attribute for that phase. `temporal.updatedAt() @onUpdate(now())` and `id.uuidv4String() @onCreate(uuid())` are refused with `PSL_PRESET_AND_DEFAULT_CONFLICT`, worded for the attribute: `Field "Post.updatedAt" uses a field-preset call that already generates a value on update, so @onUpdate(...) cannot set one too. Remove @onUpdate(...) or use a preset without an onUpdate generator.` An attribute for a phase the preset leaves empty is allowed: `temporal.timestamp(3, onCreate: now) @onUpdate(now())` gives both phases.

Why: it is the rule `psl-field-resolution.ts` already applies to a preset and `@default(uuid())`, extended to each phase. Picking one silently would break the project's hard-error rule. Reusing the existing code avoids a new diagnostic that slice 3 deletes. Mongo applies the same rule. In TypeScript, `.onCreate` or `.onUpdate` on a builder whose phase is already set, by a preset or an earlier call, throws `CONTRACT.DEFAULT_INVALID` with `reason: 'generator-phase-set-twice'`.

### D6. `@default` can no longer produce a client generator

`LoweredDefaultValue` loses its `{ kind: 'execution' }` arm, and `ControlMutationDefaultEntry` loses `printArguments`. The default function registries keep `autoincrement` and `now` only. `AssembledControlMutationDefaults.defaultFunctionPrintersByGenerator` and the `DefaultFunctionPrinter` type are removed; `componentIdsByGenerator` stays for print's refusal message. `MutationDefaultGeneratorDescriptor` loses `applicableCodecIds` (bindings replace it) and `buildPhases` (no caller). `builtinGeneratorRegistryMetadata` in `@internal/ids` loses `applicableCodecIds`.

Why: ADR 275 says every entry in the default function registry lowers to a database default. Keeping the `execution` arm would let an extension's `@default(slugid())` stay a client generator, the ambiguity the ADR removes. This is a breaking change for extension authors that ADR 275 does not list; the extension upgrade fragment covers it.

### D7. The attribute names the registry

- `@default(fn())`: if `fn` is in the default function registry, it lowers as today. If it is not, but the generator function registry has it, the `@default` spec refuses it with `PSL_GENERATOR_IN_DEFAULT` before trying the arms, as `defaultValueArm` already refuses `dbgenerated` (`sql-attribute-specs.ts`). Otherwise the existing `PSL_UNKNOWN_DEFAULT_FUNCTION`.
- `@onCreate(fn())` and `@onUpdate(fn())`: new specs `onCreateFieldSpec` and `onUpdateFieldSpec`, one `funcCall` arm per function in `generatorFunctions.functionsFor(codecId)` for the field's codec. A function the registry has but does not bind to the codec is refused with `PSL_GENERATOR_NOT_APPLICABLE`, naming the codec and listing the functions that apply. A name the registry does not have is refused with `PSL_UNKNOWN_GENERATOR_FUNCTION`, listing the functions that apply. A `resolve` refusal (`nanoid` size) is `PSL_GENERATOR_NOT_APPLICABLE` with the binding's message.

`AttributeSpecContext` (`packages/1-framework/2-authoring/psl-parser/src/attribute-spec/spec-context.ts`) gains `generatorFunctions: GeneratorFunctionRegistry`. `BinderContext` (`binder.ts`) gains it beside `controlMutationDefaults`. `ContractSourceContext` (`packages/1-framework/1-core/config/src/contract-source-types.ts`) gains it, filled from `stack.generatorFunctions` in `packages/1-framework/3-tooling/cli/src/control-api/operations/load-contract-source.ts`.

### D8. Where the field's codec comes from

The SQL interpreter resolves the field's column descriptor before lowering attributes (`psl-field-resolution.ts`), and `resolvedTypeParams(descriptor, input.namedTypes)` gives its type params through a named type. The generator attributes use that descriptor and those params, the same inputs `lowerDefaultForField` gets. So a field typed by a `types {}` alias resolves by the alias's codec and params. The spec arms use `FieldAttributeSpecContext.typeConstructor`, which also resolves through a named type. When it is `undefined` (an enum, a value object), the specs offer no function, and any call is `PSL_GENERATOR_NOT_APPLICABLE`.

### D9. Lists, optional fields, value objects

- A list field with `@onCreate` or `@onUpdate` is refused with the existing `PSL_LIST_EXECUTION_DEFAULT_UNSUPPORTED`, generalised to name the attribute.
- SQL: an optional field may carry either attribute, as PR #30742 allowed for `@default(uuid())`.
- Mongo: an optional field with a generator is refused, as the Mongo TypeScript builder refuses it (`reason: 'nullable-with-executionDefaults'`). Variant fields and two models in one collection keep the checks in `resolvePresetExecutionDefaults`, which now collects attribute generators too.
- A field typed by a value object stores `jsonb`, which no binding covers, so it is refused by D7 with no extra rule.

### D10. TypeScript: `gen`, `.onCreate`, `.onUpdate`

- New `packages/1-framework/1-core/framework-components/src/shared/generator-helpers.ts`, exported from `src/exports/components.ts`: `createGeneratorHelpers(components)` builds `gen` from the composed packs, as the `type` helpers are built. It holds one helper per generator function the components declare, typed by the positional parameters of the function's signature (`gen.uuid(version?: 4 | 7)`, `gen.nanoid(size?: number)`, `gen.slugid()` for an extension), and each returns a `GeneratorFunctionCall` with the argument keys of the signature. So each stack's `gen` holds exactly that stack's functions: Mongo's holds only `now`. The `defineContract` callback receives it, and each facade exports one built from its family and target packs.
- Re-exported beside `now` and `autoincrement` from `packages/2-sql/2-authoring/contract-ts/src/exports/contract-builder.ts`, the Mongo `contract-ts` exports, and the facade entries `packages/3-extensions/postgres/src/exports/contract-builder.ts`, `packages/3-extensions/sqlite/src/exports/contract-builder.ts` and `packages/3-extensions/mongo/src/exports/contract-builder.ts`.
- `ScalarFieldBuilder` gets `.onCreate(call)` and `.onUpdate(call)`. They store the call in a new state field `generatorCalls?: { onCreate?; onUpdate? }`, beside the resolved `executionDefaults` a preset sets. `.onCreate` returns `ScalarFieldBuilder<WithExecutionDefault<State>>`, which sets `FieldDefaultPresence.execution` to `true`; `.onUpdate` keeps the state's presence. `EnumScalarFieldBuilder` gets neither: an enum codec has no binding.
- `resolveModelNode` (`packages/2-sql/2-authoring/contract-ts/src/contract-lowering.ts`) resolves each call with the field's codec id and type params through a registry assembled from `definition.family`, `definition.target` and the extensions, and merges the result into `executionDefaults`. A refusal throws `CONTRACT.DEFAULT_INVALID` with `reason: 'generator-not-applicable'` or `'generator-unknown'` and meta `modelName`, `fieldName`, `codecId`, `function`.
- The Mongo field builder (`contract-builder.ts`, the builder that sets `__executionDefaults`) gets the same two methods. The calls are resolved before the existing execution-default checks run, so those checks see resolved phases.
- `field.generated(...)` stays until slice 3.

Why a call object and not a generator id: the generator depends on the column's codec, which a TypeScript alias constant (slice 2) does not know when it is written. Why the argument keys match the PSL signature: one `resolve` serves both surfaces. A test pins the match (see Tests).

### D11. Readers

- **Prisma 7.** `lowerFunction` (`packages/2-sql/2-authoring/contract-prisma7/src/defaults.ts`) keeps `FUNCTION_ARGUMENT_KEYS` and the `cuid()` to version 2 mapping. A name in the default function registry lowers to a database default; otherwise it resolves through `generatorFunctions` as `onCreate`. `@updatedAt` resolves `now` for the column through `generatorFunctions` for both phases (`interpreter.ts`). `Prisma7TargetBinding.updatedAtGenerator` (`target-binding.ts`) and its Postgres value (`packages/3-targets/3-targets/postgres/src/core/prisma7-binding.ts`) are removed. The `PSL.PRISMA7_UPDATED_AT_FIELD_INVALID` refusal is kept for a column `now` does not bind.
- **Prisma 6 Mongo.** `@updatedAt` and `@default(now())` resolve `now` for the field's codec through `generatorFunctions` (`packages/2-mongo-family/2-authoring/contract-prisma6/src/interpreter.ts`). `Prisma6TargetBinding.timestampGeneratorId` (`target-binding.ts`) and its Mongo value (`packages/3-mongo-target/1-mongo-target/src/core/prisma6-binding.ts`) are removed.
- Both providers pass `context.generatorFunctions` through (`contract-prisma7/src/provider.ts`, `contract-prisma6/src/provider.ts`).
- The contracts both build do not change. `uuid()` on `@db.VarChar` and on SQLite text, refused today, are read. One shape `main` read is now refused: a `nanoid` that does not fit its column, such as `@db.Char(10) @default(nanoid())`, is `PSL.PRISMA7_GENERATOR_REFUSED`. Postgres refuses that insert, so no Prisma 7 application could store such a row.

### D12. `contract print` writes attributes and drops its preset output

`buildExecutionDefault` (`packages/3-targets/3-targets/postgres/src/core/psl-print/generated-values.ts`) returns one attribute per phase: `@onCreate(<name>(<text>))` and `@onUpdate(...)`, from `generatorFunctions.callFor(generator, column)`. It then resolves the written call back with `generatorFunctions.resolve` and compares it, by `canonicalizeJson`, with the stored generator. A column with no call, or whose call reads back differently, is refused with `refuseGeneratorWithoutPslFunction`, reworded to name generator functions, or a new `refuseGeneratorReadingBackDifferently`. `scalar-fields.ts` writes the attributes after `@default`, in the order `@onCreate`, `@onUpdate`, and no longer refuses a generator beside a database default.

Removed, since print was their only user: `fieldPresetCallFor` and its types in `packages/2-sql/9-family/src/core/psl-build/generated-values.ts`; `defaultFunctionCallFor` there; `assembleFieldPresetsByCodecAndGenerator`, `FieldPresetPrintForm` and `FieldPresetsByCodecAndGenerator` in `packages/1-framework/1-core/framework-components/src/shared/field-preset-print-form.ts`; `ControlStack.fieldPresetsByCodecAndGenerator`; the field in `control-target-descriptor.ts` and `control-instance.ts` (`packages/2-sql/9-family/src/core/`); `refuseGeneratorsNoPresetWritesTogether`, `refuseUnwritablePresetCall`, `refusePresetCallReadingBackDifferently`, `refuseGeneratorOnUpdate` and `refuseGeneratorWithDatabaseDefault` in `refusals.ts`. `SqlPslBuildContext` gets `generatorFunctions` in place of `defaultFunctionPrintersByGenerator`.

Why now and not in slice 3: after this slice, every generated column the preset output covers can be written as attributes, and the attribute form covers columns the preset output refuses. Printing presets for one more slice would print a form slice 3 refuses. The printed file changes from preset calls to attributes, with the same contract hashes; the round-trip tests check that.

### D13. Language server

`lsp-control-stack.ts`, `attribute-spec-resolution.ts` and `config-resolution.ts` pass `generatorFunctions` with `controlMutationDefaults`. No completion code changes: the new attribute specs give argument completion, snippets and hover, as `@default` gets them (ADR 249). The field-preset branches stay until slice 3.

### D14. Diagnostics and hints

- New: `PSL_GENERATOR_IN_DEFAULT`, `PSL_UNKNOWN_GENERATOR_FUNCTION`, `PSL_GENERATOR_NOT_APPLICABLE`, each with an entry in `docs/reference/error-reference.md`.
- Removed: the preset-only generator refusal in `lowerDefaultForField` (`Use the corresponding field preset …`) and the `applicableCodecIds` refusal, both `PSL_INVALID_DEFAULT_APPLICABILITY`. The code stays for its other uses (a `null` default on a required field).
- The SQL `@updatedAt` hint (`REMOVED_ATTRIBUTE_RULES` in `psl-field-resolution.ts`) becomes `Use @onCreate(now()) @onUpdate(now()) instead.` and is suppressed when the field already has `@onUpdate`. The Mongo hints (`mongo-attribute-specs.ts`) say the same, and `@default(now())` on Mongo says `Use @onCreate(now()) instead; MongoDB has no database defaults.` Slice 2 adds `temporal.UpdatedAt` to both.

## Code changes by package

| Package | Files | Change |
|---|---|---|
| `@internal/framework-components` | `src/shared/generator-functions.ts` (new), `src/shared/generator-helpers.ts` (new), `src/shared/mutation-default-types.ts`, `src/shared/framework-components.ts`, `src/control/control-stack.ts`, `src/shared/field-preset-print-form.ts`, `src/shared/temporal-presets.ts`, `src/exports/control.ts`, `src/exports/authoring.ts` | D2, D6, D10, D12. `timestampNowControlDescriptor` loses `buildPhases`. |
| `@internal/config` | `src/contract-source-types.ts` | `ContractSourceContext.generatorFunctions` (D7). |
| `@internal/cli` | `src/control-api/operations/load-contract-source.ts` | Pass `stack.generatorFunctions` (D7). |
| `@internal/psl-parser` | `src/attribute-spec/spec-context.ts`, `src/binder.ts`, `src/bind-psl-schema.ts` | Thread `generatorFunctions` (D7). |
| `@internal/ids` | `src/index.ts` | Drop `applicableCodecIds` (D6). |
| `@internal/family-sql` | `src/core/generator-functions.ts` (new), `src/exports/pack.ts`, `src/core/control-descriptor.ts`, `src/core/psl-build/generated-values.ts`, `src/core/control-target-descriptor.ts`, `src/core/control-instance.ts` | D2, D4, D12. |
| `@internal/sql-contract-psl` | `src/sql-attribute-specs.ts`, `src/psl-column-resolution.ts`, `src/psl-field-resolution.ts`, `src/default-function-registry.ts`, `src/interpreter.ts`, `src/provider.ts` | D5, D7, D8, D9, D14. A new `lowerGeneratorAttributesForField` sits beside `lowerDefaultForField`. |
| `@internal/sql-contract-ts` | `src/contract-dsl.ts`, `src/contract-lowering.ts`, `src/build-contract.ts`, `src/exports/contract-builder.ts` | D5, D10. |
| `@internal/sql-contract-prisma7` | `src/defaults.ts`, `src/interpreter.ts`, `src/target-binding.ts`, `src/provider.ts` | D11. |
| `@internal/mongo-contract-psl` | `src/mongo-attribute-specs.ts`, `src/interpreter.ts`, `src/provider.ts` | D5, D7, D9, D14. |
| `@internal/mongo-contract-ts` | `src/contract-builder.ts`, its exports | D10. |
| Mongo Prisma 6 reader | `packages/2-mongo-family/2-authoring/contract-prisma6/src/interpreter.ts`, `target-binding.ts`, `provider.ts` | D11. |
| `@internal/target-postgres` | `src/core/now-generators.ts`, `src/core/descriptor-meta.ts`, `src/core/prisma7-binding.ts`, `src/core/date-time-now-generators.ts`, `src/core/authoring.ts` (presets read the binding's map), `src/core/psl-print/generated-values.ts`, `src/core/psl-print/scalar-fields.ts`, `src/core/psl-print/refusals.ts`, `src/core/type-constructors.ts` (doc comment) | D2, D3, D11, D12. |
| `@internal/target-sqlite` | `src/core/descriptor-meta.ts`, `src/core/generator-functions.ts` (new), `src/core/type-constructors.ts` (doc comment) | D2. |
| `@internal/mongo-target` | `src/core/descriptor-meta.ts`, `src/core/prisma6-binding.ts` | D2, D11. |
| `@internal/adapter-postgres`, `@internal/adapter-sqlite` | `src/core/control-mutation-defaults.ts` | Keep `autoincrement` and `now`; drop the id functions and `applicableCodecIds` (D6). |
| `@internal/language-server` | `src/lsp-control-stack.ts`, `src/attribute-spec-resolution.ts`, `src/config-resolution.ts` | D13. |
| Facades | `packages/3-extensions/postgres/src/exports/contract-builder.ts`, `packages/3-extensions/sqlite/src/exports/contract-builder.ts`, `packages/3-extensions/mongo/src/exports/contract-builder.ts` | Export `gen` (D10). |

Before building, run `pnpm build` in each package whose exported types change (`framework-components`, `config`, `psl-parser`, `family-sql`, `sql-contract-ts`), then check downstream packages.

## Tests (write them first; each must fail before its change)

Framework, `packages/1-framework/1-core/framework-components/test/`:
- New `generator-functions.test.ts`: assembly merges bindings from two components for one name; each assembly error in D2, with both component ids in the message; `functionsFor` lists only bound functions; `resolve` returns `unknown-function` and `not-bound`; `callFor` returns `undefined` for an unprinted generator.
- `default-function-printers.test.ts` is replaced by the `callFor` cases above.
- `control-stack.test.ts`: the stack exposes `generatorFunctions`; a binding that prints an unregistered generator id fails assembly.
- `mutation-defaults.test.ts`: a default function entry cannot type an `execution` result (type test with `@ts-expect-error`).

SQL family, `packages/2-sql/9-family/test/`:
- New `generator-functions.test.ts`: every Postgres and SQLite text-like codec resolves `uuid`, `cuid(2)`, `ulid`, `nanoid`, `ksuid`; `uuid` resolves on `pg/uuid@1` and `cuid` does not; the `nanoid` rules of D3 (the size is never read from the column; a size above a `Char` or `VarChar` length is refused); the argument range checks.

Targets:
- `packages/3-targets/3-targets/postgres/test/now-generators.test.ts` (extend): the ten codecs resolve to the table in ADR 275; time codecs carry `precision` from the column; `callFor` writes `now()` and reads back.
- New `packages/3-targets/3-targets/sqlite/test/generator-functions.test.ts`: `now` on `sqlite/datetime@1` is `timestampNow`; `uuid` on `sqlite/text@1`.

SQL PSL, `packages/2-sql/2-authoring/contract-psl/test/`:
- New `interpreter.generator-attributes.test.ts`: the at-a-glance schema lowers to the stated generators; `@default(now()) @onCreate(now())` keeps both; `@onUpdate` alone; an alias-typed field resolves by the alias's codec and params; a list field is refused; `Bytes @onCreate(uuid())` is `PSL_GENERATOR_NOT_APPLICABLE` listing nothing; `@onCreate(foo())` is `PSL_UNKNOWN_GENERATOR_FUNCTION`; `VarChar(10) @onCreate(nanoid(16))` is refused; `uuid()` on `VarChar(64)` lowers.
- `interpreter.defaults.functions.test.ts`, `interpreter.defaults.generator-storage.test.ts`: move the client-generator cases to `@onCreate`; add `@default(uuid())`, `@default(cuid(2))`, `@default(ulid())`, `@default(nanoid())` each refused with `PSL_GENERATOR_IN_DEFAULT` and the exact message.
- `interpreter.defaults.preset-misuse.test.ts`: `temporal.updatedAt() @onUpdate(now())` and `id.uuidv4String() @onCreate(uuid())` refused (D5); `temporal.timestamp(3, onCreate: now) @onUpdate(now())` gives both phases.
- `composed-mutation-defaults.test.ts`: an extension that contributes a generator function and a binding (the `slugid` pattern) is accepted in `@onCreate`, refused in `@default`.
- Move the inline PSL in `interpreter.defaults.generated-values.test.ts`, `interpreter.defaults.list-columns.test.ts`, `interpreter.defaults.tagged-literal.test.ts`, `interpreter.enum.test.ts`, `interpreter.namespaces.test.ts`, `provider.interpret.test.ts`, `provider.test.ts`, `semantic-diagnostics.test.ts`.
- `packages/1-framework/2-authoring/psl-parser/test/symbol-table.test.ts`: move its inline PSL.

SQL TypeScript, `packages/2-sql/2-authoring/contract-ts/test/`:
- New `contract-dsl.generator-calls.test.ts`: `gen` holds the declared functions, an extension's included; `.many().onCreate(...)` throws `generator-on-list`; `.onCreate(gen.uuid(7))` on `textColumn` lowers to `uuidv7`; `.onUpdate(gen.now())` on `timeTemporalColumn(3)` lowers with `precision: 3`; `gen.uuid()` on a `bytea` column throws `CONTRACT.DEFAULT_INVALID` with `reason: 'generator-not-applicable'`; `.onCreate` twice throws `generator-phase-set-twice`; a preset with `onCreate` plus `.onCreate` throws.
- New `contract-dsl.generator-calls.test-d.ts`: a field with `.onCreate` is optional in the create input; with `.onUpdate` only it is required.
- New `packages/2-sql/9-family/test/gen-signature-parity.test.ts`: every `gen` helper's argument keys are the keys of the SQL family's signature for that function, and each `gen` call resolves on a column the function binds.

Mongo:
- `packages/2-mongo-family/2-authoring/contract-psl/test/interpreter.generator-attributes.test.ts` (new): `DateTime @onCreate(now()) @onUpdate(now())` lowers to `timestampNow` both phases; optional field refused; a variant field refused; `@default(now())` hint names `@onCreate(now())`.
- `mongo-attribute-specs.test.ts`: the `@updatedAt` hint text.
- `packages/2-mongo-family/2-authoring/contract-ts/test/contract-builder.execution-defaults.test.ts` and `.test-d.ts`: `.onCreate(gen.now())` and `.onUpdate(gen.now())` give the same phases as `temporal.updatedAt()`.

Readers:
- `packages/2-sql/2-authoring/contract-prisma7/test/updated-at-generators.test.ts`: rewrite against the registry; same expected generators for every date and time native type.
- `packages/2-sql/2-authoring/contract-prisma7/test/defaults.test.ts`: add `@db.VarChar(191) @default(nanoid())` giving `{ id: 'nanoid' }` and `@db.VarChar(36) @default(uuid())` giving `uuidv4`, both refused today.
- `packages/2-sql/2-authoring/contract-prisma7/test/fixtures.test.ts` and `packages/2-mongo-family/2-authoring/contract-prisma6/test/fixtures.test.ts`: unchanged expected contracts.

Print, `packages/3-targets/3-targets/postgres/test/psl-print/`:
- `generated-values.test.ts`: every generator writes as `@onCreate`/`@onUpdate`; `Time(3)` with `plainTimeNow` and `precision: 3` writes `@onUpdate(now())`; the same generator without `precision` on `Time(3)` is refused as reading back differently; a generator beside `@default(now())` writes both; `nanoid` with `size: 16` writes `nanoid(16)` on every codec; `ksuid` writes `ksuid()`.
- `refusals-fields.test.ts`: drop the removed refusals; keep the unregistered-generator refusal with the new wording.

Language server, `packages/1-framework/3-tooling/language-server/test/completion-provider.test.ts`:
- `@default(|)` lists `true`, `false`, `null`, `autoincrement`, `now`.
- `@onCreate(|)` on `String` lists `uuid`, `cuid`, `ulid`, `nanoid`, `ksuid` and not `now`, which no binding gives `pg/text@1`. On `Time(3)` it lists only `now`. `uuid(|)` offers `4` and `7`, and snippets work as they do for `@default` today. Hover on `uuid` inside `@onCreate(` shows its signature.

Integration, run one file at a time with `pnpm test <file>` inside `test/integration`:
- New `test/integration/test/temporal-defaults/_fixture-attributes/contract.prisma`: the `_fixture-now` schema written with type constructors and `@onCreate(now()) @onUpdate(now())`. A new case in `temporal-defaults.integration.test.ts` asserts its `storageHash` and `executionHash` equal `_fixture-now`'s.
- New `test/integration/test/mongo/temporal-presets/_fixture-attributes/` beside `_fixture`, same assertion.
- `test/integration/test/authoring/parity/`: every `default-*` case's `schema.prisma` moves to `@onCreate`; `expected.contract.json` does not change; `default-pack-slugid/packs.ts` contributes a generator function and binding instead of a default function entry.
- `test/integration/test/psl-print/generated-values-roundtrip.integration.test.ts` and `every-postgres-contract-roundtrip.integration.test.ts`: printed text now uses attributes; hashes round-trip.
- `test/integration/test/authoring/diagnostics/invalid-default-arguments/`: `nanoid(1)` moves to `@onCreate` and keeps its argument diagnostic.
- `test/integration/test/sql-orm-client/collection-mutation-defaults-nullable.test.ts` and the three ports test files with inline PSL: moved.
- Planner goldens (`test/integration/test/planner-golden/`): no change expected; run them.

Upgrade script tests, `test/integration/test/upgrade-instructions/default-generators-to-on-create/`: before-and-after files for every function and argument form, a Prisma 7 file passed by mistake is left unchanged with a message, a file with no match is unchanged.

## Upgrade instructions

- `upgrade-instructions/pending/default-generators-to-on-create/app/instructions.md` with `scripts/rewrite-default-generators.mjs`: rewrites `@default(uuid(...))`, `@default(cuid(...))`, `@default(ulid())`, `@default(nanoid(...))` to `@onCreate(...)` in the Prisma 8 PSL files it is given. Detection: `**/*.prisma` matching `@default\((uuid|cuid|ulid|nanoid)\(`. The prose says not to pass a Prisma 7 schema read through `prisma7Schema(...)`, says contracts do not change, and shows the TypeScript `.onCreate(gen.uuid())` form as the replacement for `field.generated(...)` to come.
- `upgrade-instructions/pending/default-generators-to-on-create/extension/instructions.md`: a default function can no longer lower to a client generator; contribute a `GeneratorFunctionContribution` with bindings on the pack ref instead; `printArguments` and `applicableCodecIds` are gone; the `slugid` before and after. Detection: `kind:\s*'execution'`, `printArguments`, `applicableCodecIds`.
- Edit `upgrade-instructions/pending/contract-print-generated-values/extension/instructions.md`: it tells authors to add `printArguments` to default functions and describes preset print forms, both removed by this slice before release. Replace its two changes with a pointer to the new fragment.
- Run `pnpm check:upgrade-coverage --mode pr --prev origin/main --head HEAD`.

## Docs to update

- ADR 275: status Accepted.
- ADR 158: §1 "onUpdate is future work" done; §3 compatibility is the binding; §4 precedence covers `@default` with `@onCreate`.
- ADR 169 (Declared applicability for mutation default generators): §1 applicability is declared on bindings; §3 note and the `@default(uuid(7))` example become `@onCreate(uuid(7))`.
- ADR 231 and ADR 249: `@default` lists database functions only; `@onCreate` and `@onUpdate` specs; the spec context gains `generatorFunctions`.
- ADR 226, ADR 244: `@default(uuid())` examples. ADR 269: its `updatedAt DateTime @default(now())` example becomes `@onCreate(now()) @onUpdate(now())`.
- `docs/architecture docs/subsystems/6. Ecosystem Extensions & Packs.md`: how a pack contributes generator functions.
- `docs/architecture docs/subsystems/10. MongoDB Family.md`: `@onCreate`/`@onUpdate` in Mongo PSL.
- `docs/reference/error-reference.md`: three new codes (D14); the `CONTRACT.DEFAULT_INVALID` entry gains the TypeScript reasons of D5 and D10; `PSL_UNKNOWN_DEFAULT_FUNCTION` lists only database functions.
- READMEs: `packages/1-framework/2-authoring/psl-parser/README.md`, `packages/2-sql/2-authoring/contract-psl/README.md`, `packages/2-sql/2-authoring/contract-ts/README.md` (`gen`, `.onCreate`, `.onUpdate`), `packages/2-mongo-family/2-authoring/contract-ts/README.md`, `packages/2-sql/2-authoring/contract-prisma7/README.md` (how `@updatedAt` and client functions are read), `packages/3-extensions/postgres/README.md`, `packages/3-extensions/postgis/README.md`, `examples/prisma-8-postgis-demo/README.md`.
- `skills/prisma-8/references/contract.md` and `supabase.md`: the attribute forms.
- `scorecard/03-psl-schema-language.md`: the `@default(uuid())` row.

## Acceptance criteria

- The at-a-glance schema emits the stated generators on Postgres, and `contract print` writes it back as shown with equal hashes.
- `uuid()`, `cuid(2)`, `ulid()`, `nanoid()`, `ksuid()` in `@onCreate` work on every text-like codec of Postgres and SQLite; `uuid()` works on `Uuid`.
- `now()` in `@onCreate` and `@onUpdate` works on every Postgres date and time codec, SQLite `DateTime` and Mongo `DateTime`, with `precision` from the column on the three time codecs.
- `@default(<client function>())` is refused with `PSL_GENERATOR_IN_DEFAULT` and the `@onCreate` form.
- The attribute twins of the temporal fixtures emit the same storage and execution hashes as their preset originals, on Postgres and Mongo.
- `pnpm fixtures:check` shows no `contract.json` change after the `@default` rewrite.
- The Prisma 7 and Prisma 6 Mongo fixtures produce unchanged contracts.
- Every committed Postgres contract prints with attributes and round-trips.
- `@onCreate(` completes the functions bound to the field's codec in the language server.

## Non-goals

- Removing presets, `field.generated`, the `option` kind or the `select` template (slice 3).
- Alias expansion and attributes on aliases (slice 2). An alias still refuses every attribute.
- Contributed aliases such as `temporal.UpdatedAt` (slice 2).
- Length checks for fixed-output generators other than `nanoid` (D3).
- `ksuid()` in the Prisma 7 reader.

## Slice Definition of Done

Inherits `drive/calibration/dod.md`. Slice-specific:

- [ ] Every test above was red before its change and is green after.
- [ ] Touched packages pass `pnpm typecheck`, `pnpm lint` and `pnpm test --coverage`; `pnpm lint:deps`, `pnpm fixtures:check`, `pnpm lint:throws` and `pnpm check:upgrade-coverage --mode pr` pass.
- [ ] `/drive-code-review` run on the branch tip and its findings fixed.
- [ ] Manual QA: emit, print and re-emit `examples/prisma-8-demo` and the Mongo demo; type `@onCreate(` in the language server against a Postgres config.

## Dispatch plan

| # | Outcome | Hands to |
|---|---|---|
| 1 | D2, D3, D4: the registry in the framework, the SQL family definitions, the Postgres, SQLite and Mongo bindings, the control stack field; framework, family and target tests. | A green registry no consumer uses yet. |
| 2 | D6, D7, D8, D9, D5 in SQL PSL, plus the threading through config, CLI, psl-parser and the language server (D13); SQL PSL and language server tests. `@default(uuid())` refused. | SQL PSL on the new attributes; repository tests that use `@default(uuid())` red. |
| 3 | The app upgrade script with its tests, then run it over the file list in D1; inline PSL in tests moved by hand; `pnpm fixtures:check` clean. | Every Prisma 8 schema in the repository on `@onCreate`. |
| 4 | D10 in both TypeScript builders and the facades; D5 for TypeScript; type tests; `default-pack-slugid` parity. | TypeScript parity with PSL. |
| 5 | Mongo PSL (D7, D9, D14) and the two readers (D11); their tests and fixtures. | Every source on the registry. |
| 6 | D12 print, its tests and the round-trip integration files; the temporal attribute twins. | Print on attributes. |
| 7 | Extension fragment and the pending fragment edit; docs and ADR amendments; CI-equivalent checks; `/drive-code-review`. | Branch ready for review. |
