import type { ContractEmbedRelation, ContractField } from '@internal/contract/types';
import { type CrossReference, crossRef } from '@internal/contract/types';
import type { MongoModelDefinition, MongoModelStorage } from '../src/contract-types';
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
  {
    storage,
    ...extra
  }: Partial<
    Pick<MongoModelDefinition, 'relations' | 'discriminator' | 'variants' | 'base' | 'owner'>
  > & {
    readonly storage?: Partial<MongoModelStorage>;
  } = {},
): Model {
  return {
    fields,
    relations: {},
    storage: { fields: identityStorageFields(fields), ...storage },
    ...extra,
  };
}

export function identityStorageFields(
  fields: Record<string, ContractField>,
): MongoModelStorage['fields'] {
  return Object.fromEntries(Object.keys(fields).map((name) => [name, { field: name }]));
}

export function embedOne(to: string): ContractEmbedRelation {
  return { to: crossRef(to), cardinality: '1:1' };
}

export function embedMany(to: string): ContractEmbedRelation {
  return { to: crossRef(to), cardinality: '1:N' };
}

/** The validators of `models`, with each model in `roots` stored in the collection that keys it. */
export function derive(
  input: {
    readonly roots: Record<string, CrossReference>;
  } & Pick<CollectionValidatorsInput, 'models'> &
    Partial<Pick<CollectionValidatorsInput, 'valueObjects' | 'valueSets' | 'controlPolicies'>>,
) {
  const { roots, models, ...sources } = input;
  const stored = { ...models };
  for (const [collection, root] of Object.entries(roots)) {
    const model = stored[root.model];
    if (model !== undefined) {
      stored[root.model] = { ...model, storage: { ...model.storage, collection } };
    }
  }
  return deriveCollectionValidators({
    lookups: mongoTypeLookups,
    valueObjects: {},
    valueSets: {},
    controlPolicies: { collections: {}, defaultControlPolicy: undefined },
    ...sources,
    models: stored,
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

/** The validator of collection `items`, whose root model has `baseFields`, a string discriminator field `discriminatorField` unless `baseFields` declares it, and one variant model per entry of `variants`. */
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
        Item: model(
          { [discriminatorField]: scalarField('mongo/string@1'), ...baseFields },
          {
            discriminator: { field: discriminatorField },
            variants: Object.fromEntries(
              variants.map((variant) => [
                variant.discriminatorValue,
                crossRef(variantModelName(variant)),
              ]),
            ),
          },
        ),
        ...Object.fromEntries(
          variants.map((variant) => [variantModelName(variant), model(variant.fields)]),
        ),
      },
    }),
  );
}
