import type { Contract } from '@internal/contract/types';
import type { SqlStorage } from '@internal/sql-contract/types';
import { getFieldToColumnMap } from './collection-contract';
import type { AggregateBuilder, AggregateSelector, NumericFieldNames } from './types';

export function createAggregateBuilder<
  TContract extends Contract<SqlStorage>,
  ModelName extends string,
>(
  contract: TContract,
  namespaceId: string,
  modelName: ModelName,
): AggregateBuilder<TContract, ModelName> {
  const fieldToColumn = getFieldToColumnMap(contract, namespaceId, modelName);

  return {
    count() {
      return {
        kind: 'aggregate',
        fn: 'count',
      };
    },
    sum(field) {
      return createFieldAggregateSelector(fieldToColumn, field, 'sum');
    },
    avg(field) {
      return createFieldAggregateSelector(fieldToColumn, field, 'avg');
    },
    min(field) {
      return createFieldAggregateSelector(fieldToColumn, field, 'min');
    },
    max(field) {
      return createFieldAggregateSelector(fieldToColumn, field, 'max');
    },
  };
}

export function isAggregateSelector(value: unknown): value is AggregateSelector<unknown> {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as { kind?: unknown; fn?: unknown };
  if (candidate.kind !== 'aggregate') {
    return false;
  }

  return (
    candidate.fn === 'count' ||
    candidate.fn === 'sum' ||
    candidate.fn === 'avg' ||
    candidate.fn === 'min' ||
    candidate.fn === 'max'
  );
}

function createFieldAggregateSelector<
  TContract extends Contract<SqlStorage>,
  ModelName extends string,
>(
  fieldToColumn: Record<string, string>,
  field: NumericFieldNames<TContract, ModelName>,
  fn: 'sum' | 'avg' | 'min' | 'max',
): AggregateSelector<number | null> {
  const fieldName = field as string;
  return {
    kind: 'aggregate',
    fn,
    column: fieldToColumn[fieldName] ?? fieldName,
  };
}
