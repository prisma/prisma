import type {
  ContractSourceDiagnostic,
  ContractSourceDiagnostics,
} from '@internal/config/config-types';
import { buildExecutionSection, computeProfileHash } from '@internal/contract/hashing';
import {
  type Contract,
  type ContractEnum,
  type ContractField,
  type ContractReferenceRelation,
  type ContractValueObject,
  type CrossReference,
  crossRef,
  type ExecutionMutationDefault,
  type ExecutionMutationDefaultPhases,
  type ExecutionMutationDefaultValue,
  type JsonValue,
  type ValueSetRef,
} from '@internal/contract/types';
import { type EnumTypeHandle, resolveToOneRelationNullable } from '@internal/contract-authoring';
import type {
  AuthoringContributions,
  AuthoringEntityContext,
  AuthoringTypeConstructorDescriptor,
  AuthoringTypeNamespace,
  DataTypeSupport,
  EnumBlockSite,
  ParsedPslExtensionBlock,
  WrittenValue,
} from '@internal/framework-components/authoring';
import {
  applyDiscriminatorRule,
  describeDiscriminatorRefusal,
  encodeEnumMembers,
  enumMemberProblemDiagnostic,
  instantiateAuthoringEntityType,
  isAuthoringEntityTypeDescriptor,
  isAuthoringTypeConstructorDescriptor,
} from '@internal/framework-components/authoring';
import type {
  CodecLookupWithDescriptors,
  CodecRef,
  TypeLookups,
} from '@internal/framework-components/codec';
import type { GeneratorFunctionRegistry } from '@internal/framework-components/components';
import type { ControlMutationDefaultRegistry } from '@internal/framework-components/control';
import {
  applyPolymorphicScopeToMongoIndex,
  buildMongoStorage,
  DOCUMENT_ID,
  deriveCollectionValidators,
  type MongoCollectionInput,
  type MongoContractRefusal,
  MongoIndex,
  type MongoIndexKeyDirection,
  mongoContractRefusalsOf,
  mongoValueSetsOf,
  ownStoredNameOf,
  unsupportedStoredNameReason,
} from '@internal/mongo-contract';
import type { CollationOptions } from '@internal/mongo-value/mongodb-types';
import type {
  AttributeSpecContext,
  Binder,
  BlockSymbol,
  CompositeTypeSymbol,
  FieldAttributeSpecContext,
  FieldSymbol,
  InferAttr,
  ModelSymbol,
  NamespaceSymbol,
  ParsedWrittenScalar,
  PslSpan,
  Resolution,
  SymbolTable,
} from '@internal/psl-parser';
import {
  contributedTypeOf,
  createPslDiagnosticCollector,
  type DiagnosticSource,
  diagnosticSource,
  interpretExtensionBlocks,
  isContributedTypeChoice,
  mapPslDiagnostics,
  nodePslSpan,
  type PslDiagnostic,
  type PslDiagnosticCollector,
  refuseRepeatedTypeAliasAttributes,
  typeAttributeSpecContextOfField,
  typeReferenceNode,
} from '@internal/psl-parser';
import {
  claimedBlockKeywords,
  enumMemberAttributeDiagnostics,
  fkRelationPairKey,
  type InvalidFkPairing,
  isBareTypeConstructor,
  reportPresetNotCalled,
  reportTypeConstructorNotCalled,
  unsupportedBlockDiagnostic,
} from '@internal/psl-parser/interpret';
import {
  ArrayLiteralAst,
  type DocumentAst,
  FunctionCallAst,
  type ModelAttributeAst,
  PathExprAst,
  type PslSources,
  type SyntaxNode,
} from '@internal/psl-parser/syntax';
import { assertDefined, invariant } from '@internal/utils/assertions';
import { blindCast } from '@internal/utils/casts';
import { ifDefined } from '@internal/utils/defined';
import { InternalError } from '@internal/utils/internal-error';
import { notOk, ok, type Result } from '@internal/utils/result';
import {
  type FieldPresetContext,
  type PresetWithoutEffect,
  resolveFieldPreset,
} from './field-presets';
import {
  interpretFieldAttribute,
  interpretModelAttribute,
  mongoAttributeSpecs,
} from './mongo-attribute-specs';
import {
  type MongoBackRelationCandidate,
  type MongoForeignKeyRelation,
  pairMongoBackRelations,
} from './pair-back-relations';
import { defaultCollectionName, getAttribute } from './psl-helpers';
import {
  lowerGeneratorAttribute,
  type ResolvedTypeAlias,
  type ResolvedTypeAliases,
  resolveMongoTypeAliases,
  scalarTypeOfChoice,
  scalarTypeOfConstructor,
} from './type-aliases';

export interface InterpretPslDocumentToMongoContractInput {
  readonly documents: readonly DocumentAst[];
  readonly symbolTable: SymbolTable;
  readonly sources: PslSources;
  readonly binder: Binder;
  readonly scalarTypeCodecIds: ReadonlyMap<string, string>;
  readonly defaultFunctionRegistry: ControlMutationDefaultRegistry;
  /** The stack's generator functions, which `@onCreate(fn())` and `@onUpdate(fn())` resolve through. */
  readonly generatorFunctions: GeneratorFunctionRegistry;
  readonly dataTypes: DataTypeSupport;
  readonly codecLookup: CodecLookupWithDescriptors;
  readonly seedDiagnostics?: readonly ContractSourceDiagnostic[];
  readonly authoringContributions?: AuthoringContributions;
  /** The target's default codec ids for an `enum` block that omits `@@type`. */
  readonly enumInferenceCodecs?: { readonly text: string; readonly int: string };
  /** Receives a warning for each field typed with a deprecated scalar name. */
  readonly reportWarning?: (diagnostic: ContractSourceDiagnostic) => void;
}

/**
 * Reports `PSL_DEPRECATED_SCALAR_NAME` at the type of a field whose scalar name is a deprecated alias, naming the replacement. The alias resolves to the same codec, so the contract does not change.
 */
function deprecatedScalarWarner(input: {
  readonly sources: PslSources;
  readonly reportWarning: ((diagnostic: ContractSourceDiagnostic) => void) | undefined;
}): (field: FieldSymbol, descriptor: AuthoringTypeConstructorDescriptor) => void {
  const { reportWarning } = input;
  if (reportWarning === undefined) return () => {};
  return (field, descriptor) => {
    if (descriptor.deprecated === undefined) {
      return;
    }
    const typeNode = field.node.typeAnnotation()?.name()?.syntax ?? field.node.syntax;
    const [warning] = mapPslDiagnostics(
      [
        {
          code: 'PSL_DEPRECATED_SCALAR_NAME',
          message: `Scalar type "${field.typeName}" is deprecated and will be removed; use "${descriptor.deprecated.replacement}".`,
          ...diagnosticSource(input.sources, typeNode).at(),
        },
      ],
      input.sources,
    );
    if (warning !== undefined) reportWarning({ ...warning, severity: 'warning' });
  };
}

interface ScalarNames {
  readonly warnDeprecated: (
    field: FieldSymbol,
    descriptor: AuthoringTypeConstructorDescriptor,
  ) => void;
}

/**
 * Reports `PSL_PRESET_WITHOUT_EFFECT` for a preset call that fills nothing, such as `temporal.timestamp()` with no phase: it is stored exactly like the scalar type with the same codec, which the warning names.
 */
function presetWithoutEffectWarner(input: {
  readonly types: AuthoringTypeNamespace | undefined;
  readonly scalarTypeCodecIds: ReadonlyMap<string, string>;
  readonly sources: PslSources;
  readonly reportWarning: ((diagnostic: ContractSourceDiagnostic) => void) | undefined;
}): (preset: PresetWithoutEffect) => void {
  const { reportWarning } = input;
  if (reportWarning === undefined) return () => {};
  return ({ field, entityLabel, helperPath, descriptor, codecId }) => {
    const typeName = [...input.scalarTypeCodecIds].find(([name, id]) => {
      const type = input.types?.[name];
      const deprecated =
        type !== undefined &&
        isAuthoringTypeConstructorDescriptor(type) &&
        type.deprecated !== undefined;
      return id === codecId && !deprecated;
    })?.[0];
    if (typeName === undefined) return;
    const phases = (descriptor.args ?? []).flatMap((arg) =>
      arg.kind === 'option' && arg.name !== undefined
        ? [{ name: arg.name, value: arg.values[0] }]
        : [],
    );
    const without =
      phases.length === 0 ? '' : ` without ${phases.map(({ name }) => name).join(' or ')}`;
    const pass =
      phases.length === 0
        ? ''
        : `, or pass ${phases.map(({ name, value }) => `${name}: ${value}`).join(' or ')}`;
    const call = field.typeConstructor?.span;
    const [warning] = mapPslDiagnostics(
      [
        {
          code: 'PSL_PRESET_WITHOUT_EFFECT',
          message: `${entityLabel} uses ${helperPath}()${without}, so nothing fills it and it is stored exactly like ${typeName}. Write ${typeName}${pass}.`,
          ...diagnosticSource(input.sources, field.node.syntax).at(call ?? field.span),
        },
      ],
      input.sources,
    );
    if (warning !== undefined) reportWarning({ ...warning, severity: 'warning' });
  };
}

/**
 * Mongo's PSL surface binds the database from the connection string, so every
 * explicit namespace block is invalid, including `namespace unbound { … }`.
 */
function validateNamespaceBlocksForMongoTarget(input: {
  readonly namespaces: readonly NamespaceSymbol[];
  readonly sources: PslSources;
  readonly binder: Binder;
  readonly diagnostics: PslDiagnosticCollector;
}): void {
  for (const namespace of input.namespaces) {
    for (const { node, span } of namespace.declarations) {
      input.diagnostics.push({
        code: 'PSL_UNSUPPORTED_NAMESPACE_BLOCK',
        message: `Mongo does not support \`namespace ${node.name()?.name() ?? namespace.name} { … }\` blocks (the database is bound by the connection string; declare models at the document top level instead).`,
        ...diagnosticSource(input.sources, node.syntax).at(span),
      });
    }
  }
}

function relationNullabilityMismatchDiagnostic(
  modelName: string,
  field: FieldSymbol,
  sources: PslSources,
): PslDiagnostic {
  const source = diagnosticSource(sources, field.node.syntax);
  const fieldLabel = `Relation field "${modelName}.${field.name}"`;
  return {
    code: 'PSL_RELATION_NULLABILITY_MISMATCH',
    message: field.optional
      ? `${fieldLabel} is optional but every field in @relation(fields: [...]) is required. Make one of those fields optional with "?" or remove "?" from "${field.name}".`
      : `${fieldLabel} is required but a field in @relation(fields: [...]) is optional. Add "?" to "${field.name}" or make those fields required.`,
    ...source.at(field.span),
  };
}

