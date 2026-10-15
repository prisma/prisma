import type {
  ContractModelBase,
  ContractValueObject,
  CrossReference,
} from '@internal/contract/types';
import { assertDefined } from '@internal/utils/assertions';
import {
  deriveJsonSchema,
  derivePolymorphicJsonSchema,
  type FieldValueSets,
} from './derive-json-schema';
import type { MongoValidator } from './ir/mongo-validator';
import type { MongoTypeLookups } from './mongo-data-type';

export interface CollectionValidatorsInput {
  readonly roots: Record<string, CrossReference>;
  readonly models: Record<
    string,
    Pick<ContractModelBase, 'fields' | 'relations' | 'discriminator' | 'variants'>
  >;
  readonly lookups: MongoTypeLookups;
  readonly valueObjects: Record<string, ContractValueObject>;
  readonly valueSets: FieldValueSets;
}

/**
 * The validator of each collection in `roots`, keyed by collection name, derived from the collection's root model. A root model with variants gets one polymorphic validator covering every variant.
 */
export function deriveCollectionValidators(
  input: CollectionValidatorsInput,
): Record<string, MongoValidator> {
  const { roots, models, lookups, valueObjects, valueSets } = input;
  const validators: Record<string, MongoValidator> = {};

  for (const [collectionName, root] of Object.entries(roots)) {
    const model = models[root.model];
    assertDefined(model, `Root model "${root.model}" of collection "${collectionName}" is missing`);

    if (model.discriminator && model.variants) {
      const variants = Object.entries(model.variants).map(([discriminatorValue, variant]) => {
        const variantModel = models[variant.model];
        assertDefined(
          variantModel,
          `Variant model "${variant.model}" of "${root.model}" is missing`,
        );
        return { discriminatorValue, fields: variantModel.fields };
      });
      validators[collectionName] = derivePolymorphicJsonSchema(
        model.fields,
        model.discriminator.field,
        variants,
        lookups,
        valueObjects,
        valueSets,
      );
    } else {
      validators[collectionName] = deriveJsonSchema(model.fields, lookups, valueObjects, valueSets);
    }
  }

  return validators;
}
