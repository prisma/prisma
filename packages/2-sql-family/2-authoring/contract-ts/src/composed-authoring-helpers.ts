import {
  type ArgTypeFromDescriptor,
  type CanonicalArguments,
  type CodecTypeMap,
  composePackAuthoringNamespace,
  createEntityHelpersFromNamespace,
  createFieldHelpersFromNamespace,
  type DataTypeArgumentTypes,
  type EntityHelpersFromNamespace,
  type ExtractAuthoringNamespaceFromPack,
  type ExtractDataTypeArgumentTypesFromPack,
  type MergeExtensionAuthoringNamespaces,
  type ResolveTemplateValue,
  type TupleFromArgumentDescriptors,
  type UnionToIntersection,
} from '@internal/contract-authoring';
import type {
  AuthoringArgumentDescriptor,
  AuthoringEntityTypeNamespace,
  AuthoringFieldNamespace,
  AuthoringTypeAliasDescriptor,
  AuthoringTypeChoiceArgument,
  AuthoringTypeChoiceDescriptor,
  AuthoringTypeChoiceRow,
  AuthoringTypeConstructorDescriptor,
  AuthoringTypeNamespace,
  DataTypeComponent,
} from '@internal/framework-components/authoring';
import {
  assembleDataTypeSupport,
  assertNoCrossRegistryCollisions,
  assertTypeChoicesValid,
} from '@internal/framework-components/authoring';
import type { CodecLookupWithDescriptors } from '@internal/framework-components/codec';
import {
  createGeneratorHelpers,
  type ExtensionPackRef,
  type ExtensionPackValues,
  type FamilyPackRef,
  type GeneratorFunctionCall,
  type GeneratorHelpersOf,
  type TargetPackRef,
} from '@internal/framework-components/components';
import { blindCast } from '@internal/utils/casts';
import {
  type AuthoringHelperLookups,
  createFieldPresetHelper,
  createTypeHelpersFromNamespace,
} from './authoring-helper-runtime';
import type { FieldHelpersFromNamespace } from './authoring-type-utils';
import type {
  AnyRelationBuilder,
  ColumnFieldHelper,
  ContractModelBuilder,
  IndexTypeMap,
  NamedTypeFieldHelper,
  ScalarFieldBuilder,
} from './contract-dsl';
import { buildFieldPreset, field, model, rel } from './contract-dsl';
import { contractError } from './contract-errors';
import type {
  ExtractCodecTypesFromPack,
  MergeExtensionCodecTypesSafe,
  MergeExtensionIndexTypes,
} from './contract-types';

type ExtractTypeNamespaceFromPack<Pack> = ExtractAuthoringNamespaceFromPack<
  Pack,
  'type',
  Record<never, never>
>;
type ExtractFieldNamespaceFromPack<Pack> = ExtractAuthoringNamespaceFromPack<
  Pack,
  'field',
  Record<never, never>
>;
type ExtractEntitiesNamespaceFromPack<Pack> = ExtractAuthoringNamespaceFromPack<
  Pack,
  'entityTypes',
  Record<never, never>
>;

type MergeExtensionTypeNamespaces<Extensions> = MergeExtensionAuthoringNamespaces<
  Extensions,
  'type'
>;
type MergeExtensionFieldNamespaces<Extensions> = MergeExtensionAuthoringNamespaces<
  Extensions,
  'field'
>;
type MergeExtensionEntityNamespaces<Extensions> = MergeExtensionAuthoringNamespaces<
  Extensions,
  'entityTypes'
>;

type StorageTypeFromDescriptor<
  Descriptor extends AuthoringTypeConstructorDescriptor,
  Args extends readonly unknown[],
> = {
  readonly kind: 'codec-instance';
  readonly codecId: ResolveTemplateValue<Descriptor['output']['codecId'], Args>;
} & (Descriptor['output'] extends {
  readonly typeParams: infer TypeParams extends Record<string, unknown>;
}
  ? {
      readonly typeParams: ResolveTemplateValue<TypeParams, Args>;
    }
  : { readonly typeParams: Record<never, never> });

type TypeHelperFunction<
  Descriptor extends AuthoringTypeConstructorDescriptor,
  ValueTypes extends DataTypeArgumentTypes,
> = Descriptor extends {
  readonly args: infer Args extends readonly AuthoringArgumentDescriptor[];
}
  ? <const Params extends TupleFromArgumentDescriptors<Args, ValueTypes>>(
      ...args: Params
    ) => StorageTypeFromDescriptor<Descriptor, CanonicalArguments<Args, Params, ValueTypes>>
  : () => StorageTypeFromDescriptor<Descriptor, readonly []>;

