import type {
  ParameterizedOutputType,
  ParameterizedOutputTypesFunction,
} from './parameterized-output-types';

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

type BaseType<Override, Base, Side extends ValueTypeSide> = [Override] extends [never]
  ? Base
  : Override extends { readonly [S in Side]: infer T }
    ? T
    : Base;

type WithList<Base, Item> = Item extends {
  readonly many: { readonly elementNullable: infer ElementNullable };
}
  ? ReadonlyArray<Base | (ElementNullable extends true ? null : never)>
  : Base;

type WithListOrDictionary<Base, Item> = Item extends { readonly dict: true }
  ? Readonly<Record<string, WithList<Base, Item>>>
  : WithList<Base, Item>;

type Nullability<Item> = Item extends { readonly nullable: true } ? null : never;

// The union is written here, and read through an indexed access, so TypeScript prints the resolved type, such as `bigint | null`, in hovers and errors instead of this file's generics.
type WrappedValueType<Item, Base> =
  | WithListOrDictionary<Base, Item>
  | Nullability<Item> extends infer Value
  ? { readonly [K in 'value']: Value }['value']
  : never;

/**
 * The type of one value of codec `CodecId`, held by `Item` (a field or a storage entry with `nullable`, and optionally `many` and `dict`), on the output or input side: `Override` for that side when it gives one, else the type a type function in `ParameterizedOutputs` gives a value with these type parameters (output side only), else the codec's type in `CodecTypes`, or `unknown` for a codec it lacks; then wrapped for a list, a dictionary and nullability. A family's storage type maps apply it to each storage entry.
 */
export type CodecValueType<
  Item,
  CodecId,
  TypeParams,
  Override,
  CodecTypes,
  ParameterizedOutputs extends ParameterizedOutputTypesFunction,
  Side extends ValueTypeSide,
> = WrappedValueType<
  Item,
  BaseType<Override, CodecType<CodecTypes, CodecId, TypeParams, ParameterizedOutputs, Side>, Side>
>;

type TypeParamsOf<T> = T extends { readonly typeParams: infer TypeParams } ? TypeParams : undefined;

type ClosedWhenEmpty<T> = [keyof T] extends [never] ? Record<string, never> : T;

type ValueObjectType<
  ValueObject,
  ValueObjects,
  CodecTypes,
  ParameterizedOutputs extends ParameterizedOutputTypesFunction,
  Side extends ValueTypeSide,
> = ClosedWhenEmpty<{
  readonly [F in keyof Lookup<ValueObject, 'fields'>]: FieldValueType<
    Lookup<ValueObject, 'fields'>[F],
    never,
    ValueObjects,
    CodecTypes,
    ParameterizedOutputs,
    Side
  >;
}>;

type ElementType<
  FieldType,
  ValueObjects,
  CodecTypes,
  ParameterizedOutputs extends ParameterizedOutputTypesFunction,
  Side extends ValueTypeSide,
> = FieldType extends { readonly kind: 'scalar'; readonly codecId: infer CodecId }
  ? CodecType<CodecTypes, CodecId, TypeParamsOf<FieldType>, ParameterizedOutputs, Side>
  : FieldType extends { readonly kind: 'valueObject'; readonly name: infer Name }
    ? ValueObjectType<
        Lookup<ValueObjects, Name>,
        ValueObjects,
        CodecTypes,
        ParameterizedOutputs,
        Side
      >
    : FieldType extends {
          readonly kind: 'union';
          readonly members: infer Members extends readonly unknown[];
        }
      ? UnionMemberType<Members[number], ValueObjects, CodecTypes, ParameterizedOutputs, Side>
      : unknown;

type UnionMemberType<
  Member,
  ValueObjects,
  CodecTypes,
  ParameterizedOutputs extends ParameterizedOutputTypesFunction,
  Side extends ValueTypeSide,
> = Member extends { readonly kind: 'scalar'; readonly codecId: infer CodecId }
  ? PlainCodecType<CodecTypes, CodecId, Side>
  : ElementType<Member, ValueObjects, CodecTypes, ParameterizedOutputs, Side>;

