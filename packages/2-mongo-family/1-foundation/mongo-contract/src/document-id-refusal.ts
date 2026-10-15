import type { ContractField } from '@internal/contract/types';
import { bsonTypesOfCodec, type MongoTypeLookups } from './mongo-data-type';

function isObjectId(field: ContractField | undefined, lookups: MongoTypeLookups): boolean {
  if (field?.type.kind !== 'scalar') return false;
  const bsonTypes = bsonTypesOfCodec(field.type.codecId, lookups);
  return bsonTypes?.length === 1 && bsonTypes[0] === 'objectId';
}

/**
 * Why a root model with `fields` cannot be stored in a collection with a validator, or undefined when it can. The reason leaves out its subject so each authoring surface can lead with its own, as in `Model "User" has no _id field ...`.
 */
export function documentIdRefusalOf(
  fields: Record<string, ContractField>,
  lookups: MongoTypeLookups,
): string | undefined {
  if (Object.hasOwn(fields, '_id') && isObjectId(fields['_id'], lookups)) return undefined;
  return 'has no _id field stored as BSON type objectId. MongoDB adds an objectId _id to every document it inserts without one, so a collection validator without it rejects every insert.';
}