/** The value a call writes for each argument of a type choice, by the argument's name; `undefined` for one it leaves out. */
type WrittenChoiceArguments<
  Args extends readonly AuthoringTypeChoiceArgument[],
  Params extends readonly unknown[],
> = Args extends readonly [
  infer Head extends AuthoringTypeChoiceArgument,
  ...infer Tail extends readonly AuthoringTypeChoiceArgument[],
]
  ? {
      readonly [Name in Head['name']]: Params extends readonly [infer Written, ...unknown[]]
        ? Written
        : undefined;
    } & WrittenChoiceArguments<
      Tail,
      Params extends readonly [unknown, ...infer Rest] ? Rest : readonly []
    >
  : Record<never, never>;

type RowDefault<Row extends AuthoringTypeChoiceRow, Name extends string> = Row extends {
  readonly defaults: infer Defaults;
}
  ? Name extends keyof Defaults
    ? Defaults[Name]
    : undefined
  : undefined;

/** The arguments a type choice passes on to the constructor its row chooses, by that constructor's argument positions: the written value, or the row's default. */
type PassedOnArguments<
  Parameters extends readonly AuthoringArgumentDescriptor[],
  Written extends Record<string, unknown>,
  Row extends AuthoringTypeChoiceRow,
> = {
  readonly [Index in keyof Parameters]: Parameters[Index] extends {
    readonly name: infer Name extends string;
  }
    ? Name extends keyof Written
      ? Written[Name] extends undefined
        ? RowDefault<Row, Name>
        : Written[Name]
      : RowDefault<Row, Name>
    : undefined;
};

type ChosenStorageType<
  Chosen,
  Written extends Record<string, unknown>,
  Row extends AuthoringTypeChoiceRow,
  ValueTypes extends DataTypeArgumentTypes,
> = Chosen extends AuthoringTypeConstructorDescriptor
  ? Chosen extends {
      readonly args: infer Parameters extends readonly AuthoringArgumentDescriptor[];
    }
    ? StorageTypeFromDescriptor<
        Chosen,
        CanonicalArguments<Parameters, PassedOnArguments<Parameters, Written, Row>, ValueTypes>
      >
    : StorageTypeFromDescriptor<Chosen, readonly []>
  : never;

type ParameterNames<Chosen> = Chosen extends {
  readonly args: readonly (infer Parameter)[];
}
  ? Parameter extends { readonly name: infer Name extends string }
    ? Name
    : never
  : never;

type RowArgument<
  Head extends AuthoringTypeChoiceArgument,
  Row extends AuthoringTypeChoiceRow,
  Chosen,
  ValueTypes extends DataTypeArgumentTypes,
> = Head extends { readonly kind: 'option'; readonly default: infer Default }
  ? Head['name'] extends keyof Row['when']
    ? Row['when'][Head['name']] | (Row['when'][Head['name']] extends Default ? undefined : never)
    : never
  : Head['name'] extends ParameterNames<Chosen>
    ? ArgTypeFromDescriptor<Head, ValueTypes> | undefined
    : undefined;

/** Whether a call must write `Head` to choose `Row`: an option whose value in the row is not its default. */
type RowRequires<
  Head extends AuthoringTypeChoiceArgument,
  Row extends AuthoringTypeChoiceRow,
> = Head extends { readonly kind: 'option'; readonly default: infer Default }
  ? Head['name'] extends keyof Row['when']
    ? Row['when'][Head['name']] extends Default
      ? false
      : true
    : false
  : false;

type RowArguments<
  Args extends readonly AuthoringTypeChoiceArgument[],
  Row extends AuthoringTypeChoiceRow,
  Chosen,
  ValueTypes extends DataTypeArgumentTypes,
> = {
  readonly [Index in keyof Args]: RowArgument<Args[Index], Row, Chosen, ValueTypes>;
};

type RowRequirements<
  Args extends readonly AuthoringTypeChoiceArgument[],
  Row extends AuthoringTypeChoiceRow,
> = { readonly [Index in keyof Args]: RowRequires<Args[Index], Row> };

/** The arguments as a tuple whose trailing elements, after the last one a call must write, are optional. */
type TrailingOptional<
  Elements extends readonly unknown[],
  Requirements extends readonly boolean[],
> = Requirements extends readonly [...infer RestRequirements extends readonly boolean[], infer Last]
  ? Last extends true
    ? Elements
    : Elements extends readonly [...infer RestElements, infer LastElement]
      ? readonly [...TrailingOptional<RestElements, RestRequirements>, LastElement?]
      : readonly []
  : readonly [];

