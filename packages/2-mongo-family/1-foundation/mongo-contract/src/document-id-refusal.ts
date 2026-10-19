import type { ContractField } from '@internal/contract/types';
import type { TypeLookups } from '@internal/framework-components/codec';
import { bsonTypesOfCodec } from './mongo-data-type';

/**
 * Why a root model cannot be stored in a collection with a validator. `unknownCodec`: the lookups know no MongoDB data type for the `_id` codec. `notObjectId`: the model has no `_id`, or its `_id` is not stored as BSON type `objectId`.
 */
export type DocumentIdRefusal =
  | { readonly kind: 'unknownCodec'; readonly reason: string }
  | { readonly kind: 'notObjectId'; readonly reason: string };

const notObjectId: DocumentIdRefusal = {
  kind: 'notObjectId',
  reason:
    'has no _id field stored as BSON type objectId. MongoDB adds an objectId _id to every document it inserts without one, so a collection validator without it rejects every insert.',
};

/**
 * Why a root model with `fields` cannot be stored in a collection with a validator, or undefined when it can. The reason leaves out its subject so each authoring surface can lead with its own, as in `Model "User" has no _id field ...`.
 */
export function documentIdRefusalOf(
  fields: Record<string, ContractField>,
  lookups: TypeLookups,
): DocumentIdRefusal | undefined {
  const id = Object.hasOwn(fields, '_id') ? fields['_id'] : undefined;
  if (id?.type.kind !== 'scalar') return notObjectId;
  const bsonTypes = bsonTypesOfCodec(id.type.codecId, lookups);
  if (bsonTypes === undefined) {
    return {
      kind: 'unknownCodec',
      reason: `has an _id field whose codec "${id.type.codecId}" has no MongoDB data type, so its BSON type is unknown.`,
    };
  }
  return bsonTypes.length === 1 && bsonTypes[0] === 'objectId' ? undefined : notObjectId;
}
