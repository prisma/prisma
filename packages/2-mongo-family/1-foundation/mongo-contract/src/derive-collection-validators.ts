import type { ContractModelBase } from '@internal/contract/types';
import { assertDefined } from '@internal/utils/assertions';
import {
  deriveModelJsonSchema,
  type ModelValidatorSources,
  type ValidatorModel,
  validatorOf,
} from './derive-json-schema';
import type { MongoValidator } from './ir/mongo-validator';

export type StoredModel = Pick<ContractModelBase, 'storage' | 'base' | 'owner'>;

export type CollectionModel = ValidatorModel & StoredModel;

export interface CollectionValidatorsInput extends ModelValidatorSources {
  readonly models: Record<string, CollectionModel>;
}

/**
 * The root models of each collection, keyed by collection name: every model stored in the collection that is neither a variant nor embedded, sorted by name.
 */
export function collectionRootModelsOf(
  models: Record<string, StoredModel>,
): Record<string, readonly string[]> {
  const roots: Record<string, string[]> = {};
  for (const [name, model] of Object.entries(models)) {
    const collection = model.storage['collection'];
    if (typeof collection !== 'string' || model.base !== undefined || model.owner !== undefined) {
      continue;
    }
    roots[collection] = [...(roots[collection] ?? []), name];
  }
  for (const names of Object.values(roots)) names.sort();
  return roots;
}

/**
 * The validator of each collection that stores a root model, keyed by collection name. A root model with variants gets one polymorphic schema covering every variant. A collection that stores several root models accepts a document of any of them: its schema has one `anyOf` branch per root model.
 */
export function deriveCollectionValidators(
  input: CollectionValidatorsInput,
): Record<string, MongoValidator> {
  const validators: Record<string, MongoValidator> = {};

  for (const [collectionName, modelNames] of Object.entries(collectionRootModelsOf(input.models))) {
    const schemas = modelNames.map((modelName) => {
      const model = input.models[modelName];
      assertDefined(
        model,
        `Root model "${modelName}" of collection "${collectionName}" is missing`,
      );
      return deriveModelJsonSchema(modelName, model, input);
    });
    const [only, ...others] = schemas;
    assertDefined(only, `Collection "${collectionName}" has no root model`);
    validators[collectionName] = validatorOf(
      others.length === 0 ? only : { bsonType: 'object', anyOf: schemas },
    );
  }

  return validators;
}
