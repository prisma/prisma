import {
  AndExpr,
  BinaryExpr,
  ColumnRef,
  EqColJoinOn,
  ExistsExpr,
  JoinAst,
  ListExpression,
  LiteralExpr,
  NullCheckExpr,
  OperationExpr,
  ParamRef,
  ProjectionItem,
  SelectAst,
  TableSource,
  type ToWhereExpr,
} from '@internal/sql-relational-core/ast';
import { describe, expect, it } from 'vitest';
import { normalizeWhereArg } from '../src/where-interop';

const col = (table: string, column: string) => ColumnRef.of(table, column);
const param = (value: unknown, name?: string, codecId = 'pg/text@1') =>
  name !== undefined
    ? ParamRef.of(value, { name, codec: { codecId } })
    : ParamRef.of(value, { codec: { codecId } });
const literal = (value: unknown) => LiteralExpr.of(value);

function op(self: ColumnRef, args: Array<ColumnRef | ParamRef | LiteralExpr>): OperationExpr {
  return new OperationExpr({
    method: 'op',
    self,
    args,
    returns: {} as never,
    lowering: {} as never,
  });
}

describe('where interop', () => {
  it('rejects null where args', () => {
    expect(() => normalizeWhereArg(null as unknown as ToWhereExpr)).toThrow(/cannot be null/i);
  });

  it('normalizes ToWhereExpr to expr only', () => {
    const expr = BinaryExpr.eq(col('users', 'name'), param('Alice', 'name'));
    const arg = {
      toWhereExpr: () => expr,
    } satisfies ToWhereExpr;

    expect(normalizeWhereArg(arg)).toEqual(expr);
  });

  it('preserves nested and/or expressions across exists subqueries', () => {
    const expr = AndExpr.of([
      BinaryExpr.eq(col('users', 'id'), param(1, 'id')),
      AndExpr.of([
        BinaryExpr.eq(col('users', 'email'), param('a@b.c', 'email')),
        ExistsExpr.exists(
          SelectAst.from(TableSource.named('posts'))
            .withProjection([ProjectionItem.of('id', col('posts', 'id'))])
            .withWhere(BinaryExpr.eq(col('posts', 'user_id'), param(99, 'postUserId'))),
        ),
      ]),
    ]);

    expect(normalizeWhereArg(expr)).toEqual(expr);
  });

  it('accepts bare WhereExpr with ParamRef when no contract is provided', () => {
    const expr = BinaryExpr.eq(col('users', 'id'), param(1, 'id'));
    expect(normalizeWhereArg(expr)).toEqual(expr);
  });

  it('accepts bare param-free where expressions and comparables', () => {
    const expr = BinaryExpr.eq(col('users', 'kind'), literal('admin'));
    expect(normalizeWhereArg(expr)).toEqual(expr);

    const opExpr = BinaryExpr.eq(
      col('users', 'email'),
      op(col('users', 'email'), [col('users', 'id'), literal('x')]),
    );
    expect(normalizeWhereArg(opExpr)).toEqual(opExpr);
  });

  it('accepts bare exists with join predicates and list literals when param-free', () => {
    const expr = ExistsExpr.exists(
      SelectAst.from(TableSource.named('users'))
        .withJoins([
          JoinAst.left(
            TableSource.named('posts'),
            EqColJoinOn.of(col('users', 'id'), col('posts', 'user_id')),
          ),
          JoinAst.inner(
            TableSource.named('profiles'),
            BinaryExpr.eq(col('users', 'id'), literal('u1')),
          ),
        ])
        .withProjection([ProjectionItem.of('id', col('users', 'id'))])
        .withWhere(
          BinaryExpr.in(col('users', 'id'), ListExpression.of([literal('u1'), literal('u2')])),
        ),
    );

    expect(normalizeWhereArg(expr)).toEqual(expr);
  });

  it('accepts bare null checks whose operation args contain ParamRef', () => {
    const expr = NullCheckExpr.isNotNull(op(col('users', 'email'), [param('x', 'email')]));
    expect(normalizeWhereArg(expr)).toEqual(expr);
  });

  it('preserves params inside operations, list literals, and null checks', () => {
    const expr = AndExpr.of([
      BinaryExpr.eq(
        op(col('users', 'email'), [param('prefix', 'lhs'), literal('@example.com')]),
        op(col('users', 'email'), [param('rhs', 'rhs')]),
      ),
      BinaryExpr.in(col('users', 'id'), ListExpression.of([param('u1', 'first'), literal('u2')])),
    ]);

    expect(normalizeWhereArg(expr)).toEqual(expr);

    const nullCheck = NullCheckExpr.isNotNull(
      op(col('users', 'email'), [col('users', 'email'), param('needle', 'needle'), literal('x')]),
    );
    expect(normalizeWhereArg(nullCheck)).toEqual(nullCheck);
  });
});
