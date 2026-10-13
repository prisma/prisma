---
changes:
  - id: typescript-contract-pack-type-slots
    summary: |
      A contract built with `defineContract` reads its types from the packs in it. A third-party SQL pack is typed fully for such a contract only when it declares what an emitted `contract.d.ts` would get from its codecs and descriptors: `__queryOperationTypes` for its query operations, `__parameterizedOutputTypes` for codecs whose `renderOutputType` refines the output type by type parameters, literal-typed `types.aggregateDescriptors` for its aggregates, and exports from its `/pack` entry for the types an application's exported contract names. Nothing breaks for a pack that does none of this; its operations, refined output types and aggregates are missing from a `defineContract` contract's types, as before. The detection matches SQL pack metadata that declares codec types.
    detection:
      glob: "**/*.{ts,mts,cts}"
      matches:
        - '__codecTypes\?:'
---

# Make a SQL pack fully typed for contracts written in TypeScript

A contract built with `defineContract` now has the same types as the `contract.d.ts` that `prisma contract emit` writes for it. The emitter reads a pack's codecs and descriptors at run time. A contract written in TypeScript has only the pack's types, so a pack states as types what the emitter derives. The interfaces below are exported from `@prisma/orm-family-sql/contract/types`.

## Query operations: `__queryOperationTypes`

If your pack contributes query operations and exports a `QueryOperationTypes<CodecTypes>` type for its emitted `contract.d.ts`, declare it as a type-level function of the contract's codec types and add it to the pack metadata's type:

```ts
import type { QueryOperationTypesFunction } from '@prisma/orm-family-sql/contract/types';

export interface QueryOperationTypesForCodecs extends QueryOperationTypesFunction {
  readonly queryOperationTypes: QueryOperationTypes<this['codecTypes']>;
}

export const myPackMeta: typeof myPackMetaBase & {
  readonly __codecTypes?: CodecTypes;
  readonly __queryOperationTypes?: QueryOperationTypesForCodecs;
} = myPackMetaBase;
```

## Refined output types: `__parameterizedOutputTypes`

If a codec's `renderOutputType` writes a type that depends on the column's type parameters, such as `Vector<3>` for `vector(3)`, state the same mapping as a type-level function of the type parameters:

```ts
import type { ParameterizedOutputTypesFunction } from '@prisma/orm-family-sql/contract/types';

type OutputTypeMap<TypeParams> = {
  readonly 'my/vector@1': TypeParams extends { readonly length: infer N extends number }
    ? Vector<N>
    : never;
};

export interface ParameterizedOutputTypesForTypeParams extends ParameterizedOutputTypesFunction {
  readonly outputTypes: OutputTypeMap<this['typeParams']>;
}
```

and add `readonly __parameterizedOutputTypes?: ParameterizedOutputTypesForTypeParams` to the pack metadata's type. A codec the map leaves out, or maps to `never`, keeps its plain output type. Keep the map and `renderOutputType` in agreement: the emitted type and the TypeScript contract's type should be the same.

A column helper that returns a column spec, built with `column(factory, codecId, typeParams)`, needs no entry: a `defineContract` contract reads the field's output type and codec id from the codec the factory builds.

## Aggregates: literal `types.aggregateDescriptors`

The aggregate result types of a `defineContract` contract are settled from the `types.aggregateDescriptors` of the target, the adapter and every extension, against the contract's codecs, as emission settles them. Only descriptors whose `operation`, input codec ids or traits, output codec id and `nullable` are literal types take part. Declare the list with `as const` and no annotation that widens it:

```ts
export const myAggregateDescriptors = [
  {
    operation: 'bitOr',
    input: { kind: 'codec', codecId: 'pg/int4@1' },
    output: { kind: 'codec', codecId: 'pg/int8@1' },
    nullable: true,
  },
] as const;
```

If you build descriptors with helper functions, make the helpers generic with `const` type parameters and do not use `satisfies` inside them: TypeScript widens a generic helper's result to its constraint when its returned object has a `satisfies` clause. Check the list against the descriptor type where you use it, for example `types: { aggregateDescriptors: myAggregateDescriptors satisfies ReadonlyArray<SqlAggregateDescriptor> }`.

## Index helpers: say what the build writes

A contract built with `defineContract` types each index from the `IndexConstraint` a helper returns, so code reads it by name and passes it to query operations. `IndexConstraint` takes a third type parameter, the index's `map` name, type and options as the build writes them. If your pack adds an index helper, return `IndexConstraint<FieldNames, Name, { readonly map: Map; readonly type: 'yourType'; readonly options: Options }>` with literal types. When the options name fields that the build turns into column names, give an interface extending `IndexOptionsFunction` from `@prisma/orm-family-sql/contract-ts/contract-builder`, whose `options` reads `this['columnOf']`, the model's field-to-column map. See `fullTextIndex` in the Postgres pack.

## Declaration output: export what a contract names

An application that exports a contract and builds with `declaration: true` needs TypeScript to name every type the contract's inferred type mentions. Export from your pack's `/pack` entry, as types, the types that end up there: your `CodecTypes`, the output types your codecs refine to (such as `Vector`), `QueryOperationTypesForCodecs`, `ParameterizedOutputTypesForTypeParams`, and the value types your codec types name (such as a GeoJSON `Geometry`). Naming `CodecTypes` also keeps TypeScript from inlining codec classes with private members, which fails with TS4094. Compile a small application that imports only your published package and the public `@prisma/orm-postgres` with `declaration: true` to check.
