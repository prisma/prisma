import type { MongoAggExpr } from '@internal/mongo-query-ast/execution';
import { MongoAggAccumulator, MongoAggLiteral } from '@internal/mongo-query-ast/execution';
import type {
  ArrayField,
  DocField,
  NullableNumericField,
  NumericField,
  TypedAccumulatorExpr,
  TypedAggExpr,
} from './types';

function namedAccumulatorArgs(
  args: Readonly<Record<string, TypedAggExpr<DocField> | undefined>>,
): Record<string, MongoAggExpr> {
  const result: Record<string, MongoAggExpr> = {};
  for (const [key, val] of Object.entries(args)) {
    if (val !== undefined) {
      result[key] = val.node;
    }
  }
  return result;
}

export const acc = {
  sum<F extends DocField>(expr: TypedAggExpr<F>): TypedAccumulatorExpr<F> {
    return { _field: undefined as never, node: MongoAggAccumulator.sum(expr.node) };
  },

  avg(expr: TypedAggExpr<DocField>): TypedAccumulatorExpr<NullableNumericField> {
    return { _field: undefined as never, node: MongoAggAccumulator.avg(expr.node) };
  },

  min<F extends DocField>(
    expr: TypedAggExpr<F>,
  ): TypedAccumulatorExpr<{ readonly codecId: F['codecId']; readonly nullable: true }> {
    return { _field: undefined as never, node: MongoAggAccumulator.min(expr.node) };
  },

  max<F extends DocField>(
    expr: TypedAggExpr<F>,
  ): TypedAccumulatorExpr<{ readonly codecId: F['codecId']; readonly nullable: true }> {
    return { _field: undefined as never, node: MongoAggAccumulator.max(expr.node) };
  },

  first<F extends DocField>(
    expr: TypedAggExpr<F>,
  ): TypedAccumulatorExpr<{ readonly codecId: F['codecId']; readonly nullable: true }> {
    return { _field: undefined as never, node: MongoAggAccumulator.first(expr.node) };
  },

  last<F extends DocField>(
    expr: TypedAggExpr<F>,
  ): TypedAccumulatorExpr<{ readonly codecId: F['codecId']; readonly nullable: true }> {
    return { _field: undefined as never, node: MongoAggAccumulator.last(expr.node) };
  },

  push(expr: TypedAggExpr<DocField>): TypedAccumulatorExpr<ArrayField> {
    return { _field: undefined as never, node: MongoAggAccumulator.push(expr.node) };
  },

  addToSet(expr: TypedAggExpr<DocField>): TypedAccumulatorExpr<ArrayField> {
    return { _field: undefined as never, node: MongoAggAccumulator.addToSet(expr.node) };
  },

  count(): TypedAccumulatorExpr<NumericField> {
    return { _field: undefined as never, node: MongoAggAccumulator.count() };
  },

  stdDevPop(expr: TypedAggExpr<DocField>): TypedAccumulatorExpr<NullableNumericField> {
    return { _field: undefined as never, node: MongoAggAccumulator.stdDevPop(expr.node) };
  },

  stdDevSamp(expr: TypedAggExpr<DocField>): TypedAccumulatorExpr<NullableNumericField> {
    return { _field: undefined as never, node: MongoAggAccumulator.stdDevSamp(expr.node) };
  },

  firstN(args: {
    input: TypedAggExpr<DocField>;
    n: TypedAggExpr<NumericField>;
  }): TypedAccumulatorExpr<ArrayField> {
    return {
      _field: undefined as never,
      node: MongoAggAccumulator.of('$firstN', namedAccumulatorArgs(args)),
    };
  },

  lastN(args: {
    input: TypedAggExpr<DocField>;
    n: TypedAggExpr<NumericField>;
  }): TypedAccumulatorExpr<ArrayField> {
    return {
      _field: undefined as never,
      node: MongoAggAccumulator.of('$lastN', namedAccumulatorArgs(args)),
    };
  },

  maxN(args: {
    input: TypedAggExpr<DocField>;
    n: TypedAggExpr<NumericField>;
  }): TypedAccumulatorExpr<ArrayField> {
    return {
      _field: undefined as never,
      node: MongoAggAccumulator.of('$maxN', namedAccumulatorArgs(args)),
    };
  },

  minN(args: {
    input: TypedAggExpr<DocField>;
    n: TypedAggExpr<NumericField>;
  }): TypedAccumulatorExpr<ArrayField> {
    return {
      _field: undefined as never,
      node: MongoAggAccumulator.of('$minN', namedAccumulatorArgs(args)),
    };
  },

  top(args: {
    output: TypedAggExpr<DocField>;
    sortBy: Readonly<Record<string, 1 | -1>>;
  }): TypedAccumulatorExpr<DocField> {
    return {
      _field: undefined as never,
      node: MongoAggAccumulator.of('$top', {
        output: args.output.node,
        sortBy: MongoAggLiteral.of(args.sortBy),
      }),
    };
  },

  bottom(args: {
    output: TypedAggExpr<DocField>;
    sortBy: Readonly<Record<string, 1 | -1>>;
  }): TypedAccumulatorExpr<DocField> {
    return {
      _field: undefined as never,
      node: MongoAggAccumulator.of('$bottom', {
        output: args.output.node,
        sortBy: MongoAggLiteral.of(args.sortBy),
      }),
    };
  },

  topN(args: {
    output: TypedAggExpr<DocField>;
    sortBy: Readonly<Record<string, 1 | -1>>;
    n: TypedAggExpr<NumericField>;
  }): TypedAccumulatorExpr<ArrayField> {
    return {
      _field: undefined as never,
      node: MongoAggAccumulator.of('$topN', {
        output: args.output.node,
        sortBy: MongoAggLiteral.of(args.sortBy),
        n: args.n.node,
      }),
    };
  },

  bottomN(args: {
    output: TypedAggExpr<DocField>;
    sortBy: Readonly<Record<string, 1 | -1>>;
    n: TypedAggExpr<NumericField>;
  }): TypedAccumulatorExpr<ArrayField> {
    return {
      _field: undefined as never,
      node: MongoAggAccumulator.of('$bottomN', {
        output: args.output.node,
        sortBy: MongoAggLiteral.of(args.sortBy),
        n: args.n.node,
      }),
    };
  },
};
