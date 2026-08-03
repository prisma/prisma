import type { Contract } from '@internal/contract/types';
import type { FamilyPackRef, TargetPackRef } from '@internal/framework-components/components';
import {
  CheckConstraint,
  type SqlStorage,
  StorageTable,
  type StorageTableInput,
} from '@internal/sql-contract/types';
import { describe, expect, it } from 'vitest';
import { createTestSqlNamespace } from '../../../1-core/contract/test/test-support';
import { defineContract } from '../src/contract-builder';
import { enumType, member } from '../src/enum-type';

const sqlFamilyPack = {
  kind: 'family',
  id: 'sql',
  familyId: 'sql',
  version: '0.0.1',
  authoring: {
    field: {
      text: {
        kind: 'fieldPreset',
        output: { codecId: 'pg/text@1', nativeType: 'text' },
      },
    },
  },
} as const satisfies FamilyPackRef<'sql'>;

const postgresTargetPack = {
  kind: 'target',
  id: 'postgres',
  familyId: 'sql',
  targetId: 'postgres',
  version: '0.0.1',
  defaultNamespaceId: 'public',
} as const satisfies TargetPackRef<'sql', 'postgres'>;

const pgText = { codecId: 'pg/text@1' as const, nativeType: 'text' } as const;

// ---------------------------------------------------------------------------
// Lowering: check constraints emitted per enum-restricted column
// ---------------------------------------------------------------------------

describe('check-constraint lowering', () => {
  it('emits a check constraint for each enum-restricted column', () => {
    const Role = enumType('Role', pgText, member('User', 'user'), member('Admin', 'admin'));

    const contract = defineContract(
      {
        family: sqlFamilyPack,
        target: postgresTargetPack,
        createNamespace: createTestSqlNamespace,
        enums: { Role },
      },
      ({ field: f, model: m }) =>
        ({
          models: {
            User: m('User', {
              fields: {
                id: f.text().id(),
                role: f.namedType(Role),
              },
            }),
          },
        }) as const,
    ) as Contract<SqlStorage>;

    const storageNs = contract.storage.namespaces['public'];
    const userTable = storageNs !== undefined ? storageNs.entries.table?.['User'] : undefined;

    expect(userTable?.checks).toHaveLength(1);
    expect(userTable?.checks?.[0]).toMatchObject({
      name: 'User_role_check',
      column: 'role',
      valueSet: {
        plane: 'storage',
        entityKind: 'valueSet',
        namespaceId: 'public',
        entityName: 'Role',
      },
    });
  });

  it('emits one check per enum-restricted column when multiple columns are restricted', () => {
    const Role = enumType('Role', pgText, member('User', 'user'), member('Admin', 'admin'));
    const Status = enumType(
      'Status',
      pgText,
      member('Active', 'active'),
      member('Inactive', 'inactive'),
    );

    const contract = defineContract(
      {
        family: sqlFamilyPack,
        target: postgresTargetPack,
        createNamespace: createTestSqlNamespace,
        enums: { Role, Status },
      },
      ({ field: f, model: m }) =>
        ({
          models: {
            User: m('User', {
              fields: {
                id: f.text().id(),
                role: f.namedType(Role),
                status: f.namedType(Status),
              },
            }),
          },
        }) as const,
    ) as Contract<SqlStorage>;

    const storageNs = contract.storage.namespaces['public'];
    const userTable = storageNs !== undefined ? storageNs.entries.table?.['User'] : undefined;

    expect(userTable?.checks).toHaveLength(2);
    const checkNames = userTable?.checks?.map((c) => c.name).sort();
    expect(checkNames).toEqual(['User_role_check', 'User_status_check']);
  });

  it('leaves checks absent when no enum-restricted columns exist', () => {
    const contract = defineContract(
      {
        family: sqlFamilyPack,
        target: postgresTargetPack,
        createNamespace: createTestSqlNamespace,
      },
      ({ field: f, model: m }) =>
        ({
          models: {
            User: m('User', {
              fields: {
                id: f.text().id(),
                name: f.text(),
              },
            }),
          },
        }) as const,
    ) as Contract<SqlStorage>;

    const storageNs = contract.storage.namespaces['public'];
    const userTable = storageNs !== undefined ? storageNs.entries.table?.['User'] : undefined;

    expect(userTable?.checks).toBeUndefined();
  });

  it('check constraint items are CheckConstraint instances', () => {
    const Role = enumType('Role', pgText, member('User', 'user'), member('Admin', 'admin'));

    const contract = defineContract(
      {
        family: sqlFamilyPack,
        target: postgresTargetPack,
        createNamespace: createTestSqlNamespace,
        enums: { Role },
      },
      ({ field: f, model: m }) =>
        ({
          models: {
            User: m('User', {
              fields: {
                id: f.text().id(),
                role: f.namedType(Role),
              },
            }),
          },
        }) as const,
    ) as Contract<SqlStorage>;

    const storageNs = contract.storage.namespaces['public'];
    const userTable = storageNs !== undefined ? storageNs.entries.table?.['User'] : undefined;

    expect(userTable?.checks?.[0]).toHaveProperty('valueSet');
  });
});

// ---------------------------------------------------------------------------
// CHECK is always written for a domain enum (`enumType()` + `namedType()`):
// this authoring surface has no entity-ref-resolved, storage-enforced-type
// path (that only exists via PSL's `pg.enum(Ref)` — see
// `target-postgres/test/psl-pg-enum-column.test.ts` for the no-CHECK case),
// so a domain enum's column is always a plain scalar column and always
// needs a CHECK to enforce its member set, regardless of the codec bound to
// it.
// ---------------------------------------------------------------------------

