import type {
  ContractEmbedRelation,
  ContractField,
  ContractModelBase,
} from '@internal/contract/types';
import { crossRef } from '@internal/contract/types';
import {
  type CollectionValidatorsInput,
  deriveCollectionValidators,
} from '../src/derive-collection-validators';
import { mongoTypeLookups } from '../src/fake-type-lookups';
import type { MongoValidator } from '../src/ir/mongo-validator';
import { scalarField } from './derive-json-schema-helpers';

export type Model = CollectionValidatorsInput['models'][string];

export function model(
  fields: Record<string, ContractField>,
  extra: Partial<Pick<ContractModelBase, 'relations' | 'discriminator' | 'variants'>> = {},
): Model {
  return { fields, relations: {}, ...extra };
}

export function embedOne(to: string): ContractEmbedRelation {
  return { to: crossRef(to), cardinality: '1:1' };
}

export function embedMany(to: string): ContractEmbedRelation {
  return { to: crossRef(to), cardinality: '1:N' };
}

export function derive(
  input: Pick<CollectionValidatorsInput, 'roots' | 'models'> &
    Partial<Pick<CollectionValidatorsInput, 'valueObjects' | 'valueSets'>>,
) {
  return deriveCollectionValidators({
    lookups: mongoTypeLookups,
    valueObjects: {},
    valueSets: {},
    ...input,
  });
}

export function jsonSchemas(validators: ReturnType<typeof deriveCollectionValidators>) {
  return Object.fromEntries(Object.entries(validators).map(([name, v]) => [name, v.jsonSchema]));
}

export const objectId = () => scalarField('mongo/objectId@1');

function itemsValidator(validators: Record<string, MongoValidator>): MongoValidator {
  const validator = validators['items'];
  if (validator === undefined) throw new Error('expected a validator for items');
  return validator;
}

/** The validator of collection `items`, whose root model has `fields`. */
export function rootValidator(
  fields: Record<string, ContractField>,
  sources: Partial<Pick<CollectionValidatorsInput, 'valueObjects' | 'valueSets'>> = {},
): MongoValidator {
  return itemsValidator(
    derive({ roots: { items: crossRef('Item') }, models: { Item: model(fields) }, ...sources }),
  );
}

export interface VariantFields {
  readonly discriminatorValue: string;
  readonly fields: Record<string, ContractField>;
}

/** The validator of collection `items`, whose root model has `baseFields` and one variant model per entry of `variants`. */
export function polymorphicRootValidator(
  baseFields: Record<string, ContractField>,
  discriminatorField: string,
  variants: readonly VariantFields[],
): MongoValidator {
  const variantModelName = (variant: VariantFields) => `${variant.discriminatorValue}Variant`;
  return itemsValidator(
    derive({
      roots: { items: crossRef('Item') },
      models: {
        Item: model(baseFields, {
          discriminator: { field: discriminatorField },
          variants: Object.fromEntries(
            variants.map((variant) => [
              variant.discriminatorValue,
              crossRef(variantModelName(variant)),
            ]),
          ),
        }),
        ...Object.fromEntries(
          variants.map((variant) => [variantModelName(variant), model(variant.fields)]),
        ),
      },
    }),
  );
}
