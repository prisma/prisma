import type {
  ParameterizedOutputType,
  ParameterizedOutputTypesFunction,
} from '@internal/contract/types';

export type ValueTypeSide = 'output' | 'input';

type Lookup<T, Key> = Key extends keyof T ? T[Key] : never;

type NonEmptyTypeParams<TypeParams> =
  TypeParams extends Record<string, unknown>
    ? keyof TypeParams extends never
      ? undefined
      : TypeParams
    : undefined;

type PlainCodecType<
  CodecTypes,
  CodecId,
  Side extends ValueTypeSide,
> = CodecId extends keyof CodecTypes
  ? CodecTypes[CodecId] extends { readonly [S in Side]: infer Plain }
    ? Plain
    : unknown
  : unknown;

type CodecType<
  CodecTypes,
  CodecId,
  TypeParams,
  ParameterizedOutputs extends ParameterizedOutputTypesFunction,
  Side extends ValueTypeSide,
> = Side extends 'output'
  ? NonEmptyTypeParams<TypeParams> extends infer Params extends Record<string, unknown>
    ? ParameterizedOutputType<
        ParameterizedOutputs,
        CodecId,
        Params,
        PlainCodecType<CodecTypes, CodecId, Side>
      >
    : PlainCodecType<CodecTypes, CodecId, Side>
  : PlainCodecType<CodecTypes, CodecId, Side>;

type BaseType<Known, Codec, Side extends ValueTypeSide> = [Known] extends [never]
  ? Codec
  : Known extends { readonly [S in Side]: infer T }
    ? T
    : Codec;

type WithList<Base, Item> = Item extends {
  readonly many: { readonly elementNullable: infer ElementNullable };
}
  ? ReadonlyArray<Base | (ElementNullable extends true ? null : never)>
  : Base;

type WithModifiers<Base, Item> =
  | (Item extends { readonly dict: true }
      ? Readonly<Record<string, WithList<Base, Item>>>
      : WithList<Base, Item>)
  | (Item extends { readonly nullable: true } ? null : never);

type ValueType<
  Item,
  CodecId,
  TypeParams,
  Known,
  CodecTypes,
  ParameterizedOutputs extends ParameterizedOutputTypesFunction,
  Side extends ValueTypeSide,
> = WithModifiers<
  BaseType<Known, CodecType<CodecTypes, CodecId, TypeParams, ParameterizedOutputs, Side>, Side>,
  Item
>;

type FieldScalarType<Field> = Lookup<Field, 'type'>;

type TypeParamsOf<T> = T extends { readonly typeParams: infer TypeParams } ? TypeParams : undefined;

type ClosedWhenEmpty<T> = [keyof T] extends [never] ? Record<string, never> : T;

type ModelFieldTypes<
  Fields,
  KnownForModel,
  CodecTypes,
  ParameterizedOutputs extends ParameterizedOutputTypesFunction,
  Side extends ValueTypeSide,
> = {
  readonly [F in keyof Fields]: ValueType<
    Fields[F],
    Lookup<FieldScalarType<Fields[F]>, 'codecId'>,
    TypeParamsOf<FieldScalarType<Fields[F]>>,
    Lookup<KnownForModel, F>,
    CodecTypes,
    ParameterizedOutputs,
    Side
  >;
};

/**
 * `FieldOutputTypes` (`Side` `'output'`) or `FieldInputTypes` (`'input'`) of a contract whose domain namespaces are `DomainNamespaces`, computed from the contract's literal shape. A contract written with `defineContract` types its field and storage column maps through this and {@link ColumnTypesFromStorage}.
 *
 * Each value is typed by, in order:
 *
 * 1. its known type for that side, when `KnownTypes` gives one at `[namespace][model][field]` as `{ output?, input? }`: the members of the enum a field holds, or the type a column spec's codec reads;
 * 2. on the output side, the type a pack's type function in `ParameterizedOutputs` gives a column with its type parameters (`ParameterizedOutputType`);
 * 3. its codec's `output` or `input` type, or `unknown` for a codec `CodecTypes` lacks;
 *
 * then wrapped in `ReadonlyArray` for a list and in `Readonly<Record<string, …>>` for a dictionary, with `null` for a nullable element or value. A model without fields has `{}` output types and `Record<string, never>` input types.
 */
export type FieldTypesFromDomain<
  DomainNamespaces,
  CodecTypes,
  ParameterizedOutputs extends ParameterizedOutputTypesFunction,
  KnownTypes,
  Side extends ValueTypeSide,
> = {
  readonly [Ns in keyof DomainNamespaces]: {
    readonly [M in keyof Lookup<DomainNamespaces[Ns], 'models'>]: ModelFieldTypes<
      Lookup<Lookup<DomainNamespaces[Ns], 'models'>[M], 'fields'>,
      Lookup<Lookup<KnownTypes, Ns>, M>,
      CodecTypes,
      ParameterizedOutputs,
      Side
    > extends infer Types
      ? Side extends 'input'
        ? ClosedWhenEmpty<Types>
        : Types
      : never;
  };
};

type ColumnTypeParams<Column, StorageTypes> = Column extends {
  readonly typeParams: infer TypeParams;
}
  ? TypeParams
  : Column extends { readonly typeRef: infer TypeRef }
    ? TypeParamsOf<Lookup<StorageTypes, TypeRef>>
    : undefined;

type TablesOf<Namespace> = Lookup<Lookup<Namespace, 'entries'>, 'table'>;

/**
 * `StorageColumnTypes` (`Side` `'output'`) or `StorageColumnInputTypes` (`'input'`) of a contract whose storage is `Storage`, by the rules of {@link FieldTypesFromDomain}, with `KnownTypes` keyed by namespace, table and column. A column typed by a named storage type takes that type's parameters.
 */
export type ColumnTypesFromStorage<
  Storage,
  CodecTypes,
  ParameterizedOutputs extends ParameterizedOutputTypesFunction,
  KnownTypes,
  Side extends ValueTypeSide,
> = {
  readonly [Ns in keyof Lookup<Storage, 'namespaces'>]: {
    readonly [T in keyof TablesOf<Lookup<Storage, 'namespaces'>[Ns]>]: {
      readonly [C in keyof Lookup<
        TablesOf<Lookup<Storage, 'namespaces'>[Ns]>[T],
        'columns'
      >]: Lookup<TablesOf<Lookup<Storage, 'namespaces'>[Ns]>[T], 'columns'>[C] extends infer Column
        ? ValueType<
            Column,
            Lookup<Column, 'codecId'>,
            ColumnTypeParams<Column, NonNullable<Lookup<Storage, 'types'>>>,
            Lookup<Lookup<Lookup<KnownTypes, Ns>, T>, C>,
            CodecTypes,
            ParameterizedOutputs,
            Side
          >
        : never;
    };
  };
};
