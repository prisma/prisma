---
changes:
  - id: generator-applicable-data-types
    summary: |
      `MutationDefaultGeneratorDescriptor.applicableCodecIds` (`@prisma/orm-framework/components/control`) is replaced by `applicableDataTypes`, a list of data type ids. One entry covers every codec of that data type. A descriptor that still sets `applicableCodecIds` is treated as having no list, so `@default(...)` refuses the generator with the message that points at the field preset.
    detection:
      glob: "**/*.{ts,mts,cts,tsx,js,mjs,cjs}"
      matches:
        - '\bapplicableCodecIds\b'
  - id: builtin-generator-metadata-writes-uuid
    summary: |
      `builtinGeneratorRegistryMetadata` (`@prisma/orm-framework/ids`) gives `{ id, writesUuid }` for each built-in generator instead of `{ id, applicableCodecIds }`. A SQL target builds its descriptors with `sqlBuiltinGeneratorDescriptors({ text, uuid })` from `@prisma/orm-family-sql/family/control`, passing its own data types.
    detection:
      glob: "**/*.{ts,mts,cts,tsx,js,mjs,cjs}"
      matches:
        - '\bbuiltinGeneratorRegistryMetadata\b'
  - id: generator-applicability-names-data-type
    summary: |
      `PSL_INVALID_DEFAULT_APPLICABILITY` names the column's data type instead of its codec: `... with data type "pg/int4".` where it said `... with codecId "pg/int4@1".`
    detection:
      glob: "**/*.{ts,mts,cts,tsx,js,mjs,cjs}"
      matches:
        - '\bwith codecId \\?"'
  - id: default-function-signature-from-data-types
    summary: |
      A default function's `signature` in a `defaultFunctionRegistry` entry may now be a function of the stack's data types that returns the `FuncCallSig`, as the SQL family's `uuid`, `cuid` and `nanoid` are. Code that reads `entry.signature` as a `FuncCallSig` builds it with `defaultFunctionCall(name, entry, dataTypes)` from `@prisma/orm-family-sql/contract-psl/attribute-specs`, or calls the signature when it is a function. A registered plain object still works.
    detection:
      glob: "**/*.{ts,mts,cts,tsx,js,mjs,cjs}"
      matches:
        - '(?<![\s\S])(?=[\s\S]*\bdefaultFunctionRegistry\b)[\s\S]*\.signature\b'
  - id: arg-binding-spec-label
    summary: |
      `ArgBindingSpec` (`@prisma/orm-framework/psl-parser`), the second argument of `interpretArgs`, names its callee with `label`, the whole phrase such as `Attribute "rel"`, instead of `name`. `funcCall(name, signature, { label })` takes the phrase its binding diagnostics use; without it they say `Attribute "<name>"` as before.
    detection:
      glob: "**/*.{ts,mts,cts,tsx,js,mjs,cjs}"
      matches:
        - '\binterpretArgs\s*\('
        - '\bArgBindingSpec\b'
  - id: one-of-refuses-data-type-value
    summary: |
      `oneOf` (`@prisma/orm-framework/psl-parser`) throws an `InternalError` when one of its arms is a `dataTypeValue`. Give the value its own parameter, or use it as a parameter of a `funcCall` arm.
    detection:
      glob: "**/*.{ts,mts,cts,tsx,js,mjs,cjs}"
      matches:
        - '\boneOf\([^;]*\bdataTypeValue\('
  - id: text-data-types
    summary: |
      A component's authoring contributions may name `textDataTypes`, the data types whose values are text. Only SQL `@@discriminator` reads the list: a discriminator field must be stored in one of them. An extension that adds a text type and wants it usable as a discriminator names it there. The built-in ID generators apply only to the data types the target passes to `sqlBuiltinGeneratorDescriptors`.
---

## `generator-applicable-data-types`

```ts
// Before
generatorDescriptors: [{ id: 'slugid', applicableCodecIds: ['pg/text@1'] }],

// After
import { dataTypeId } from '@prisma/orm-framework/components/codec';

generatorDescriptors: [{ id: 'slugid', applicableDataTypes: [dataTypeId('pg/text')] }],
```

The check compares the column's data type, the one its codec declares, so a codec of `pg/text` from any pack takes the generator. A generator reachable only through a field preset still leaves the list out.

## `builtin-generator-metadata-writes-uuid`

```ts
// Before
generatorDescriptors: builtinGeneratorRegistryMetadata.map(({ id, applicableCodecIds }) => ({
  id,
  applicableCodecIds,
})),

// After
import { sqlBuiltinGeneratorDescriptors } from '@prisma/orm-family-sql/family/control';
import { pgChar, pgText, pgUuid, pgVarchar } from '@prisma/orm-postgres/target/data-types';

generatorDescriptors: sqlBuiltinGeneratorDescriptors({
  text: [pgText.id, pgChar.id, pgVarchar.id],
  uuid: [pgUuid.id],
}),
```

`writesUuid` is `true` for `uuidv4` and `uuidv7`, which also apply to the `uuid` data types.

## `default-function-signature-from-data-types`

```ts
// Before
const signature = entry.signature as FuncCallSig;
const arm = funcCall(name, signature);

// After
import { defaultFunctionCall } from '@prisma/orm-family-sql/contract-psl/attribute-specs';

const arm = defaultFunctionCall(name, entry, dataTypes);
```

A function you register can keep a plain `FuncCallSig`. Write it as `(dataTypes) => FuncCallSig` when an argument is a value of a data type, read with `dataTypeValue(type, dataTypes)`.

## `arg-binding-spec-label`

```ts
// Before
interpretArgs(args, { name: 'rel', positional, named }, ctx, span, node);

// After
interpretArgs(args, { label: 'Attribute "rel"', positional, named }, ctx, span, node);
```

## `one-of-refuses-data-type-value`

```ts
// Before
type: oneOf(str(), dataTypeValue(pgInt4.id, dataTypes)),

// After: a value of a data type is its own parameter
type: dataTypeValue(pgInt4.id, dataTypes),
```

## `text-data-types`

```ts
authoring: {
  textDataTypes: [citext.id],
},
```
