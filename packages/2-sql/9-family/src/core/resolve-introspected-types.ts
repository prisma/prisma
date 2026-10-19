import type { DataType } from '@internal/framework-components/codec';
import { resolveReportedSqlType } from '@internal/sql-contract/data-type';
import { SqlColumnIR, SqlSchemaIRNode } from '@internal/sql-schema-ir/types';
import { blindCast } from '@internal/utils/casts';

/**
 * The introspected `schema` with each column given the data type that claims its reported type, and that type's parameters in normal form, over `dataTypes`, the stack's declared SQL data types in assembly order. A column no data type claims is kept as introspected, with no data type. ADR 254.
 */
export function resolveIntrospectedTypes(
  schema: SqlSchemaIRNode,
  dataTypes: readonly DataType[],
): SqlSchemaIRNode {
  const byId = new Map(dataTypes.map((type) => [type.id, type]));
  const resolveColumn = (column: SqlColumnIR): SqlColumnIR => {
    if (column.reportedType === undefined) return column;
    const resolved = resolveReportedSqlType(column.reportedType, dataTypes);
    const type = resolved === undefined ? undefined : byId.get(resolved.dataType);
    return resolved === undefined || type === undefined
      ? column
      : column.withDataType(type, resolved.typeParams);
  };
  return rebuiltNode(schema, resolveColumn);
}

type ColumnRebuild = (column: SqlColumnIR) => SqlColumnIR;

/** `value` with every column below it rebuilt, sharing every part that holds no changed column. */
function rebuilt(value: unknown, rebuildColumn: ColumnRebuild): unknown {
  if (value instanceof SqlColumnIR) return rebuildColumn(value);
  if (value instanceof SqlSchemaIRNode) return rebuiltNode(value, rebuildColumn);
  if (Array.isArray(value)) {
    const items = value.map((item) => rebuilt(item, rebuildColumn));
    return items.every((item, index) => item === value[index]) ? value : sealedLike(value, items);
  }
  if (isPlainRecord(value)) {
    const entries = Object.entries(value).map(
      ([key, item]) => [key, rebuilt(item, rebuildColumn)] as const,
    );
    return entries.every(([key, item]) => item === value[key])
      ? value
      : sealedLike(value, Object.fromEntries(entries));
  }
  return value;
}

/**
 * A copy of `node` of the same class with every column below it rebuilt. Each target's nodes are its own classes, so the copy is made from the node's own properties, enumerable or not, rather than through a constructor this family does not know.
 */
function rebuiltNode<T extends SqlSchemaIRNode>(node: T, rebuildColumn: ColumnRebuild): T {
  const descriptors = Object.getOwnPropertyDescriptors(node);
  let changed = false;
  for (const descriptor of Object.values(descriptors)) {
    if (!('value' in descriptor)) continue;
    const value = rebuilt(descriptor.value, rebuildColumn);
    if (value === descriptor.value) continue;
    descriptor.value = value;
    changed = true;
  }
  if (!changed) return node;
  const copy = blindCast<T, 'a new object with the prototype and every own property of node'>(
    Object.create(Object.getPrototypeOf(node), descriptors),
  );
  return sealedLike(node, copy);
}

function isPlainRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  if (typeof value !== 'object' || value === null) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function sealedLike<T>(original: object, copy: T): T {
  return Object.isFrozen(original) ? Object.freeze(copy) : copy;
}