type FieldValueType<
  Field,
  Override,
  ValueObjects,
  CodecTypes,
  ParameterizedOutputs extends ParameterizedOutputTypesFunction,
  Side extends ValueTypeSide,
> = WrappedValueType<
  Field,
  BaseType<
    Override,
    ElementType<Lookup<Field, 'type'>, ValueObjects, CodecTypes, ParameterizedOutputs, Side>,
    Side
  >
>;

type ModelFieldTypes<
  Fields,
  OverridesForModel,
  ValueObjects,
  CodecTypes,
  ParameterizedOutputs extends ParameterizedOutputTypesFunction,
  Side extends ValueTypeSide,
> = {
  readonly [F in keyof Fields]: FieldValueType<
    Fields[F],
    Lookup<OverridesForModel, F>,
    ValueObjects,
    CodecTypes,
    ParameterizedOutputs,
    Side
  >;
};

type NamespaceValueObjects<Namespace> = Lookup<Namespace, 'valueObjects'>;

/**
 * `FieldOutputTypes` (`Side` `'output'`) or `FieldInputTypes` (`'input'`) of a contract whose domain namespaces are `DomainNamespaces`, computed from the contract's literal shape. Both an emitted `contract.d.ts` and a contract written with `defineContract` type their fields through it.
 *
 * Each value is typed by, in order:
 *
 * 1. its override for that side, when `Overrides` gives one at `[namespace][model][field]` as `{ output?, input? }`: the members of the value set a field holds, or the type its codec gives as text;
 * 2. for a scalar field, on the output side, the type a pack's type function in `ParameterizedOutputs` gives it for its type parameters (`ParameterizedOutputType`), else its codec's `output` or `input` type, or `unknown` for a codec `CodecTypes` lacks;
 * 3. for a value object field, an object of the value object's field types from the same namespace's `valueObjects`, computed by these rules without overrides;
 * 4. for a union field, the union of its members' types, each a codec's plain type or a value object's type;
 *
 * then wrapped in `ReadonlyArray` for a list and in `Readonly<Record<string, …>>` for a dictionary, with `null` for a nullable element or value. A model without fields has `{}` output types and `Record<string, never>` input types; a value object without fields has `Record<string, never>` on both sides.
 */
export type FieldTypesFromDomain<
  DomainNamespaces,
  CodecTypes,
  ParameterizedOutputs extends ParameterizedOutputTypesFunction,
  Overrides,
  Side extends ValueTypeSide,
> = {
  readonly [Ns in keyof DomainNamespaces]: {
    readonly [M in keyof Lookup<DomainNamespaces[Ns], 'models'>]: ModelFieldTypes<
      Lookup<Lookup<DomainNamespaces[Ns], 'models'>[M], 'fields'>,
      Lookup<Lookup<Overrides, Ns>, M>,
      NamespaceValueObjects<DomainNamespaces[Ns]>,
      CodecTypes,
      ParameterizedOutputs,
      Side
    > extends infer Types
      ? // Mapped again here, so hovers and errors show the field types, not the generic.
        { readonly [F in keyof Types]: Types[F] } extends infer Resolved
        ? Side extends 'input'
          ? ClosedWhenEmpty<Resolved>
          : Resolved
        : never
      : never;
  };
};

/**
 * The output (`Side` `'output'`) or input (`'input'`) type of each value object of a contract whose domain namespaces are `DomainNamespaces`, keyed by namespace and value object name, by the rules of {@link FieldTypesFromDomain}.
 */
export type ValueObjectTypesFromDomain<
  DomainNamespaces,
  CodecTypes,
  ParameterizedOutputs extends ParameterizedOutputTypesFunction,
  Side extends ValueTypeSide,
> = {
  readonly [Ns in keyof DomainNamespaces]: {
    readonly [V in keyof NamespaceValueObjects<DomainNamespaces[Ns]>]: ValueObjectType<
      NamespaceValueObjects<DomainNamespaces[Ns]>[V],
      NamespaceValueObjects<DomainNamespaces[Ns]>,
      CodecTypes,
      ParameterizedOutputs,
      Side
    >;
  };
};
