import type { ContractField } from '@internal/contract/types';
import { bsonTypesOfCodec, type MongoTypeLookups } from './mongo-data-type';

function storedAs(field: ContractField, lookups: MongoTypeLookups): string | undefined {
  if (field.type.kind !== 'scalar') return 'an object';
  if (field.many) return 'an array';
  const bsonTypes = bsonTypesOfCodec(field.type.codecId, lookups);
  if (bsonTypes === undefined) return undefined;
  if (field.nullable) return `BSON type ${['null', ...bsonTypes].join(' or ')}`;
  if (bsonTypes.length === 1 && bsonTypes[0] === 'objectId') return undefined;
  return bsonTypes.length === 0 ? 'any BSON type' : `BSON type ${bsonTypes.join(' or ')}`;
}

/**
 * Why a root model's field stored as `_id` cannot be, or undefined when it can: it must be stored as BSON type `objectId`. A codec whose BSON type is unknown is left to {@link fieldBsonTypeRefusalOf}. The reason leaves out its subject so each authoring surface can lead with its own, as in `Model "User" field "_id" holds the document id as ...`.
 */
export function documentIdRefusalOf(
  field: ContractField,
  lookups: MongoTypeLookups,
): string | undefined {
  const description = storedAs(field, lookups);
  if (description === undefined) return undefined;
  return `holds the document id as ${description}, but an _id must be stored as BSON type objectId: every collection validator requires an objectId _id, which MongoDB adds to every document inserted without one.`;
}