function resolvePhysicalNames(input: {
  readonly model: ModelSymbol;
  readonly physicalNames: Map<ModelSymbol | FieldSymbol, string>;
  readonly specContext: AttributeSpecContext;
  readonly sources: PslSources;
  readonly binder: Binder;
  readonly diagnostics: PslDiagnosticCollector;
}): void {
  const { model, physicalNames, specContext, sources, binder, diagnostics } = input;
  const modelMap = model.attributes.find((attr) => attr.name === 'map');
  const collectionName = modelMap
    ? interpretModelAttribute({
        symbols: specContext.symbols,
        node: modelMap.node,
        spec: mongoAttributeSpecs.model.map(specContext),
        model,
        sources,
        binder,
        diagnostics,
      })?.name
    : undefined;
  physicalNames.set(model, collectionName ?? defaultCollectionName(model.name));
  for (const field of Object.values(model.fields)) {
    const fieldMap = field.attributes.find((attr) => attr.name === 'map');
    const mapped = fieldMap
      ? interpretFieldAttribute({
          symbols: specContext.symbols,
          node: fieldMap.node,
          spec: mongoAttributeSpecs.field.map({
            ...specContext,
            field,
            typeResolution: fieldTypeResolution(field, binder),
            contributedType: contributedTypeOf(
              fieldTypeResolution(field, binder),
              binder,
              field.typeConstructor,
            ),
          }),
          model,
          field,
          sources,
          binder,
          diagnostics,
        })?.name
      : undefined;
    physicalNames.set(field, mapped ?? field.name);
  }
}

function physicalName(
  physicalNames: ReadonlyMap<ModelSymbol | FieldSymbol, string>,
  symbol: ModelSymbol | FieldSymbol | undefined,
): string {
  assertDefined(symbol, 'Physical names require a bound declaration');
  const name = physicalNames.get(symbol);
  assertDefined(name, 'Physical names must be populated before lowering');
  return name;
}

interface MongoModelEntry {
  readonly fields: Record<string, ContractField>;
  readonly relations: Record<string, ContractReferenceRelation>;
  readonly storage: {
    readonly collection: string;
    readonly fields: Readonly<Record<string, { readonly field: string }>>;
  };
  readonly discriminator?: { readonly field: string };
  readonly variants?: Record<string, CrossReference>;
  readonly base?: CrossReference;
}

type DiscriminatorDeclaration = {
  readonly fieldName: string;
  readonly source: DiagnosticSource;
  readonly span: PslSpan;
};
type BaseDeclaration = {
  readonly base: ModelSymbol;
  /** The discriminator value as the discriminator field stores it; `undefined` when the base has no valid discriminator or the value was refused. */
  readonly value: string | undefined;
  readonly collectionName: string;
  readonly source: DiagnosticSource;
  readonly span: PslSpan;
};
/**
 * The `@@discriminator` and `@@base` attributes already reported: a discriminator refused by the discriminator rule or failed to parse, and the base a `@@base` that failed to parse names, as written. No orphan diagnostic is added for them.
 */
type ReportedPolymorphism = {
  readonly discriminators: Set<ModelSymbol>;
  readonly baseTargets: Set<string>;
};
type PendingBaseDeclaration = Omit<BaseDeclaration, 'value'> & {
  readonly written: ParsedWrittenScalar;
};

function collectPolymorphismDeclarations(input: {
  readonly models: readonly ModelSymbol[];
  readonly entries: Readonly<Record<string, MongoModelEntry>>;
  readonly enums: Readonly<Record<string, ContractEnum>>;
  readonly specContextFor: (model: ModelSymbol) => AttributeSpecContext;
  readonly physicalNames: ReadonlyMap<ModelSymbol | FieldSymbol, string>;
  readonly sources: PslSources;
  readonly binder: Binder;
  readonly codecLookup: CodecLookupWithDescriptors;
  readonly dataTypes: DataTypeSupport;
  readonly diagnostics: PslDiagnosticCollector;
}): {
  discriminatorDeclarations: Map<ModelSymbol, DiscriminatorDeclaration>;
  baseDeclarations: Map<ModelSymbol, BaseDeclaration>;
  reported: ReportedPolymorphism;
} {
  const { sources, binder, diagnostics } = input;
  const pendingDiscriminators = new Map<ModelSymbol, DiscriminatorDeclaration>();
  const pendingBases = new Map<ModelSymbol, PendingBaseDeclaration>();
  const reported: ReportedPolymorphism = { discriminators: new Set(), baseTargets: new Set() };

  for (const model of input.models) {
    const specContext = input.specContextFor(model);
    const discNode = model.attributes.find((attr) => attr.name === 'discriminator')?.node;
    if (discNode) {
      const parsed = interpretModelAttribute({
        symbols: specContext.symbols,
        node: discNode,
        spec: mongoAttributeSpecs.model.discriminator(specContext),
        model,
        sources,
        binder,
        diagnostics,
      });
      if (parsed) {
        pendingDiscriminators.set(model, {
          fieldName: parsed.field,
          source: diagnosticSource(sources, discNode.syntax),
          span: nodePslSpan(discNode.syntax, sources),
        });
      } else {
        reported.discriminators.add(model);
      }
    }
    const baseAttribute = model.attributes.find((attr) => attr.name === 'base');
    const baseNode = baseAttribute?.node;
    if (baseNode) {
      const parsed = interpretModelAttribute({
        symbols: specContext.symbols,
        node: baseNode,
        spec: mongoAttributeSpecs.model.base(),
        model,
        sources,
        binder,
        diagnostics,
      });
      if (parsed) {
        pendingBases.set(model, {
          base: parsed.base.declaration,
          written: parsed.value,
          collectionName: physicalName(input.physicalNames, model),
          source: diagnosticSource(sources, baseNode.syntax),
          span: nodePslSpan(baseNode.syntax, sources),
        });
      } else {
        const target = baseAttribute?.args[0]?.value;
        if (target !== undefined) reported.baseTargets.add(target);
      }
    }
  }

  const discriminatorDeclarations = new Map<ModelSymbol, DiscriminatorDeclaration>();
  const values = new Map<ModelSymbol, string>();
  for (const [model, declaration] of pendingDiscriminators) {
    const field = input.entries[model.name]?.fields[declaration.fieldName];
    if (field === undefined) {
      discriminatorDeclarations.set(model, declaration);
      continue;
    }
    const bases = [...pendingBases].filter(([, base]) => base.base === model);
    const accepted = acceptedDiscriminator(model, declaration, field, bases, input);
    if (accepted === undefined) {
      reported.discriminators.add(model);
      continue;
    }
    discriminatorDeclarations.set(model, declaration);
    for (const [variant, value] of accepted) values.set(variant, value);
  }

  const baseDeclarations = new Map<ModelSymbol, BaseDeclaration>();
  for (const [model, { base, collectionName, source, span }] of pendingBases) {
    baseDeclarations.set(model, { base, collectionName, source, span, value: values.get(model) });
  }
  return { discriminatorDeclarations, baseDeclarations, reported };
}

/**
 * The stored discriminator value of each variant when the discriminator rule accepts the field; `undefined` when it refuses the field. A refusal is reported at the `@@discriminator` attribute or at the `@@base` value it is about.
 */
function acceptedDiscriminator(
  model: ModelSymbol,
  declaration: DiscriminatorDeclaration,
  field: ContractField,
  bases: readonly (readonly [ModelSymbol, PendingBaseDeclaration])[],
  input: {
    readonly enums: Readonly<Record<string, ContractEnum>>;
    readonly codecLookup: CodecLookupWithDescriptors;
    readonly dataTypes: DataTypeSupport;
    readonly diagnostics: PslDiagnosticCollector;
  },
): ReadonlyMap<ModelSymbol, string> | undefined {
  const { fieldName } = declaration;
  const enumName = field.valueSet?.entityKind === 'enum' ? field.valueSet.entityName : undefined;
  const baseByVariant = new Map(bases);
  const decision = applyDiscriminatorRule({
    field: {
      ref: field.type.kind === 'scalar' ? codecRefOf(field.type) : undefined,
      nullable: field.nullable,
      many: field.many !== undefined && field.many !== false,
      enumMembers:
        enumName === undefined
          ? undefined
          : input.enums[enumName]?.members.map(({ value }) => value),
    },
    variants: bases.map(([variant, base]) => ({ key: variant, written: writtenBaseValue(base) })),
    subject: `Field "${model.name}.${fieldName}"`,
    codecLookup: input.codecLookup,
    dataTypes: input.dataTypes,
  });
  const subject = {
    modelName: model.name,
    fieldName,
    typeName: model.fields[fieldName]?.typeName ?? fieldName,
    enumName,
    variantName: (variant: ModelSymbol) => variant.name,
  };
  for (const refusal of decision.fieldRefusals) {
    input.diagnostics.push({
      code: 'PSL_INVALID_ATTRIBUTE_ARGUMENT',
      message: describeDiscriminatorRefusal(refusal, subject),
      ...declaration.source.at(declaration.span),
    });
  }
  if (decision.fieldRefusals.length > 0) return undefined;
  for (const refusal of decision.variantRefusals) {
    const base = baseByVariant.get(refusal.key);
    if (base === undefined) {
      throw new InternalError('A refused @@base value belongs to a collected variant.');
    }
    input.diagnostics.push({
      ...(refusal.kind === 'unreadable'
        ? refusal.refusal
        : {
            code: 'PSL_INVALID_ATTRIBUTE_ARGUMENT',
            message: describeDiscriminatorRefusal(refusal, subject),
          }),
      ...base.source.at(base.written.span),
    });
  }
  return decision.values;
}

/** The codec reference of a scalar field, with its type parameters. */
function codecRefOf(type: {
  readonly codecId: string;
  readonly typeParams?: Record<string, unknown>;
}): CodecRef {
  return {
    codecId: type.codecId,
    ...ifDefined(
      'typeParams',
      type.typeParams === undefined
        ? undefined
        : blindCast<JsonValue, 'type parameters are read from PSL and checked by the codec'>(
            type.typeParams,
          ),
    ),
  };
}

