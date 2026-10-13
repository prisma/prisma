import type {
  ColumnDefault,
  Contract,
  ContractExecutionSection,
  ContractRelation,
  NamespaceId,
  StorageHashBase,
} from '@internal/contract/types';
import type { ExtensionPackRef, TargetPackRef } from '@internal/framework-components/components';
import type { StorageType } from '@internal/framework-components/ir';
import type { IndexTypeRegistration } from '@internal/sql-contract/index-types';
import type {
  AggregateTypesBase,
  ApplyParameterizedOutputTypes,
  ApplyQueryOperationTypes,
  AuthoredStorageTypeInstance,
  ContractWithTypeMaps,
  ForeignKeyIndex,
  Index,
  ParameterizedOutputTypesFunction,
  QueryOperationTypesFunction,
  ReferentialAction,
  TypeMaps,
} from '@internal/sql-contract/types';
import type { UnionToIntersection } from './authoring-type-utils';
import type { AttributeStageIdFieldNames, FieldStateOf, ScalarFieldBuilder } from './contract-dsl';
import type { EnumTypeHandle } from './enum-type';

export type PublicCodecTypes<CodecTypes extends Record<string, { readonly output: unknown }>> = {
  readonly [CodecId in keyof CodecTypes]: Pick<
    CodecTypes[CodecId],
    Extract<keyof CodecTypes[CodecId], 'input' | 'output' | 'traits'>
  >;
};

export type ExtractCodecTypesFromPack<P> = P extends {
  __codecTypes?: infer C extends Record<string, { readonly output: unknown }>;
}
  ? PublicCodecTypes<C>
  : Record<never, never>;

export type MergeExtensionCodecTypes<Packs extends Record<string, unknown>> = UnionToIntersection<
  {
    [K in keyof Packs]: ExtractCodecTypesFromPack<Packs[K]>;
  }[keyof Packs]
>;

export type MergeExtensionCodecTypesSafe<Packs> =
  Packs extends Record<string, unknown>
    ? keyof Packs extends never
      ? Record<never, never>
      : MergeExtensionCodecTypes<Packs>
    : Record<never, never>;

export type ExtractIndexTypesFromPack<P> = P extends {
  readonly indexTypes: IndexTypeRegistration<infer M>;
}
  ? M
  : Record<never, never>;

type AllIndexTypeLiterals<Packs> =
  Packs extends Record<string, unknown>
    ? { [K in keyof Packs]: keyof ExtractIndexTypesFromPack<Packs[K]> }[keyof Packs] & string
    : never;

export type MergeExtensionIndexTypes<Packs extends Record<string, unknown>> = {
  readonly [Lit in AllIndexTypeLiterals<Packs>]: Extract<
    {
      [K in keyof Packs]: Lit extends keyof ExtractIndexTypesFromPack<Packs[K]>
        ? ExtractIndexTypesFromPack<Packs[K]>[Lit]
        : never;
    }[keyof Packs],
    { readonly options: unknown }
  >;
};

export type MergeExtensionPackRefs<
  Existing extends Record<string, unknown> | undefined,
  Added extends Record<string, ExtensionPackRef<'sql', string>>,
> = Existing extends Record<string, unknown> ? Existing & Added : Added;

type DefinitionExtensions<Definition> = Definition extends {
  readonly extensions?: infer Packs extends Record<string, ExtensionPackRef<'sql', string>>;
}
  ? Packs
  : Record<never, never>;

type ExtractPackCapabilities<P> = P extends {
  readonly capabilities?: infer Caps extends Record<string, Record<string, boolean>>;
}
  ? Caps
  : never;

type MergeExtensionPackCapabilities<Packs> =
  Packs extends Record<string, unknown>
    ? keyof Packs extends never
      ? Record<never, never>
      : UnionToIntersection<
          {
            [K in keyof Packs]: ExtractPackCapabilities<Packs[K]>;
          }[keyof Packs]
        >
    : Record<never, never>;

type Defaulted<T, Fallback> = [T] extends [never] ? Fallback : T;

type DefinitionAdapter<Definition> = Definition extends { readonly adapter?: infer Adapter }
  ? Present<Adapter>
  : never;

type EnabledCapabilities<Capabilities> = {
  readonly [Namespace in keyof Capabilities as keyof EnabledCapabilityFlags<
    Capabilities[Namespace]
  > extends never
    ? never
    : Namespace]: EnabledCapabilityFlags<Capabilities[Namespace]>;
};

type EnabledCapabilityFlags<Flags> = {
  readonly [Flag in keyof Flags as Flags[Flag] extends true ? Flag : never]: true;
};

// The capabilities of the target, its adapter and the extensions, as the CLI merges them into an emitted contract and the execution context merges them at runtime; a disabled capability is left out, as in an emitted contract.
type DerivedCapabilities<Definition> = EnabledCapabilities<
  Defaulted<ExtractPackCapabilities<DefinitionTarget<Definition>>, Record<never, never>> &
    Defaulted<ExtractPackCapabilities<DefinitionAdapter<Definition>>, Record<never, never>> &
    MergeExtensionPackCapabilities<DefinitionExtensions<Definition>>
>;

type ExtractQueryOperationTypesFromPack<
  P,
  CodecTypes extends Record<string, { readonly input: unknown; readonly output: unknown }>,
> = P extends { readonly __queryOperationTypes?: infer TypeFunction }
  ? Present<TypeFunction> extends infer Defined extends QueryOperationTypesFunction
    ? ApplyQueryOperationTypes<Defined, CodecTypes>
    : Record<never, never>
  : Record<never, never>;

type PackQueryOperationTypes<Definition> = UnionToIntersection<
  {
    [K in keyof AllPacks<Definition>]: ExtractQueryOperationTypesFromPack<
      AllPacks<Definition>[K],
      CodecTypesFromDefinition<Definition>
    >;
  }[keyof AllPacks<Definition>]
>;

type QueryOperationTypesFromDefinition<Definition> =
  PackQueryOperationTypes<Definition> extends infer Operations extends Record<string, unknown>
    ? Operations
    : Record<string, never>;

