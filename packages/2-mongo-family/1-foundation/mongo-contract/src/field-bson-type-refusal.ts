import { bsonTypesOfCodec, type MongoTypeLookups } from './mongo-data-type';

/**
 * Why a collection validator cannot describe a field of codec `codecId`. `unknownCodec`: no pack in the contract provides the codec. `notMongoDataType`: the codec's data type is not a MongoDB data type, so it names no BSON type.
 */
export type FieldBsonTypeRefusal =
  | { readonly kind: 'unknownCodec'; readonly reason: string }
  | { readonly kind: 'notMongoDataType'; readonly reason: string; readonly dataType: string };

const CANNOT_GIVE = 'so the collection validator cannot give its BSON type.';

/**
 * Why a field of codec `codecId` cannot be described by a collection validator, or undefined when it can. The reason leaves out its subject so each authoring surface can lead with its own, as in `Field "Place.location" uses codec ...`.
 */
export function fieldBsonTypeRefusalOf(
  codecId: string,
  lookups: MongoTypeLookups,
): FieldBsonTypeRefusal | undefined {
  if (bsonTypesOfCodec(codecId, lookups) !== undefined) return undefined;
  const descriptor = lookups.codecLookup.descriptorFor(codecId);
  if (descriptor === undefined) {
    return {
      kind: 'unknownCodec',
      reason: `uses codec "${codecId}", which no pack in the contract provides, ${CANNOT_GIVE}`,
    };
  }
  return {
    kind: 'notMongoDataType',
    dataType: descriptor.dataType,
    reason: `uses codec "${codecId}", whose data type "${descriptor.dataType}" is not a MongoDB data type of any pack in the contract, ${CANNOT_GIVE}`,
  };
}