/** A `@@base` value as it is written; the grammar reads only a quoted string there. */
function writtenBaseValue(base: PendingBaseDeclaration): WrittenValue {
  if (base.written.written === undefined) {
    throw new InternalError('A @@base value is a quoted string, never a tagged literal.');
  }
  return base.written.written;
}

function resolvePolymorphism(input: {
  models: Record<string, MongoModelEntry>;
  roots: Record<string, CrossReference>;
  collections: Record<string, Record<string, unknown>>;
  discriminatorDeclarations: Map<ModelSymbol, DiscriminatorDeclaration>;
  baseDeclarations: Map<ModelSymbol, BaseDeclaration>;
  reported: ReportedPolymorphism;
  indexSpans: Map<MongoIndex, PslSpan>;
  modelIndexesByName: Map<string, readonly MongoIndex[]>;
  physicalNames: ReadonlyMap<ModelSymbol | FieldSymbol, string>;
  indexSources: ReadonlyMap<MongoIndex, DiagnosticSource>;
  sources: PslSources;
  namespaceId: string;
}): {
  models: Record<string, MongoModelEntry>;
  roots: Record<string, CrossReference>;
  collections: Record<string, Record<string, unknown>>;
  diagnostics: PslDiagnosticCollector;
} {
  const {
    discriminatorDeclarations,
    baseDeclarations,
    physicalNames,
    indexSpans,
    modelIndexesByName,
    indexSources,
  } = input;
  let patched = input.models;
  let roots = input.roots;
  let collections = input.collections;
  const diagnostics = createPslDiagnosticCollector(input.sources);

  for (const [declaration, decl] of discriminatorDeclarations) {
    const modelName = declaration.name;
    if (baseDeclarations.has(declaration)) {
      diagnostics.push({
        code: 'PSL_DISCRIMINATOR_AND_BASE',
        message: `Model "${modelName}" cannot have both @@discriminator and @@base`,
        ...decl.source.at(decl.span),
      });
      continue;
    }

    const model = patched[modelName];
    if (!model) continue;

    if (!Object.hasOwn(model.fields, decl.fieldName)) {
      diagnostics.push({
        code: 'PSL_DISCRIMINATOR_FIELD_NOT_FOUND',
        message: `Discriminator field "${decl.fieldName}" is not a field on model "${modelName}"`,
        ...decl.source.at(decl.span),
      });
      continue;
    }

    const variants: Record<string, CrossReference> = {};
    for (const [variant, baseDecl] of baseDeclarations) {
      if (baseDecl.base !== declaration || baseDecl.value === undefined) continue;
      const existingVariant = variants[baseDecl.value];
      if (existingVariant !== undefined) {
        diagnostics.push({
          code: 'PSL_DUPLICATE_DISCRIMINATOR_VALUE',
          message: `Discriminator value "${baseDecl.value}" is used by both "${existingVariant.model}" and "${variant.name}" on base model "${modelName}"`,
          ...baseDecl.source.at(baseDecl.span),
        });
        continue;
      }
      variants[baseDecl.value] = crossRef(variant.name, input.namespaceId);
    }

    if (Object.keys(variants).length === 0) {
      const alreadyReported =
        input.reported.baseTargets.has(modelName) ||
        [...baseDeclarations.values()].some(
          (baseDecl) => baseDecl.base === declaration && baseDecl.value === undefined,
        );
      if (alreadyReported) continue;
      diagnostics.push({
        code: 'PSL_ORPHANED_DISCRIMINATOR',
        message: `Model "${modelName}" has @@discriminator but no variant models declare @@base(${modelName}, ...)`,
        ...decl.source.at(decl.span),
      });
      continue;
    }

    patched = {
      ...patched,
      [modelName]: { ...model, discriminator: { field: decl.fieldName }, variants },
    };
  }

  for (const [variant, baseDecl] of baseDeclarations) {
    const variantName = variant.name;
    const baseName = baseDecl.base.name;
    if (!discriminatorDeclarations.has(baseDecl.base)) {
      if (input.reported.discriminators.has(baseDecl.base)) continue;
      diagnostics.push({
        code: 'PSL_ORPHANED_BASE',
        message: `Model "${variantName}" declares @@base(${baseName}, ...) but "${baseName}" has no @@discriminator`,
        ...baseDecl.source.at(baseDecl.span),
      });
      continue;
    }

    if (discriminatorDeclarations.has(variant)) {
      continue;
    }

    const baseModel = patched[baseName];
    const hasExplicitMap = getAttribute(variant.attributes, 'map') !== undefined;

    if (hasExplicitMap && baseModel && baseDecl.collectionName !== baseModel.storage.collection) {
      diagnostics.push({
        code: 'PSL_MONGO_VARIANT_SEPARATE_COLLECTION',
        message: `Mongo variant "${variantName}" cannot use a different collection than its base "${baseName}". Mongo only supports single-collection polymorphism.`,
        ...baseDecl.source.at(baseDecl.span),
      });
      continue;
    }

    const baseCollection = baseModel?.storage.collection ?? baseDecl.collectionName;
    const variantModel = patched[variantName];
    if (variantModel) {
      patched = {
        ...patched,
        [variantName]: {
          ...variantModel,
          base: crossRef(baseName, input.namespaceId),
          storage: { ...variantModel.storage, collection: baseCollection },
        },
      };
    }

    const variantCollectionName = physicalName(physicalNames, variant);
    if (roots[variantCollectionName]?.model === variantName) {
      if (variantCollectionName === baseCollection && baseModel) {
        roots = { ...roots, [variantCollectionName]: crossRef(baseName, input.namespaceId) };
      } else {
        roots = Object.fromEntries(
          Object.entries(roots).filter(([key]) => key !== variantCollectionName),
        );
      }
    }

    const variantOwnIndexes = modelIndexesByName.get(variantName) ?? [];
    const baseColl = collections[baseCollection];

    const baseModelEntry = patched[baseName];
    const discriminatorDomainField = baseModelEntry?.discriminator?.field;
    const discriminatorField =
      baseModelEntry === undefined || discriminatorDomainField === undefined
        ? undefined
        : ownStoredNameOf(baseModelEntry, discriminatorDomainField);
    const scopedVariantIndexes: MongoIndex[] = [];
    const discriminatorValue = baseDecl.value;
    if (discriminatorField && discriminatorValue !== undefined) {
      for (const idx of variantOwnIndexes) {
        const result = applyPolymorphicScopeToMongoIndex(idx, {
          discriminatorField,
          discriminatorValue,
        });
        if (result.kind === 'conflict') {
          const span = indexSpans.get(idx) ?? baseDecl.span;
          diagnostics.push({
            code: 'PSL_INVALID_INDEX',
            message: `Variant "${variantName}" index conflicts with discriminator scope: ${result.reason}`,
            ...(indexSources.get(idx) ?? baseDecl.source).at(span),
          });
          continue;
        }
        if (result.index !== idx) {
          indexSpans.set(result.index, indexSpans.get(idx) ?? baseDecl.span);
        }
        scopedVariantIndexes.push(result.index);
      }
    } else {
      scopedVariantIndexes.push(...variantOwnIndexes);
    }

    if (variantCollectionName !== baseCollection) {
      const filtered = Object.fromEntries(
        Object.entries(collections).filter(([key]) => key !== variantCollectionName),
      );
      if (scopedVariantIndexes.length > 0 && baseColl) {
        const baseIndexes = collectionIndexes(baseColl);
        collections = {
          ...filtered,
          [baseCollection]: {
            ...baseColl,
            indexes: [...baseIndexes, ...scopedVariantIndexes],
          },
        };
      } else {
        collections = filtered;
      }
    } else if (baseColl) {
      const existingIndexes = collectionIndexes(baseColl);
      const variantIndexSet = new Set<MongoIndex>(variantOwnIndexes);
      const withoutUnscopedVariants = existingIndexes.filter((idx) => !variantIndexSet.has(idx));
      const mergedIndexes = [...withoutUnscopedVariants];
      for (const idx of scopedVariantIndexes) {
        const idxKey = canonicalJson(idx);
        const isDuplicate = withoutUnscopedVariants.some(
          (existing) => canonicalJson(existing) === idxKey,
        );
        if (!isDuplicate) {
          mergedIndexes.push(idx);
        }
      }
      if (
        mergedIndexes.length !== existingIndexes.length ||
        mergedIndexes.some((idx, i) => idx !== existingIndexes[i])
      ) {
        const next: Record<string, unknown> = { ...baseColl };
        if (mergedIndexes.length > 0) {
          next['indexes'] = mergedIndexes;
        } else {
          delete next['indexes'];
        }
        collections = { ...collections, [baseCollection]: next };
      }
    }
  }

  return { models: patched, roots, collections, diagnostics };
}

function collectionIndexes(collection: Record<string, unknown>): MongoIndex[] {
  return blindCast<
    MongoIndex[],
    'Mongo collection indexes are constructed as MongoIndex arrays by this interpreter'
  >(collection['indexes'] ?? []);
}

// Property-order-stable serialization for structural equality of plain
// JSON-compatible values. Used for comparing MongoIndex shapes in
// the variant-merge dedup path where a future change to the spread order
// would otherwise produce JSON-stringify mismatches even though the
// indexes are structurally identical.
function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

type ParsedIndexField =
  | {
      readonly kind: 'field';
      readonly name: string;
      readonly direction?: 1 | -1;
    }
  | {
      readonly kind: 'wildcard';
      readonly scope?: string;
    };

function normalizeIndexField(element: NormalIndexArgs['fields'][number]): ParsedIndexField {
  if (typeof element === 'string') {
    return { kind: 'field', name: element };
  }
  if (element.fn === 'wildcard') {
    const scope = element.args['scope'];
    return typeof scope === 'string' ? { kind: 'wildcard', scope } : { kind: 'wildcard' };
  }
  const field = element.args['field'];
  invariant(typeof field === 'string', 'The sort function spec requires a field reference');
  return {
    kind: 'field',
    name: field,
    direction: element.args['direction'] === 'Desc' ? -1 : 1,
  };
}

interface SpecCollationArgs {
  readonly collationLocale?: string;
  readonly collationStrength?: number;
  readonly collationCaseLevel?: boolean;
  readonly collationCaseFirst?: string;
  readonly collationNumericOrdering?: boolean;
  readonly collationAlternate?: string;
  readonly collationMaxVariable?: string;
  readonly collationBackwards?: boolean;
  readonly collationNormalization?: boolean;
}