/** What a call choosing `Row` may write for each argument: the row's value for an option, left out only when that is the option's default, and a value for an argument the chosen constructor takes. */
type RowParameters<
  Args extends readonly AuthoringTypeChoiceArgument[],
  Row extends AuthoringTypeChoiceRow,
  Chosen,
  ValueTypes extends DataTypeArgumentTypes,
> = TrailingOptional<RowArguments<Args, Row, Chosen, ValueTypes>, RowRequirements<Args, Row>>;

type RowHelperFunction<
  Args extends readonly AuthoringTypeChoiceArgument[],
  Row extends AuthoringTypeChoiceRow,
  Chosen,
  ValueTypes extends DataTypeArgumentTypes,
> = <const Params extends RowParameters<Args, Row, Chosen, ValueTypes>>(
  ...args: Params
) => ChosenStorageType<Chosen, WrittenChoiceArguments<Args, Params>, Row, ValueTypes>;

type RowOverloads<
  Args extends readonly AuthoringTypeChoiceArgument[],
  Rows extends readonly AuthoringTypeChoiceRow[],
  Namespace,
  ValueTypes extends DataTypeArgumentTypes,
> = Rows extends readonly [
  infer Row extends AuthoringTypeChoiceRow,
  ...infer Rest extends readonly AuthoringTypeChoiceRow[],
]
  ? RowHelperFunction<
      Args,
      Row,
      Row['type'] extends keyof Namespace ? Namespace[Row['type']] : never,
      ValueTypes
    > &
      RowOverloads<Args, Rest, Namespace, ValueTypes>
  : unknown;

/** A type choice's helper: one overload per row, so a call is typed by the row its option values choose, and a combination with no row does not compile. */
type TypeChoiceHelperFunction<
  Descriptor extends AuthoringTypeChoiceDescriptor,
  Namespace,
  ValueTypes extends DataTypeArgumentTypes,
> = RowOverloads<Descriptor['args'], Descriptor['choices'], Namespace, ValueTypes>;

type AliasGeneratorCalls<Output> = (Output extends { readonly onCreate: GeneratorFunctionCall }
  ? { readonly onCreate: GeneratorFunctionCall }
  : unknown) &
  (Output extends { readonly onUpdate: GeneratorFunctionCall }
    ? { readonly onUpdate: GeneratorFunctionCall }
    : unknown);

type TypeAliasHelperFunction<Descriptor extends AuthoringTypeAliasDescriptor> = () => {
  readonly kind: 'codec-instance';
  readonly codecId: Descriptor['output']['type']['codecId'];
  readonly typeParams: Descriptor['output']['type'] extends {
    readonly typeParams: infer TypeParams extends Record<string, unknown>;
  }
    ? TypeParams
    : Record<never, never>;
} & (Descriptor['output'] extends
  | { readonly onCreate: GeneratorFunctionCall }
  | { readonly onUpdate: GeneratorFunctionCall }
  ? { readonly generatorCalls: AliasGeneratorCalls<Descriptor['output']> }
  : unknown);

type TypeHelpersFromNamespace<Namespace, ValueTypes extends DataTypeArgumentTypes> = {
  readonly [K in keyof Namespace]: Namespace[K] extends AuthoringTypeConstructorDescriptor
    ? TypeHelperFunction<Namespace[K], ValueTypes>
    : Namespace[K] extends AuthoringTypeAliasDescriptor
      ? TypeAliasHelperFunction<Namespace[K]>
      : Namespace[K] extends AuthoringTypeChoiceDescriptor
        ? TypeChoiceHelperFunction<Namespace[K], Namespace, ValueTypes>
        : Namespace[K] extends Record<string, unknown>
          ? TypeHelpersFromNamespace<Namespace[K], ValueTypes>
          : never;
};

type MergeExtensionDataTypeArgumentTypes<Extensions> =
  Extensions extends Record<string, unknown>
    ? keyof Extensions extends never
      ? Record<never, never>
      : UnionToIntersection<
          {
            [K in keyof Extensions]: ExtractDataTypeArgumentTypesFromPack<Extensions[K]>;
          }[keyof Extensions]
        >
    : Record<never, never>;

type DataTypeArgumentTypesOfPacks<Family, Target, Extensions> =
  ExtractDataTypeArgumentTypesFromPack<Family> &
    ExtractDataTypeArgumentTypesFromPack<Target> &
    MergeExtensionDataTypeArgumentTypes<Extensions>;

type CoreFieldHelpers = Pick<typeof field, 'column' | 'generated' | 'namedType'>;

