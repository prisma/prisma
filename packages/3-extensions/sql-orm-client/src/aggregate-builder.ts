import type { Contract } from '@internal/contract/types';
import type { SqlStorage } from '@internal/sql-contract/types';
import { getFieldToColumnMap } from './collection-contract';
import type { AggregateBuilder, AggregateSelector } from './types';

export function createAggregateBuilder<
  TContract extends Contract<SqlStorage>,
  ModelName extends string,
  NsId extends string = never,
>(
  contract: TContract,
  namespaceId: string,
  modelName: ModelName,
): AggregateBuilder<TContract, ModelName, NsId> {
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

/**
 * The selector's result type is the contract's to state — it varies by target, operation, and the field's own codec — so the builder erases it here and each method's declared return type names it.
 */
function createFieldAggregateSelector<Result>(
  fieldToColumn: Record<string, string>,
  field: string,
  fn: 'sum' | 'avg' | 'min' | 'max',
): AggregateSelector<Result> {
  return {
    kind: 'aggregate',
    fn,
    column: fieldToColumn[field] ?? field,
  };
}
