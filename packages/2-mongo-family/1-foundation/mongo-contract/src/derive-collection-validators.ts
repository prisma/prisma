import type {
  ContractDiscriminator,
  ContractField,
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

export interface CollectionValidatorModel {
  readonly fields: Record<string, ContractField>;
  readonly storage: { readonly collection: string };
  readonly discriminator?: ContractDiscriminator;
  readonly variants?: Record<string, CrossReference>;
  readonly base?: CrossReference;
}

export interface CollectionValidatorsInput {
  readonly models: Record<string, CollectionValidatorModel>;
  readonly lookups: MongoTypeLookups;
  readonly valueObjects: Record<string, ContractValueObject>;
  readonly valueSets: FieldValueSets;
}

/**
 * The validator of each collection a root model is stored in, keyed by collection name. A model with variants gets one polymorphic validator covering every variant; variant models get none of their own.
 */
export function deriveCollectionValidators(
  input: CollectionValidatorsInput,
): Record<string, MongoValidator> {
  const { models, lookups, valueObjects, valueSets } = input;
  const validators: Record<string, MongoValidator> = {};

  for (const [modelName, model] of Object.entries(models)) {
    if (model.base) continue;

    if (model.discriminator && model.variants) {
      const variants = Object.entries(model.variants).map(([discriminatorValue, variant]) => {
        const variantModel = models[variant.model];
        assertDefined(
          variantModel,
          `Variant model "${variant.model}" of "${modelName}" is missing`,
        );
        return { discriminatorValue, fields: variantModel.fields };
      });
      validators[model.storage.collection] = derivePolymorphicJsonSchema(
        model.fields,
        model.discriminator.field,
        variants,
        lookups,
        valueObjects,
        valueSets,
      );
    } else {
      validators[model.storage.collection] = deriveJsonSchema(
        model.fields,
        lookups,
        valueObjects,
        valueSets,
      );
    }
  }

  return validators;
}
