import type { CodecControlHooks } from '@internal/family-sql/control';
import type { StorageColumn, StorageTypeInstance } from '@internal/sql-contract/types';
import { ifDefined } from '@internal/utils/defined';

/**
 * Resolves the identity value (monoid neutral element) as a SQL literal for a column's type.
 * Checks codec hooks first (extensions can provide type-specific identity values),
 * then falls back to the built-in map.
 */
export function resolveIdentityValue(
  column: StorageColumn,
  codecHooks: ReadonlyMap<string, CodecControlHooks>,
  storageTypes: Record<string, StorageTypeInstance> = {},
): string | null {
  const referencedType = column.typeRef ? storageTypes[column.typeRef] : undefined;
  const codecId = referencedType?.codecId ?? column.codecId;
  const nativeType = referencedType?.nativeType ?? column.nativeType;
  const typeParams = referencedType?.typeParams ?? column.typeParams;

  if (codecId) {
    const hookDefault = codecHooks.get(codecId)?.resolveIdentityValue?.({
      nativeType,
      codecId,
      ...ifDefined('typeParams', typeParams),
    });
    if (hookDefault !== undefined) {
      return hookDefault;
    }
  }

  return buildBuiltinIdentityValue(nativeType, typeParams);
}

/**
 * Returns the built-in identity value (monoid neutral element) as a SQL literal for the given
 * PostgreSQL native type — e.g. 0 for integers, '' for text, false for booleans.
 *
 * This is the planner's fallback when no codec hook provides a type-specific identity value.
 *
 * Returns null for unrecognized types (for example enums and extension-owned types without a
 * hook), which causes the planner to fall back to the empty-table precheck.
 *
 * @internal Exported for testing only.
 */
export function buildBuiltinIdentityValue(
  nativeType: string,
  typeParams?: Record<string, unknown>,
): string | null {
  const normalizedNativeType = normalizeIdentityValueNativeType(nativeType);

  if (normalizedNativeType.endsWith('[]')) {
    return "'{}'";
  }

  switch (normalizedNativeType) {
    case 'text':
    case 'character':
    case 'bpchar':
    case 'character varying':
    case 'varchar':
      return "''";

    case 'int2':
    case 'int4':
    case 'int8':
    case 'integer':
    case 'bigint':
    case 'smallint':
    case 'float4':
    case 'float8':
    case 'real':
    case 'double precision':
    case 'numeric':
    case 'decimal':
      return '0';

    case 'bool':
    case 'boolean':
      return 'false';

    case 'uuid':
      return "'00000000-0000-0000-0000-000000000000'";

    case 'json':
      return "'{}'::json";
    case 'jsonb':
      return "'{}'::jsonb";

    case 'date':
    case 'timestamp':
    case 'timestamptz':
    case 'timestamp with time zone':
    case 'timestamp without time zone':
      return "'epoch'";

    case 'time':
    case 'time without time zone':
      return "'00:00:00'";
    case 'timetz':
    case 'time with time zone':
      return "'00:00:00+00'";

    case 'interval':
      return "'0'";

    case 'bytea':
      return "''::bytea";
    case 'tsvector':
      return "''::tsvector";

    case 'bit':
      return buildBitIdentityValue(typeParams);
    case 'bit varying':
    case 'varbit':
      return "B''";

    default:
      return null;
  }
}

function normalizeIdentityValueNativeType(nativeType: string): string {
  return nativeType.trim().toLowerCase().replace(/\s+/g, ' ');
}

function buildBitIdentityValue(typeParams?: Record<string, unknown>): string | null {
  const length = typeParams?.['length'];
  if (length === undefined) {
    return "B'0'";
  }
  if (typeof length !== 'number' || !Number.isInteger(length) || length <= 0) {
    return null;
  }
  return `B'${'0'.repeat(length)}'`;
}
