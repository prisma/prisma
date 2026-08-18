import type { ContractField } from '@internal/contract/types';
import type { MongoModelDefinition } from '@internal/mongo-contract';
import type { MongoFieldShape, MongoResultShape } from '@internal/mongo-query-ast/execution';
import { freezeMongoFieldShape, freezeMongoResultShape } from '@internal/mongo-query-ast/execution';

export function contractFieldToMongoFieldShape(field: ContractField): MongoFieldShape {
  const { type, nullable, many } = field;
  if (type.kind === 'valueObject' || type.kind === 'union') {
    return Object.freeze({ kind: 'unknown' as const });
  }
  if (type.kind !== 'scalar') {
    return Object.freeze({ kind: 'unknown' as const });
  }
  if (field.dict === true) {
    return Object.freeze({ kind: 'unknown' as const });
  }
  if (many !== false) {
    return freezeMongoFieldShape({
      kind: 'array',
      nullable,
      element: { kind: 'leaf', codecId: type.codecId, nullable: many.elementNullable },
    });
  }
  return freezeMongoFieldShape({
    kind: 'leaf',
    codecId: type.codecId,
    nullable,
  });
}

export function contractModelToMongoResultShape(
  model: MongoModelDefinition,
  options?: {
    readonly selection?: readonly string[];
    readonly includeRelationNames?: readonly string[];
  },
): MongoResultShape {
  const fields: Record<string, MongoFieldShape> = {};
  for (const rel of options?.includeRelationNames ?? []) {
    fields[rel] = Object.freeze({ kind: 'unknown' as const });
  }
  const modelFields = model.fields;
  // An explicit empty selection is honored as-is (returns a document shape
  // with no fields). Only the absence of a selection falls back to the model's
  // full field set.
  const keys = options?.selection !== undefined ? options.selection : Object.keys(modelFields);

  for (const key of keys) {
    if (Object.hasOwn(fields, key)) {
      continue;
    }
    const cf = modelFields[key];
    if (!cf) {
      fields[key] = Object.freeze({ kind: 'unknown' as const });
      continue;
    }
    fields[key] = contractFieldToMongoFieldShape(cf);
  }
  return freezeMongoResultShape({ kind: 'document', fields });
}