type AggregateTypesFromDefinition<Definition> =
  DefinitionTarget<Definition> extends {
    readonly __aggregateTypes?: infer Aggregates;
  }
    ? Present<Aggregates> extends infer Defined extends AggregateTypesBase
      ? Defined
      : Record<string, never>
    : Record<string, never>;

type DefinitionTargetId<Definition> = Definition extends {
  readonly target: TargetPackRef<'sql', infer Target>;
}
  ? Target
  : never;

type Present<T> = Exclude<T, undefined>;

type CodecTypesFromDefinition<Definition> = ExtractCodecTypesFromPack<
  Definition extends { readonly target: infer Target } ? Target : never
> &
  MergeExtensionCodecTypesSafe<DefinitionExtensions<Definition>>;

type DefinitionTarget<Definition> = Definition extends { readonly target: infer Target }
  ? Target
  : never;

type AllPacks<Definition> = DefinitionExtensions<Definition> & {
  readonly __target: DefinitionTarget<Definition>;
};

export type IndexTypesFromDefinition<Definition> = MergeExtensionIndexTypes<AllPacks<Definition>>;

type DefinitionModels<Definition> = Definition extends {
  readonly models?: unknown;
}
  ? Present<Definition['models']> extends Record<string, unknown>
    ? Present<Definition['models']>
    : Record<never, never>
  : Record<never, never>;

type DefinitionNamespaces<Definition> = Definition extends {
  readonly namespaces?: infer Names extends readonly string[];
}
  ? string[] extends Names
    ? never
    : readonly string[] extends Names
      ? never
      : Names[number]
  : never;

type DefinitionTypes<Definition> = Definition extends {
  readonly types?: unknown;
}
  ? Present<Definition['types']> extends Record<string, StorageType>
    ? Present<Definition['types']>
    : Record<never, never>
  : Record<never, never>;

type DefinitionTableNaming<Definition> = Definition extends {
  readonly naming?: { readonly tables?: infer Strategy extends string };
}
  ? Strategy
  : undefined;

type DefinitionColumnNaming<Definition> = Definition extends {
  readonly naming?: { readonly columns?: infer Strategy extends string };
}
  ? Strategy
  : undefined;

type FirstChar<S extends string> = S extends `${infer First}${string}` ? First : '';

type CharKind<C extends string> = C extends ''
  ? 'end'
  : C extends Lowercase<C>
    ? C extends Uppercase<C>
      ? 'other'
      : 'lower'
    : 'upper';

type ShouldInsertSnakeUnderscore<
  PrevKind extends 'start' | 'lower' | 'upper' | 'other' | 'end',
  Current extends string,
  Next extends string,
> =
  CharKind<Current> extends 'upper'
    ? PrevKind extends 'start'
      ? false
      : PrevKind extends 'lower' | 'other'
        ? true
        : CharKind<Next> extends 'lower'
          ? true
          : false
    : false;

type SnakeCaseInternal<
  S extends string,
  PrevKind extends 'start' | 'lower' | 'upper' | 'other' | 'end' = 'start',
> = S extends `${infer Current}${infer Rest}`
  ? `${ShouldInsertSnakeUnderscore<PrevKind, Current, FirstChar<Rest>> extends true
      ? '_'
      : ''}${Lowercase<Current>}${SnakeCaseInternal<Rest, CharKind<Current>>}`
  : '';

type SnakeCase<S extends string> = string extends S ? string : SnakeCaseInternal<S>;

type ApplyNamingType<Name extends string, Strategy extends string | undefined> = string extends Name
  ? string
  : Strategy extends 'snake_case'
    ? SnakeCase<Name>
    : Name;

type ModelNames<Definition> = keyof DefinitionModels<Definition> & string;

type ModelFields<
  Definition,
  ModelName extends ModelNames<Definition>,
> = DefinitionModels<Definition>[ModelName] extends {
  readonly stageOne: {
    readonly fields: Record<string, ScalarFieldBuilder>;
  };
}
  ? DefinitionModels<Definition>[ModelName]['stageOne']['fields']
  : Record<never, never>;

type ModelFieldNames<Definition, ModelName extends ModelNames<Definition>> = keyof ModelFields<
  Definition,
  ModelName
> &
  string;

type StagedModelRelations<
  Definition,
  ModelName extends ModelNames<Definition>,
> = DefinitionModels<Definition>[ModelName] extends {
  readonly stageOne: { readonly relations: infer R };
}
  ? R extends Record<string, unknown>
    ? R
    : Record<never, never>
  : Record<never, never>;

type StagedModelRelationNames<
  Definition,
  ModelName extends ModelNames<Definition>,
> = keyof StagedModelRelations<Definition, ModelName> & string;

type ModelFieldState<
  Definition,
  ModelName extends ModelNames<Definition>,
  FieldName extends ModelFieldNames<Definition, ModelName>,
> = FieldStateOf<ModelFields<Definition, ModelName>[FieldName]>;

type ModelSql<
  Definition,
  ModelName extends ModelNames<Definition>,
> = DefinitionModels<Definition>[ModelName] extends {
  readonly __sql: infer SqlSpec;
}
  ? SqlSpec
  : undefined;

type ModelAttributes<
  Definition,
  ModelName extends ModelNames<Definition>,
> = DefinitionModels<Definition>[ModelName] extends {
  readonly __attributes: infer AttributesSpec;
}
  ? AttributesSpec
  : undefined;

type FieldDescriptorOf<FieldState> = Present<
  FieldState extends { readonly descriptor?: infer Descriptor } ? Descriptor : never
>;

type FieldTypeRefOf<FieldState> = Present<
  FieldState extends { readonly typeRef?: infer TypeRef } ? TypeRef : never
>;

type FieldNullableOf<FieldState> = FieldState extends {
  readonly nullable: infer Nullable extends boolean;
}
  ? Nullable
  : boolean;

type FieldManyOf<FieldState> = FieldState extends {
  readonly many: infer Many extends false | { readonly elementNullable: boolean };
}
  ? Many
  : false;

