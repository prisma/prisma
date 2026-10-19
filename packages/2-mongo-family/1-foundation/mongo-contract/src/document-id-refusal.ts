import type { ContractField } from '@internal/contract/types';
import { bsonTypesOfCodec, type MongoTypeLookups } from './mongo-data-type';

/**
 * Why a root model cannot be stored in a collection with a validator. `unknownCodec`: the lookups know no MongoDB data type for the `_id` codec. `missing`: the model has no `_id`. `notObjectId`: its `_id` is not stored as BSON type `objectId`.
 */
export type DocumentIdRefusal =
  | { readonly kind: 'unknownCodec'; readonly reason: string }
  | { readonly kind: 'missing'; readonly reason: string }
  | { readonly kind: 'notObjectId'; readonly reason: string };

const missing: DocumentIdRefusal = {
  kind: 'missing',
  reason:
    'has no _id field. MongoDB adds an objectId _id to every document it inserts without one, so a collection validator without it rejects every insert.',
};

function storedAs(description: string): DocumentIdRefusal {
  return {
    kind: 'notObjectId',
    reason: `has an _id field stored as ${description}. An _id must be stored as BSON type objectId: MongoDB adds an objectId _id to a document inserted without one, and the collection validator would refuse that document.`,
  };
}

/**
 * Why a root model with `fields` cannot be stored in a collection with a validator, or undefined when it can. The reason leaves out its subject so each authoring surface can lead with its own, as in `Model "User" has no _id field ...`.
 */
export function documentIdRefusalOf(
  fields: Record<string, ContractField>,
  lookups: MongoTypeLookups,
): DocumentIdRefusal | undefined {
  const id = Object.hasOwn(fields, '_id') ? fields['_id'] : undefined;
  if (id === undefined) return missing;
  if (id.type.kind !== 'scalar') return storedAs('an object');
  const bsonTypes = bsonTypesOfCodec(id.type.codecId, lookups);
  if (bsonTypes === undefined) {
    return {
      kind: 'unknownCodec',
      reason: `has an _id field whose codec "${id.type.codecId}" has no MongoDB data type, so its BSON type is unknown.`,
    };
  }
  if (bsonTypes.length === 1 && bsonTypes[0] === 'objectId') return undefined;
  return storedAs(bsonTypes.length === 0 ? 'any BSON type' : `BSON type ${bsonTypes.join(' or ')}`);
}