function buildCollationFromSpec(args: SpecCollationArgs): CollationOptions | null | undefined {
  const locale = args.collationLocale;
  if (locale === undefined) {
    const hasAnyCollationArg =
      args.collationStrength !== undefined ||
      args.collationCaseLevel !== undefined ||
      args.collationCaseFirst !== undefined ||
      args.collationNumericOrdering !== undefined ||
      args.collationAlternate !== undefined ||
      args.collationMaxVariable !== undefined ||
      args.collationBackwards !== undefined ||
      args.collationNormalization !== undefined;
    return hasAnyCollationArg ? null : undefined;
  }

  const collation: CollationOptions = { locale };
  if (args.collationStrength !== undefined) collation.strength = args.collationStrength;
  if (args.collationCaseLevel !== undefined) collation.caseLevel = args.collationCaseLevel;
  if (args.collationCaseFirst !== undefined) collation.caseFirst = args.collationCaseFirst;
  if (args.collationNumericOrdering !== undefined)
    collation.numericOrdering = args.collationNumericOrdering;
  if (args.collationAlternate !== undefined) collation.alternate = args.collationAlternate;
  if (args.collationMaxVariable !== undefined) collation.maxVariable = args.collationMaxVariable;
  if (args.collationBackwards !== undefined) collation.backwards = args.collationBackwards;
  if (args.collationNormalization !== undefined)
    collation.normalization = args.collationNormalization;
  return collation;
}

type NormalIndexArgs = InferAttr<ReturnType<typeof mongoAttributeSpecs.model.index>>;
type TextIndexArgs = InferAttr<ReturnType<typeof mongoAttributeSpecs.model.textIndex>>;

interface IndexBuildContext {
  readonly pslModel: ModelSymbol;
  readonly physicalNames: ReadonlyMap<ModelSymbol | FieldSymbol, string>;
  readonly indexableFieldNames: ReadonlySet<string>;
  readonly source: DiagnosticSource;
  readonly span: PslSpan;
  readonly diagnostics: PslDiagnosticCollector;
}

interface ResolvedIndexKeys {
  readonly keys: readonly { readonly field: string; readonly direction: MongoIndexKeyDirection }[];
  readonly hasWildcard: boolean;
}

function resolveIndexKeys(
  parsedFields: readonly ParsedIndexField[],
  defaultDirection: MongoIndexKeyDirection,
  ctx: IndexBuildContext,
): ResolvedIndexKeys | undefined {
  const wildcardCount = parsedFields.filter((field) => field.kind === 'wildcard').length;
  if (wildcardCount > 1) {
    ctx.diagnostics.push({
      code: 'PSL_INVALID_INDEX',
      message: 'An index can contain at most one wildcard() field',
      ...ctx.source.at(ctx.span),
    });
    return undefined;
  }

  for (const field of parsedFields) {
    const fieldName = field.kind === 'wildcard' ? field.scope : field.name;
    if (fieldName !== undefined && !ctx.indexableFieldNames.has(fieldName)) {
      ctx.diagnostics.push({
        code: 'PSL_INDEX_FIELD_NOT_FOUND',
        message: `Index on model "${ctx.pslModel.name}" references unknown field "${fieldName}"`,
        ...ctx.source.at(ctx.span),
      });
      return undefined;
    }
  }

  const keys = parsedFields.map((field) => {
    if (field.kind === 'wildcard') {
      if (field.scope === undefined) return { field: '$**', direction: defaultDirection };
      const mappedScope = physicalName(ctx.physicalNames, ctx.pslModel.fields[field.scope]);
      return { field: `${mappedScope}.$**`, direction: defaultDirection };
    }
    const mappedName = physicalName(ctx.physicalNames, ctx.pslModel.fields[field.name]);
    return { field: mappedName, direction: field.direction ?? defaultDirection };
  });
  return { keys, hasWildcard: wildcardCount === 1 };
}

function buildProjection(
  include: readonly string[] | undefined,
  exclude: readonly string[] | undefined,
  hasWildcard: boolean,
  ctx: IndexBuildContext,
): Record<string, 0 | 1> | null | undefined {
  if (include !== undefined && exclude !== undefined) {
    ctx.diagnostics.push({
      code: 'PSL_INVALID_INDEX',
      message: 'Cannot specify both include and exclude on the same index',
      ...ctx.source.at(ctx.span),
    });
    return null;
  }
  const fields = include ?? exclude;
  if (fields === undefined) return undefined;
  if (!hasWildcard) {
    ctx.diagnostics.push({
      code: 'PSL_INVALID_INDEX',
      message: 'include/exclude options are only valid when the index contains a wildcard() field',
      ...ctx.source.at(ctx.span),
    });
    return null;
  }
  if (fields.length === 0) return undefined;
  const value = include === undefined ? 0 : 1;
  const projection: Record<string, 0 | 1> = {};
  for (const field of fields) projection[field] = value;
  return projection;
}

function buildNormalIndex(
  parsed: NormalIndexArgs,
  unique: boolean,
  ctx: IndexBuildContext,
): MongoIndex | undefined {
  const parsedFields = parsed.fields.map(normalizeIndexField);
  if (parsedFields.length === 0) return undefined;
  const defaultDirection = parsed.type ?? 1;
  const resolved = resolveIndexKeys(parsedFields, defaultDirection, ctx);
  if (!resolved) return undefined;

  if (unique && resolved.hasWildcard) {
    ctx.diagnostics.push({
      code: 'PSL_INVALID_INDEX',
      message: 'Unique indexes cannot use wildcard() fields',
      ...ctx.source.at(ctx.span),
    });
    return undefined;
  }
  if (
    resolved.hasWildcard &&
    typeof defaultDirection === 'string' &&
    ['hashed', '2dsphere', '2d'].includes(defaultDirection)
  ) {
    ctx.diagnostics.push({
      code: 'PSL_INVALID_INDEX',
      message: `wildcard() fields cannot be combined with type: ${defaultDirection}`,
      ...ctx.source.at(ctx.span),
    });
    return undefined;
  }
  if (defaultDirection === 'hashed' && parsedFields.length > 1) {
    ctx.diagnostics.push({
      code: 'PSL_INVALID_INDEX',
      message: 'Hashed indexes must have exactly one field',
      ...ctx.source.at(ctx.span),
    });
    return undefined;
  }
  if (resolved.hasWildcard && parsed.expireAfterSeconds !== undefined) {
    ctx.diagnostics.push({
      code: 'PSL_INVALID_INDEX',
      message: 'expireAfterSeconds cannot be combined with wildcard() fields',
      ...ctx.source.at(ctx.span),
    });
    return undefined;
  }

  const wildcardProjection = buildProjection(
    parsed.include,
    parsed.exclude,
    resolved.hasWildcard,
    ctx,
  );
  if (wildcardProjection === null) return undefined;
  const collation = buildCollationFromSpec(parsed);
  if (collation === null) {
    ctx.diagnostics.push({
      code: 'PSL_INVALID_INDEX',
      message: 'collationLocale is required when using collation options',
      ...ctx.source.at(ctx.span),
    });
    return undefined;
  }

  return new MongoIndex({
    keys: resolved.keys,
    ...(unique && { unique: true }),
    ...(parsed.sparse !== undefined && { sparse: parsed.sparse }),
    ...(parsed.expireAfterSeconds !== undefined && {
      expireAfterSeconds: parsed.expireAfterSeconds,
    }),
    ...(parsed.filter !== undefined && { partialFilterExpression: parsed.filter }),
    ...(wildcardProjection !== undefined && { wildcardProjection }),
    ...(collation !== undefined && { collation }),
    ...(parsed.default_language !== undefined && { default_language: parsed.default_language }),
    ...(parsed.languageOverride !== undefined && { language_override: parsed.languageOverride }),
  });
}

function buildTextIndex(parsed: TextIndexArgs, ctx: IndexBuildContext): MongoIndex | undefined {
  const parsedFields = parsed.fields.map(normalizeIndexField);
  if (parsedFields.length === 0) return undefined;
  const resolved = resolveIndexKeys(parsedFields, 'text', ctx);
  if (!resolved) return undefined;
  if (resolved.hasWildcard) {
    ctx.diagnostics.push({
      code: 'PSL_INVALID_INDEX',
      message: 'wildcard() fields cannot be combined with type: hashed/2dsphere/2d or @@textIndex',
      ...ctx.source.at(ctx.span),
    });
    return undefined;
  }

  const collation = buildCollationFromSpec(parsed);
  if (collation === null) {
    ctx.diagnostics.push({
      code: 'PSL_INVALID_INDEX',
      message: 'collationLocale is required when using collation options',
      ...ctx.source.at(ctx.span),
    });
    return undefined;
  }

  return new MongoIndex({
    keys: resolved.keys,
    ...(parsed.filter !== undefined && { partialFilterExpression: parsed.filter }),
    ...(collation !== undefined && { collation }),
    ...ifDefined('weights', parsed.weights),
    ...(parsed.language !== undefined && { default_language: parsed.language }),
    ...(parsed.languageOverride !== undefined && { language_override: parsed.languageOverride }),
  });
}

function nestedIndexPath(
  node: ModelAttributeAst,
): { readonly path: readonly string[]; readonly syntax: SyntaxNode } | undefined {
  for (const arg of node.argList()?.args() ?? []) {
    const name = arg.name()?.name();
    const list = arg.value();
    if ((name !== undefined && name !== 'fields') || !(list instanceof ArrayLiteralAst)) continue;
    for (const element of list.elements()) {
      const field =
        element instanceof FunctionCallAst && element.name()?.identifier()?.token()?.text === 'sort'
          ? [...element.args()][0]?.value()
          : element;
      const path = field instanceof PathExprAst ? field.path() : [];
      if (field instanceof PathExprAst && path.length > 1) return { path, syntax: field.syntax };
    }
  }
  return undefined;
}

function nestedIndexPathMessage(
  path: readonly string[],
  pslModel: ModelSymbol,
  binder: Binder,
): string {
  const [root = ''] = path;
  const label = `Index field "${path.join('.')}" on model "${pslModel.name}"`;
  const rootField = Object.hasOwn(pslModel.fields, root) ? pslModel.fields[root] : undefined;
  return rootField !== undefined && fieldTypeResolution(rootField, binder)?.kind === 'compositeType'
    ? `${label} is a path into a composite type; indexes on fields of a composite type are not supported yet. Index a top-level field of "${pslModel.name}" or remove the index.`
    : `${label} is a dotted path, but "${root}" is not a field of "${pslModel.name}" whose type is a composite type, so the path names no field. List fields of "${pslModel.name}" by name.`;
}