type FieldDefaultPresenceOf<FieldState> = Present<
  FieldState extends { readonly __defaultPresence?: infer Defaults } ? Defaults : never
>;

type FieldHasColumnDefault<FieldState> =
  FieldDefaultPresenceOf<FieldState> extends { readonly column: true } ? true : false;

type FieldHasExecutionDefault<FieldState> =
  FieldDefaultPresenceOf<FieldState> extends { readonly execution: true } ? true : false;

type FieldColumnOverrideOf<FieldState> = Present<
  FieldState extends { readonly columnName?: infer ColumnName } ? ColumnName : never
>;

type FieldInlineIdSpecOf<FieldState> = Present<
  FieldState extends { readonly id?: infer IdSpec } ? IdSpec : never
>;

// A column spec types its `codecId` as `string`; the codec its factory builds carries the literal id.
type DescriptorCodecId<Descriptor> = Descriptor extends {
  readonly codecId: infer CodecId extends string;
}
  ? string extends CodecId
    ? ColumnSpecCodecId<Descriptor>
    : CodecId
  : string;

type ColumnSpecCodecId<Descriptor> = Descriptor extends {
  readonly codecFactory: (...args: never[]) => { readonly id: infer Id extends string };
}
  ? Id
  : string;

type DescriptorTypeParams<Descriptor> = Descriptor extends {
  readonly typeParams: infer TypeParams extends Record<string, unknown>;
}
  ? TypeParams
  : undefined;

type DescriptorTypeRef<Descriptor> = Descriptor extends {
  readonly typeRef: infer TypeRef extends string;
}
  ? TypeRef
  : undefined;

type LookupNamedStorageTypeKeyByValue<Definition, TypeRef extends StorageType> = {
  [TypeName in keyof DefinitionTypes<Definition> & string]: [TypeRef] extends [
    DefinitionTypes<Definition>[TypeName],
  ]
    ? [DefinitionTypes<Definition>[TypeName]] extends [TypeRef]
      ? TypeName
      : never
    : never;
}[keyof DefinitionTypes<Definition> & string];

type ResolveNamedStorageTypeKey<Definition, TypeRef> = TypeRef extends string
  ? TypeRef
  : TypeRef extends StorageType
    ? [LookupNamedStorageTypeKeyByValue<Definition, TypeRef>] extends [never]
      ? string
      : LookupNamedStorageTypeKeyByValue<Definition, TypeRef>
    : never;

type ResolveNamedStorageType<Definition, TypeRef> =
  ResolveNamedStorageTypeKey<Definition, TypeRef> extends infer TypeName extends string
    ? TypeName extends keyof DefinitionTypes<Definition>
      ? DefinitionTypes<Definition>[TypeName]
      : AuthoredStorageTypeInstance
    : AuthoredStorageTypeInstance;

// An enum-typed field carries its `EnumTypeHandle` (an object with a `codecId`
// but no `kind`) as the field's `typeRef`. It is neither a string nor a
// registered `StorageType`, so the named-type lookup cannot reach it;
// `EnumFieldHandle` short-circuits the resolvers to read the codec straight
// off the handle, with no column type-ref (the enum name is carried
// elsewhere). The `[...] extends [never]` guard excludes plain column fields,
// whose `typeRef` is `never`.
type EnumFieldHandle<FieldState> = [FieldTypeRefOf<FieldState>] extends [never]
  ? never
  : FieldTypeRefOf<FieldState> extends EnumTypeHandle
    ? FieldTypeRefOf<FieldState>
    : never;

type EnumHandleDescriptor<Handle> = Handle extends {
  readonly codecId: infer CodecId extends string;
}
  ? { readonly codecId: CodecId }
  : never;

type ResolveFieldDescriptor<Definition, FieldState> = [EnumFieldHandle<FieldState>] extends [never]
  ? [FieldDescriptorOf<FieldState>] extends [never]
    ? ResolveNamedStorageType<Definition, FieldTypeRefOf<FieldState>>
    : FieldDescriptorOf<FieldState>
  : EnumHandleDescriptor<EnumFieldHandle<FieldState>>;

type ResolveFieldColumnTypeRef<Definition, FieldState> = [EnumFieldHandle<FieldState>] extends [
  never,
]
  ? [FieldTypeRefOf<FieldState>] extends [never]
    ? DescriptorTypeRef<FieldDescriptorOf<FieldState>>
    : ResolveNamedStorageTypeKey<Definition, FieldTypeRefOf<FieldState>>
  : undefined;

type ResolveFieldColumnTypeParams<Definition, FieldState> = [
  ResolveFieldColumnTypeRef<Definition, FieldState>,
] extends [string]
  ? undefined
  : DescriptorTypeParams<FieldDescriptorOf<FieldState>>;

type ModelTableName<Definition, ModelName extends ModelNames<Definition>> = [
  Present<
    ModelSql<Definition, ModelName> extends { readonly table?: infer TableName } ? TableName : never
  >,
] extends [never]
  ? ApplyNamingType<ModelName, DefinitionTableNaming<Definition>>
  : Present<
        ModelSql<Definition, ModelName> extends { readonly table?: infer TableName }
          ? TableName
          : never
      > extends infer ExplicitTableName extends string
    ? ExplicitTableName
    : ApplyNamingType<ModelName, DefinitionTableNaming<Definition>>;

type ModelColumnName<
  Definition,
  ModelName extends ModelNames<Definition>,
  FieldName extends ModelFieldNames<Definition, ModelName>,
> = [FieldColumnOverrideOf<ModelFieldState<Definition, ModelName, FieldName>>] extends [never]
  ? ApplyNamingType<FieldName, DefinitionColumnNaming<Definition>>
  : FieldColumnOverrideOf<
        ModelFieldState<Definition, ModelName, FieldName>
      > extends infer ExplicitColumnName extends string
    ? ExplicitColumnName
    : ApplyNamingType<FieldName, DefinitionColumnNaming<Definition>>;

type FieldNamesToColumnNames<
  Definition,
  ModelName extends ModelNames<Definition>,
  FieldNames extends readonly string[],
