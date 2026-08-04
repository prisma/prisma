import { AndExpr, BinaryExpr, ColumnRef, LiteralExpr } from '@internal/sql-relational-core/ast';
import { describe, expect, it } from 'vitest';
import { combineWhereExprs } from '../src/where-utils';

describe('where utils', () => {
  it('combines filters with AND', () => {
    const a = BinaryExpr.eq(ColumnRef.of('users', 'id'), LiteralExpr.of(1));
    const b = BinaryExpr.eq(ColumnRef.of('users', 'name'), LiteralExpr.of('x'));
    const combined = combineWhereExprs([a, b]);
    expect(combined?.kind).toBe('and');
  });

  it('returns the original expression when only one filter is provided', () => {
    const expr = BinaryExpr.eq(ColumnRef.of('users', 'name'), LiteralExpr.of('Alice'));
    expect(combineWhereExprs([expr])).toBe(expr);
  });

  it('combines multiple filters with AND', () => {
    const first = BinaryExpr.eq(ColumnRef.of('users', 'id'), LiteralExpr.of(1));
    const second = BinaryExpr.eq(ColumnRef.of('users', 'name'), LiteralExpr.of('Alice'));

    expect(combineWhereExprs([first, second])).toEqual(AndExpr.of([first, second]));
  });
});
