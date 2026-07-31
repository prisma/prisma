import type { Contract } from '@internal/contract/types';
import type {
  AnnotationValue,
  MetaBuilder,
  OperationKind,
} from '@internal/framework-components/runtime';
import { createMetaBuilder } from '@internal/framework-components/runtime';
import type { SqlStorage } from '@internal/sql-contract/types';
import {
  AggregateExpr,
  type AnyExpression,
  BinaryExpr,
  type BinaryOp,
  ColumnRef,
  LiteralExpr,
} from '@internal/sql-relational-core/ast';
import type { SimplifyDeep } from '@internal/utils/simplify-deep';
import { createAggregateBuilder, isAggregateSelector } from './aggregate-builder';
import { getFieldToColumnMap } from './collection-contract';
import { mapStorageRowToModelFields } from './collection-runtime';
import { executeQueryPlan } from './execute-query-plan';
import { ormError } from './orm-errors';
import { compileGroupedAggregate, mergeAnnotations } from './query-plan';
import type {
  AggregateBuilder,
  AggregateResult,
  AggregateSpec,
  CollectionContext,
  DefaultModelRow,
  HavingBuilder,
  HavingComparisonMethods,
} from './types';
import { combineWhereExprs } from './where-utils';

interface GroupedCollectionInit {
  readonly tableName: string;
  readonly namespaceId: string;
  readonly baseFilters: readonly AnyExpression[];
  readonly groupByFields: readonly string[];
  readonly groupByColumns: readonly string[];
  readonly havingFilters: readonly AnyExpression[];
}

type GroupByFieldName<
  TContract extends Contract<SqlStorage>,
  ModelName extends string,
> = keyof DefaultModelRow<TContract, ModelName> & string;

export class GroupedCollection<
  TContract extends Contract<SqlStorage>,
  ModelName extends string,
  GroupFields extends readonly GroupByFieldName<TContract, ModelName>[],
> {
  readonly ctx: CollectionContext<TContract>;
  private readonly contract: TContract;
  readonly modelName: ModelName;
  readonly tableName: string;
  readonly namespaceId: string;
  readonly baseFilters: readonly AnyExpression[];
  readonly groupByFields: readonly string[];
  readonly groupByColumns: readonly string[];
  readonly havingFilters: readonly AnyExpression[];

  constructor(
    ctx: CollectionContext<TContract>,
    modelName: ModelName,
    options: GroupedCollectionInit,
  ) {
    this.ctx = ctx;
    this.contract = ctx.context.contract;
    this.modelName = modelName;
    this.tableName = options.tableName;
    this.namespaceId = options.namespaceId;
    this.baseFilters = options.baseFilters;
    this.groupByFields = options.groupByFields;
    this.groupByColumns = options.groupByColumns;
    this.havingFilters = options.havingFilters;
  }

  having(
    predicate: (having: HavingBuilder<TContract, ModelName>) => AnyExpression,
  ): GroupedCollection<TContract, ModelName, GroupFields> {
    const havingExpr = predicate(
      createHavingBuilder(this.contract, this.namespaceId, this.modelName, this.tableName),
    );
    return new GroupedCollection(this.ctx, this.modelName, {
      tableName: this.tableName,
      namespaceId: this.namespaceId,
      baseFilters: this.baseFilters,
      groupByFields: this.groupByFields,
      groupByColumns: this.groupByColumns,
      havingFilters: [...this.havingFilters, havingExpr],
    }) as GroupedCollection<TContract, ModelName, GroupFields>;
  }

  /**
   * Read terminal: run a grouped aggregate query.
   *
   * Accepts an optional `configure` callback that receives a
   * `MetaBuilder<'read'>` for attaching typed annotations.
   * Annotations are merged into the compiled plan's `meta.annotations`.
   */
  async aggregate<Spec extends AggregateSpec>(
    fn: (aggregate: AggregateBuilder<TContract, ModelName>) => Spec,
    configure?: (meta: MetaBuilder<'read'>) => void,
  ): Promise<
    Array<
      SimplifyDeep<
        Pick<DefaultModelRow<TContract, ModelName>, GroupFields[number]> & AggregateResult<Spec>
      >
    >
  > {
    const aggregateSpec = fn(
      createAggregateBuilder(this.contract, this.namespaceId, this.modelName),
    );
    const aggregateEntries = Object.entries(aggregateSpec);
    if (aggregateEntries.length === 0) {
      throw ormError(
        'ORM.AGGREGATE_SELECTOR_MISSING',
        'groupBy().aggregate() requires at least one aggregation selector',
        { meta: { method: 'groupBy.aggregate', model: this.modelName } },
      );
    }

    for (const [alias, selector] of aggregateEntries) {
      if (!isAggregateSelector(selector)) {
        throw ormError(
          'ORM.AGGREGATE_SELECTOR_INVALID',
          `groupBy().aggregate() selector "${alias}" is invalid`,
          { meta: { method: 'groupBy.aggregate', model: this.modelName, alias } },
        );
      }
    }

    let annotationsMap: ReadonlyMap<string, AnnotationValue<unknown, OperationKind>> | undefined;
    if (configure !== undefined) {
      const meta = createMetaBuilder('read', 'groupBy.aggregate');
      configure(meta);
      if (meta.annotations.size > 0) {
        annotationsMap = meta.annotations;
      }
    }

    const compiled = mergeAnnotations(
      compileGroupedAggregate(
        this.contract,
        this.namespaceId,
        this.tableName,
        this.baseFilters,
        this.groupByColumns,
        aggregateSpec,
        combineWhereExprs(this.havingFilters),
      ),
      annotationsMap,
    );
    const rows = await executeQueryPlan<Record<string, unknown>>(
      this.ctx.runtime,
      compiled,
    ).toArray();

    return rows.map((row) => {
      const mapped = mapStorageRowToModelFields(
        this.contract,
        this.namespaceId,
        this.modelName,
        row,
      );
      for (const [alias, selector] of aggregateEntries) {
        mapped[alias] = coerceAggregateValue(selector.fn, row[alias]);
      }
      return mapped;
    }) as Array<
      SimplifyDeep<
        Pick<DefaultModelRow<TContract, ModelName>, GroupFields[number]> & AggregateResult<Spec>
      >
    >;
  }
}