> = FieldNames extends readonly []
  ? readonly []
  : FieldNames extends readonly [
        infer First extends ModelFieldNames<Definition, ModelName>,
        ...infer Rest extends readonly string[],
      ]
    ? readonly [
        ModelColumnName<Definition, ModelName, First>,
        ...FieldNamesToColumnNames<Definition, ModelName, Rest>,
      ]
    : readonly string[];

type InlineIdFieldName<Definition, ModelName extends ModelNames<Definition>> = {
  [FieldName in ModelFieldNames<Definition, ModelName>]: [
    FieldInlineIdSpecOf<ModelFieldState<Definition, ModelName, FieldName>>,
  ] extends [never]
    ? never
    : FieldName;
}[ModelFieldNames<Definition, ModelName>];

type InlineIdFieldNames<Definition, ModelName extends ModelNames<Definition>> = [
  InlineIdFieldName<Definition, ModelName>,
] extends [never]
  ? undefined
  : readonly [InlineIdFieldName<Definition, ModelName>];

type InlineIdName<Definition, ModelName extends ModelNames<Definition>> = {
  [FieldName in ModelFieldNames<Definition, ModelName>]: FieldInlineIdSpecOf<
    ModelFieldState<Definition, ModelName, FieldName>
  > extends { readonly name?: infer Name extends string }
    ? Name
    : never;
}[ModelFieldNames<Definition, ModelName>];

type AttributeIdFieldNames<
  Definition,
  ModelName extends ModelNames<Definition>,
> = AttributeStageIdFieldNames<ModelAttributes<Definition, ModelName>>;

type AttributeIdName<Definition, ModelName extends ModelNames<Definition>> = Present<
  ModelAttributes<Definition, ModelName> extends {
    readonly id?: { readonly name?: infer Name extends string };
  }
    ? Name
    : never
>;

type ModelIdFieldNames<Definition, ModelName extends ModelNames<Definition>> = [
  AttributeIdFieldNames<Definition, ModelName>,
] extends [undefined]
  ? InlineIdFieldNames<Definition, ModelName>
  : AttributeIdFieldNames<Definition, ModelName>;

type ModelIdName<Definition, ModelName extends ModelNames<Definition>> = [
  AttributeIdName<Definition, ModelName>,
] extends [never]
  ? Present<InlineIdName<Definition, ModelName>>
  : AttributeIdName<Definition, ModelName>;

type StorageColumn<
  CodecId extends string,
  Nullable extends boolean,
  TypeRef extends string | undefined = undefined,
  TypeParams extends Record<string, unknown> | undefined = undefined,
  Many extends false | { readonly elementNullable: boolean } = false,
  HasDefault extends boolean = false,
> = {
  readonly dataType: string;
  readonly codecId: CodecId;
  readonly nullable: Nullable;
} & (HasDefault extends true ? { readonly default: ColumnDefault } : Record<never, never>) &
  (TypeRef extends string ? { readonly typeRef: TypeRef } : Record<never, never>) &
  (TypeParams extends Record<string, unknown>
    ? { readonly typeParams: TypeParams }
    : Record<never, never>) & {
    readonly many: Many;
  };

type ModelStorageColumn<
  Definition,
  ModelName extends ModelNames<Definition>,
  FieldName extends string,
> =
  FieldName extends ModelFieldNames<Definition, ModelName>
    ? StorageColumn<
        DescriptorCodecId<
          ResolveFieldDescriptor<Definition, ModelFieldState<Definition, ModelName, FieldName>>
        >,
        FieldNullableOf<ModelFieldState<Definition, ModelName, FieldName>>,
        ResolveFieldColumnTypeRef<Definition, ModelFieldState<Definition, ModelName, FieldName>>,
        ResolveFieldColumnTypeParams<Definition, ModelFieldState<Definition, ModelName, FieldName>>,
        FieldManyOf<ModelFieldState<Definition, ModelName, FieldName>>,
        FieldHasColumnDefault<ModelFieldState<Definition, ModelName, FieldName>>
      >
    : never;

type StagedRelationState<
  Definition,
  ModelName extends ModelNames<Definition>,
  RelName extends StagedModelRelationNames<Definition, ModelName>,
> = StagedModelRelations<Definition, ModelName>[RelName] extends { readonly __state: infer State }
  ? State
  : never;

type RelationSourceModelName<Source> = Source extends {
  readonly modelName: infer Name extends string;
}
  ? Name
  : Source extends { readonly resolve: () => infer Name extends string }
    ? Name
    : never;

type RelationFieldTuple<Fields> = Fields extends readonly string[]
  ? Fields
  : readonly [Extract<Fields, string>];

type RelationFieldUnion<Fields> = Fields extends readonly (infer FieldName)[] ? FieldName : Fields;

type ModelAnchorFieldNames<Definition, ModelName extends ModelNames<Definition>> =
  ModelIdFieldNames<Definition, ModelName> extends infer IdFields extends readonly string[]
    ? IdFields
    : readonly ['id'];

type AnyFieldNullable<Definition, ModelName extends ModelNames<Definition>, Fields> = true extends (
  RelationFieldUnion<Fields> extends infer FieldName
    ? FieldName extends ModelFieldNames<Definition, ModelName>
      ? FieldNullableOf<ModelFieldState<Definition, ModelName, FieldName>>
      : boolean
    : never
)
  ? true
  : false;

// A declared `optional` that disagrees with the `from` fields fails the build, so the fields decide.
type BelongsToNullable<
  Definition,
  ModelName extends ModelNames<Definition>,
  State,
> = AnyFieldNullable<
  Definition,
  ModelName,
  State extends { readonly from: infer From } ? From : never
>;

type BuiltRelationTarget<Definition, Target extends ModelNames<Definition>> = {
  readonly namespace: ModelNamespace<Definition, Target> & NamespaceId;
  readonly model: Target;
};

// The target's primary key columns, or the columns of its unique key when it has no primary key, as the build picks them.
type JunctionTargetColumns<Definition, Target extends ModelNames<Definition>> =
  ModelIdFieldNames<Definition, Target> extends infer IdFields extends readonly string[]
    ? FieldNamesToColumnNames<Definition, Target, IdFields>
    : BuiltUnique<Definition, Target>['columns'];

