import { assertType, expectTypeOf, test } from 'vitest';
import type { MongoExprFilter, MongoFilterExpr } from '../src/filter-expressions';
import type { MongoFilterRewriter, MongoFilterVisitor } from '../src/visitors';

test('MongoFilterExpr kind union includes expr', () => {
  expectTypeOf<MongoFilterExpr['kind']>().toEqualTypeOf<
    'field' | 'and' | 'or' | 'not' | 'exists' | 'expr'
  >();
});

test('switching on MongoFilterExpr kind is exhaustive', () => {
  function exhaustiveSwitch(expr: MongoFilterExpr): string {
    switch (expr.kind) {
      case 'field':
        return 'field';
      case 'and':
        return 'and';
      case 'or':
        return 'or';
      case 'not':
        return 'not';
      case 'exists':
        return 'exists';
      case 'expr':
        return 'expr';
      default: {
        const _exhaustive: never = expr;
        return _exhaustive;
      }
    }
  }
  assertType<(expr: MongoFilterExpr) => string>(exhaustiveSwitch);
});

test('MongoExprFilter is assignable to MongoFilterExpr', () => {
  expectTypeOf<MongoExprFilter>().toExtend<MongoFilterExpr>();
});

test('MongoFilterVisitor requires expr method', () => {
  expectTypeOf<MongoFilterVisitor<string>>().toHaveProperty('expr');

  // @ts-expect-error - missing 'expr' method
  assertType<MongoFilterVisitor<string>>({
    field: () => '',
    and: () => '',
    or: () => '',
    not: () => '',
    exists: () => '',
  });
});

test('MongoFilterRewriter accepts empty object (all optional)', () => {
  assertType<MongoFilterRewriter>({});
});

test('MongoFilterRewriter expr is optional', () => {
  const rewriter: MongoFilterRewriter = {
    expr: (e): MongoFilterExpr => e,
  };
  assertType<MongoFilterRewriter>(rewriter);
});