describe('check-constraint always written for a domain enum, regardless of codec', () => {
  it('writes a CHECK for a domain-enum array column (many)', () => {
    const Role = enumType('Role', pgText, member('User', 'user'), member('Admin', 'admin'));

    const contract = defineContract(
      {
        family: sqlFamilyPack,
        target: postgresTargetPack,
        createNamespace: createTestSqlNamespace,
        enums: { Role },
      },
      ({ field: f, model: m }) =>
        ({
          models: {
            User: m('User', {
              fields: {
                id: f.text().id(),
                roles: f.namedType(Role).many(),
              },
            }),
          },
        }) as const,
    ) as Contract<SqlStorage>;

    const storageNs = contract.storage.namespaces['public'];
    const userTable = storageNs !== undefined ? storageNs.entries.table?.['User'] : undefined;

    expect(userTable?.checks).toHaveLength(1);
    expect(userTable?.checks?.[0]).toMatchObject({
      name: 'User_roles_check',
      column: 'roles',
      valueSet: {
        plane: 'storage',
        entityKind: 'valueSet',
        namespaceId: 'public',
        entityName: 'Role',
      },
    });
  });

  it('still writes a CHECK for a domain enum using a codec id other than pg/text@1', () => {
    const NativeRole = enumType(
      'NativeRole',
      { codecId: 'test/native-enum@1', nativeType: 'native_role' },
      member('User', 'user'),
      member('Admin', 'admin'),
    );

    const contract = defineContract(
      {
        family: sqlFamilyPack,
        target: postgresTargetPack,
        createNamespace: createTestSqlNamespace,
        enums: { NativeRole },
      },
      ({ field: f, model: m }) =>
        ({
          models: {
            User: m('User', {
              fields: {
                id: f.text().id(),
                role: f.namedType(NativeRole),
              },
            }),
          },
        }) as const,
    ) as Contract<SqlStorage>;

    const storageNs = contract.storage.namespaces['public'];
    const userTable = storageNs !== undefined ? storageNs.entries.table?.['User'] : undefined;

    expect(userTable?.checks).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// A value set resolved by an entity-ref type constructor (`field.descriptor.valueSet`
// set, no `enumTypeHandle`) mirrors what PSL's `pg.enum(Ref)` produces after
// resolution — the column's codec/native-type pairing IS the storage-level
// enforcement, so no CHECK is written, scalar or array.
// ---------------------------------------------------------------------------

describe('check-constraint omitted for an entity-ref-resolved value set (native enum shape)', () => {
  const nativeRoleDescriptor = {
    codecId: 'test/native-role@1',
    nativeType: 'native_role',
    valueSet: {
      plane: 'storage',
      entityKind: 'valueSet',
      namespaceId: 'public',
      entityName: 'NativeRole',
    },
  } as const;

  it('writes no CHECK for a scalar entity-ref-resolved column', () => {
    const contract = defineContract(
      {
        family: sqlFamilyPack,
        target: postgresTargetPack,
        createNamespace: createTestSqlNamespace,
      },
      ({ field: f, model: m }) =>
        ({
          models: {
            User: m('User', {
              fields: {
                id: f.text().id(),
                role: f.column(nativeRoleDescriptor),
              },
            }),
          },
        }) as const,
    ) as Contract<SqlStorage>;

    const storageNs = contract.storage.namespaces['public'];
    const userTable = storageNs !== undefined ? storageNs.entries.table?.['User'] : undefined;

    expect(userTable?.checks ?? []).toEqual([]);
  });

  it('writes no CHECK for an array entity-ref-resolved column (many)', () => {
    const contract = defineContract(
      {
        family: sqlFamilyPack,
        target: postgresTargetPack,
        createNamespace: createTestSqlNamespace,
      },
      ({ field: f, model: m }) =>
        ({
          models: {
            User: m('User', {
              fields: {
                id: f.text().id(),
                roles: f.column(nativeRoleDescriptor).many(),
              },
            }),
          },
        }) as const,
    ) as Contract<SqlStorage>;

    const storageNs = contract.storage.namespaces['public'];
    const userTable = storageNs !== undefined ? storageNs.entries.table?.['User'] : undefined;

    expect(userTable?.checks ?? []).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Serialize → deserialize round-trip
// ---------------------------------------------------------------------------

describe('check-constraint serialize→hydrate round-trip', () => {
  it('preserves checks through JSON round-trip', () => {
    const Role = enumType('Role', pgText, member('User', 'user'), member('Admin', 'admin'));

    const contract = defineContract(
      {
        family: sqlFamilyPack,
        target: postgresTargetPack,
        createNamespace: createTestSqlNamespace,
        enums: { Role },
      },
      ({ field: f, model: m }) =>
        ({
          models: {
            User: m('User', {
              fields: {
                id: f.text().id(),
                role: f.namedType(Role),
              },
            }),
          },
        }) as const,
    ) as Contract<SqlStorage>;

    // Serialize to JSON and back
    const json = JSON.parse(JSON.stringify(contract)) as {
      storage: {
        namespaces: Record<string, { entries: { table: Record<string, unknown> } }>;
      };
    };

    // Re-hydrate via StorageTable constructor (simulating deserialization)
    const rawTable = json.storage.namespaces['public']?.entries.table['User'];
    const hydratedTable = new StorageTable(rawTable as StorageTableInput);

    expect(hydratedTable.checks).toHaveLength(1);
    expect(hydratedTable.checks![0]).toBeInstanceOf(CheckConstraint);
    expect(hydratedTable.checks![0]!.name).toBe('User_role_check');
    expect(hydratedTable.checks![0]!.column).toBe('role');
    expect(hydratedTable.checks![0]!.valueSet).toEqual({
      plane: 'storage',
      entityKind: 'valueSet',
      namespaceId: 'public',
      entityName: 'Role',
    });
  });
});