type BuiltManyToManyRelation<
  Definition,
  ModelName extends ModelNames<Definition>,
  Target extends ModelNames<Definition>,
  State,
> = State extends {
  readonly through: infer ThroughSource;
  readonly from: infer From;
  readonly to: infer To;
}
  ? RelationSourceModelName<ThroughSource> extends infer Through extends ModelNames<Definition>
    ? {
        readonly to: BuiltRelationTarget<Definition, Target>;
        readonly cardinality: 'N:M';
        readonly on: {
          readonly localFields: ModelAnchorFieldNames<Definition, ModelName>;
          readonly targetFields: FieldNamesToColumnNames<
            Definition,
            Through,
            RelationFieldTuple<From>
          >;
        };
        readonly through: {
          readonly table: ModelTableName<Definition, Through>;
          readonly namespaceId: ModelNamespace<Definition, Through>;
          readonly parentColumns: FieldNamesToColumnNames<
            Definition,
            Through,
            RelationFieldTuple<From>
          >;
          readonly childColumns: FieldNamesToColumnNames<
            Definition,
            Through,
            RelationFieldTuple<To>
          >;
          readonly targetColumns: JunctionTargetColumns<Definition, Target>;
        };
      }
    : ContractRelation
  : ContractRelation;

type BuiltSameSpaceRelationByKind<
  Definition,
  ModelName extends ModelNames<Definition>,
  Target extends ModelNames<Definition>,
  State,
> = State extends { readonly kind: 'belongsTo'; readonly from: infer From; readonly to: infer To }
  ? {
      readonly to: BuiltRelationTarget<Definition, Target>;
      readonly cardinality: 'N:1';
      readonly nullable: BelongsToNullable<Definition, ModelName, State>;
      readonly on: {
        readonly localFields: RelationFieldTuple<From>;
        readonly targetFields: RelationFieldTuple<To>;
      };
    }
  : State extends { readonly kind: 'hasMany'; readonly by: infer By }
    ? {
        readonly to: BuiltRelationTarget<Definition, Target>;
        readonly cardinality: '1:N';
        readonly on: {
          readonly localFields: ModelAnchorFieldNames<Definition, ModelName>;
          readonly targetFields: RelationFieldTuple<By>;
        };
      }
    : State extends { readonly kind: 'hasOne'; readonly by: infer By }
      ? {
          readonly to: BuiltRelationTarget<Definition, Target>;
          readonly cardinality: '1:1';
          readonly nullable: true;
          readonly on: {
            readonly localFields: ModelAnchorFieldNames<Definition, ModelName>;
            readonly targetFields: RelationFieldTuple<By>;
          };
        }
      : State extends { readonly kind: 'manyToMany' }
        ? BuiltManyToManyRelation<Definition, ModelName, Target, State>
        : ContractRelation;

type IsOtherSpaceTarget<State> = State extends { readonly __targetSpaceId?: infer SpaceId }
  ? [Present<SpaceId>] extends ['<self>']
    ? false
    : true
  : false;

// A relation to a model in another contract space keeps the general type, whatever the target's name.
type BuiltRelation<Definition, ModelName extends ModelNames<Definition>, State> =
  IsOtherSpaceTarget<State> extends true
    ? ContractRelation
    : BuiltSameSpaceRelation<Definition, ModelName, State>;

type BuiltSameSpaceRelation<
  Definition,
  ModelName extends ModelNames<Definition>,
  State,
> = State extends {
  readonly toModel: infer Source;
}
  ? RelationSourceModelName<Source> extends infer Target extends ModelNames<Definition>
    ? BuiltSameSpaceRelationByKind<Definition, ModelName, Target, State>
    : ContractRelation
  : ContractRelation;

type ExecutionDefaultEntries<Definition> = {
  [ModelName in ModelNames<Definition>]: {
    [FieldName in ModelFieldNames<Definition, ModelName>]: FieldHasExecutionDefault<
      ModelFieldState<Definition, ModelName, FieldName>
    > extends true
      ? ContractExecutionSection['mutations']['defaults'][number] & {
          readonly ref: {
            readonly namespace: ModelNamespace<Definition, ModelName>;
            readonly entry: ModelTableName<Definition, ModelName>;
            readonly field: ModelColumnName<Definition, ModelName, FieldName>;
          };
        }
      : never;
  }[ModelFieldNames<Definition, ModelName>];
}[ModelNames<Definition>];

type BuiltExecution<Definition> = [ExecutionDefaultEntries<Definition>] extends [never]
  ? { readonly execution?: ContractExecutionSection }
  : {
      readonly execution: ContractExecutionSection & {
        readonly mutations: {
          readonly defaults: ReadonlyArray<ExecutionDefaultEntries<Definition>>;
        };
      };
    };

type DomainFieldTypeParams<TypeParams> =
  TypeParams extends Record<string, unknown>
    ? keyof TypeParams extends never
      ? Record<never, never>
      : { readonly typeParams: TypeParams }
    : Record<never, never>;

type DomainFieldMany<Many> = Many extends false ? Record<never, never> : { readonly many: Many };

type BuiltModels<Definition> = {
  readonly [ModelName in ModelNames<Definition>]: {
    readonly storage: {
      readonly table: ModelTableName<Definition, ModelName>;
      readonly namespaceId: ModelNamespace<Definition, ModelName>;
      readonly fields: {
        readonly [FieldName in ModelFieldNames<Definition, ModelName>]: {
          readonly column: ModelColumnName<Definition, ModelName, FieldName>;
        };
      };
    };
    readonly fields: {
      readonly [FieldName in ModelFieldNames<Definition, ModelName>]: {
        readonly nullable: ModelStorageColumn<Definition, ModelName, FieldName>['nullable'];
        readonly type: {
          readonly kind: 'scalar';
          readonly codecId: ModelStorageColumn<Definition, ModelName, FieldName>['codecId'];
        } & DomainFieldTypeParams<
          FieldColumnTypeParams<Definition, ModelFieldState<Definition, ModelName, FieldName>>
        >;
      } & DomainFieldMany<FieldManyOf<ModelFieldState<Definition, ModelName, FieldName>>>;
    };
    readonly relations: {
      readonly [RelName in StagedModelRelationNames<Definition, ModelName>]: BuiltRelation<
        Definition,
        ModelName,
        StagedRelationState<Definition, ModelName, RelName>
      >;
    };
  };
};

