import type { ContractField } from '@internal/contract/types';
import { MongoFieldFilter } from '@internal/mongo-query-ast/execution';
import type { MongoValue } from '@internal/mongo-value';

/**
 * MongoDB's `{ field: null }` also matches an array holding a null item, so `null` on a scalar list matches any value that is not an array: null or a missing field.
 */
export function whereEquality(
  path: string,
  field: ContractField | undefined,
  value: MongoValue,
): MongoFieldFilter {
  if (value === null && field?.many && field.type.kind === 'scalar') return notAnArray(path);
  return MongoFieldFilter.eq(path, value);
}

function notAnArray(path: string): MongoFieldFilter {
  return MongoFieldFilter.of(path, '$not', { $type: 'array' });
}
