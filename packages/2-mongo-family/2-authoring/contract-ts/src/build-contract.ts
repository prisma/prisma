import { buildExecutionSection, computeProfileHash } from '@internal/contract/hashing';
import type { ContractEnum } from '@internal/contract/types';
import { composePackAuthoringNamespace, encodeEnumTypeMembers } from '@internal/contract-authoring';
import {
  type AuthoringWarning,
  assertTypeAliasesValid,
  type DataTypeSupport,
  flushAuthoringWarnings,
} from '@internal/framework-components/authoring';
import type { CodecLookupWithDescriptors, TypeLookups } from '@internal/framework-components/codec';
import { assembleGeneratorFunctions } from '@internal/framework-components/components';
import { UNBOUND_NAMESPACE_ID } from '@internal/framework-components/ir';
import {
  buildMongoStorage,
  deriveCollectionValidators,
  type MongoContract,
  type MongoStorageShape,
  mongoValueSetsOf,
} from '@internal/mongo-contract';
import { assertMongoFieldTypeParams } from '@internal/mongo-contract/data-type';
import { ifDefined } from '@internal/utils/defined';
import { buildCollections } from './build-collections';
import {
  assertNoValueObjectExecutionDefaults,
  buildExecutionDefaults,
} from './build-execution-defaults';
import { buildModels, buildRoots, buildValueObjects } from './build-models';
import { assertCollectionValidatorSources } from './collection-validator-checks';
import type { ContractDefinition } from './contract-definition';
import { contractError } from './contract-errors';

function buildEnums(
  definition: ContractDefinition,
  codecLookup: CodecLookupWithDescriptors,
): Record<string, ContractEnum> {
  const builtEnums: Record<string, ContractEnum> = {};
  for (const [enumName, handle] of Object.entries(definition.enums ?? {})) {
    builtEnums[enumName] = {
      codecId: handle.codecId,
      members: encodeEnumTypeMembers(handle, codecLookup, 'the field'),
    };
  }
  for (const [enumName, handle] of Object.entries(definition.enums ?? {})) {
    if (enumName !== handle.enumName) {
      throw contractError(
        'CONTRACT.ENUM_INVALID',
        `enum declaration key "${enumName}" must match enumType name "${handle.enumName}". Aliases are not supported.`,
        {
          meta: {
            enumName: handle.enumName,
            declaredKey: enumName,
            reason: 'declaration-key-mismatch',
          },
        },
      );
    }
  }
  for (const model of definition.models) {
    for (const field of model.fields) {
      if (field.enumName !== undefined && !(field.enumName in builtEnums)) {
        throw contractError(
          'CONTRACT.ENUM_UNKNOWN',
          `Model "${model.modelName}" field "${field.fieldName}" references enum "${field.enumName}" which is not declared in defineContract({ enums: { ... } }).`,
          {
            meta: {
              modelName: model.modelName,
              fieldName: field.fieldName,
              enumName: field.enumName,
            },
          },
        );
      }
    }
  }
  return builtEnums;
}

/**
 * Builds a MongoDB contract from its plain-data definition, with the stack's codecs and data types.
 */
export function buildMongoContractFromDefinition(
  definition: ContractDefinition,
  codecLookup: CodecLookupWithDescriptors,
  dataTypes: DataTypeSupport,
): MongoContract {
  const warnings: AuthoringWarning[] = [...(definition.warnings ?? [])];
  const builtModels = buildModels(definition.models);
  const builtValueObjects = buildValueObjects(definition.valueObjects);
  const roots = buildRoots(definition);
  // Contracts carry no capabilities when built; emit adds the stack's. The profile hash fingerprints this empty set.
  const capabilities: Record<string, Record<string, boolean>> = {};
  const collections = buildCollections(definition.models);
  assertNoValueObjectExecutionDefaults(definition.valueObjects);
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
  const execution = buildExecutionSection({
    target: definition.target.targetId,
    targetFamily: definition.family.familyId,
    defaults: buildExecutionDefaults(definition.models, generatorFunctions),
  });

  const lookups: TypeLookups = { codecLookup, dataTypeLookup: dataTypes.lookup };
  assertMongoFieldTypeParams(
    { [UNBOUND_NAMESPACE_ID]: { models: builtModels, valueObjects: builtValueObjects } },
    lookups,
  );

  const builtEnums = buildEnums(definition, codecLookup);
  const storageValueSets = mongoValueSetsOf(builtEnums);

  const controlPolicies = {
    collections: Object.fromEntries(
      Object.entries(collections).map(([name, collection]) => [name, collection.control]),
    ),
    defaultControlPolicy: definition.defaultControlPolicy,
  };
  assertCollectionValidatorSources({
    models: builtModels,
    valueObjects: builtValueObjects,
    enums: builtEnums,
    lookups,
    controlPolicies,
  });
  const validators = definition.collectionValidators
    ? deriveCollectionValidators({
        models: builtModels,
        lookups,
        valueObjects: builtValueObjects,
        valueSets: storageValueSets,
        controlPolicies,
      })
    : {};
  const storage: MongoStorageShape<string> = buildMongoStorage({
    collections: Object.fromEntries(
      Object.entries(collections).map(([name, collection]) => [
        name,
        { ...collection, ...ifDefined('validator', validators[name]) },
      ]),
    ),
    valueSets: storageValueSets,
  });

  flushAuthoringWarnings(warnings);
  return {
    target: definition.target.targetId,
    targetFamily: definition.family.familyId,
    ...ifDefined('defaultControlPolicy', definition.defaultControlPolicy),
    roots,
    domain: {
      namespaces: {
        [UNBOUND_NAMESPACE_ID]: {
          models: builtModels,
          ...(Object.keys(builtValueObjects).length > 0 ? { valueObjects: builtValueObjects } : {}),
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
  };
}