function collectIndexes(
  pslModel: ModelSymbol,
  specContext: AttributeSpecContext,
  physicalNames: ReadonlyMap<ModelSymbol | FieldSymbol, string>,
  sources: PslSources,
  binder: Binder,
  diagnostics: PslDiagnosticCollector,
  indexSpans: Map<MongoIndex, PslSpan>,
  indexSources: Map<MongoIndex, DiagnosticSource>,
): MongoIndex[] {
  const indexes: MongoIndex[] = [];
  let textIndexCount = 0;
  const indexableFieldNames = new Set<string>();
  for (const field of Object.values(pslModel.fields)) {
    if (fieldTypeResolution(field, binder)?.kind !== 'model') indexableFieldNames.add(field.name);
  }

  for (const field of Object.values(pslModel.fields)) {
    if (fieldTypeResolution(field, binder)?.kind === 'model') continue;
    const uniqueNode = field.attributes.find((attr) => attr.name === 'unique')?.node;
    if (!uniqueNode) continue;
    const unique = interpretFieldAttribute({
      symbols: specContext.symbols,
      node: uniqueNode,
      spec: mongoAttributeSpecs.field.unique({
        ...specContext,
        field,
        typeResolution: fieldTypeResolution(field, binder),
        contributedType: contributedTypeOf(
          fieldTypeResolution(field, binder),
          binder,
          field.typeConstructor,
        ),
      }),
      model: pslModel,
      field,
      sources,
      binder,
      diagnostics,
    });
    if (unique === undefined) continue;
    const mappedName = physicalName(physicalNames, field);
    const fieldUniqueIndex = new MongoIndex({
      keys: [{ field: mappedName, direction: 1 }],
      unique: true,
    });
    indexes.push(fieldUniqueIndex);
    indexSpans.set(fieldUniqueIndex, nodePslSpan(uniqueNode.syntax, sources));
    indexSources.set(fieldUniqueIndex, diagnosticSource(sources, uniqueNode.syntax));
  }

  for (const attr of pslModel.attributes) {
    if (attr.name !== 'index' && attr.name !== 'unique' && attr.name !== 'textIndex') continue;
    const node = attr.node;
    const source = diagnosticSource(sources, node.syntax);
    const ctx: IndexBuildContext = {
      pslModel,
      physicalNames,
      indexableFieldNames,
      source,
      span: attr.span,
      diagnostics,
    };

    const nested = nestedIndexPath(node);
    if (nested !== undefined) {
      diagnostics.push({
        code: 'PSL_INVALID_INDEX',
        message: nestedIndexPathMessage(nested.path, pslModel, binder),
        ...source.at(nodePslSpan(nested.syntax, sources)),
      });
      continue;
    }

    let index: MongoIndex | undefined;
    if (attr.name === 'textIndex') {
      const parsed = interpretModelAttribute({
        symbols: specContext.symbols,
        node,
        spec: mongoAttributeSpecs.model.textIndex(specContext),
        model: pslModel,
        sources,
        binder,
        diagnostics,
      });
      if (!parsed || parsed.fields.length === 0) continue;
      textIndexCount++;
      if (textIndexCount > 1) {
        diagnostics.push({
          code: 'PSL_INVALID_INDEX',
          message: `Only one @@textIndex is allowed per collection (model "${pslModel.name}")`,
          ...source.at(attr.span),
        });
        continue;
      }
      index = buildTextIndex(parsed, ctx);
    } else {
      const unique = attr.name === 'unique';
      const parsed = interpretModelAttribute({
        symbols: specContext.symbols,
        node,
        spec: unique
          ? mongoAttributeSpecs.model.unique(specContext)
          : mongoAttributeSpecs.model.index(specContext),
        model: pslModel,
        sources,
        binder,
        diagnostics,
      });
      if (!parsed) continue;
      index = buildNormalIndex(parsed, unique, ctx);
    }

    if (!index) continue;
    indexes.push(index);
    indexSpans.set(index, attr.span);
    indexSources.set(index, source);
  }
  return indexes;
}

function fieldTypeResolution(field: FieldSymbol, binder: Binder): Resolution | undefined {
  const node = typeReferenceNode(field);
  return node === undefined ? undefined : binder.symbolForNode(node);
}

interface PresetExecutionDefault {
  readonly modelName: string;
  readonly field: FieldSymbol;
  readonly storedField: string;
  readonly phases: ExecutionMutationDefaultPhases;
  readonly fromPreset: boolean;
}

/**
 * Keys each preset's execution defaults by collection and stored field. Rejects presets on variant fields, since a default keyed by collection applies to every document in it, and merges identical defaults that two models declare for the same collection field.
 */
function resolvePresetExecutionDefaults(input: {
  readonly defaults: readonly PresetExecutionDefault[];
  readonly models: Readonly<Record<string, MongoModelEntry>>;
  readonly sources: PslSources;
  readonly diagnostics: PslDiagnosticCollector;
  readonly namespaceId: string;
}): ExecutionMutationDefault[] {
  const byRef = new Map<
    string,
    { readonly owner: PresetExecutionDefault; readonly phasesKey: string }
  >();
  const resolved: ExecutionMutationDefault[] = [];
  for (const preset of input.defaults) {
    const model = input.models[preset.modelName];
    if (model === undefined) continue;
    const collection = model.storage.collection;
    const call = preset.field.typeConstructor;
    const presetPath = call?.path.join('.') ?? preset.field.typeName;
    const at = diagnosticSource(input.sources, preset.field.node.syntax).at(
      call?.span ?? preset.field.span,
    );
    const source = preset.fromPreset ? `Preset "${presetPath}"` : 'Generated value';
    if (model.base !== undefined) {
      input.diagnostics.push({
        code: 'PSL_PRESET_ON_VARIANT_FIELD',
        message: `${source} on variant "${preset.modelName}" field "${preset.field.name}": execution defaults apply to every document in collection "${collection}", so declare them on the base model.`,
        ...at,
      });
      continue;
    }
    const refKey = JSON.stringify([collection, preset.storedField]);
    const phasesKey = canonicalJson(preset.phases);
    const existing = byRef.get(refKey);
    if (existing === undefined) {
      byRef.set(refKey, { owner: preset, phasesKey });
      resolved.push({
        ref: { namespace: input.namespaceId, entry: collection, field: preset.storedField },
        ...preset.phases,
      });
      continue;
    }
    if (existing.phasesKey !== phasesKey) {
      input.diagnostics.push({
        code: 'PSL_PRESET_CONFLICT',
        message: `${source} on "${preset.modelName}.${preset.field.name}" sets different execution defaults than "${existing.owner.modelName}.${existing.owner.field.name}" for field "${preset.storedField}" of collection "${collection}". Generate the same values on both models.`,
        ...at,
      });
    }
  }
  return resolved;
}

const GENERATOR_PHASES = ['onCreate', 'onUpdate'] as const;

/**
 * The generators a field's `@onCreate(fn())` and `@onUpdate(fn())` resolve to, `undefined` for a field with neither, or `'invalid'` when one is refused.
 */
function lowerGeneratorAttributes(input: {
  readonly field: FieldSymbol;
  readonly modelName: string;
  readonly resolved: ResolvedNonRelationField;
  readonly specContext: FieldAttributeSpecContext;
  readonly generatorFunctions: GeneratorFunctionRegistry;
  readonly sources: PslSources;
  readonly binder: Binder;
  readonly diagnostics: PslDiagnosticCollector;
}): ExecutionMutationDefaultPhases | 'invalid' | undefined {
  const { field, modelName, diagnostics } = input;
  const fieldLabel = `Field "${modelName}.${field.name}"`;
  const phases: {
    onCreate?: ExecutionMutationDefaultValue;
    onUpdate?: ExecutionMutationDefaultValue;
  } = {};
  for (const phase of GENERATOR_PHASES) {
    const [attribute, duplicate] = field.attributes.filter(({ name }) => name === phase);
    if (attribute === undefined) continue;
    if (duplicate !== undefined) {
      diagnostics.push({
        code: 'PSL_DUPLICATE_ATTRIBUTE',
        message: `\`@${phase}\` declared more than once on field "${modelName}.${field.name}".`,
        ...diagnosticSource(input.sources, field.node.syntax).at(duplicate.span),
      });
      return 'invalid';
    }
    const at = diagnosticSource(input.sources, field.node.syntax).at(attribute.span);
    const argument = attribute.args.find((arg) => arg.kind === 'positional')?.value.trim() ?? '';
    if (field.list) {
      diagnostics.push({
        code: 'PSL_LIST_EXECUTION_DEFAULT_UNSUPPORTED',
        message: `${fieldLabel} is a list and cannot use @${phase}(${argument}). Lists have no per-element generated values; remove @${phase}(...).`,
        ...at,
      });
      return 'invalid';
    }
    if (field.optional) {
      diagnostics.push({
        code: 'PSL_OPTIONAL_EXECUTION_DEFAULT_UNSUPPORTED',
        message: `${fieldLabel} is optional, and a generated value needs a required field in MongoDB. Remove "?" or remove @${phase}(...).`,
        ...at,
      });
      return 'invalid';
    }
    if (input.resolved.executionDefaults?.[phase] !== undefined) {
      const phaseText = phase === 'onCreate' ? 'on create' : 'on update';
      diagnostics.push({
        code: 'PSL_PRESET_AND_DEFAULT_CONFLICT',
        message: `${fieldLabel} uses a field-preset call that already generates a value ${phaseText}, so @${phase}(...) cannot set one too. Remove @${phase}(...) or use a preset without an ${phase} generator.`,
        ...at,
      });
      return 'invalid';
    }
    const generator = lowerGeneratorAttribute({
      phase,
      attribute,
      specContext: typeAttributeSpecContextOfField(input.specContext),
      type: input.resolved.field.type,
      symbols: input.specContext.symbols,
      binder: input.binder,
      sources: input.sources,
      generatorFunctions: input.generatorFunctions,
      diagnostics,
    });
    if (generator === undefined) return 'invalid';
    phases[phase] = generator;
  }
  return phases.onCreate === undefined && phases.onUpdate === undefined ? undefined : phases;
}

interface ResolvedNonRelationField {
  readonly field: ContractField;
  /** What the field's preset generates. */
  readonly executionDefaults?: ExecutionMutationDefaultPhases;
  /** The type alias the field is typed by. */
  readonly typeAlias?: ResolvedTypeAlias;
}