type FieldHelpersForCodecs<CodecTypes extends CodecTypeMap> = Pick<typeof field, 'generated'> & {
  readonly column: ColumnFieldHelper<CodecTypes>;
  readonly namedType: NamedTypeFieldHelper;
};

type CodecTypesOfPacks<Family, Target, Extensions> = ExtractCodecTypesFromPack<Family> &
  ExtractCodecTypesFromPack<Target> &
  MergeExtensionCodecTypesSafe<Extensions>;

type MergeAllPackIndexTypes<Family, Target, Extensions> = MergeExtensionIndexTypes<
  { readonly __family: Family; readonly __target: Target } & (Extensions extends Record<
    string,
    unknown
  >
    ? Extensions
    : Record<never, never>)
>;

type PackAwareModel<IndexTypes extends IndexTypeMap> = {
  <
    const ModelName extends string,
    Fields extends Record<string, ScalarFieldBuilder>,
    Relations extends Record<string, AnyRelationBuilder> = Record<never, never>,
    const Namespace extends string | undefined = undefined,
  >(
    modelName: ModelName,
    input: {
      readonly fields: Fields;
      readonly relations?: Relations;
      readonly namespace?: Namespace;
    },
  ): ContractModelBuilder<
    ModelName,
    Fields,
    Relations,
    undefined,
    undefined,
    IndexTypes,
    '<self>',
    NoInfer<Namespace>
  >;
  <
    Fields extends Record<string, ScalarFieldBuilder>,
    Relations extends Record<string, AnyRelationBuilder> = Record<never, never>,
    const Namespace extends string | undefined = undefined,
  >(input: {
    readonly fields: Fields;
    readonly relations?: Relations;
    readonly namespace?: Namespace;
  }): ContractModelBuilder<
    undefined,
    Fields,
    Relations,
    undefined,
    undefined,
    IndexTypes,
    '<self>',
    NoInfer<Namespace>
  >;
};

export type ComposedAuthoringHelpers<
  Family extends FamilyPackRef<string>,
  Target extends TargetPackRef<'sql', string>,
  Extensions extends Record<string, ExtensionPackRef<'sql', string>> | undefined,
> = EntityHelpersFromNamespace<
  ExtractEntitiesNamespaceFromPack<Family> &
    ExtractEntitiesNamespaceFromPack<Target> &
    MergeExtensionEntityNamespaces<Extensions>
> & {
  readonly field: FieldHelpersForCodecs<CodecTypesOfPacks<Family, Target, Extensions>> &
    FieldHelpersFromNamespace<
      ExtractFieldNamespaceFromPack<Family> &
        ExtractFieldNamespaceFromPack<Target> &
        MergeExtensionFieldNamespaces<Extensions>,
      CodecTypesOfPacks<Family, Target, Extensions>,
      DataTypeArgumentTypesOfPacks<Family, Target, Extensions>
    >;
  readonly model: PackAwareModel<MergeAllPackIndexTypes<Family, Target, Extensions>>;
  readonly rel: typeof rel;
  readonly type: TypeHelpersFromNamespace<
    ExtractTypeNamespaceFromPack<Family> &
      ExtractTypeNamespaceFromPack<Target> &
      MergeExtensionTypeNamespaces<Extensions>,
    DataTypeArgumentTypesOfPacks<Family, Target, Extensions>
  >;
  readonly gen: GeneratorHelpersOf<Family | Target | ExtensionPackValues<Extensions>>;
};

type AuthoringComponent = DataTypeComponent & {
  readonly authoring?: { readonly entityTypes?: unknown };
};

function composeTypeNamespace(components: readonly AuthoringComponent[]): AuthoringTypeNamespace {
  return composePackAuthoringNamespace(components, 'type');
}

function composeFieldNamespace(components: readonly AuthoringComponent[]): AuthoringFieldNamespace {
  return composePackAuthoringNamespace(components, 'field');
}

function composeEntityNamespace(
  components: readonly AuthoringComponent[],
): AuthoringEntityTypeNamespace {
  return composePackAuthoringNamespace(components, 'entityTypes');
}

/**
 * Reserved top-level keys on the composed helpers surface — the
 * built-in `model` / `rel` helpers, the `field` / `type` / `gen` namespace
 * objects. Pack-contributed entity types are flattened to the same
 * top-level shape (e.g. `helpers.enum({...})`), so a pack cannot
 * contribute an entity type whose name collides with one of these
 * reserved keys without silently overwriting at runtime. Detect the
 * collision at compose time and fail loudly with a guidance message.
 */