type BuiltModelColumnMappings<
  Definition,
  ModelName extends ModelNames<Definition>,
> = BuiltModels<Definition>[ModelName]['storage']['fields'];

type BuiltModelTableName<
  Definition,
  ModelName extends ModelNames<Definition>,
> = BuiltModels<Definition>[ModelName]['storage']['table'];

type BuiltStorageTableColumns<Definition, ModelName extends ModelNames<Definition>> = {
  readonly [FieldName in keyof BuiltModelColumnMappings<Definition, ModelName> &
    string as BuiltModelColumnMappings<
    Definition,
    ModelName
  >[FieldName]['column']]: ModelStorageColumn<Definition, ModelName, FieldName>;
};

type FieldUniqueSpecOf<FieldState> = FieldState extends { readonly unique: infer UniqueSpec }
  ? [UniqueSpec] extends [{ readonly name?: infer Name }]
    ? { readonly name: Name }
    : never
  : never;

type UniqueName<Name> = Present<Name> extends infer Defined extends string ? Defined : never;

type InlineUnique<Definition, ModelName extends ModelNames<Definition>> = {
  [FieldName in ModelFieldNames<Definition, ModelName>]: FieldUniqueSpecOf<
    ModelFieldState<Definition, ModelName, FieldName>
  > extends infer Spec
    ? [Spec] extends [never]
      ? never
      : Spec extends { readonly name: infer Name }
        ? {
            readonly columns: readonly [ModelColumnName<Definition, ModelName, FieldName>];
            readonly name?: UniqueName<Name>;
          }
        : never
    : never;
}[ModelFieldNames<Definition, ModelName>];

type AttributeUnique<Definition, ModelName extends ModelNames<Definition>> =
  ModelAttributes<Definition, ModelName> extends {
    readonly uniques?: infer Uniques extends readonly unknown[];
  }
    ? Uniques[number] extends infer Unique
      ? Unique extends {
          readonly fields: infer Fields extends readonly string[];
        }
        ? number extends Fields['length']
          ? never
          : {
              readonly columns: FieldNamesToColumnNames<Definition, ModelName, Fields>;
              readonly name?: Unique extends { readonly name?: infer Name }
                ? UniqueName<Name>
                : never;
            }
        : never
      : never
    : never;

// The unique constraints of a model, from `.unique()` fields and the `uniques` attribute, so a unique criterion names their columns.
type BuiltUnique<Definition, ModelName extends ModelNames<Definition>> =
  | InlineUnique<Definition, ModelName>
  | AttributeUnique<Definition, ModelName>;

type BuiltStorageTables<Definition, Ns extends string> = {
  readonly [ModelName in ModelsInNamespace<Definition, Ns> as BuiltModelTableName<
    Definition,
    ModelName
  >]: {
    readonly columns: BuiltStorageTableColumns<Definition, ModelName>;
    readonly uniques: ReadonlyArray<BuiltUnique<Definition, ModelName>>;
    readonly indexes: ReadonlyArray<Index>;
    readonly foreignKeys: ReadonlyArray<{
      readonly source: {
        readonly namespaceId: NamespaceId;
        readonly tableName: string;
        readonly columns: readonly string[];
      };
      readonly target: {
        readonly namespaceId: NamespaceId;
        readonly spaceId?: string;
        readonly tableName: string;
        readonly columns: readonly string[];
      };
      readonly name?: string;
      readonly onDelete?: ReferentialAction;
      readonly onUpdate?: ReferentialAction;
      readonly index?: ForeignKeyIndex;
    }>;
  } & (ModelIdFieldNames<Definition, ModelName> extends readonly string[]
    ? {
        readonly primaryKey: {
          readonly columns: FieldNamesToColumnNames<
            Definition,
            ModelName,
            ModelIdFieldNames<Definition, ModelName>
          >;
          readonly name?: ModelIdName<Definition, ModelName>;
        };
      }
    : Record<never, never>);
};

type DefinitionEnums<Definition> = Definition extends {
  readonly enums?: infer E;
}
  ? Present<E> extends Record<string, EnumTypeHandle>
    ? // A bare `Record<string, EnumTypeHandle>` (no literal keys) is the
      // widened default for a contract authored without enums; treat it as
      // empty so `db.enums` carries only literally-authored enums.
      string extends keyof Present<E>
      ? Record<never, never>
      : Present<E>
    : Record<never, never>
  : Record<never, never>;

type EnumHandleAccessorType<Handle> =
  Handle extends EnumTypeHandle<infer _Name, infer Values, infer Names, infer MembersMap>
    ? {
        readonly values: Values;
        readonly names: Names;
        readonly members: MembersMap;
        has(v: Values[number]): boolean;
        nameOf(v: Values[number]): string | undefined;
        ordinalOf(v: Values[number]): number;
      }
    : never;

type BuiltEnumAccessors<Definition> = {
  readonly [K in keyof DefinitionEnums<Definition>]: EnumHandleAccessorType<
    DefinitionEnums<Definition>[K]
  >;
};

type BuiltDocumentScopedTypes<Definition> = {
  readonly [K in keyof DefinitionTypes<Definition> as DefinitionTypes<Definition>[K] extends AuthoredStorageTypeInstance
    ? K
    : never]: DefinitionTypes<Definition>[K] & { readonly dataType: string };
};

type BuiltDomain<Definition> =
  BuiltDocumentScopedTypes<Definition> extends Record<never, never>
    ? Record<never, never>
    : {
        readonly __unbound__: {
          readonly types: BuiltDocumentScopedTypes<Definition>;
        };
      };

