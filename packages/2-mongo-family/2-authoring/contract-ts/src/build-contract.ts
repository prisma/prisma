import { buildExecutionSection, computeProfileHash } from '@internal/contract/hashing';
import { composePackAuthoringNamespace } from '@internal/contract-authoring';
import {
  assertTypeAliasesValid,
  type DataTypeSupport,
} from '@internal/framework-components/authoring';
import type { CodecLookupWithDescriptors, TypeLookups } from '@internal/framework-components/codec';
import { assembleGeneratorFunctions } from '@internal/framework-components/components';
import {
  buildMongoStorage,
  deriveCollectionValidators,
  type MongoContract,
  mongoContractRefusalsOf,
  mongoValueSetsOf,
} from '@internal/mongo-contract';
import { ifDefined } from '@internal/utils/defined';
import { notOk, ok, type Result } from '@internal/utils/result';
import { buildCollections } from './build-collections';
import { buildEnums } from './build-enums';
import {
  buildExecutionDefaults,
  checkValueObjectExecutionDefaults,
} from './build-execution-defaults';
import { checkFields } from './build-fields';
import { buildModels, buildRoots, buildValueObjects } from './build-models';
import { decidePolymorphism, inheritVariantCollections } from './build-polymorphism';
import {
  type MongoBuildRefusal,
  type MongoBuildWarning,
  validatorRefusalKey,
} from './build-refusals';
import type { ContractDefinition } from './contract-definition';

/** A contract the builder built, with the warnings to report about it. */
export interface MongoBuiltContract {
  readonly contract: MongoContract;
  readonly warnings: readonly MongoBuildWarning[];
}

/**
 * Builds a MongoDB contract from its plain-data definition, with the stack's codecs and data types. Every MongoDB family rule is checked here, and each refusal comes back as data keyed by the part of the definition it is about, for the source to report in its own terms.
 */
export function buildMongoContractFromDefinition(
  definition: ContractDefinition,
  codecLookup: CodecLookupWithDescriptors,
  dataTypes: DataTypeSupport,
): Result<MongoBuiltContract, readonly MongoBuildRefusal[]> {
  const refusals: MongoBuildRefusal[] = [];
  const warnings: MongoBuildWarning[] = (definition.warnings ?? []).map((warning) => ({
    kind: 'source',
    warning,
  }));
  const namespaceId = definition.target.defaultNamespaceId;
  const lookups: TypeLookups = { codecLookup, dataTypeLookup: dataTypes.lookup };
  const components = [
    definition.family,
    definition.target,
    ...Object.values(definition.extensions ?? {}),
  ];
  const generatorFunctions = assembleGeneratorFunctions(components);
  assertTypeAliasesValid(composePackAuthoringNamespace(components, 'type'), {
    generatorFunctions,
    paramsSchemaOf: (codecId) => codecLookup.descriptorFor(codecId)?.paramsSchema,
    fieldLength: () => undefined,
  });

  const models = inheritVariantCollections(definition.models, refusals);
  const builtEnums = buildEnums(definition, codecLookup, refusals);
  const variantValues = decidePolymorphism({
    models,
    enums: builtEnums,
    codecLookup,
    dataTypes,
    refusals,
  });
  const builtModels = buildModels({ models, variantValues, namespaceId, refusals });
  const builtValueObjects = buildValueObjects(definition.valueObjects, namespaceId, refusals);
  checkFields({
    models,
    valueObjects: definition.valueObjects,
    declaredEnums: new Set(Object.keys(definition.enums ?? {})),
    lookups,
    refusals,
    warnings,
  });
  const collections = buildCollections({ models, variantValues, refusals });
  checkValueObjectExecutionDefaults(definition.valueObjects, refusals);
  const executionDefaults = buildExecutionDefaults({
    models,
    generatorFunctions,
    namespaceId,
    refusals,
  });
  if (refusals.length > 0) return notOk(refusals);

  const controlPolicies = {
    collections: Object.fromEntries(
      Object.entries(collections).map(([name, collection]) => [name, collection.control]),
    ),
    defaultControlPolicy: definition.defaultControlPolicy,
  };
  const validatorRefusals = mongoContractRefusalsOf({
    models: builtModels,
    valueObjects: builtValueObjects,
    enums: builtEnums,
    lookups,
    controlPolicies,
  });
  if (validatorRefusals.length > 0) {
    return notOk(
      validatorRefusals.map((refusal) => ({
        kind: 'validator',
        key: validatorRefusalKey(refusal),
        refusal,
      })),
    );
  }

  const storageValueSets = mongoValueSetsOf(builtEnums);
  const validators = definition.collectionValidators
    ? deriveCollectionValidators({
        models: builtModels,
        lookups,
        valueObjects: builtValueObjects,
        valueSets: storageValueSets,
        controlPolicies,
      })
    : {};
  const storage = buildMongoStorage({
    namespaceId,
    collections: Object.fromEntries(
      Object.entries(collections).map(([name, collection]) => [
        name,
        { ...collection, ...ifDefined('validator', validators[name]) },
      ]),
    ),
    valueSets: storageValueSets,
  });
  // Contracts carry no capabilities when built; emit adds the stack's. The profile hash fingerprints this empty set.
  const capabilities: Record<string, Record<string, boolean>> = {};
  const execution = buildExecutionSection({
    target: definition.target.targetId,
    targetFamily: definition.family.familyId,
    defaults: executionDefaults,
  });

  return ok({
    contract: {
      target: definition.target.targetId,
      targetFamily: definition.family.familyId,
      ...ifDefined('defaultControlPolicy', definition.defaultControlPolicy),
      roots: buildRoots(definition, models, namespaceId),
      domain: {
        namespaces: {
          [namespaceId]: {
            models: builtModels,
            ...(Object.keys(builtValueObjects).length > 0
              ? { valueObjects: builtValueObjects }
              : {}),
            ...(Object.keys(builtEnums).length > 0 ? { enum: builtEnums } : {}),
          },
        },
      },
      storage,
      capabilities,
      extensions: definition.extensions ?? {},
      profileHash: computeProfileHash({
        target: definition.target.targetId,
        targetFamily: definition.family.familyId,
        capabilities,
      }),
      meta: {},
      ...ifDefined('execution', execution),
    },
    warnings,
  });
}
