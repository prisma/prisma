import { describe, expect, it } from 'vitest';
import {
  type AnyQueryAst,
  BinaryExpr,
  DeleteAst,
  DerivedTableSource,
  EqColJoinOn,
  ExistsExpr,
  InsertAst,
  InsertOnConflict,
  JoinAst,
  OrderByItem,
  ProjectionItem,
  RawExpr,
  RawQueryAst,
  SelectAst,
  UpdateAst,
} from '../../src/exports/ast';
import { col, param, simpleSelect, table } from './test-helpers';

const raw = () =>
  new RawExpr({ parts: ['now()'], returns: { codecId: 'pg/text@1', nullable: false } });
const id = col('user', 'id');
const select = simpleSelect('user', ['id']).withWhere(BinaryExpr.eq(id, param(1)));
const containsRawSql = (asts: Record<string, AnyQueryAst>) =>
  Object.fromEntries(Object.entries(asts).map(([name, ast]) => [name, ast.containsRawSql()]));

describe('containsRawSql', () => {
  it('is false for statements the builders write', () => {
    expect(
      containsRawSql({
        select,
        insert: InsertAst.into(table('user')).withRows([{ id: param(1) }]),
        update: UpdateAst.table(table('user'))
          .withSet({ id: param(1) })
          .withWhere(select.where),
        delete: DeleteAst.from(table('user')).withWhere(select.where),
      }),
    ).toEqual({ select: false, insert: false, update: false, delete: false });
  });

  it('finds raw SQL anywhere in a select', () => {
    expect(
      containsRawSql({
        rawQuery: RawQueryAst.affectedCount(['SET time_zone = ', param('+00:00')]),
        projection: select.withProjection([ProjectionItem.of('now', raw())]),
        where: select.withWhere(BinaryExpr.eq(id, raw())),
        orderBy: select.withOrderBy([OrderByItem.asc(raw())]),
        groupBy: select.withGroupBy([raw()]),
        having: select.withHaving(BinaryExpr.eq(id, raw())),
        joinOn: select.withJoins([JoinAst.inner(table('post'), BinaryExpr.eq(id, raw()))]),
        derivedJoin: select.withJoins([
          JoinAst.inner(
            DerivedTableSource.as('p', simpleSelect('post', ['id']).withWhere(raw())),
            EqColJoinOn.of(id, col('p', 'id')),
          ),
        ]),
        derivedFrom: SelectAst.from(
          DerivedTableSource.as('u', select.withWhere(BinaryExpr.eq(id, raw()))),
        ).withProjection([ProjectionItem.of('id', col('u', 'id'))]),
        subquery: select.withWhere(
          ExistsExpr.exists(simpleSelect('post', ['id']).withWhere(raw())),
        ),
      }),
    ).toEqual({
      rawQuery: true,
      projection: true,
      where: true,
      orderBy: true,
      groupBy: true,
      having: true,
      joinOn: true,
      derivedJoin: true,
      derivedFrom: true,
      subquery: true,
    });
  });

  it('finds raw SQL in an insert, an update and a delete', () => {
    expect(
      containsRawSql({
        insertRow: InsertAst.into(table('user')).withRows([{ id: raw() }]),
        onConflict: InsertAst.into(table('user'))
          .withRows([{ id: param(1) }])
          .withOnConflict(InsertOnConflict.on([id]).doUpdateSet({ id: raw() })),
        updateSet: UpdateAst.table(table('user')).withSet({ id: raw() }),
        updateWhere: UpdateAst.table(table('user'))
          .withSet({ id: param(1) })
          .withWhere(BinaryExpr.eq(id, raw())),
        deleteWhere: DeleteAst.from(table('user')).withWhere(BinaryExpr.eq(id, raw())),
      }),
    ).toEqual({
      insertRow: true,
      onConflict: true,
      updateSet: true,
      updateWhere: true,
      deleteWhere: true,
    });
  });

  it('finds raw SQL, and the params inside it, in every child of an insert, an update and a delete', () => {
    const marked = param('inside raw');
    const rawWithParam = () =>
      new RawExpr({
        parts: ['lower(', marked, ')'],
        returns: { codecId: 'pg/text@1', nullable: false },
      });
    const returning = [ProjectionItem.of('r', rawWithParam())];
    const writes: Record<string, AnyQueryAst> = {
      insertRow: InsertAst.into(table('user')).withRows([{ id: rawWithParam() }]),
      insertConflictSet: InsertAst.into(table('user'))
        .withRows([{ id: param(1) }])
        .withOnConflict(InsertOnConflict.on([id]).doUpdateSet({ id: rawWithParam() })),
      insertReturning: InsertAst.into(table('user'))
        .withRows([{ id: param(1) }])
        .withReturning(returning),
      updateSet: UpdateAst.table(table('user')).withSet({ id: rawWithParam() }),
      updateWhere: UpdateAst.table(table('user'))
        .withSet({ id: param(1) })
        .withWhere(BinaryExpr.eq(id, rawWithParam())),
      updateReturning: UpdateAst.table(table('user'))
        .withSet({ id: param(1) })
        .withReturning(returning),
      deleteWhere: DeleteAst.from(table('user')).withWhere(BinaryExpr.eq(id, rawWithParam())),
      deleteReturning: DeleteAst.from(table('user')).withReturning(returning),
    };
    const found = Object.fromEntries(
      Object.entries(writes).map(([name, ast]) => [
        name,
        { raw: ast.containsRawSql(), param: ast.collectParamRefs().includes(marked) },
      ]),
    );
    expect(found).toEqual(
      Object.fromEntries(Object.keys(writes).map((name) => [name, { raw: true, param: true }])),
    );
  });
});
