import { UNBOUND_NAMESPACE_ID } from '@internal/framework-components/ir';
import { describe, expect, it } from 'vitest';
import { sqlEmission } from '../src/index';
import { createEmitterTestContract as createContract } from './create-emitter-test-contract';

const idColumn = { id: { dataType: 'pg/uuid', codecId: 'pg/uuid@1', nullable: false } };
const userTable = { columns: idColumn, uniques: [], indexes: [], foreignKeys: [] };

describe('storage type emission for namespace kinds', () => {
  function storageTypeFor(namespaces: Record<string, unknown>): string {
    return sqlEmission.generateStorageType(
      createContract({
        domain: { namespaces: { [UNBOUND_NAMESPACE_ID]: { models: {} } } },
        storage: { namespaces },
      }),
      'StorageHash',
    );
  }

  it('spells a bound schema namespace as a postgres schema', () => {
    const dts = storageTypeFor({
      app: { id: 'app', kind: 'schema', entries: { table: { user: userTable } } },
    });

    expect(dts).toContain('readonly kind: "postgres-schema"');
  });

  it('spells the unbound schema namespace distinctly', () => {
    const dts = storageTypeFor({
      [UNBOUND_NAMESPACE_ID]: {
        id: UNBOUND_NAMESPACE_ID,
        kind: 'schema',
        entries: { table: { user: userTable } },
      },
    });

    expect(dts).toContain('readonly kind: "postgres-unbound-schema"');
  });

  it('emits an empty namespace map as Record<string, never>', () => {
    expect(storageTypeFor({})).toContain('Record<string, never>');
  });

  it('orders namespaces and their value sets by name', () => {
    const dts = storageTypeFor({
      zeta: { id: 'zeta', kind: 'schema', entries: { table: { audit: userTable } } },
      alpha: {
        id: 'alpha',
        kind: 'schema',
        entries: {
          table: { user: userTable },
          valueSet: {
            Status: { kind: 'valueSet', values: ['on', 'off'] },
            Role: { kind: 'valueSet', values: ['user', 'admin'] },
          },
        },
      },
    });

    expect(dts.indexOf('alpha')).toBeLessThan(dts.indexOf('zeta'));
    expect(dts.indexOf('Role')).toBeLessThan(dts.indexOf('Status'));
  });
});

describe('getStorageTypeExports', () => {
  it('resolves to nothing without storage namespaces', () => {
    expect(sqlEmission.getStorageTypeExports(createContract({ storage: {} }))).toBeUndefined();
  });

  it('orders the column type maps by namespace name', () => {
    const exports = sqlEmission.getStorageTypeExports(
      createContract({
        storage: {
          namespaces: {
            zeta: { id: 'zeta', entries: { table: { audit: userTable } } },
            alpha: { id: 'alpha', entries: { table: { user: userTable } } },
          },
        },
      }),
    );

    expect(exports?.indexOf('alpha')).toBeLessThan(exports?.indexOf('zeta') ?? -1);
  });

  it('emits both column type maps as Record<string, never> for an empty namespace map', () => {
    const exports = sqlEmission.getStorageTypeExports(
      createContract({ storage: { namespaces: {} } }),
    );

    expect(exports).toBe(
      [
        'export type StorageColumnTypes = Record<string, never>;',
        'export type StorageColumnInputTypes = Record<string, never>;',
      ].join('\n'),
    );
  });

  it('falls back to the codec type when a column names a value set the storage does not carry', () => {
    const exports = sqlEmission.getStorageTypeExports(
      createContract({
        storage: {
          namespaces: {
            app: {
              id: 'app',
              entries: {
                table: {
                  user: {
                    columns: {
                      role: {
                        dataType: 'pg/text',
                        codecId: 'pg/text@1',
                        nullable: false,
                        valueSet: {
                          namespaceId: 'app',
                          entityKind: 'valueSet',
                          entityName: 'Missing',
                        },
                      },
                    },
                    uniques: [],
                    indexes: [],
                    foreignKeys: [],
                  },
                },
              },
            },
          },
        },
      }),
    );

    expect(exports).toBe(
      [
        'export type StorageColumnTypes = { readonly app: { readonly user: { readonly role: CodecTypes["pg/text@1"]["output"] } } };',
        'export type StorageColumnInputTypes = { readonly app: { readonly user: { readonly role: CodecTypes["pg/text@1"]["input"] } } };',
      ].join('\n'),
    );
  });
});
