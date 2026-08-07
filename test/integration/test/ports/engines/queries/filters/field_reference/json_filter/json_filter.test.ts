import type { AnyExpression } from '@internal/sql-relational-core/ast';
import { BinaryExpr, ColumnRef, NotExpr } from '@internal/sql-relational-core/ast';
import { describe, expect, it } from 'vitest';
import { timeouts, withPostgresPort } from '../../../../../_harness/postgres';
import type { Contract } from './_fixture/generated/contract';
import contractJson from './_fixture/generated/contract.json' with { type: 'json' };

const column = (name: string) => ColumnRef.of('testModel', name);

describe('ports/engines/queries/filters/field-reference/json-filter', () => {
  it(
    'basic_where',
    () =>
      withPostgresPort<Contract>({ contractJson }, async ({ db }) => {
        await db.public.TestModel.select('id').createAll([
          { id: 1, json: { a: { b: 'c' } }, json2: { a: { b: 'c' } } },
          { id: 2, json: { a: { b: 'a' } }, json2: 'b' },
          { id: 3, json: { a: { b: 2 } }, json2: 1 },
          { id: 4 },
        ]);

        const ids = (filter: AnyExpression) =>
          db.public.TestModel.where(filter)
            .orderBy((row) => row.id.asc())
            .select('id')
            .all();

        expect(await ids(BinaryExpr.eq(column('json'), column('json')))).toEqual([
          { id: 1 },
          { id: 2 },
          { id: 3 },
        ]);
        expect(await ids(BinaryExpr.eq(column('json'), column('json2')))).toEqual([{ id: 1 }]);
        expect(await ids(new NotExpr(BinaryExpr.eq(column('json'), column('json2'))))).toEqual([
          { id: 2 },
          { id: 3 },
        ]);
      }),
    timeouts.spinUpPpgDev,
  );

  it(
    'preserves nulls inside JSON values',
    () =>
      withPostgresPort<Contract>({ contractJson }, async ({ db }) => {
        await db.public.TestModel.create({ id: 1, json: { a: null } });

        const rows = await db.public.TestModel.select('id', 'json').all();

        expect(rows).toEqual([{ id: 1, json: { a: null } }]);
      }),
    timeouts.spinUpPpgDev,
  );
});
