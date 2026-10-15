const STORED_JSON_TYPE_NAMES = {
  string: 'a string',
  number: 'a finite number',
  boolean: 'a boolean',
  object: 'a JSON object',
  array: 'a JSON array',
} as const;

type StoredJsonType = keyof typeof STORED_JSON_TYPE_NAMES;

/**
 * A collection validator lists an enum's members in their stored forms, so an enum's BSON type must be one whose values JSON holds. Maps each such type to the JSON type of a member's stored form.
 */
const VALIDATOR_LISTABLE_BSON_TYPES: Readonly<Record<string, StoredJsonType>> = {
  string: 'string',
  int: 'number',
  double: 'number',
  bool: 'boolean',
  object: 'object',
  array: 'array',
};

function storedJsonTypeOf(stored: unknown): string {
  if (stored === null) return 'null';
  if (Array.isArray(stored)) return 'array';
  return typeof stored;
}

export type MongoEnumListability =
  | { readonly kind: 'refused'; readonly reason: string }
  | {
      readonly kind: 'listable';
      readonly bsonType: string;
      readonly memberRefusalOf: (stored: unknown) => string | undefined;
    };

/**
 * Whether a collection validator can list the members of an enum whose codec stores `bsonTypes`. A refusal reason, and a member's refusal reason, describe the codec or member without naming it, so each authoring surface can lead with its own subject.
 */
export function mongoEnumListabilityOf(bsonTypes: readonly string[]): MongoEnumListability {
  const [bsonType, ...otherBsonTypes] = bsonTypes;
  if (bsonType === undefined || otherBsonTypes.length > 0) {
    return {
      kind: 'refused',
      reason: `declares ${bsonTypes.length} BSON types; an enum needs exactly one. Use a codec with one BSON type, such as mongo/string@1.`,
    };
  }

  const storedJsonType = VALIDATOR_LISTABLE_BSON_TYPES[bsonType];
  if (storedJsonType === undefined) {
    return {
      kind: 'refused',
      reason: `stores BSON type ${bsonType}, which a collection validator cannot list as an enum value. Use a codec whose BSON type is string, int, double, bool, object or array.`,
    };
  }

  return {
    kind: 'listable',
    bsonType,
    memberRefusalOf: (stored) =>
      storedJsonTypeOf(stored) === storedJsonType
        ? undefined
        : `is stored as ${JSON.stringify(stored)}, which a collection validator cannot list as a ${bsonType}. A member of a ${bsonType} enum must be ${STORED_JSON_TYPE_NAMES[storedJsonType]}.`,
  };
}
