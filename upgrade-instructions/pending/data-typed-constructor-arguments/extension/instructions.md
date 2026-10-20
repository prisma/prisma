---
changes:
  - id: value-arguments-name-a-data-type
    summary: |
      A type constructor's argument that is a value is declared `{ kind: 'value', dataType }`,
      naming the data type the argument's value belongs to, such as `pg/int4` for a Postgres length,
      precision, scale or SRID. The argument kinds `string`, `boolean` and `stringArray` are
      removed, and a type constructor's `number` argument becomes a `value` argument. Drop
      `integer`, `minimum` and `maximum`: the data type's parameter schema checks the value.
    detection:
      glob: "**/*.{ts,mts,cts}"
      matches:
        - "kind:\\s*['\"](?:string|boolean|stringArray)['\"]\\s*,\\s*name:"
        - "kind:\\s*['\"]number['\"]\\s*,\\s*name:"
  - id: value-argument-types-in-typescript
    summary: |
      The TypeScript builder types a `value` argument through `__dataTypeArguments`, a map a pack
      declares in its type from each data type it registers to `{ input, canonical }`. A pack that
      registers a data type its own type constructors take must declare it, or the argument types
      as `never`.
  - id: psl-and-print-helpers-take-data-types
    summary: |
      `mapPslHelperArgs` and `instantiatePslFieldPreset` take the stack's `dataTypes`;
      `parsePslPositionalArgs` and `pslTypeArgumentText` are removed. `inferColumnTypes` takes
      `dataTypes`, and its `PslTypeCall` carries the argument `values`. `writtenTypeArguments` writes
      a call's arguments as literals of their data types. `sql.String` is no longer in the SQL
      family pack: a SQL target contributes it with
      `sqlTargetTypeConstructors({ sizeType })`, and `temporalCodecPresetWithPrecision` takes
      `sizeType` too.
    detection:
      glob: "**/*.{ts,mts,cts}"
      matches:
        - 'parsePslPositionalArgs|pslTypeArgumentText'
        - 'temporalCodecPresetWithPrecision\('
---

# Type-constructor arguments are values of data types

## `value-arguments-name-a-data-type`

An argument is read as a value of its data type, through the same read and cast as an attribute argument (ADR 254), in PSL and in the TypeScript builder. Name the data type the argument takes:

```ts
// Before
Vector: {
  kind: 'typeConstructor',
  args: [{ kind: 'number', name: 'length', integer: true, minimum: 1, maximum: 16000 }],
  output: { codecId: 'pg/vector@1', typeParams: { length: { kind: 'arg', index: 0 } } },
},

// After
Vector: {
  kind: 'typeConstructor',
  args: [{ kind: 'value', dataType: 'pg/int4', name: 'length' }],
  output: { codecId: 'pg/vector@1', typeParams: { length: { kind: 'arg', index: 0 } } },
},
```

Move any bound the argument carried to the data type's `params` schema, which the codec's `paramsSchema` references. A string argument becomes a value of the data type it names; an argument that holds SQL, such as a type name, is a value of `sql/expression`, written ``sql`...` ``. The data type must be registered in the stack and written by some authoring entry, itself or through a type it casts from: assembly refuses a value argument otherwise, with `CONTRACT.DATA_TYPE_UNREGISTERED` or `CONTRACT.DATA_TYPE_NOT_WRITABLE`.

## `value-argument-types-in-typescript`

A target or extension that registers a data type its arguments take declares the TypeScript value in its pack's type, beside `__codecTypes`:

```ts
export const myTargetPack: typeof myTargetPackBase & {
  readonly __codecTypes?: CodecTypes;
  readonly __dataTypeArguments?: {
    readonly 'my/int': { readonly argument: number; readonly parameter: number };
  };
} = myTargetPackBase;
```

An extension whose arguments take the target's types, such as `pg/int4`, declares nothing.

## `psl-and-print-helpers-take-data-types`

Pass the stack's `DataTypeSupport` to `mapPslHelperArgs({ ..., dataTypes })` and `instantiatePslFieldPreset({ ..., dataTypes })`. Replace `parsePslPositionalArgs` with the values of the call you built, and `pslTypeArgumentText` with `writtenTypeArguments(descriptor, args, dataTypes)`. A SQL target spreads `sqlTargetTypeConstructors({ sizeType: '<its whole-number data type>' })` from `@prisma/orm-family-sql/family/pack` into its type namespace, and passes the same `sizeType` to `temporalCodecPresetWithPrecision`.
