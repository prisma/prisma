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

/**
 * The type of the value one storage entry holds, after its override, its list or dictionary wrapping and its nullability. `Item` is the entry, with `nullable` and optionally `many` and `dict`, holding values of codec `CodecId`. On each side the value is typed by `Override` for that side when it gives one, else, on the output side, by the type a type function in `ParameterizedOutputs` gives a value with these type parameters, else by the codec's type in `CodecTypes`, or `unknown` for a codec it lacks. A family's storage type maps apply it to each storage entry.
 */
export type StoredValueType<
  Item,
  CodecId,
  TypeParams,
  Override,
  CodecTypes,
  ParameterizedOutputs extends ParameterizedOutputTypesFunction,
  Side extends ValueTypeSide,
> = Item extends {
  readonly nullable: infer Nullable;
  readonly many?: infer Many;
  readonly dict?: infer Dictionary;
}
  ? ModifiedValueType<
      BaseType<
        Override,
        CodecType<CodecTypes, CodecId, TypeParams, ParameterizedOutputs, Side>,
        Side
      >,
      Nullable,
      Many,
      Dictionary
    >
  : never;

type ClosedWhenEmpty<T> = [keyof T] extends [never] ? Record<string, never> : T;

// A model without fields has `{}` output types, and `Record<string, never>` input types, since TypeScript accepts any object where `{}` is expected.
type InputClosedWhenEmpty<Side extends ValueTypeSide, T> = Side extends 'input'
  ? ClosedWhenEmpty<T>
  : T;

// What a field's type is read against: the namespace's value objects, and the overrides of their fields, keyed by value object and field.
type Scope<ValueObjects, ValueObjectOverrides> = {
  readonly valueObjects: ValueObjects;
  readonly overrides: ValueObjectOverrides;
};

type ValueObjectType<
  Name,
  NamespaceScope,
  CodecTypes,
  ParameterizedOutputs extends ParameterizedOutputTypesFunction,
  Side extends ValueTypeSide,
> = ClosedWhenEmpty<{
  readonly [F in keyof Lookup<
    Lookup<Lookup<NamespaceScope, 'valueObjects'>, Name>,
    'fields'
  >]: FieldValueType<
    Lookup<Lookup<Lookup<NamespaceScope, 'valueObjects'>, Name>, 'fields'>[F],
    Lookup<Lookup<Lookup<NamespaceScope, 'overrides'>, Name>, F>,
    NamespaceScope,
    CodecTypes,
    ParameterizedOutputs,
    Side
  >;
}>;

// The type of a value object, a union, or a field of a kind this file does not know, before modifiers. Scalar fields are typed by `ScalarValueType`.
type ElementType<
  FieldType,
  NamespaceScope,
  CodecTypes,
  ParameterizedOutputs extends ParameterizedOutputTypesFunction,
  Side extends ValueTypeSide,
> = FieldType extends { readonly kind: 'valueObject'; readonly name: infer Name }
  ? ValueObjectType<Name, NamespaceScope, CodecTypes, ParameterizedOutputs, Side>
  : FieldType extends {
        readonly kind: 'union';
        readonly members: infer Members extends readonly unknown[];
      }
    ? UnionMemberType<Members[number], NamespaceScope, CodecTypes, ParameterizedOutputs, Side>
    : unknown;

type UnionMemberType<
  Member,
  NamespaceScope,
  CodecTypes,
  ParameterizedOutputs extends ParameterizedOutputTypesFunction,
  Side extends ValueTypeSide,
> = Member extends { readonly kind: 'scalar'; readonly codecId: infer CodecId }
  ? PlainCodecType<CodecTypes, CodecId, Side>
  : ElementType<Member, NamespaceScope, CodecTypes, ParameterizedOutputs, Side>;

type Listed<Base, Many> = [Many] extends [{ readonly elementNullable: infer ElementNullable }]
  ? ReadonlyArray<Base | (ElementNullable extends true ? null : never)>
  : Base;

// The union is written here, and read through an indexed access, so TypeScript prints the resolved type, such as `bigint | null`, in hovers and errors instead of this file's generics.
type ModifiedValueType<Base, Nullable, Many, Dictionary> =
  | ([Dictionary] extends [true]
      ? Readonly<Record<string, Listed<Base, Many>>>
      : Listed<Base, Many>)
  | ([Nullable] extends [true] ? null : never) extends infer Value
  ? { readonly [K in 'value']: Value }['value']
  : never;

// A scalar field's value from its parts, which are literals, so fields with the same codec and modifiers share one instantiation.
type ScalarValueType<
  CodecId,
  TypeParams,
  Override,
  Nullable,
  Many,
  Dictionary,
  CodecTypes,
  ParameterizedOutputs extends ParameterizedOutputTypesFunction,
  Side extends ValueTypeSide,
> = ModifiedValueType<
  BaseType<Override, CodecType<CodecTypes, CodecId, TypeParams, ParameterizedOutputs, Side>, Side>,
  Nullable,
  Many,
  Dictionary
>;

type FieldValueType<
  Field,
  Override,
  NamespaceScope,
  CodecTypes,
  ParameterizedOutputs extends ParameterizedOutputTypesFunction,
  Side extends ValueTypeSide,