const RESERVED_HELPER_KEYS: readonly string[] = ['field', 'model', 'rel', 'type', 'gen'];

function assertNoBuiltInEntityCollisions(namespace: AuthoringEntityTypeNamespace): void {
  const collisions = Object.keys(namespace).filter((name) => RESERVED_HELPER_KEYS.includes(name));
  if (collisions.length > 0) {
    throw contractError(
      'CONTRACT.PACK_CONTRIBUTION_INVALID',
      `Pack-contributed entity type(s) ${collisions.map((c) => `"${c}"`).join(', ')} collide with the reserved built-in helper key(s) on the composed helpers surface. Reserved keys: ${RESERVED_HELPER_KEYS.map((k) => `"${k}"`).join(', ')}.`,
      { meta: { collisions, reservedKeys: RESERVED_HELPER_KEYS } },
    );
  }
}

function createComposedFieldHelpers(
  fieldNamespace: AuthoringFieldNamespace,
  lookups: AuthoringHelperLookups,
): CoreFieldHelpers & Record<string, unknown> {
  const helperNamespace = createFieldHelpersFromNamespace(
    fieldNamespace,
    ({ helperPath, descriptor }) =>
      createFieldPresetHelper({
        helperPath,
        descriptor,
        codecLookup: lookups.codecLookup,
        dataTypes: lookups.dataTypes,
        build: ({ args, namedConstraintOptions }) =>
          buildFieldPreset(descriptor, args, namedConstraintOptions),
      }),
  );
  const coreFieldHelpers = {
    column: field.column,
    generated: field.generated,
    namedType: field.namedType,
  } satisfies CoreFieldHelpers;

  const coreHelperNames = new Set(Object.keys(coreFieldHelpers));
  for (const helperName of Object.keys(helperNamespace)) {
    if (coreHelperNames.has(helperName)) {
      throw contractError(
        'CONTRACT.PACK_CONTRIBUTION_INVALID',
        `Duplicate authoring field helper "${helperName}". Core field helpers reserve that name.`,
        { meta: { helperName } },
      );
    }
  }

  return {
    ...coreFieldHelpers,
    ...helperNamespace,
  };
}

export function createComposedAuthoringHelpers<
  Family extends FamilyPackRef<string>,
  Target extends TargetPackRef<'sql', string>,
  Extensions extends Record<string, ExtensionPackRef<'sql', string>> | undefined,
>(options: {
  readonly family: Family;
  readonly target: Target;
  readonly extensions?: Extensions;
  readonly codecLookup: CodecLookupWithDescriptors;
}): ComposedAuthoringHelpers<Family, Target, Extensions> {
  const extensionValues: readonly ExtensionPackRef<'sql', string>[] = Object.values(
    (options.extensions ?? {}) as Record<string, ExtensionPackRef<'sql', string>>,
  );
  const components: readonly AuthoringComponent[] = [
    options.family,
    options.target,
    ...extensionValues,
  ];

  const typeNamespace = composeTypeNamespace(components);
  const fieldNamespace = composeFieldNamespace(components);
  const entityNamespace = composeEntityNamespace(components);
  // Mirrors the call in `assembleAuthoringContributions`: PSL composes via
  // `createControlStack`, the TS DSL composes here. Both seams need the guard.
  assertNoCrossRegistryCollisions(typeNamespace, fieldNamespace, entityNamespace);
  assertNoBuiltInEntityCollisions(entityNamespace);
  for (const component of components) {
    assertTypeChoicesValid(
      component.authoring?.type ?? {},
      component.id ?? '<unknown>',
      typeNamespace,
    );
  }
  const { support } = assembleDataTypeSupport(
    components,
    (codecId) => options.codecLookup.descriptorFor(codecId)?.dataType,
  );
  const helperLookups: AuthoringHelperLookups = {
    codecLookup: options.codecLookup,
    dataTypes: support,
  };

  return blindCast<
    ComposedAuthoringHelpers<Family, Target, Extensions>,
    'the helpers are the same objects for every set of packs; the packs decide only their types'
  >({
    ...createEntityHelpersFromNamespace(entityNamespace, {
      ctx: {
        family: options.family.familyId,
        target: options.target.targetId,
        codecLookup: options.codecLookup,
        dataTypes: support,
      },
    }),
    field: createComposedFieldHelpers(fieldNamespace, helperLookups),
    model,
    rel,
    type: createTypeHelpersFromNamespace(typeNamespace, helperLookups),
    gen: createGeneratorHelpers([options.family, options.target, ...extensionValues]),
  });
}