function fieldOfTypeAlias(
  field: FieldSymbol,
  typeAlias: ResolvedTypeAlias,
): ResolvedNonRelationField {
  return {
    field: {
      type: typeAlias.type,
      nullable: field.optional,
      many: field.list ? { elementNullable: field.elementOptional } : false,
      ...ifDefined('valueSet', typeAlias.valueSet),
    },
    typeAlias,
  };
}

/**
 * Whether a field may take what its type alias carries: it repeats none of the alias's attributes, and, when the alias generates a value, it is required and not a list. Reports each refusal at the field.
 */
function acceptsTypeAliasGenerators(input: {
  readonly field: FieldSymbol;
  readonly modelName: string;
  readonly typeAlias: ResolvedTypeAlias;
  readonly sources: PslSources;
  readonly diagnostics: PslDiagnosticCollector;
}): boolean {
  const { field, typeAlias, diagnostics } = input;
  const fieldPath = `${input.modelName}.${field.name}`;
  if (
    refuseRepeatedTypeAliasAttributes({
      field,
      fieldPath,
      alias: typeAlias.alias,
      sources: input.sources,
      diagnostics,
    })
  ) {
    return false;
  }
  if (typeAlias.executionDefaults === undefined) return true;
  const at = diagnosticSource(input.sources, field.node.syntax).at(field.span);
  if (field.list) {
    diagnostics.push({
      code: 'PSL_LIST_EXECUTION_DEFAULT_UNSUPPORTED',
      message: `Field "${fieldPath}" is a list, and its type alias "${typeAlias.name}" generates a value. Lists have no per-element generated values; remove "[]" or type the field without the alias.`,
      ...at,
    });
    return false;
  }
  if (field.optional) {
    diagnostics.push({
      code: 'PSL_OPTIONAL_EXECUTION_DEFAULT_UNSUPPORTED',
      message: `Field "${fieldPath}" is optional, and its type alias "${typeAlias.name}" generates a value, which needs a required field in MongoDB. Remove "?" or type the field without the alias.`,
      ...at,
    });
    return false;
  }
  return true;
}

function resolveNonRelationField(
  field: FieldSymbol,
  owner: { readonly name: string; readonly kind: 'model' | 'compositeType' },
  resolution: Resolution | undefined,
  codecIdByEnumName: ReadonlyMap<string, string>,
  presetContext: FieldPresetContext,
  scalarNames: ScalarNames,
  typeAliases: ResolvedTypeAliases,
): ResolvedNonRelationField | undefined {
  const ownerName = owner.name;
  if (resolution?.kind === 'compositeType') {
    return {
      field: {
        type: { kind: 'valueObject', name: resolution.symbol.name },
        nullable: field.optional,
        many: field.list ? { elementNullable: field.elementOptional } : false,
      },
    };
  }

  if (resolution?.kind === 'block' && resolution.symbol.keyword === 'enum') {
    const enumCodecId = codecIdByEnumName.get(resolution.symbol.name);
    if (enumCodecId === undefined) return undefined;
    const valueSet: ValueSetRef = {
      plane: 'domain',
      entityKind: 'enum',
      namespaceId: resolution.namespace.id,
      entityName: resolution.symbol.name,
    };
    return {
      field: {
        type: { kind: 'scalar', codecId: enumCodecId },
        nullable: field.optional,
        many: field.list ? { elementNullable: field.elementOptional } : false,
        valueSet,
      },
    };
  }

  if (resolution?.kind === 'namedType') {
    if (field.typeConstructor !== undefined) {
      presetContext.diagnostics.push({
        code: 'PSL_UNSUPPORTED_FIELD_TYPE',
        message: `Field "${ownerName}.${field.name}" calls "${field.typeConstructor.path.join('.')}", which is a type alias, not a type constructor. Remove the arguments.`,
        ...diagnosticSource(presetContext.sources, field.node.syntax).at(field.span),
      });
      return undefined;
    }
    const typeAlias = typeAliases.ofResolution(resolution);
    return typeAlias === undefined ? undefined : fieldOfTypeAlias(field, typeAlias);
  }

  if (
    resolution?.kind === 'model' ||
    resolution?.kind === 'block' ||
    resolution?.kind === 'crossSpace'
  ) {
    presetContext.diagnostics.push({
      code: 'PSL_UNSUPPORTED_FIELD_TYPE',
      message: `Field "${ownerName}.${field.name}" type "${field.typeName}" is not supported in Mongo PSL interpreter`,
      ...diagnosticSource(presetContext.sources, field.node.syntax).at(field.span),
    });
    return undefined;
  }
  if (resolution?.kind !== 'contributedType') {
    return undefined;
  }
  const call = field.typeConstructor;
  const entityLabel = `Field "${ownerName}.${field.name}"`;
  const source = diagnosticSource(presetContext.sources, field.node.syntax);
  if (isContributedTypeChoice(resolution.symbol)) {
    const type = scalarTypeOfChoice({
      symbol: resolution.symbol,
      call,
      span: field.span,
      codecLookup: presetContext.typeLookups.codecLookup,
      diagnostics: presetContext.diagnostics,
      source,
      entityLabel,
      dataTypes: presetContext.dataTypes,
    });
    return type === undefined
      ? undefined
      : {
          field: {
            type,
            nullable: field.optional,
            many: field.list ? { elementNullable: field.elementOptional } : false,
          },
        };
  }
  const { descriptor, path } = resolution.symbol;
  if (descriptor.kind === 'typeAlias') {
    if (call !== undefined) {
      presetContext.diagnostics.push({
        code: 'PSL_INVALID_ATTRIBUTE_ARGUMENT',
        message: `${path.join('.')} is a type alias and takes no arguments.`,
        ...source.at(call.span),
      });
      return undefined;
    }
    const typeAlias = typeAliases.ofResolution(resolution);
    invariant(typeAlias !== undefined, 'A contributed type alias always resolves');
    return fieldOfTypeAlias(field, typeAlias);
  }
  if (descriptor.kind === 'fieldPreset') {
    if (call === undefined) {
      reportPresetNotCalled({
        entityLabel,
        presetPath: path.join('.'),
        source,
        span: field.span,
        diagnostics: presetContext.diagnostics,
      });
      return undefined;
    }
    const preset = resolveFieldPreset({
      field,
      call,
      descriptor,
      ownerName,
      ownerKind: owner.kind,
      context: presetContext,
    });
    if (preset.kind === 'invalid') return undefined;
    return {
      field: preset.field,
      ...ifDefined('executionDefaults', preset.executionDefaults),
    };
  }
  if (call === undefined && !isBareTypeConstructor(descriptor)) {
    reportTypeConstructorNotCalled({
      entityLabel,
      path: path.join('.'),
      descriptor,
      source,
      span: field.span,
      diagnostics: presetContext.diagnostics,
    });
    return undefined;
  }

  if (call === undefined) scalarNames.warnDeprecated(field, descriptor);
  return {
    field: {
      type: scalarTypeOfConstructor(descriptor, call),
      nullable: field.optional,
      many: field.list ? { elementNullable: field.elementOptional } : false,
    },
  };
}

interface EnumSite {
  readonly sourceId: string;
  readonly codecSpan: PslSpan;
  readonly memberSpans: Readonly<Record<string, PslSpan>>;
}

function fieldKey(owner: string, fieldName: string): string {
  return JSON.stringify([owner, fieldName]);
}

/** The diagnostic for an enum a collection validator cannot describe, at its `@@type` or member. */
function enumRefusalDiagnostic(
  refusal: MongoContractRefusal,
  sites: ReadonlyMap<string, EnumSite>,
): ContractSourceDiagnostic | undefined {
  if (
    refusal.kind !== 'enumBsonType' &&
    refusal.kind !== 'enumNotListable' &&
    refusal.kind !== 'enumMemberNotListable'
  ) {
    return undefined;
  }
  const site = sites.get(refusal.enumName);
  assertDefined(site, `Built enum "${refusal.enumName}" has a declaration site`);
  const subject = `enum "${refusal.enumName}"`;
  if (refusal.kind === 'enumBsonType') {
    return {
      code: 'PSL_EXTENSION_INVALID_VALUE',
      message: `${subject} ${refusal.refusal.reason}`,
      sourceId: site.sourceId,
      span: site.codecSpan,
    };
  }
  if (refusal.kind === 'enumNotListable') {
    return {
      code: 'PSL_EXTENSION_INVALID_VALUE',
      message: `${subject} @@type codec "${refusal.codecId}" ${refusal.reason}`,
      sourceId: site.sourceId,
      span: site.codecSpan,
    };
  }
  return {
    code: 'PSL_EXTENSION_INVALID_VALUE',
    message: `${subject} member "${refusal.member}" ${refusal.reason}`,
    sourceId: site.sourceId,
    span: site.memberSpans[refusal.member] ?? site.codecSpan,
  };
}

/** MongoDB PSL has no control policies, so every collection is managed. */
const MONGO_PSL_CONTROL_POLICIES = { collections: {}, defaultControlPolicy: undefined } as const;

/** The diagnostic for a field a collection validator cannot describe, at the field. */
function fieldRefusalDiagnostic(
  refusal: MongoContractRefusal,
  fieldSymbols: ReadonlyMap<string, FieldSymbol>,
  sources: PslSources,
): PslDiagnostic | undefined {
  if (refusal.kind !== 'fieldBsonType' && refusal.kind !== 'documentId') return undefined;
  const owner = refusal.kind === 'fieldBsonType' ? refusal.owner.name : refusal.modelName;
  const field = fieldSymbols.get(fieldKey(owner, refusal.fieldName));
  assertDefined(field, `Field "${owner}.${refusal.fieldName}" has a declaration`);
  return {
    code: refusal.kind === 'fieldBsonType' ? 'PSL_UNSUPPORTED_FIELD_TYPE' : 'PSL_MONGO_ID_INVALID',
    message: `Field "${owner}.${field.name}" ${refusal.kind === 'fieldBsonType' ? refusal.refusal.reason : refusal.reason}`,
    ...diagnosticSource(sources, field.node.syntax).at(field.span),
  };
}

