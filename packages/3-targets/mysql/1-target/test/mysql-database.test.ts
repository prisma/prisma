import { UNBOUND_NAMESPACE_ID } from '@internal/framework-components/ir';
import { describe, expect, it } from 'vitest';
import { type MysqlDatabase, mysqlCreateNamespace } from '../src/core/mysql-database';

const roleColumn = (typeParams?: Record<string, unknown>) => ({
  dataType: 'mysql/enum',
  codecId: 'mysql/enum@1',
  nullable: false,
  ...(typeParams === undefined ? {} : { typeParams }),
  valueSet: {
    plane: 'storage',
    entityKind: 'valueSet',
    namespaceId: UNBOUND_NAMESPACE_ID,
    entityName: 'Role',
  },
});

const userTable = (role: unknown) => ({
  columns: {
    id: { dataType: 'mysql/int', codecId: 'mysql/int@1', nullable: false },
    role,
  },
  primaryKey: { columns: ['id'] },
  uniques: [],
  indexes: [],
  foreignKeys: [],
});

const valueSet = { Role: { kind: 'valueSet', values: ['USER', 'ADMIN'] } };

function columnsOf(database: MysqlDatabase) {
  return JSON.parse(JSON.stringify(database.table['User']?.columns));
}

describe('mysqlCreateNamespace', () => {
  it('writes an enum column’s members into its type parameters in declared order', () => {
    const database = mysqlCreateNamespace({
      id: UNBOUND_NAMESPACE_ID,
      entries: { table: { User: userTable(roleColumn()) }, valueSet },
    });
    expect(columnsOf(database)).toEqual({
      id: { dataType: 'mysql/int', codecId: 'mysql/int@1', nullable: false, many: false },
      role: { ...roleColumn({ values: ['USER', 'ADMIN'] }), many: false },
    });
  });

  it('leaves members a column already lists, so hydrating an emitted contract changes nothing', () => {
    const database = mysqlCreateNamespace({
      id: UNBOUND_NAMESPACE_ID,
      entries: { table: { User: userTable(roleColumn({ values: ['ADMIN'] })) }, valueSet },
    });
    expect(columnsOf(database).role.typeParams).toEqual({ values: ['ADMIN'] });
  });

  it('refuses an enum column with no enum to take members from', () => {
    expect(() =>
      mysqlCreateNamespace({
        id: UNBOUND_NAMESPACE_ID,
        entries: { table: { User: userTable(roleColumn()) } },
      }),
    ).toThrow(/Column "User"."role" is a MySQL enum but has no enum/);
  });

  it('refuses any namespace but the unbound one', () => {
    expect(() => mysqlCreateNamespace({ id: 'app', entries: { table: {} } })).toThrow(
      expect.objectContaining({ code: 'CONTRACT.NAMESPACE_INVALID' }),
    );
  });

  it('refuses an expression index', () => {
    expect(() =>
      mysqlCreateNamespace({
        id: UNBOUND_NAMESPACE_ID,
        entries: {
          table: {
            User: {
              ...userTable({ dataType: 'mysql/int', codecId: 'mysql/int@1', nullable: false }),
              indexes: [{ name: 'by_lower', expression: 'lower(email)', unique: false }],
            },
          },
        },
      }),
    ).toThrow(/expression or partial indexes/);
  });

  it('addresses tables unqualified, with backticks', () => {
    const database = mysqlCreateNamespace({ id: UNBOUND_NAMESPACE_ID, entries: { table: {} } });
    expect({
      kind: database.kind,
      qualifier: database.qualifier(),
      table: database.qualifyTable('my`table'),
      isUnbound: database.isUnbound,
    }).toEqual({ kind: 'mysql-namespace', qualifier: '', table: '`my``table`', isUnbound: true });
  });
});
