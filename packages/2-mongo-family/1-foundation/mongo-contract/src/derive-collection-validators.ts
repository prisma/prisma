import type { ContractModelBase, CrossReference } from '@internal/contract/types';
import { assertDefined } from '@internal/utils/assertions';
import {
  deriveModelJsonSchema,
  type ModelValidatorSources,
  type ValidatorModel,
  validatorOf,
} from './derive-json-schema';
import type { MongoValidator } from './ir/mongo-validator';

export type CollectionModel = ValidatorModel &
  Partial<Pick<ContractModelBase, 'storage' | 'base' | 'owner'>>;

export interface CollectionValidatorsInput extends ModelValidatorSources {
  readonly roots: Record<string, CrossReference>;
  readonly models: Record<string, CollectionModel>;
}

/** The root model of `collectionName` and every other model stored in it that is neither a variant nor embedded, in name order. */
function rootModelNamesOf(
  collectionName: string,
  root: CrossReference,
  models: Record<string, CollectionModel>,
): string[] {
  const names = new Set([root.model]);
  for (const [name, model] of Object.entries(models)) {
    const isRoot =
      model.storage?.['collection'] === collectionName &&
      model.base === undefined &&
      model.owner === undefined;
    if (isRoot) names.add(name);
  }
  return [...names].sort();
}

/**
 * The validator of each collection in `roots`, keyed by collection name. A root model with variants gets one polymorphic schema covering every variant. A collection that stores several root models accepts a document of any of them: its schema has one `anyOf` branch per root model.
 */
export function deriveCollectionValidators(
  input: CollectionValidatorsInput,
): Record<string, MongoValidator> {
  const validators: Record<string, MongoValidator> = {};

  for (const [collectionName, root] of Object.entries(input.roots)) {
    const schemas = rootModelNamesOf(collectionName, root, input.models).map((modelName) => {
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