function processEnumDeclarations(input: {
  readonly enumSymbols: readonly BlockSymbol[];
  readonly parsedBlocks: ReadonlyMap<BlockSymbol, ParsedPslExtensionBlock>;
  readonly sources: PslSources;
  readonly binder: Binder;
  readonly authoringContributions: AuthoringContributions | undefined;
  readonly entityContext: AuthoringEntityContext;
  readonly diagnostics: PslDiagnosticCollector;
  /** Filled with where each built enum is declared, for diagnostics about it. */
  readonly sites: Map<string, EnumSite>;
}): Record<string, ContractEnum> {
  const builtEnums: Record<string, ContractEnum> = {};

  if (input.enumSymbols.length === 0) return builtEnums;

  const enumDescriptor =
    input.authoringContributions?.entityTypes?.['enum'] !== undefined &&
    isAuthoringEntityTypeDescriptor(input.authoringContributions.entityTypes['enum'])
      ? input.authoringContributions.entityTypes['enum']
      : undefined;

  if (!enumDescriptor) {
    for (const enumSymbol of input.enumSymbols) {
      const source = diagnosticSource(input.sources, enumSymbol.node.syntax);
      input.diagnostics.push({
        code: 'PSL_ENUM_MISSING_FACTORY',
        message: `enum "${enumSymbol.name}" requires an "enum" entityType factory in the active authoring contributions`,
        ...source.at(enumSymbol.span),
      });
    }
    return builtEnums;
  }

  for (const enumSymbol of input.enumSymbols) {
    const sourceFile = input.sources.sourceFileFor(enumSymbol.node.syntax);
    const envelope = input.parsedBlocks.get(enumSymbol);
    input.diagnostics.push(...enumMemberAttributeDiagnostics(enumSymbol, input.sources));
    if (envelope === undefined) continue;
    const handle = instantiateAuthoringEntityType<EnumTypeHandle | undefined>(
      'enum',
      enumDescriptor,
      [envelope],
      { ...input.entityContext, sourceId: sourceFile.filename },
    );

    if (handle === undefined || handle === null) continue;

    const encoded = encodeEnumMembers(handle, input.entityContext.codecLookup);
    if (!encoded.ok) {
      const site: EnumBlockSite = {
        enumName: envelope.name,
        codecId: handle.codecId,
        sourceId: sourceFile.filename,
        span: envelope.span,
        memberSpans: envelope.parameterSpans,
      };
      input.diagnostics.pushExternal(
        ...encoded.failure.map((problem) => enumMemberProblemDiagnostic(problem, site)),
      );
      continue;
    }
    builtEnums[envelope.name] = { codecId: handle.codecId, members: encoded.value };
    const typeAttribute = envelope.attributes['type'];
    input.sites.set(envelope.name, {
      sourceId: sourceFile.filename,
      codecSpan: typeAttribute?.argSpans?.['codecId'] ?? typeAttribute?.span ?? envelope.span,
      memberSpans: envelope.parameterSpans,
    });
  }

  return builtEnums;
}

