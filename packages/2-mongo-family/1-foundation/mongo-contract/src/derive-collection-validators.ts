import type { CrossReference } from '@internal/contract/types';
import { assertDefined } from '@internal/utils/assertions';
import { deriveModelValidator, type ModelValidatorSources } from './derive-json-schema';
import type { MongoValidator } from './ir/mongo-validator';

export interface CollectionValidatorsInput extends ModelValidatorSources {
  readonly roots: Record<string, CrossReference>;
}

/**
 * The validator of each collection in `roots`, keyed by collection name, derived from the collection's root model. A root model with variants gets one polymorphic validator covering every variant.
 */
export function deriveCollectionValidators(
  input: CollectionValidatorsInput,
): Record<string, MongoValidator> {
  const validators: Record<string, MongoValidator> = {};

  for (const [collectionName, root] of Object.entries(input.roots)) {
    const model = input.models[root.model];
    assertDefined(model, `Root model "${root.model}" of collection "${collectionName}" is missing`);
    validators[collectionName] = deriveModelValidator(root.model, model, input);
  }

  return validators;
}
