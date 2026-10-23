import { type } from 'arktype';

const ScalarFieldTypeSchema = type({
  '+': 'reject',
  kind: "'scalar'",
  codecId: 'string',
  'typeParams?': 'Record<string, unknown>',
});

const ValueObjectFieldTypeSchema = type({
  '+': 'reject',
  kind: "'valueObject'",
  plane: "'storage'",
  namespaceId: 'string',
  entityKind: "'valueObject'",
  entityName: 'string',
});

const UnionFieldTypeSchema = type({
  '+': 'reject',
  kind: "'union'",
  members: ScalarFieldTypeSchema.or(ValueObjectFieldTypeSchema).array(),
});

const StorageValueSetReferenceSchema = type({
  '+': 'reject',
  plane: "'storage'",
  namespaceId: 'string',
  entityKind: "'valueSet'",
  entityName: 'string',
  'spaceId?': 'string',
});

const StorageValueObjectFieldSchema = type({
  '+': 'reject',
  nullable: 'boolean',
  type: ScalarFieldTypeSchema.or(ValueObjectFieldTypeSchema).or(UnionFieldTypeSchema),
  'many?': type('false').or({ '+': 'reject', elementNullable: 'boolean' }),
  'dict?': 'true',
  'valueSet?': StorageValueSetReferenceSchema,
});

/**
 * A value object, the storage entity under `storage.namespaces.<ns>.entries.valueObject.<name>` (ADR 309). The framework defines this entity kind, since domain fields refer to it; both families validate their entries against this schema.
 */
export const StorageValueObjectSchema = type({
  '+': 'reject',
  fields: type({ '[string]': StorageValueObjectFieldSchema }),
});
