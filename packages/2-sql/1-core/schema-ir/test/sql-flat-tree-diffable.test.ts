import { describe, expect, it } from 'vitest';

import { SqlSchemaIR } from '../src/ir/sql-schema-ir';
import { SqlTableIR } from '../src/ir/sql-table-ir';

describe('flat tree diffability (SqlSchemaIR / SqlTableIR)', () => {
  const table = new SqlTableIR({
    name: 'users',
    columns: {
      id: { name: 'id', nativeType: 'int4', nullable: false },
      email: { name: 'email', nativeType: 'text', nullable: false },
    },
    primaryKey: { columns: ['id'] },
    foreignKeys: [{ columns: ['org_id'], referencedTable: 'orgs', referencedColumns: ['id'] }],
    uniques: [{ columns: ['email'] }],
    indexes: [
      {
        naming: { kind: 'exact', name: 'users_email_idx' },
        columns: ['email'],
        where: undefined,
        unique: false,
        partial: false,
        type: undefined,
        options: undefined,
        annotations: undefined,
        dependsOn: undefined,
      },
    ],
    checks: [{ naming: { kind: 'exact', name: 'chk' }, expression: `"email" <> ''` }],
  });

  it('SqlSchemaIR is the diff root: sentinel id, identity isEqualTo, tables as children', () => {
    const root = new SqlSchemaIR({ tables: { users: table } });
    expect(root.id).toBe('database');
    expect(root.isEqualTo(new SqlSchemaIR({ tables: {} }))).toBe(true);
    expect(root.children()).toEqual([table]);
  });

  it('SqlTableIR children compose columns, PK, FKs, uniques, indexes, checks in order', () => {
    expect(table.children().map((c) => c.id)).toEqual([
      'column:id',
      'column:email',
      'primary-key',
      'foreign-key:org_id->.orgs(id)',
      'unique:email',
      'index:users_email_idx',
      'check:chk',
    ]);
  });

  it('SqlTableIR isEqualTo is identity by name', () => {
    const sameName = new SqlTableIR({
      name: 'users',
      columns: {},
      foreignKeys: [],
      uniques: [],
      indexes: [],
    });
    const otherName = new SqlTableIR({
      name: 'orders',
      columns: {},
      foreignKeys: [],
      uniques: [],
      indexes: [],
    });
    expect(table.isEqualTo(sameName)).toBe(true);
    expect(table.isEqualTo(otherName)).toBe(false);
  });
});
