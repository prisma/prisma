import { BinaryExpr, ColumnRef, ParamRef } from '@internal/sql-relational-core/ast';
import { describe, expect, it } from 'vitest';
import { ExpressionImpl } from '../../src/runtime/expression-impl';
import type { ScopeField } from '../../src/scope';

describe('ExpressionImpl', () => {
  it('wraps an AST node with field metadata', () => {
    const col = ColumnRef.of('users', 'id');
    const scopeField: ScopeField = { codecId: 'pg/int4@1', nullable: false };
    const expr = new ExpressionImpl(col, scopeField);

    expect(expr).toBeInstanceOf(ExpressionImpl);
    expect(expr.buildAst()).toBe(col);
    expect(expr.returnType).toEqual(scopeField);
  });

  it('wraps a predicate Expression node', () => {
    const binary = BinaryExpr.eq(ColumnRef.of('users', 'id'), ParamRef.of(1));
    const scopeField: ScopeField = { codecId: 'pg/bool@1', nullable: false };
    const expr = new ExpressionImpl(binary, scopeField);

    expect(expr.buildAst()).toBe(binary);
  });
});
