import type { ValueSetRef } from '@internal/contract/types';
import { UNBOUND_NAMESPACE_ID } from '@internal/framework-components/ir';
import { type } from 'arktype';
import { describe, expect, it } from 'vitest';
import { composeSqlEntityKinds } from '../src/entity-kinds';
import { CheckConstraint } from '../src/ir/check-constraint';
import { StorageTable } from '../src/ir/storage-table';
import { createSqlStorageSchema } from '../src/validators';

const baseValueSetRef: ValueSetRef = {
  plane: 'storage',
  namespaceId: 'public',
  entityKind: 'valueSet',
  entityName: 'Role',
};

describe('CheckConstraint', () => {
  it('constructs with name, column, and valueSet', () => {
    const cc = new CheckConstraint({
      name: 'user_role_check',
      column: 'role',
      valueSet: baseValueSetRef,
    });
    expect(cc.name).toBe('user_role_check');
    expect(cc.column).toBe('role');
    expect(cc.valueSet).toEqual(baseValueSetRef);
  });

  it('is frozen', () => {
    const cc = new CheckConstraint({
      name: 'user_role_check',
      column: 'role',
      valueSet: baseValueSetRef,
    });
    expect(Object.isFrozen(cc)).toBe(true);
  });

  it('is idempotent — constructing from an existing instance preserves values', () => {
    const cc1 = new CheckConstraint({
      name: 'user_role_check',
      column: 'role',
      valueSet: baseValueSetRef,
    });
    const cc2 = new CheckConstraint(cc1);
    expect(cc2.name).toBe(cc1.name);
    expect(cc2.column).toBe(cc1.column);
    expect(cc2.valueSet).toEqual(cc1.valueSet);
  });
});

describe('StorageTable with optional checks', () => {
  const baseColumns = {
    id: { nativeType: 'int4', codecId: 'pg/int4@1', nullable: false },
    role: { nativeType: 'text', codecId: 'pg/text@1', nullable: false },
  };

  it('leaves checks absent when not provided', () => {
    const table = new StorageTable({
      columns: baseColumns,
      uniques: [],
      indexes: [],
      foreignKeys: [],
    });
    expect(table.checks).toBeUndefined();
  });

  it('materializes checks when provided as plain inputs', () => {
    const table = new StorageTable({
      columns: baseColumns,
      uniques: [],
      indexes: [],
      foreignKeys: [],
      checks: [{ name: 'user_role_check', column: 'role', valueSet: baseValueSetRef }],
    });
    expect(table.checks).toHaveLength(1);
    expect(table.checks![0]).toBeInstanceOf(CheckConstraint);
    expect(table.checks![0]!.name).toBe('user_role_check');
    expect(table.checks![0]!.column).toBe('role');
    expect(table.checks![0]!.valueSet).toEqual(baseValueSetRef);
  });

  it('accepts pre-constructed CheckConstraint instances (idempotent construction)', () => {
    const cc = new CheckConstraint({
      name: 'user_role_check',
      column: 'role',
      valueSet: baseValueSetRef,
    });
    const table = new StorageTable({
      columns: baseColumns,
      uniques: [],
      indexes: [],
      foreignKeys: [],
      checks: [cc],
    });
    expect(table.checks![0]).toBeInstanceOf(CheckConstraint);
    expect(table.checks![0]).toEqual(cc);
  });

  it('table with checks is frozen', () => {
    const table = new StorageTable({
      columns: baseColumns,
      uniques: [],
      indexes: [],
      foreignKeys: [],
      checks: [{ name: 'user_role_check', column: 'role', valueSet: baseValueSetRef }],
    });
    expect(Object.isFrozen(table)).toBe(true);
    expect(Object.isFrozen(table.checks)).toBe(true);
  });
});

describe('StorageTableSchema validates checks', () => {
  const storageSchema = createSqlStorageSchema(composeSqlEntityKinds());

  function makeRawStorage(tableExtra: Record<string, unknown>) {
    return {
      storageHash: 'test',
      namespaces: {
        [UNBOUND_NAMESPACE_ID]: {
          id: UNBOUND_NAMESPACE_ID,
          entries: {
            table: {
              user: {
                columns: {
                  role: { nativeType: 'text', codecId: 'pg/text@1', nullable: false },
                },
                uniques: [],
                indexes: [],
                foreignKeys: [],
                ...tableExtra,
              },
            },
          },
        },
      },
    };
  }

  it('accepts a table without checks', () => {
    const result = storageSchema(makeRawStorage({}));
    expect(result).not.toBeInstanceOf(Error);
  });

  it('accepts a table with a valid checks array', () => {
    const result = storageSchema(
      makeRawStorage({
        checks: [
          {
            name: 'user_role_check',
            column: 'role',
            valueSet: {
              plane: 'storage',
              namespaceId: 'public',
              entityKind: 'valueSet',
              entityName: 'Role',
            },
          },
        ],
      }),
    );
    expect(result).not.toBeInstanceOf(Error);
  });

  it('rejects a check with a missing name', () => {
    const result = storageSchema(
      makeRawStorage({
        checks: [
          {
            column: 'role',
            valueSet: {
              plane: 'storage',
              namespaceId: 'public',
              entityKind: 'valueSet',
              entityName: 'Role',
            },
          },
        ],
      }),
    );
    expect(result).toBeInstanceOf(type.errors);
  });
});