> = Field extends {
  readonly type: {
    readonly kind: 'scalar';
    readonly codecId: infer CodecId;
    readonly typeParams?: infer TypeParams;
  };
  readonly nullable: infer Nullable;
  readonly many?: infer Many;
  readonly dict?: infer Dictionary;
}
  ? ScalarValueType<
      CodecId,
      TypeParams,
      Override,
      Nullable,
      Many,
      Dictionary,
      CodecTypes,
      ParameterizedOutputs,
      Side
    >
  : Field extends {
        readonly type: { readonly kind: 'valueObject'; readonly name: infer Name };
        readonly nullable: infer Nullable;
        readonly many?: infer Many;
        readonly dict?: infer Dictionary;
      }
    ? ModifiedValueType<
        BaseType<
          Override,
          ValueObjectType<Name, NamespaceScope, CodecTypes, ParameterizedOutputs, Side>,
          Side
        >,
        Nullable,
        Many,
        Dictionary
      >
    : Field extends {
          readonly type: infer FieldType;
          readonly nullable: infer Nullable;
          readonly many?: infer Many;
          readonly dict?: infer Dictionary;
        }
      ? ModifiedValueType<
          BaseType<
            Override,
            ElementType<FieldType, NamespaceScope, CodecTypes, ParameterizedOutputs, Side>,
            Side
          >,
          Nullable,
          Many,
          Dictionary
        >
      : never;

type NamespaceScopeOf<DomainNamespaces, Ns, ValueObjectOverrides> = Scope<
  Lookup<Lookup<DomainNamespaces, Ns>, 'valueObjects'>,
  Lookup<ValueObjectOverrides, Ns>
>;

/**
 * `FieldOutputTypes` (`Side` `'output'`) or `FieldInputTypes` (`'input'`) of a contract whose domain namespaces are `DomainNamespaces`, computed from the contract's literal shape. Both an emitted `contract.d.ts` and a contract written with `defineContract` type their fields through it.
 *
 * Each value is typed by, in order:
 *
 * 1. its override for that side, `{ output?, input? }`, from `Overrides` at `[namespace][model][field]` for a model field, or from `ValueObjectOverrides` at `[namespace][valueObject][field]` for a value object field. An override is the type of a field that the contract's shape and the codec types cannot give: the members of the value set it holds, the type its codec renders as text, or the type the codec of a SQL column spec reads;
 * 2. for a scalar field, on the output side, the type a pack's type function in `ParameterizedOutputs` gives it for its type parameters (`ParameterizedOutputType`), else its codec's `output` or `input` type, or `unknown` for a codec `CodecTypes` lacks;
 * 3. for a value object field, an object of the value object's field types from the same namespace's `valueObjects`, computed by these rules;
 * 4. for a union field, the union of its members' types, each a codec's plain type or a value object's type;
 *
 * then wrapped in `ReadonlyArray` for a list and in `Readonly<Record<string, …>>` for a dictionary, with `null` for a nullable element or value. A model without fields has `{}` output types and `Record<string, never>` input types; a value object without fields has `Record<string, never>` on both sides.
 */
export type FieldTypesFromDomain<
  DomainNamespaces,
  CodecTypes,
  ParameterizedOutputs extends ParameterizedOutputTypesFunction,
  Overrides,
  ValueObjectOverrides,
  Side extends ValueTypeSide,
> = {
  readonly [Ns in keyof DomainNamespaces]: NamespaceFieldTypes<
    Lookup<DomainNamespaces[Ns], 'models'>,
    Lookup<Overrides, Ns>,
    NamespaceScopeOf<DomainNamespaces, Ns, ValueObjectOverrides>,
    CodecTypes,
    ParameterizedOutputs,
    Side
  >;
};

type NamespaceFieldTypes<
  Models,
  NamespaceOverrides,
  NamespaceScope,
  CodecTypes,
  ParameterizedOutputs extends ParameterizedOutputTypesFunction,
  Side extends ValueTypeSide,
> = {
  readonly [M in keyof Models]: Lookup<Models[M], 'fields'> extends infer Fields
    ? [Fields] extends [never]
      ? never
      : // The fields are a mapped type written here, not an alias, so hovers and errors show the field types.
        InputClosedWhenEmpty<
          Side,
          {
            readonly [F in keyof Fields]: FieldValueType<
              Fields[F],
              Lookup<Lookup<NamespaceOverrides, M>, F>,
              NamespaceScope,
              CodecTypes,
              ParameterizedOutputs,
              Side
            >;
          }
        >
    : never;
};

/**
 * The output (`Side` `'output'`) or input (`'input'`) type of each value object of a contract whose domain namespaces are `DomainNamespaces`, keyed by namespace and value object name, by the rules of {@link FieldTypesFromDomain}.
 */
export type ValueObjectTypesFromDomain<
  DomainNamespaces,
  CodecTypes,
  ParameterizedOutputs extends ParameterizedOutputTypesFunction,
  ValueObjectOverrides,
  Side extends ValueTypeSide,
> = {
  readonly [Ns in keyof DomainNamespaces]: {
    readonly [V in keyof Lookup<DomainNamespaces[Ns], 'valueObjects'>]: ValueObjectType<
      V,
      NamespaceScopeOf<DomainNamespaces, Ns, ValueObjectOverrides>,
      CodecTypes,
      ParameterizedOutputs,
      Side
    >;
  };
};