export function interpretPslDocumentToMongoContract(
  input: InterpretPslDocumentToMongoContractInput,
): Result<Contract, ContractSourceDiagnostics> {
  const { symbolTable, sources, scalarTypeCodecIds, codecLookup } = input;
  const diagnostics = createPslDiagnosticCollector(sources);
  const presetContext: FieldPresetContext = {
    authoringContributions: input.authoringContributions,
    sources,
    diagnostics,
    typeLookups: { codecLookup, dataTypeLookup: input.dataTypes.lookup },
    dataTypes: input.dataTypes,
    warnPresetWithoutEffect: presetWithoutEffectWarner({
      types: input.authoringContributions?.type,
      scalarTypeCodecIds,
      sources,
      reportWarning: input.reportWarning,
    }),
  };
  const presetExecutionDefaults: PresetExecutionDefault[] = [];
  const scalarNames: ScalarNames = {
    warnDeprecated: deprecatedScalarWarner({
      sources,
      reportWarning: input.reportWarning,
    }),
  };
  const { binder } = input;
  const { parsedBlocks, diagnostics: blockDiagnostics } = interpretExtensionBlocks({
    symbolTable,
    sources,
    pslBlockDescriptors: input.authoringContributions?.pslBlockDescriptors ?? {},
    binder,
    dataTypes: input.dataTypes,
  });
  diagnostics.push(...blockDiagnostics);
  const { defaultNamespace } = symbolTable;
  validateNamespaceBlocksForMongoTarget({
    namespaces: Object.values(symbolTable.namespaces),
    sources,
    binder,
    diagnostics,
  });
  const allModels: ModelSymbol[] = Object.values(defaultNamespace.models);
  const allCompositeTypes: CompositeTypeSymbol[] = Object.values(defaultNamespace.compositeTypes);
  const { generatorFunctions } = input;
  const specContextFor = (model: ModelSymbol): AttributeSpecContext => ({
    symbols: symbolTable,
    model,
    defaultFunctionRegistry: input.defaultFunctionRegistry,
    generatorFunctions,
    dataTypes: input.dataTypes,
  });
  const physicalNames = new Map<ModelSymbol | FieldSymbol, string>();
  for (const model of allModels) {
    resolvePhysicalNames({
      model,
      physicalNames,
      specContext: specContextFor(model),
      sources,
      binder,
      diagnostics,
    });
  }

  const blockKeywords = new Set([
    'enum',
    ...claimedBlockKeywords(input.authoringContributions?.pslBlockDescriptors),
  ]);
  for (const block of Object.values(defaultNamespace.blocks)) {
    if (!blockKeywords.has(block.keyword)) {
      diagnostics.push(unsupportedBlockDiagnostic(block, sources));
    }
  }
  const topLevelEnumSymbols = Object.values(defaultNamespace.blocks).filter(
    (b) => b.keyword === 'enum',
  );

  const enumSites = new Map<string, EnumSite>();
  const builtEnums = processEnumDeclarations({
    sites: enumSites,
    enumSymbols: topLevelEnumSymbols,
    parsedBlocks,
    sources,
    binder,
    authoringContributions: input.authoringContributions,
    entityContext: {
      family: 'mongo',
      target: 'mongo',
      ...ifDefined('enumInferenceCodecs', input.enumInferenceCodecs),
      codecLookup,
      dataTypes: input.dataTypes,
      diagnostics: {
        push: (d) => {
          diagnostics.pushExternal(
            blindCast<ContractSourceDiagnostic, 'sink diagnostics are span-compatible'>(d),
          );
        },
      },
    },
    diagnostics,
  });

  const codecIdByEnumName: Map<string, string> = new Map(
    Object.entries(builtEnums).map(([name, e]) => [name, e.codecId]),
  );
  const typeAliases = resolveMongoTypeAliases({
    declarations: Object.values(symbolTable.namedTypes),
    symbols: symbolTable,
    binder,
    sources,
    diagnostics,
    codecIdByEnumName,
    defaultFunctionRegistry: input.defaultFunctionRegistry,
    generatorFunctions,
    dataTypes: input.dataTypes,
    codecLookup: input.codecLookup,
    authoringTypes: input.authoringContributions?.type,
  });

  const models: Record<string, MongoModelEntry> = {};
  const collections: Record<string, Record<string, unknown>> = {};
  const roots: Record<string, CrossReference> = {};
  const allFkRelations: MongoForeignKeyRelation[] = [];
  const indexSpans = new Map<MongoIndex, PslSpan>();
  const indexSources = new Map<MongoIndex, DiagnosticSource>();
  const modelIndexesByName = new Map<string, readonly MongoIndex[]>();

  const backrelationCandidates: MongoBackRelationCandidate[] = [];
  const invalidFkPairings: InvalidFkPairing[] = [];

  const validatorLookups: TypeLookups = {
    codecLookup,
    dataTypeLookup: input.dataTypes.lookup,
  };

  const fieldSymbols = new Map<string, FieldSymbol>();

  for (const pslModel of allModels) {
    const collectionName = physicalName(physicalNames, pslModel);
    const specContext = specContextFor(pslModel);

    const fields: Record<string, ContractField> = {};
    const storageFields: Record<string, { readonly field: string }> = {};
    const fieldsByStoredName = new Map<string, string>();
    const relations: Record<string, ContractReferenceRelation> = {};

    for (const field of Object.values(pslModel.fields)) {
      const resolution = fieldTypeResolution(field, binder);
      if (resolution?.kind === 'model') {
        const target = resolution.symbol;
        const relationNode = field.attributes.find((attr) => attr.name === 'relation')?.node;
        const relation = relationNode
          ? interpretFieldAttribute({
              symbols: specContext.symbols,
              node: relationNode,
              spec: mongoAttributeSpecs.field.relation({
                ...specContext,
                field,
                typeResolution: fieldTypeResolution(field, binder),
                contributedType: contributedTypeOf(
                  fieldTypeResolution(field, binder),
                  binder,
                  field.typeConstructor,
                ),
              }),
              model: pslModel,
              field,
              sources,
              binder,
              diagnostics,
            })
          : undefined;

        if (field.list || !(relation?.fields && relation?.references)) {
          backrelationCandidates.push({
            modelName: pslModel.name,
            targetModelName: target.name,
            ...ifDefined('relationName', relation?.name),
            cardinality: field.list ? '1:N' : '1:1',
            field,
            sources,
          });
          continue;
        }

        if (relation?.fields && relation?.references) {
          const nullability = resolveToOneRelationNullable({
            declaredNullable: field.optional,
            localFieldNullability: relation.fields.map(
              (localFieldName) => pslModel.fields[localFieldName]?.optional === true,
            ),
            ownsReference: true,
          });
          if (nullability.contradiction !== undefined) {
            diagnostics.push(relationNullabilityMismatchDiagnostic(pslModel.name, field, sources));
            invalidFkPairings.push({
              pairKey: fkRelationPairKey(pslModel.name, target.name),
              ...ifDefined('relationName', relation.name),
            });
            continue;
          }
          if (!physicalNames.has(target)) continue;

          relations[field.name] = {
            to: crossRef(target.name, defaultNamespace.id),
            cardinality: 'N:1' as const,
            nullable: field.optional,
            on: {
              localFields: relation.fields,
              targetFields: relation.references,
            },
          };

          allFkRelations.push({
            declaringModel: pslModel.name,
            targetModel: target.name,
            ...ifDefined('relationName', relation.name),
            localFields: relation.fields,
            targetFields: relation.references,
          });
        }
        continue;
      }

      const resolved = resolveNonRelationField(
        field,
        { name: pslModel.name, kind: 'model' },
        resolution,
        codecIdByEnumName,
        presetContext,
        scalarNames,
        typeAliases,
      );
      if (!resolved) continue;
      if (
        resolved.typeAlias !== undefined &&
        !acceptsTypeAliasGenerators({
          field,
          modelName: pslModel.name,
          typeAlias: resolved.typeAlias,
          sources,
          diagnostics,
        })
      ) {
        continue;
      }

      const mappedName = physicalName(physicalNames, field);
      const unsupported = unsupportedStoredNameReason(mappedName);
      if (unsupported !== undefined) {
        diagnostics.push({
          code: 'PSL_STORED_NAME_UNSUPPORTED',
          message: `Field "${pslModel.name}.${field.name}" ${unsupported}. Give the field another stored name with @map.`,
          ...diagnosticSource(sources, field.node.syntax).at(field.span),
        });
        continue;
      }
      const sharingField = fieldsByStoredName.get(mappedName);
      if (sharingField !== undefined) {
        diagnostics.push({
          code: 'PSL_DUPLICATE_STORED_NAME',
          message: `Fields "${pslModel.name}.${sharingField}" and "${pslModel.name}.${field.name}" are both stored as "${mappedName}". Give each field its own stored name with @map.`,
          ...diagnosticSource(sources, field.node.syntax).at(field.span),
        });
        continue;
      }
      fieldsByStoredName.set(mappedName, field.name);
      fields[field.name] = resolved.field;
      storageFields[field.name] = { field: mappedName };
      fieldSymbols.set(fieldKey(pslModel.name, field.name), field);
      const generated = lowerGeneratorAttributes({
        field,
        modelName: pslModel.name,
        resolved,
        specContext: {
          ...specContext,
          field,
          typeResolution: resolution,
          contributedType: contributedTypeOf(resolution, binder, field.typeConstructor),
        },
        generatorFunctions,
        sources,
        binder,
        diagnostics,
      });
      if (generated === 'invalid') continue;
      const inherited = resolved.executionDefaults ?? resolved.typeAlias?.executionDefaults;
      const phases = inherited === undefined ? generated : { ...inherited, ...generated };
      if (phases !== undefined) {
        presetExecutionDefaults.push({
          modelName: pslModel.name,
          field,
          storedField: mappedName,
          phases,
          fromPreset: resolved.executionDefaults !== undefined,
        });
      }
    }

    const idFields: FieldSymbol[] = [];
    for (const field of Object.values(pslModel.fields)) {
      const idNode = field.attributes.find((attr) => attr.name === 'id')?.node;
      if (!idNode) continue;
      const interpreted = interpretFieldAttribute({
        symbols: specContext.symbols,
        node: idNode,
        spec: mongoAttributeSpecs.field.id({
          ...specContext,
          field,
          typeResolution: fieldTypeResolution(field, binder),
          contributedType: contributedTypeOf(
            fieldTypeResolution(field, binder),
            binder,
            field.typeConstructor,
          ),
        }),
        model: pslModel,
        field,
        sources,
        binder,
        diagnostics,
      });
      if (interpreted === undefined) continue;
      idFields.push(field);
      const storedName = physicalName(physicalNames, field);
      if (storedName !== DOCUMENT_ID) {
        diagnostics.push({
          code: 'PSL_MONGO_ID_ATTRIBUTE_INVALID',
          message: `Field "${pslModel.name}.${field.name}" has @id but is stored as "${storedName}". In MongoDB, @id marks the field stored as _id, the document id: add @map("_id") to it, or remove @id.`,
          ...diagnosticSource(sources, field.node.syntax).at(field.span),
        });
      }
    }
    const [, secondIdField] = idFields;
    if (secondIdField !== undefined) {
      diagnostics.push({
        code: 'PSL_MONGO_ID_ATTRIBUTE_INVALID',
        message: `Model "${pslModel.name}" has @id on ${idFields.length} fields, ${idFields.map((field) => `"${field.name}"`).join(' and ')}. A document has one id: keep @id only on the field stored as _id.`,
        ...diagnosticSource(sources, secondIdField.node.syntax).at(secondIdField.span),
      });
    }

    models[pslModel.name] = {
      fields,
      relations,
      storage: { collection: collectionName, fields: storageFields },
    };
    const modelIndexes = collectIndexes(
      pslModel,
      specContext,
      physicalNames,
      sources,
      binder,
      diagnostics,
      indexSpans,
      indexSources,
    );
    modelIndexesByName.set(pslModel.name, modelIndexes);
    const existingColl = collections[collectionName];
    if (existingColl && modelIndexes.length > 0) {
      const existingIndexes = collectionIndexes(existingColl);
      collections[collectionName] = { indexes: [...existingIndexes, ...modelIndexes] };
    } else if (!existingColl) {
      collections[collectionName] = modelIndexes.length > 0 ? { indexes: modelIndexes } : {};
    }
    roots[collectionName] = crossRef(pslModel.name, defaultNamespace.id);
  }

  const valueObjects: Record<string, ContractValueObject> = {};
  for (const compositeType of allCompositeTypes) {
    const fields: Record<string, ContractField> = {};
    for (const field of Object.values(compositeType.fields)) {
      const fieldMap = field.attributes.find((attr) => attr.name === 'map');
      if (fieldMap !== undefined) {
        diagnostics.push({
          code: 'PSL_MONGO_TYPE_FIELD_MAP_UNSUPPORTED',
          message: `Field "${compositeType.name}.${field.name}" has @map, but a field of a composite type is stored under its own name. Remove @map, or rename the field to the name it is stored under.`,
          ...diagnosticSource(sources, fieldMap.node.syntax).at(
            nodePslSpan(fieldMap.node.syntax, sources),
          ),
        });
      }
      const resolved = resolveNonRelationField(
        field,
        { name: compositeType.name, kind: 'compositeType' },
        fieldTypeResolution(field, binder),
        codecIdByEnumName,
        presetContext,
        scalarNames,
        typeAliases,
      );
      if (!resolved) continue;
      if (resolved.typeAlias?.executionDefaults !== undefined) {
        diagnostics.push({
          code: 'PSL_UNSUPPORTED_FIELD_TYPE',
          message: `Member "${field.name}" of composite type "${compositeType.name}" is typed by the type alias "${resolved.typeAlias.name}", which generates a value; a composite type member has no generated values.`,
          ...diagnosticSource(sources, field.node.syntax).at(field.span),
        });
        continue;
      }
      fields[field.name] = resolved.field;
      fieldSymbols.set(fieldKey(compositeType.name, field.name), field);
    }
    valueObjects[compositeType.name] = { fields };
  }

  const paired = pairMongoBackRelations({
    foreignKeys: allFkRelations,
    candidates: backrelationCandidates,
    invalidFkPairings,
    namespaceId: defaultNamespace.id,
  });
  diagnostics.push(...paired.diagnostics);
  for (const { modelName, fieldName, relation } of paired.relations) {
    const modelEntry = models[modelName];
    if (modelEntry) modelEntry.relations[fieldName] = relation;
  }

  const { discriminatorDeclarations, baseDeclarations, reported } = collectPolymorphismDeclarations(
    {
      models: allModels,
      entries: models,
      enums: builtEnums,
      specContextFor,
      physicalNames,
      sources,
      binder,
      codecLookup,
      dataTypes: input.dataTypes,
      diagnostics,
    },
  );
  const polyResult = resolvePolymorphism({
    namespaceId: defaultNamespace.id,
    sources,
    models,
    roots,
    collections,
    discriminatorDeclarations,
    baseDeclarations,
    reported,
    indexSpans,
    modelIndexesByName,
    physicalNames,
    indexSources,
  });
  const executionDefaults = resolvePresetExecutionDefaults({
    defaults: presetExecutionDefaults,
    models: polyResult.models,
    sources,
    diagnostics,
    namespaceId: defaultNamespace.id,
  });

  for (const refusal of mongoContractRefusalsOf({
    models: polyResult.models,
    valueObjects,
    enums: builtEnums,
    lookups: validatorLookups,
    controlPolicies: MONGO_PSL_CONTROL_POLICIES,
  })) {
    const enumDiagnostic = enumRefusalDiagnostic(refusal, enumSites);
    if (enumDiagnostic !== undefined) diagnostics.pushExternal(enumDiagnostic);
    const fieldDiagnostic = fieldRefusalDiagnostic(refusal, fieldSymbols, sources);
    if (fieldDiagnostic !== undefined) diagnostics.push(fieldDiagnostic);
  }

  if (
    diagnostics.length > 0 ||
    polyResult.diagnostics.length > 0 ||
    (input.seedDiagnostics?.length ?? 0) > 0
  ) {
    return notOk({
      summary: 'PSL to Mongo contract interpretation failed',
      diagnostics: [
        ...(input.seedDiagnostics ?? []),
        ...diagnostics.toExternal(),
        ...polyResult.diagnostics.toExternal(),
      ],
    });
  }

  const resolvedModels = polyResult.models;
  const resolvedCollections = polyResult.collections;

  const target = 'mongo';
  const targetFamily = 'mongo';
  const execution = buildExecutionSection({
    target,
    targetFamily,
    defaults: executionDefaults,
  });

  const storageValueSets = mongoValueSetsOf(builtEnums);

  const validators = deriveCollectionValidators({
    models: resolvedModels,
    lookups: validatorLookups,
    valueObjects,
    valueSets: storageValueSets,
    controlPolicies: MONGO_PSL_CONTROL_POLICIES,
  });
  for (const [collectionName, validator] of Object.entries(validators)) {
    const coll = resolvedCollections[collectionName];
    if (coll) coll['validator'] = validator;
  }

  const collectionInputs: Record<string, MongoCollectionInput> = {};
  for (const [name, coll] of Object.entries(resolvedCollections)) {
    const raw: Record<string, unknown> = {};
    if (coll['indexes'] != null) raw['indexes'] = coll['indexes'];
    if (coll['validator'] != null) raw['validator'] = coll['validator'];
    if (coll['options'] != null) raw['options'] = coll['options'];
    collectionInputs[name] = blindCast<
      MongoCollectionInput,
      'arktype-validated JSON shapes satisfy MongoCollectionInput by construction'
    >(raw);
  }
  const storage: Contract['storage'] = buildMongoStorage({
    collections: collectionInputs,
    valueSets: storageValueSets,
  });
  const capabilities: Record<string, Record<string, boolean>> = {};

  const hasEnums = Object.keys(builtEnums).length > 0;

  return ok({
    targetFamily,
    target,
    roots: polyResult.roots,
    domain: {
      namespaces: {
        [defaultNamespace.id]: {
          models: polyResult.models,
          ...(Object.keys(valueObjects).length > 0 ? { valueObjects } : {}),
          ...(hasEnums ? { enum: builtEnums } : {}),
        },
      },
    },
    storage,
    extensions: {},
    capabilities,
    profileHash: computeProfileHash({ target, targetFamily, capabilities }),
    meta: {},
    ...ifDefined('execution', execution),
  });
}
