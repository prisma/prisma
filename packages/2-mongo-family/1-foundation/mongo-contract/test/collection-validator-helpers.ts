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