function createHavingBuilder<TContract extends Contract<SqlStorage>, ModelName extends string>(
  contract: TContract,
  namespaceId: string,
  modelName: ModelName,
  tableName: string,
): HavingBuilder<TContract, ModelName> {
  const fieldToColumn = getFieldToColumnMap(contract, namespaceId, modelName);
  const createMetricExpr = (
    fn: Exclude<AggregateExpr['fn'], 'count'>,
    fieldName: string,
  ): AggregateExpr =>
    new AggregateExpr(fn, ColumnRef.of(tableName, fieldToColumn[fieldName] ?? fieldName));

  return {
    count() {
      return createHavingComparisonMethods<number>(AggregateExpr.count());
    },
    sum(field) {
      return createHavingComparisonMethods<number | null>(createMetricExpr('sum', field as string));
    },
    avg(field) {
      return createHavingComparisonMethods<number | null>(createMetricExpr('avg', field as string));
    },
    min(field) {
      return createHavingComparisonMethods<number | null>(createMetricExpr('min', field as string));
    },
    max(field) {
      return createHavingComparisonMethods<number | null>(createMetricExpr('max', field as string));
    },
  };
}

function createHavingComparisonMethods<T extends number | null>(
  metric: AggregateExpr,
): HavingComparisonMethods<T> {
  const buildBinaryExpr = (op: BinaryOp, value: unknown): AnyExpression =>
    new BinaryExpr(op, metric, LiteralExpr.of(value));

  return {
    eq(value) {
      return buildBinaryExpr('eq', value);
    },
    neq(value) {
      return buildBinaryExpr('neq', value);
    },
    gt(value) {
      return buildBinaryExpr('gt', value);
    },
    lt(value) {
      return buildBinaryExpr('lt', value);
    },
    gte(value) {
      return buildBinaryExpr('gte', value);
    },
    lte(value) {
      return buildBinaryExpr('lte', value);
    },
  };
}

function coerceAggregateValue(fn: string, value: unknown): unknown {
  if (value === null) {
    return null;
  }

  if (value === undefined) {
    return fn === 'count' ? 0 : null;
  }

  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'bigint') {
    return Number(value);
  }

  if (typeof value === 'string') {
    const numeric = Number(value);
    return Number.isNaN(numeric) ? value : numeric;
  }

  return value;
}
