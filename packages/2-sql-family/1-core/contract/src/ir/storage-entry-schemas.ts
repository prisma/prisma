import { StorageValueObjectSchema } from '@internal/contract/types';
import { DATA_TYPE_ID_PATTERN } from '@internal/framework-components/codec';
import { type Type, type } from 'arktype';
import type { ForeignKeyIndex, ForeignKeyInput, ReferentialAction } from './foreign-key';
import type { ForeignKeyReferenceInput } from './foreign-key-reference';
import type { PrimaryKeyInput } from './primary-key';
import type { UniqueConstraintInput } from './unique-constraint';

type ColumnDefaultLiteral = {
  readonly kind: 'literal';
  readonly value: string | number | boolean | Record<string, unknown> | unknown[] | null;
};
type ColumnDefaultFunction = { readonly kind: 'function'; readonly expression: string };

const literalKindSchema = type("'literal'");
const functionKindSchema = type("'function'");
const ControlPolicySchema = type("'managed' | 'tolerated' | 'external' | 'observed'");

export const ColumnDefaultLiteralSchema = type.declare<ColumnDefaultLiteral>().type({
  kind: literalKindSchema,
  value: 'string | number | boolean | null | unknown[] | Record<string, unknown>',
});

export const ColumnDefaultFunctionSchema = type.declare<ColumnDefaultFunction>().type({
  kind: functionKindSchema,
  expression: 'string',
});

export const ColumnDefaultSchema = ColumnDefaultLiteralSchema.or(ColumnDefaultFunctionSchema);

const StorageValueSetRefSchema = type({
  plane: "'storage'",
  namespaceId: 'string',
  entityKind: "'valueSet'",
  entityName: 'string',
  'spaceId?': 'string',
});

const VALUE_OBJECT_REFERENCE_KEYS = new Set([
  'kind',
  'plane',
  'namespaceId',
  'entityKind',
  'entityName',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isValueObjectReference(value: Record<string, unknown>): boolean {
  return (
    value['plane'] === 'storage' &&
    value['entityKind'] === 'valueObject' &&
    typeof value['namespaceId'] === 'string' &&
    typeof value['entityName'] === 'string' &&
    Object.keys(value).every((key) => VALUE_OBJECT_REFERENCE_KEYS.has(key))
  );
}

/** A field's type: a scalar with its codec, a value object by its storage coordinate, or a union of those. */
export function isContractFieldType(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const kind = value['kind'];
  if (kind === 'scalar') {
    if (typeof value['codecId'] !== 'string') return false;
    const typeParams = value['typeParams'];
    if (typeParams !== undefined && !isRecord(typeParams)) return false;
    return true;
  }
  if (kind === 'valueObject') {
    return isValueObjectReference(value);
  }
  if (kind === 'union') {
    const members = value['members'];
    if (!Array.isArray(members)) return false;
    return members.every((m) => isContractFieldType(m));
  }
  return false;
}

export const ContractFieldTypeSchema = type('unknown').narrow((value, ctx) =>
  isContractFieldType(value)
    ? true
    : ctx.mustBe(
        'scalar, valueObject (by its storage coordinate: plane, namespaceId, entityKind, entityName), or union field type',
      ),
);

/**
 * The framework's value object schema, narrowed to what SQL stores: no member is a union or a dictionary, since the derived check cannot enforce them.
 */
export const SqlStorageValueObjectSchema = StorageValueObjectSchema.narrow((valueObject, ctx) => {
  for (const [name, member] of Object.entries(valueObject.fields)) {
    const kind = member.type.kind === 'union' ? 'union' : member.dict ? 'dictionary' : undefined;
    if (kind !== undefined) {
      return ctx.reject({
        message: `value object member "${name}" is a ${kind}; SQL value objects hold no unions or dictionaries, since their check cannot enforce them`,
      });
    }
  }
  return true;
});

const StorageColumnSchema = type({
  '+': 'reject',
  dataType: DATA_TYPE_ID_PATTERN,
  codecId: 'string',
  nullable: 'boolean',
  'many?': type('false').or({ '+': 'reject', elementNullable: 'boolean' }),
  'typeParams?': 'Record<string, unknown>',
  'default?': ColumnDefaultSchema,
  'control?': ControlPolicySchema,
  'valueSet?': StorageValueSetRefSchema,
});

/**
 * Storage value-set entry under `storage.namespaces[id].entries.valueSet[name]`.
 * Carries a `kind: 'valueSet'` discriminator (enumerable, survives JSON) and an
 * ordered `values` array of codec-encoded permitted values.
 */
export const StorageValueSetSchema = type({
  kind: "'valueSet'",
  values: type('string | number | boolean | null | unknown[] | Record<string, unknown>')
    .array()
    .readonly(),
});

const PrimaryKeySchema = type.declare<PrimaryKeyInput>().type({
  columns: type.string.array().readonly(),
  'name?': 'string',
});

const UniqueConstraintSchema = type.declare<UniqueConstraintInput>().type({
  columns: type.string.array().readonly(),
  'name?': 'string',
});

export const IndexSchema = type({
  name: 'string',
  'prefix?': 'string',
  'columns?': type.string.array().readonly(),
  'expression?': 'string',
  'where?': 'string',
  unique: 'boolean',
  'type?': 'string',
  'options?': 'Record<string, unknown>',
});

export const ForeignKeyReferenceSchema = type({
  '+': 'reject',
  namespaceId: 'string',
  tableName: 'string',
  columns: type.string.array().readonly(),
  'spaceId?': 'string',
}) satisfies Type<ForeignKeyReferenceInput>;

export const ForeignKeySourceSchema = type({
  '+': 'reject',
  namespaceId: 'string',
  tableName: 'string',
  columns: type.string.array().readonly(),
}) satisfies Type<ForeignKeyReferenceInput>;

export const ReferentialActionSchema = type
  .declare<ReferentialAction>()
  .type("'noAction' | 'restrict' | 'cascade' | 'setNull' | 'setDefault'");

export const ForeignKeyIndexSchema = type
  .declare<ForeignKeyIndex>()
  .type(
    type({ '+': 'reject', name: 'string' })
      .or({ '+': 'reject', primaryKey: 'true' })
      .or({ '+': 'reject', unique: type.string.array().readonly() }),
  );

export const ForeignKeySchema = type.declare<ForeignKeyInput>().type({
  source: ForeignKeySourceSchema,
  target: ForeignKeyReferenceSchema,
  'name?': 'string',
  'onDelete?': ReferentialActionSchema,
  'onUpdate?': ReferentialActionSchema,
  'index?': ForeignKeyIndexSchema.or('boolean'),
});

export const CheckConstraintSchema = type({
  '+': 'reject',
  name: 'string',
  'prefix?': 'string',
  expression: 'string',
});

export const StorageTableSchema = type({
  '+': 'reject',
  columns: type({ '[string]': StorageColumnSchema }),
  'primaryKey?': PrimaryKeySchema,
  uniques: UniqueConstraintSchema.array().readonly(),
  indexes: IndexSchema.array().readonly(),
  foreignKeys: ForeignKeySchema.array().readonly(),
  'control?': ControlPolicySchema,
  'checks?': CheckConstraintSchema.array().readonly(),
});
