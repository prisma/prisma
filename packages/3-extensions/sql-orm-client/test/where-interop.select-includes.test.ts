import {
  BinaryExpr,
  ColumnRef,
  DerivedTableSource,
  ExistsExpr,
  JoinAst,
  LiteralExpr,
  NullCheckExpr,
  OperationExpr,
  OrderByItem,
  ParamRef,
  ProjectionItem,
  SelectAst,
  SubqueryExpr,
  TableSource,
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

describe('where interop select/source branches', () => {
  it('accepts bound payloads when ParamRef only appears inside select/source branches', () => {
    const select = SelectAst.from(
      DerivedTableSource.as(
        'users_src',
        SelectAst.from(TableSource.named('users'))
          .withProjection([ProjectionItem.of('id', col('users', 'id'))])
          .withWhere(BinaryExpr.eq(col('users', 'kind'), param('srcWhere', 'kind'))),
      ),
    )
      .withProjection([
        ProjectionItem.of('id', col('users_src', 'id')),
        ProjectionItem.of(
          'nested',
          SubqueryExpr.of(
            SelectAst.from(TableSource.named('posts')).withProjection([
              ProjectionItem.of(
                'title',
                op(col('posts', 'title'), [param('nestedProject', 'nested')]),
              ),
            ]),
          ),
        ),
      ])
      .withOrderBy([OrderByItem.desc(op(col('users_src', 'id'), [param('order', 'order')]))])
      .withJoins([
        JoinAst.inner(
          TableSource.named('posts'),
          BinaryExpr.eq(col('users_src', 'id'), param('joinOn', 'join')),
        ),
      ]);

    expect(normalizeWhereArg(ExistsExpr.exists(select))).toEqual(ExistsExpr.exists(select));
  });

  it('preserves nullCheck expressions with operation args', () => {
    const expr = NullCheckExpr.isNotNull(
      op(col('users', 'email'), [col('users', 'email'), param('needle', 'needle'), literal('x')]),
    );

    expect(normalizeWhereArg(expr)).toEqual(expr);
  });

  it('accepts bare exists expressions with params in derived branches', () => {
    const expr = ExistsExpr.exists(
      SelectAst.from(
        DerivedTableSource.as(
          'users_src',
          SelectAst.from(TableSource.named('users'))
            .withProjection([ProjectionItem.of('id', col('users', 'id'))])
            .withWhere(BinaryExpr.eq(col('users', 'id'), param(1, 'id'))),
        ),
      ).withProjection([ProjectionItem.of('id', col('users_src', 'id'))]),
    );

    expect(normalizeWhereArg(expr)).toEqual(expr);
  });

  it('accepts bare exists with literal and subquery projections when param-free', () => {
    const expr = ExistsExpr.exists(
      SelectAst.from(TableSource.named('users'))
        .withProjection([
          ProjectionItem.of('id', col('users', 'id')),
          ProjectionItem.of('tag', literal('x')),
          ProjectionItem.of(
            'postId',
            SubqueryExpr.of(
              SelectAst.from(TableSource.named('posts')).withProjection([
                ProjectionItem.of('id', col('posts', 'id')),
              ]),
            ),
          ),
        ])
        .withOrderBy([OrderByItem.asc(col('users', 'id'))]),
    );

    expect(normalizeWhereArg(expr)).toEqual(expr);
  });

  it('accepts bare exists with params in top-level and nested subqueries', () => {
    const expr = ExistsExpr.exists(
      SelectAst.from(TableSource.named('users'))
        .withProjection([
          ProjectionItem.of(
            'postId',
            SubqueryExpr.of(
              SelectAst.from(TableSource.named('posts')).withProjection([
                ProjectionItem.of('id', op(col('posts', 'id'), [param(2, 'nested')])),
              ]),
            ),
          ),
        ])
        .withOrderBy([OrderByItem.asc(op(col('users', 'id'), [param(1, 'top')]))]),
    );

    expect(normalizeWhereArg(expr)).toEqual(expr);
  });
});
