import { assertType, expectTypeOf, test } from 'vitest';
import type { MongoAggExpr } from '../src/aggregation-expressions';
import {
  type MongoAggAccumulator,
  type MongoAggArrayFilter,
  type MongoAggCond,
  MongoAggFieldRef,
  type MongoAggLet,
  type MongoAggLiteral,
  type MongoAggMap,
  type MongoAggMergeObjects,
  type MongoAggOperator,
  type MongoAggReduce,
  type MongoAggSwitch,
} from '../src/aggregation-expressions';
import type { MongoAggExprRewriter, MongoAggExprVisitor } from '../src/visitors';

test('each concrete class is assignable to MongoAggExpr', () => {
  expectTypeOf<MongoAggFieldRef>().toExtend<MongoAggExpr>();
  expectTypeOf<MongoAggLiteral>().toExtend<MongoAggExpr>();
  expectTypeOf<MongoAggOperator>().toExtend<MongoAggExpr>();
  expectTypeOf<MongoAggAccumulator>().toExtend<MongoAggExpr>();
  expectTypeOf<MongoAggCond>().toExtend<MongoAggExpr>();
  expectTypeOf<MongoAggSwitch>().toExtend<MongoAggExpr>();
  expectTypeOf<MongoAggArrayFilter>().toExtend<MongoAggExpr>();
  expectTypeOf<MongoAggMap>().toExtend<MongoAggExpr>();
  expectTypeOf<MongoAggReduce>().toExtend<MongoAggExpr>();
  expectTypeOf<MongoAggLet>().toExtend<MongoAggExpr>();
  expectTypeOf<MongoAggMergeObjects>().toExtend<MongoAggExpr>();
});

test('MongoAggExpr kind union covers all 11 kinds', () => {
  expectTypeOf<MongoAggExpr['kind']>().toEqualTypeOf<
    | 'fieldRef'
    | 'literal'
    | 'operator'
    | 'accumulator'
    | 'cond'
    | 'switch'
    | 'filter'
    | 'map'
    | 'reduce'
    | 'let'
    | 'mergeObjects'
  >();
});

test('switching on kind is exhaustive', () => {
  function exhaustiveSwitch(expr: MongoAggExpr): string {
    switch (expr.kind) {
      case 'fieldRef':
        return 'fieldRef';
      case 'literal':
        return 'literal';
      case 'operator':
        return 'operator';
      case 'accumulator':
        return 'accumulator';
      case 'cond':
        return 'cond';
      case 'switch':
        return 'switch';
      case 'filter':
        return 'filter';
      case 'map':
        return 'map';
      case 'reduce':
        return 'reduce';
      case 'let':
        return 'let';
      case 'mergeObjects':
        return 'mergeObjects';
      default: {
        const _exhaustive: never = expr;
        return _exhaustive;
      }
    }
  }
  assertType<(expr: MongoAggExpr) => string>(exhaustiveSwitch);
});

test('MongoAggExprVisitor requires all 11 methods', () => {
  type Complete = MongoAggExprVisitor<string>;

  expectTypeOf<Complete>().toHaveProperty('fieldRef');
  expectTypeOf<Complete>().toHaveProperty('literal');
  expectTypeOf<Complete>().toHaveProperty('operator');
  expectTypeOf<Complete>().toHaveProperty('accumulator');
  expectTypeOf<Complete>().toHaveProperty('cond');
  expectTypeOf<Complete>().toHaveProperty('switch_');
  expectTypeOf<Complete>().toHaveProperty('filter');
  expectTypeOf<Complete>().toHaveProperty('map');
  expectTypeOf<Complete>().toHaveProperty('reduce');
  expectTypeOf<Complete>().toHaveProperty('let_');
  expectTypeOf<Complete>().toHaveProperty('mergeObjects');

  // @ts-expect-error - missing 'fieldRef' method
  assertType<MongoAggExprVisitor<string>>({
    literal: () => '',
    operator: () => '',
    accumulator: () => '',
    cond: () => '',
    switch_: () => '',
    filter: () => '',
    map: () => '',
    reduce: () => '',
    let_: () => '',
    mergeObjects: () => '',
  });
});

test('MongoAggExprRewriter accepts empty object (all optional)', () => {
  assertType<MongoAggExprRewriter>({});
});

test('rewriter hooks return MongoAggExpr', () => {
  const rewriter: MongoAggExprRewriter = {
    fieldRef: (expr): MongoAggExpr => expr,
    literal: (expr): MongoAggExpr => expr,
    operator: (expr): MongoAggExpr => expr,
  };
  assertType<MongoAggExprRewriter>(rewriter);
});

test('accept returns R for any visitor R', () => {
  const ref = MongoAggFieldRef.of('x');
  const visitor: MongoAggExprVisitor<number> = {
    fieldRef: () => 1,
    literal: () => 2,
    operator: () => 3,
    accumulator: () => 4,
    cond: () => 5,
    switch_: () => 6,
    filter: () => 7,
    map: () => 8,
    reduce: () => 9,
    let_: () => 10,
    mergeObjects: () => 11,
  };
  expectTypeOf(ref.accept(visitor)).toBeNumber();
});

test('rewrite returns MongoAggExpr', () => {
  const ref = MongoAggFieldRef.of('x');
  expectTypeOf(ref.rewrite({})).toEqualTypeOf<MongoAggExpr>();
});

test('MongoAggOperator.args accepts all three forms', () => {
  expectTypeOf<MongoAggOperator['args']>().toEqualTypeOf<
    | MongoAggExpr
    | ReadonlyArray<MongoAggExpr>
    | Readonly<Record<string, MongoAggExpr | ReadonlyArray<MongoAggExpr>>>
  >();
});

test('MongoAggAccumulator.arg accepts MongoAggExpr, record, or null', () => {
  expectTypeOf<MongoAggAccumulator['arg']>().toEqualTypeOf<
    MongoAggExpr | Readonly<Record<string, MongoAggExpr | ReadonlyArray<MongoAggExpr>>> | null
  >();
});

test('MongoAggSwitch.branches is ReadonlyArray', () => {
  expectTypeOf<MongoAggSwitch['branches']>().toExtend<ReadonlyArray<unknown>>();
});

test('MongoAggLet.vars is Readonly<Record>', () => {
  expectTypeOf<MongoAggLet['vars']>().toExtend<Readonly<Record<string, MongoAggExpr>>>();
});

test('MongoAggMergeObjects.exprs is ReadonlyArray', () => {
  expectTypeOf<MongoAggMergeObjects['exprs']>().toExtend<ReadonlyArray<MongoAggExpr>>();
});