type BuiltDomainNamespace<Definition, Ns extends string> = {
  readonly models: {
    readonly [ModelName in ModelsInNamespace<Definition, Ns>]: BuiltModels<Definition>[ModelName];
  };
};

type DefaultStorageNamespaceId<Definition> =
  DefinitionTarget<Definition> extends {
    readonly defaultNamespaceId: infer Id extends string;
  }
    ? Id
    : never;

type ModelNamespaceOf<Definition, Namespace> = [Namespace] extends [undefined]
  ? DefaultStorageNamespaceId<Definition>
  : Namespace extends '' | undefined
    ? DefaultStorageNamespaceId<Definition>
    : Namespace;

type ModelNamespace<
  Definition,
  ModelName extends ModelNames<Definition>,
> = DefinitionModels<Definition>[ModelName] extends {
  readonly __namespace: infer Namespace extends string | undefined;
}
  ? ModelNamespaceOf<Definition, Namespace>
  : DefaultStorageNamespaceId<Definition>;

type ModelNamespaces<Definition> = {
  [ModelName in ModelNames<Definition>]: ModelNamespace<Definition, ModelName>;
}[ModelNames<Definition>] &
  string;

// A model whose namespace is a non-literal `string` cannot be placed, so every namespace lists every model.
type ModelsInNamespace<Definition, Ns extends string> =
  string extends ModelNamespaces<Definition>
    ? ModelNames<Definition>
    : {
        [ModelName in ModelNames<Definition>]: Ns extends ModelNamespace<Definition, ModelName>
          ? ModelName
          : never;
      }[ModelNames<Definition>];

// Mirrors the namespaces `buildSqlContractFromDefinition` puts in `domain.namespaces`: each
// model's namespace, and the default namespace when the contract has no models or has enums.
type DomainNamespaceIds<Definition> = (
  | ModelNamespaces<Definition>
  | ([ModelNames<Definition>] extends [never] ? DefaultStorageNamespaceId<Definition> : never)
  | (keyof DefinitionEnums<Definition> extends never
      ? never
      : DefaultStorageNamespaceId<Definition>)
) &
  string;

type StorageNamespaceIds<Definition> = (
  | DefaultStorageNamespaceId<Definition>
  | DefinitionNamespaces<Definition>
  | ModelNamespaces<Definition>
) &
  string;

type BuiltStorage<Definition> = {
  readonly storageHash: StorageHashBase<string>;
  readonly types?: BuiltDocumentScopedTypes<Definition>;
  // The shape is described inline (rather than intersecting with
  // `SqlStorage['namespaces']`) so its `Readonly<Record<string, Namespace>>`
  // index signature doesn't collapse slot keys to `string`. The literal object
  // is still structurally assignable to `SqlStorage['namespaces']` because
  // every value satisfies the framework `Namespace` interface.
  readonly namespaces: {
    readonly [Ns in StorageNamespaceIds<Definition>]: {
      readonly id: Ns;
      readonly kind: string;
      readonly entries: {
        readonly table: BuiltStorageTables<Definition, Ns>;
      };
    };
  };
};

type StorageColumnManyOf<Col> = Col extends {
  readonly many: infer Many extends false | { readonly elementNullable: boolean };
}
  ? Many
  : false;

// The enum value union for an enum-typed field, or `never` for a non-enum
// field. The field's `typeRef` carries the authored `EnumTypeHandle`, whose
// `Values` tuple preserves the literal member values (text or numeric).
type EnumValueUnion<FieldState> = [FieldTypeRefOf<FieldState>] extends [
  EnumTypeHandle<string, infer Values>,
]
  ? readonly unknown[] extends Values
    ? never
    : Values[number]
  : never;

// The member-value literal tuple carried on a descriptor's `entityRef.entity`
// (e.g. a target's native-enum entity), or `never` when the descriptor has no
// entityRef, its entity has no `members`, or `members` is widened to
// `readonly string[]` — this is checked with non-optional property shapes so
// a descriptor genuinely lacking `entityRef` fails the structural match
// instead of matching vacuously through the framework type's optional slot.
type DescriptorEntityMembers<Descriptor> = Descriptor extends {
  readonly entityRef: {
    readonly entity: { readonly members: infer Members extends readonly string[] };
  };
}
  ? Members
  : never;

// The value-set member union for a descriptor-carried entity (the type-level
// mirror of the runtime's generic `deriveValueSetFromEntity` fold), or
// `never` for a field with no descriptor, a descriptor with no entityRef.entity,
// or a widened (non-literal) members tuple — mirroring `EnumValueUnion`'s
// erasure guard.
type DescriptorValueSetUnion<FieldState> = [FieldDescriptorOf<FieldState>] extends [never]
  ? never
  : readonly string[] extends DescriptorEntityMembers<FieldDescriptorOf<FieldState>>
    ? never
    : DescriptorEntityMembers<FieldDescriptorOf<FieldState>>[number];

type FieldColumnTypeParams<Definition, FieldState> =
  ResolveFieldColumnTypeRef<Definition, FieldState> extends infer TypeRef extends
    keyof DefinitionTypes<Definition>
    ? DefinitionTypes<Definition>[TypeRef] extends {
        readonly typeParams: infer TypeParams extends Record<string, unknown>;
      }
      ? TypeParams
      : undefined
    : DescriptorTypeParams<FieldDescriptorOf<FieldState>>;

type PackParameterizedOutputType<
  Pack,
  CodecId,
  TypeParams extends Record<string, unknown>,
> = Pack extends { readonly __parameterizedOutputTypes?: infer TypeFunction }
  ? Present<TypeFunction> extends infer Defined extends ParameterizedOutputTypesFunction
    ? ApplyParameterizedOutputTypes<Defined, TypeParams> extends infer Outputs
      ? CodecId extends keyof Outputs
        ? Outputs[CodecId]
        : never
      : never
    : never
  : never;

// The output type a codec's `renderOutputType` gives a column with these type parameters, or `never` when it gives none.
type ParameterizedOutputType<Definition, CodecId, TypeParams> =
  TypeParams extends Record<string, unknown>
    ? {
        [K in keyof AllPacks<Definition>]: PackParameterizedOutputType<
          AllPacks<Definition>[K],
          CodecId,
          TypeParams
        >;
      }[keyof AllPacks<Definition>]
    : never;

