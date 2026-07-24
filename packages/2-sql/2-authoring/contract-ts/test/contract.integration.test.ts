import type { Contract } from '@prisma-next/contract/types';
import { UNBOUND_NAMESPACE_ID } from '@prisma-next/framework-components/ir';
import type { SqlStorage } from '@prisma-next/sql-contract/types';
import { validateSqlContractFully } from '@prisma-next/sql-contract/validators';
import { describe, expect, expectTypeOf, it } from 'vitest';
import { sqlStorageFixture, validSqlContractJson } from './sql-contract-json-fixture';
import { unboundTables } from './unbound-tables';

describe('SqlContractSerializer', () => {
  const validContractInput = validSqlContractJson({
    storage: sqlStorageFixture({
      User: {
        columns: {
          id: { codecId: 'pg/text@1', nativeType: 'text', nullable: false },
          email: { codecId: 'pg/text@1', nativeType: 'text', nullable: false },
        },
        primaryKey: { columns: ['id'] },
        uniques: [],
        indexes: [],
        foreignKeys: [],
      },
    }),
  });

  it('performs both structural and logical validation', () => {
    const result = validateSqlContractFully<Contract<SqlStorage>>(validContractInput);
    expect(unboundTables(result.storage)).toHaveProperty('User');
  });

  it('throws on structural validation failure', () => {
    // biome-ignore lint/suspicious/noExplicitAny: testing invalid input
    const invalid = { ...validContractInput, targetFamily: undefined } as any;
    expect(() => validateSqlContractFully<Contract<SqlStorage>>(invalid)).toThrow(
      /Invalid contract structure|Contract header validation failed|structural validation failed/,
    );
  });

  it('accepts contract with valid primaryKey columns', () => {
    const valid = {
      ...validContractInput,
      storage: sqlStorageFixture({
        User: {
          ...unboundTables(validContractInput.storage as unknown as SqlStorage)['User'],
          primaryKey: { columns: ['id'] },
        },
      }),
    };
    expect(() => validateSqlContractFully<Contract<SqlStorage>>(valid)).not.toThrow();
  });

  it('throws on semantic validation failure for duplicate named storage objects', () => {
    const invalid = {
      ...validContractInput,
      storage: sqlStorageFixture({
        User: {
          ...unboundTables(validContractInput.storage as unknown as SqlStorage)['User'],
          primaryKey: { columns: ['id'], name: 'user_pkey' },
          indexes: [{ columns: ['id'], name: 'user_pkey', unique: false }],
        },
      }),
    };

    expect(() => validateSqlContractFully<Contract<SqlStorage>>(invalid)).toThrow(
      /Contract semantic validation failed:.*user_pkey/,
    );
  });

  it('accepts type parameter for strict contract type', () => {
    // Simulate JSON import - TypeScript infers string types, not literal types
    // The type parameter provides the strict type from contract.d.ts
    const contractJson = validSqlContractJson({
      storage: sqlStorageFixture({
        User: {
          columns: {
            id: { codecId: 'pg/text@1', nativeType: 'text', nullable: false },
          },
          primaryKey: { columns: ['id'] },
          uniques: [],
          indexes: [],
          foreignKeys: [],
        },
      }),
    });
    const result = validateSqlContractFully<Contract<SqlStorage>>(contractJson);
    // After validation, types should match the type parameter
    expectTypeOf(result).toEqualTypeOf<Contract<SqlStorage>>();
    // Verify structure is validated at runtime
    expect(unboundTables(result.storage)).toHaveProperty('User');
    expect(unboundTables(result.storage)['User']?.columns).toHaveProperty('id');
  });

  it('handles empty foreignKeys array', () => {
    const contractInput = validSqlContractJson({
      storage: sqlStorageFixture({
        User: {
          columns: {
            id: { codecId: 'pg/text@1', nativeType: 'text', nullable: false },
          },
          primaryKey: { columns: ['id'] },
          uniques: [],
          indexes: [],
          foreignKeys: [],
        },
      }),
    });
    expect(() => validateSqlContractFully<Contract<SqlStorage>>(contractInput)).not.toThrow();
  });

  it('rejects foreignKey referencing non-existent table', () => {
    const contractInput = validSqlContractJson({
      storage: sqlStorageFixture({
        User: {
          columns: {
            id: { codecId: 'pg/text@1', nativeType: 'text', nullable: false },
          },
          primaryKey: { columns: ['id'] },
          uniques: [],
          indexes: [],
          foreignKeys: [],
        },
        Post: {
          columns: {
            id: { codecId: 'pg/text@1', nativeType: 'text', nullable: false },
            userId: { codecId: 'pg/text@1', nativeType: 'text', nullable: false },
          },
          primaryKey: { columns: ['id'] },
          uniques: [],
          indexes: [],
          foreignKeys: [
            {
              source: { namespaceId: UNBOUND_NAMESPACE_ID, tableName: 'Post', columns: ['userId'] },
              target: {
                namespaceId: UNBOUND_NAMESPACE_ID,
                tableName: 'NonExistent',
                columns: ['id'],
              },
              constraint: true,
              index: true,
            },
          ],
        },
      }),
    });
    expect(() => validateSqlContractFully<Contract<SqlStorage>>(contractInput)).toThrow(
      /foreignKey references non-existent table "__unbound__\.NonExistent"/,
    );
  });
});