// The value type of the codec a column spec's factory builds, such as the type an arktype schema infers; `never` for a descriptor without a factory.
type ColumnSpecCodecOutput<Descriptor> = Descriptor extends {
  readonly codecFactory: (...args: never[]) => infer Codec;
}
  ? Codec extends { decode(...args: never[]): Promise<infer Output> }
    ? Output
    : never
  : never;

type RefinedChannelType<
  Definition,
  CodecId,
  Channel extends 'output' | 'input',
  TypeParams,
  Plain,
  Descriptor,
> = Channel extends 'output'
  ? [ParameterizedOutputType<Definition, CodecId, TypeParams>] extends [never]
    ? [ColumnSpecCodecOutput<Descriptor>] extends [never]
      ? Plain
      : ColumnSpecCodecOutput<Descriptor>
    : ParameterizedOutputType<Definition, CodecId, TypeParams>
  : Plain;

// The codec's `output` / `input` JS type for a field's column, before
// nullability. `unknown` when the codec is not in the definition's codec map.
type CodecChannelType<
  Definition,
  ModelName extends ModelNames<Definition>,
  FieldName extends ModelFieldNames<Definition, ModelName>,
  Channel extends 'output' | 'input',
> = ModelStorageColumn<Definition, ModelName, FieldName>['codecId'] extends infer Id extends
  keyof CodecTypesFromDefinition<Definition>
  ? CodecTypesFromDefinition<Definition>[Id] extends { readonly [K in Channel]: infer Plain }
    ? RefinedChannelType<
        Definition,
        Id,
        Channel,
        FieldColumnTypeParams<Definition, ModelFieldState<Definition, ModelName, FieldName>>,
        Plain,
        FieldDescriptorOf<ModelFieldState<Definition, ModelName, FieldName>>
      > extends infer T
      ? StorageColumnManyOf<ModelStorageColumn<Definition, ModelName, FieldName>> extends infer Many
        ? Many extends { readonly elementNullable: infer ElementNullable }
          ? ReadonlyArray<T | (ElementNullable extends true ? null : never)>
          : T
        : never
      : never
    : unknown
  : unknown;

// The literal value union for a field: the enum-typed union takes precedence
// (matching today's behavior), falling back to the descriptor-carried
// value-set union; `never` when neither applies.
type FieldValueUnion<FieldState> = [EnumValueUnion<FieldState>] extends [never]
  ? DescriptorValueSetUnion<FieldState>
  : EnumValueUnion<FieldState>;

// A field's read/write JS type: the value union (enum or descriptor value-set)
// when the field carries one, otherwise the codec channel type, with column
// nullability applied.
type FieldChannelType<
  Definition,
  ModelName extends ModelNames<Definition>,
  FieldName extends ModelFieldNames<Definition, ModelName>,
  Channel extends 'output' | 'input',
> =
  | ([FieldValueUnion<ModelFieldState<Definition, ModelName, FieldName>>] extends [never]
      ? CodecChannelType<Definition, ModelName, FieldName, Channel>
      : StorageColumnManyOf<ModelStorageColumn<Definition, ModelName, FieldName>> extends infer Many
        ? Many extends { readonly elementNullable: infer ElementNullable }
          ? ReadonlyArray<
              | FieldValueUnion<ModelFieldState<Definition, ModelName, FieldName>>
              | (ElementNullable extends true ? null : never)
            >
          : FieldValueUnion<ModelFieldState<Definition, ModelName, FieldName>>
        : never)
  | (FieldNullableOf<ModelFieldState<Definition, ModelName, FieldName>> extends true
      ? null
      : never);

// Nested by namespace coordinate (`{ [ns]: { [model]: { [field]: type } } }`)
// to mirror the emitter's namespace-nested `FieldOutputTypes` (and the
// `TypeMaps` constraint).
type FieldChannelTypes<Definition, Channel extends 'output' | 'input'> = {
  readonly [Ns in DomainNamespaceIds<Definition>]: {
    readonly [ModelName in ModelsInNamespace<Definition, Ns>]: {
      readonly [FieldName in ModelFieldNames<Definition, ModelName>]: FieldChannelType<
        Definition,
        ModelName,
        FieldName,
        Channel
      >;
    };
  };
};

type StorageColumnChannelTypes<Definition, Channel extends 'output' | 'input'> = {
  readonly [Ns in StorageNamespaceIds<Definition>]: {
    readonly [ModelName in ModelsInNamespace<Definition, Ns> as BuiltModelTableName<
      Definition,
      ModelName
    >]: {
      readonly [FieldName in ModelFieldNames<Definition, ModelName> as BuiltModelColumnMappings<
        Definition,
        ModelName
      >[FieldName]['column']]: FieldChannelType<Definition, ModelName, FieldName, Channel>;
    };
  };
};

export type SqlContractResult<Definition> = ContractWithTypeMaps<
  Omit<Contract<BuiltStorage<Definition>>, 'domain' | 'execution'> &
    BuiltExecution<Definition> & {
      readonly target: DefinitionTargetId<Definition>;
      readonly targetFamily: 'sql';
    } & {
      readonly domain: {
        readonly namespaces: {
          readonly [Ns in DomainNamespaceIds<Definition>]: BuiltDomainNamespace<Definition, Ns>;
        };
      } & BuiltDomain<Definition>;
    } & {
      readonly extensions: DefinitionExtensions<Definition>;
      readonly capabilities: DerivedCapabilities<Definition>;
      readonly enumAccessors: BuiltEnumAccessors<Definition>;
    },
  TypeMaps<
    CodecTypesFromDefinition<Definition>,
    QueryOperationTypesFromDefinition<Definition>,
    FieldChannelTypes<Definition, 'output'>,
    FieldChannelTypes<Definition, 'input'>,
    StorageColumnChannelTypes<Definition, 'output'>,
    StorageColumnChannelTypes<Definition, 'input'>,
    AggregateTypesFromDefinition<Definition>
  >
>;
