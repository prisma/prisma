import { ContractValidationError } from '@prisma-next/contract/contract-validation-error';
import { type ContractModel, type ContractRelation, crossRef } from '@prisma-next/contract/types';
import { UNBOUND_NAMESPACE_ID } from '@prisma-next/framework-components/ir';
import { createContract } from '@prisma-next/test-utils';
import { blindCast } from '@prisma-next/utils/casts';
import { type } from 'arktype';
import { describe, expect, it } from 'vitest';
import { composeSqlEntityKinds } from '../src/entity-kinds';
import { col, fk, index, model, pk, table, unique } from '../src/factories';
import { CheckConstraint } from '../src/ir/check-constraint';
import { StorageTable } from '../src/ir/storage-table';
import type { ReferentialAction, SqlModelFieldStorage, SqlStorage } from '../src/types';
import {
  createSqlStorageSchema,
  StorageValueSetSchema,
  validateModel,
  validateSqlContractFully,
  validateSqlStorageConsistency,
  validateStorage,
  validateStorageSemantics,
} from '../src/validators';

function unboundTables<T extends Record<string, unknown>>(tables: T) {
  return {
    namespaces: {
      [UNBOUND_NAMESPACE_ID]: {
        id: UNBOUND_NAMESPACE_ID,
        kind: 'test-sql-namespace',
        entries: { table: tables },
      },
    },
  };
}

// `model()` (src/factories.ts) declares its return `relations` as the loose
// `Record<string, unknown>` — the runtime value always matches the caller's
// literal relations argument, so this wrapper re-asserts the precise type
// for call sites that need `ContractModel`.
function contractModel(
  tableName: string,
  fields: Record<string, SqlModelFieldStorage>,
  relations: Record<string, ContractRelation> = {},
  namespaceId?: string,
): ContractModel {
  return blindCast<
    ContractModel,
    'model() widens `relations` to Record<string, unknown>; the argument here already matches ContractRelation'
  >(model(tableName, fields, relations, namespaceId));
}

describe('SQL contract validators', () => {
  describe('validateStorage', () => {
    it('validates valid storage', () => {
      const userTable = table({
        id: col('int4', 'pg/int4@1'),
        email: col('text', 'pg/text@1'),
      });
      const s = createContract<SqlStorage>({
        storage: unboundTables({ user: userTable }),
      }).storage;
      expect(() => validateStorage(s)).not.toThrow();
    });

    it('throws on invalid storage structure', () => {
      const invalid = {
        storageHash: 'test',
        namespaces: {
          [UNBOUND_NAMESPACE_ID]: {
            id: UNBOUND_NAMESPACE_ID,
            entries: { table: 'not-an-object' },
          },
        },
      } as unknown;
      expect(() => validateStorage(invalid)).toThrow();
    });

    it('invalid storage error carries CONTRACT.VALIDATION_FAILED', () => {
      const invalid = {
        storageHash: 'test',
        namespaces: {
          [UNBOUND_NAMESPACE_ID]: {
            id: UNBOUND_NAMESPACE_ID,
            entries: { table: 'not-an-object' },
          },
        },
      } as unknown;
      expect(() => validateStorage(invalid)).toThrowError(
        expect.objectContaining({ code: 'CONTRACT.VALIDATION_FAILED' }) as unknown as Error,
      );
    });

    it('throws on invalid table structure', () => {
      const invalid = {
        storageHash: 'test',
        namespaces: {
          [UNBOUND_NAMESPACE_ID]: {
            id: UNBOUND_NAMESPACE_ID,
            entries: {
              table: {
                user: {
                  columns: 'not-an-object',
                },
              },
            },
          },
        },
      } as unknown;
      expect(() => validateStorage(invalid)).toThrow();
    });

    it('throws on invalid nativeType', () => {
      const invalid = {
        storageHash: 'test',
        namespaces: {
          [UNBOUND_NAMESPACE_ID]: {
            id: UNBOUND_NAMESPACE_ID,
            entries: {
              table: {
                user: {
                  columns: {
                    id: { nativeType: 123, codecId: 'pg/int4@1', nullable: false },
                  },
                },
              },
            },
          },
        },
      } as unknown;
      expect(() => validateStorage(invalid)).toThrow();
    });

    it('throws on invalid nullable type', () => {
      const invalid = {
        storageHash: 'test',
        namespaces: {
          [UNBOUND_NAMESPACE_ID]: {
            id: UNBOUND_NAMESPACE_ID,
            entries: {
              table: {
                user: {
                  columns: {
                    id: { nativeType: 'int4', codecId: 'pg/int4@1', nullable: 'yes' },
                  },
                },
              },
            },
          },
        },
      } as unknown;
      expect(() => validateStorage(invalid)).toThrow();
    });

    it('throws when column declares both typeParams and typeRef', () => {
      const invalid = {
        storageHash: 'test',
        namespaces: {
          [UNBOUND_NAMESPACE_ID]: {
            id: UNBOUND_NAMESPACE_ID,
            entries: {
              table: {
                user: {
                  columns: {
                    embedding: {
                      nativeType: 'vector',
                      codecId: 'pg/vector@1',
                      nullable: false,
                      typeParams: { dimensions: 1536 },
                      typeRef: 'vector_1536',
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
      } as unknown;
      expect(() => validateStorage(invalid)).toThrow(/either typeParams or typeRef, not both/);
    });
  });

  describe('validateModel', () => {
    it('validates valid model', () => {
      const userModel = model('user', {
        id: { column: 'id' },
        email: { column: 'email' },
      });
      expect(() => validateModel(userModel)).not.toThrow();
    });

    it('throws on invalid model structure', () => {
      const invalid = { storage: 'not-an-object' } as unknown;
      expect(() => validateModel(invalid)).toThrow();
    });

    it('throws on missing storage.table', () => {
      const invalid = {
        storage: {},
        fields: {},
        relations: {},
      } as unknown;
      expect(() => validateModel(invalid)).toThrow();
    });

    it('throws on invalid fields structure', () => {
      const invalid = {
        storage: { table: 'user', namespaceId: UNBOUND_NAMESPACE_ID },
        fields: 'not-an-object',
        relations: {},
      } as unknown;
      expect(() => validateModel(invalid)).toThrow();
    });

    it('validates model without relations', () => {
      const modelWithoutRelations = {
        storage: {
          table: 'user',
          namespaceId: UNBOUND_NAMESPACE_ID,
          fields: { id: { column: 'id' } },
        },
        fields: {
          id: { nullable: false, type: { kind: 'scalar', codecId: 'pg/int4@1' } },
        },
      };
      expect(() => validateModel(modelWithoutRelations)).not.toThrow();
    });

    const modelWithRelation = (relation: unknown) => ({
      storage: {
        table: 'parent',
        namespaceId: UNBOUND_NAMESPACE_ID,
        fields: { id: { column: 'id' } },
      },
      fields: { id: { nullable: false, type: { kind: 'scalar', codecId: 'pg/int4@1' } } },
      relations: { rel: relation },
    });

    const through = {
      table: 'parent_child',
      namespaceId: UNBOUND_NAMESPACE_ID,
      parentColumns: ['parent_id'],
      childColumns: ['child_id'],
      targetColumns: ['id'],
    };

    it('validates an N:M relation carrying through', () => {
      const valid = modelWithRelation({
        to: { model: 'Child', namespace: UNBOUND_NAMESPACE_ID },
        cardinality: 'N:M',
        on: { localFields: ['id'], targetFields: ['id'] },
        through,
      });
      expect(() => validateModel(valid)).not.toThrow();
    });

    it('rejects an N:M relation without through', () => {
      const invalid = modelWithRelation({
        to: { model: 'Child', namespace: UNBOUND_NAMESPACE_ID },
        cardinality: 'N:M',
        on: { localFields: ['id'], targetFields: ['id'] },
      });
      expect(() => validateModel(invalid)).toThrow();
    });

    it('rejects a non-N:M relation carrying through', () => {
      const invalid = modelWithRelation({
        to: { model: 'Child', namespace: UNBOUND_NAMESPACE_ID },
        cardinality: 'N:1',
        on: { localFields: ['parentId'], targetFields: ['id'] },
        through,
      });
      expect(() => validateModel(invalid)).toThrow();
    });
  });

  describe('validateSqlContractFully', () => {
    it('throws ContractValidationError when contract value is not an object', () => {
      try {
        validateSqlContractFully(null);
        expect.unreachable();
      } catch (e) {
        expect(e).toBeInstanceOf(ContractValidationError);
        expect((e as ContractValidationError).phase).toBe('structural');
        expect((e as ContractValidationError).code).toBe('CONTRACT.VALIDATION_FAILED');
        expect((e as ContractValidationError).message).toMatch(/value must be an object/);
      }
    });

    it('validates valid contract', () => {
      const userTable = table({
        id: col('int4', 'pg/int4@1'),
        email: col('text', 'pg/text@1'),
      });
      const c = createContract<SqlStorage>({
        storage: unboundTables({ user: userTable }),
        models: {
          User: contractModel('user', {
            id: { column: 'id' },
            email: { column: 'email' },
          }),
        },
      });
      expect(() => validateSqlContractFully(c)).not.toThrow();
    });

    const manyToManyContract = (relationOverrides: {
      on: { localFields: readonly string[]; targetFields: readonly string[] };
      through: {
        table: string;
        namespaceId: string;
        parentColumns: readonly string[];
        childColumns: readonly string[];
        targetColumns: readonly string[];
      };
    }) =>
      createContract<SqlStorage>({
        storage: unboundTables({
          user: table({ id: col('int4', 'pg/int4@1') }),
          tag: table({ id: col('int4', 'pg/int4@1') }),
          user_tags: table({
            user_id: col('int4', 'pg/int4@1'),
            tag_id: col('int4', 'pg/int4@1'),
          }),
        }),
        models: {
          User: contractModel(
            'user',
            { id: { column: 'id' } },
            {
              tags: {
                to: crossRef('Tag', UNBOUND_NAMESPACE_ID),
                cardinality: 'N:M',
                ...relationOverrides,
              },
            },
          ),
          Tag: contractModel('tag', { id: { column: 'id' } }),
        },
      });

    const consistentThrough = {
      table: 'user_tags',
      namespaceId: UNBOUND_NAMESPACE_ID,
      parentColumns: ['user_id'],
      childColumns: ['tag_id'],
      targetColumns: ['id'],
    };

    it('accepts an N:M relation whose through joins existing, type-matched columns', () => {
      const c = manyToManyContract({
        on: { localFields: ['id'], targetFields: ['user_id'] },
        through: consistentThrough,
      });
      expect(() => validateSqlContractFully(c)).not.toThrow();
    });

    it('rejects an N:M relation whose through.parentColumns and on.localFields differ in length', () => {
      const c = manyToManyContract({
        on: { localFields: [], targetFields: ['user_id'] },
        through: consistentThrough,
      });
      expect(() => validateSqlContractFully(c)).toThrow(
        /through\.parentColumns \(1\) with on\.localFields \(0\) of differing length/,
      );
    });

    it('rejects an N:M relation whose through.childColumns and through.targetColumns differ in length', () => {
      const c = manyToManyContract({
        on: { localFields: ['id'], targetFields: ['user_id'] },
        through: { ...consistentThrough, targetColumns: ['id', 'id'] },
      });
      expect(() => validateSqlContractFully(c)).toThrow(
        /through\.childColumns \(1\) with through\.targetColumns \(2\) of differing length/,
      );
    });

    it('rejects an N:M relation whose through references a column absent from the junction table', () => {
      const c = manyToManyContract({
        on: { localFields: ['id'], targetFields: ['ghost'] },
        through: { ...consistentThrough, parentColumns: ['ghost'] },
      });
      expect(() => validateSqlContractFully(c)).toThrow(
        /through\.parentColumns references column "ghost" absent from junction table/,
      );
    });

    it('rejects an N:M relation whose through joins columns of differing storage type', () => {
      const c = createContract<SqlStorage>({
        storage: unboundTables({
          user: table({ id: col('int4', 'pg/int4@1') }),
          tag: table({ id: col('int4', 'pg/int4@1') }),
          user_tags: table({
            user_id: col('text', 'pg/text@1'),
            tag_id: col('int4', 'pg/int4@1'),
          }),
        }),
        models: {
          User: contractModel(
            'user',
            { id: { column: 'id' } },
            {
              tags: {
                to: crossRef('Tag', UNBOUND_NAMESPACE_ID),
                cardinality: 'N:M',
                on: { localFields: ['id'], targetFields: ['user_id'] },
                through: {
                  table: 'user_tags',
                  namespaceId: UNBOUND_NAMESPACE_ID,
                  parentColumns: ['user_id'],
                  childColumns: ['tag_id'],
                  targetColumns: ['id'],
                },
              },
            },
          ),
          Tag: contractModel('tag', { id: { column: 'id' } }),
        },
      });
      expect(() => validateSqlContractFully(c)).toThrow(/differing storage type/);
    });

    it('validates child-side through length even for a cross-space target', () => {
      // The target Tag lives in another contract space, so its storage is not
      // resolvable here — but the childColumns ↔ targetColumns length is still
      // checkable, and here it is wrong.
      const c = createContract<SqlStorage>({
        storage: unboundTables({
          user: table({ id: col('int4', 'pg/int4@1') }),
          user_tags: table({
            user_id: col('int4', 'pg/int4@1'),
            tag_id: col('int4', 'pg/int4@1'),
          }),
        }),
        models: {
          User: contractModel(
            'user',
            { id: { column: 'id' } },
            {
              tags: {
                to: crossRef('Tag', UNBOUND_NAMESPACE_ID, 'other'),
                cardinality: 'N:M',
                on: { localFields: ['id'], targetFields: ['user_id'] },
                through: {
                  table: 'user_tags',
                  namespaceId: UNBOUND_NAMESPACE_ID,
                  parentColumns: ['user_id'],
                  childColumns: ['tag_id'],
                  targetColumns: ['id', 'id'],
                },
              },
            },
          ),
        },
      });
      expect(() => validateSqlContractFully(c)).toThrow(
        /through\.childColumns \(1\) with through\.targetColumns \(2\) of differing length/,
      );
    });

    it('resolves on.localFields field names to storage columns when they differ', () => {
      const c = createContract<SqlStorage>({
        storage: unboundTables({
          account: table({ tenant_id: col('int4', 'pg/int4@1') }),
          tag: table({ id: col('int4', 'pg/int4@1') }),
          account_tags: table({
            acct_tenant: col('int4', 'pg/int4@1'),
            tag_id: col('int4', 'pg/int4@1'),
          }),
        }),
        models: {
          Account: contractModel(
            'account',
            { tenantId: { column: 'tenant_id' } },
            {
              tags: {
                to: crossRef('Tag', UNBOUND_NAMESPACE_ID),
                cardinality: 'N:M',
                on: { localFields: ['tenantId'], targetFields: ['acct_tenant'] },
                through: {
                  table: 'account_tags',
                  namespaceId: UNBOUND_NAMESPACE_ID,
                  parentColumns: ['acct_tenant'],
                  childColumns: ['tag_id'],
                  targetColumns: ['id'],
                },
              },
            },
          ),
          Tag: contractModel('tag', { id: { column: 'id' } }),
        },
      });
      expect(() => validateSqlContractFully(c)).not.toThrow();
    });

    it('throws on missing targetFamily', () => {
      const userTable = table({
        id: col('int4', 'pg/int4@1'),
      });
      const c = createContract<SqlStorage>({
        storage: unboundTables({ user: userTable }),
      });
      const invalid = { ...c, targetFamily: undefined } as unknown;
      expect(() => validateSqlContractFully(invalid)).toThrow(/targetFamily/);
    });

    it('throws ContractValidationError on wrong targetFamily', () => {
      const userTable = table({
        id: col('int4', 'pg/int4@1'),
      });
      const c = createContract<SqlStorage>({
        storage: unboundTables({ user: userTable }),
      });
      const invalid = { ...c, targetFamily: 'document' } as unknown;
      try {
        validateSqlContractFully(invalid);
        expect.unreachable();
      } catch (e) {
        expect(e).toBeInstanceOf(ContractValidationError);
        expect((e as ContractValidationError).phase).toBe('structural');
        expect((e as ContractValidationError).message).toMatch(/Unsupported target family/);
      }
    });

    it('throws ContractValidationError on missing target', () => {
      const userTable = table({
        id: col('int4', 'pg/int4@1'),
      });
      const c = createContract<SqlStorage>({
        storage: unboundTables({ user: userTable }),
      });
      const invalid = { ...c, target: undefined } as unknown;
      try {
        validateSqlContractFully(invalid);
        expect.unreachable();
      } catch (e) {
        expect(e).toBeInstanceOf(ContractValidationError);
        expect((e as ContractValidationError).phase).toBe('structural');
        expect((e as ContractValidationError).message).toMatch(/target/);
      }
    });

    it('throws on missing storage.storageHash', () => {
      const userTable = table({
        id: col('int4', 'pg/int4@1'),
      });
      const c = createContract<SqlStorage>({
        storage: unboundTables({ user: userTable }),
      });
      const invalid = { ...c, storage: { ...c.storage, storageHash: undefined } } as unknown;
      expect(() => validateSqlContractFully(invalid)).toThrow(/storageHash/);
    });

    it('throws on missing storage', () => {
      const userTable = table({
        id: col('int4', 'pg/int4@1'),
      });
      const c = createContract<SqlStorage>({
        storage: unboundTables({ user: userTable }),
      });
      const invalid = { ...c, storage: undefined } as unknown;
      expect(() => validateSqlContractFully(invalid)).toThrow(/storage/);
    });

    it('throws on missing models', () => {
      const userTable = table({
        id: col('int4', 'pg/int4@1'),
      });
      const c = createContract<SqlStorage>({
        storage: unboundTables({ user: userTable }),
      });
      const invalid = { ...c, models: undefined } as unknown;
      expect(() => validateSqlContractFully(invalid)).toThrow(/models/);
    });

    it('accepts contract with profileHash', () => {
      const userTable = table({
        id: col('int4', 'pg/int4@1'),
      });
      const c = createContract<SqlStorage>({
        storage: unboundTables({ user: userTable }),
      });
      expect(() => validateSqlContractFully(c)).not.toThrow();
    });

    it('rejects contract without profileHash', () => {
      const userTable = table({
        id: col('int4', 'pg/int4@1'),
      });
      const c = createContract<SqlStorage>({
        storage: unboundTables({ user: userTable }),
      });
      const { profileHash: _, ...withoutProfileHash } = c;
      expect(() => validateSqlContractFully(withoutProfileHash)).toThrow(/profileHash/);
    });

    it('accepts optional capabilities', () => {
      const userTable = table({
        id: col('int4', 'pg/int4@1'),
      });
      const c = createContract<SqlStorage>({
        storage: unboundTables({ user: userTable }),
        capabilities: {
          postgres: {
            returning: true,
          },
        },
      });
      expect(() => validateSqlContractFully(c)).not.toThrow();
    });

    it('accepts optional extension packs', () => {
      const userTable = table({
        id: col('int4', 'pg/int4@1'),
      });
      const c = createContract<SqlStorage>({
        storage: unboundTables({ user: userTable }),
        extensions: {
          postgres: {
            id: 'postgres',
            version: '0.0.1',
          },
        },
      });
      expect(() => validateSqlContractFully(c)).not.toThrow();
    });

    it('accepts optional meta', () => {
      const userTable = table({
        id: col('int4', 'pg/int4@1'),
      });
      const c = createContract<SqlStorage>({
        storage: unboundTables({ user: userTable }),
        meta: {
          generated: true,
        },
      });
      expect(() => validateSqlContractFully(c)).not.toThrow();
    });

    it('rejects unknown top-level keys', () => {
      const userTable = table({ id: col('int4', 'pg/int4@1') });
      const base = createContract<SqlStorage>({
        storage: unboundTables({ user: userTable }),
      });
      const c = {
        ...base,
        mappings: { modelToTable: { User: 'user' } },
      };
      expect(() => validateSqlContractFully(c)).toThrow('mappings must be removed');
    });

    it('validates FK with source and target coordinates only', () => {
      const userTable = table({ id: col('int4', 'pg/int4@1') }, { pk: pk('id') });
      const postTable = table(
        { id: col('int4', 'pg/int4@1'), userId: col('int4', 'pg/int4@1') },
        {
          pk: pk('id'),
          fks: [fk('post', ['userId'], 'user', ['id'])],
        },
      );
      const c = createContract<SqlStorage>({
        storage: unboundTables({ user: userTable, post: postTable }),
      });
      expect(() => validateSqlContractFully(c)).not.toThrow();
    });

    it('validates storage with FK referential actions', () => {
      const actions: ReferentialAction[] = [
        'noAction',
        'restrict',
        'cascade',
        'setNull',
        'setDefault',
      ];
      for (const action of actions) {
        const postTable = table(
          {
            id: col('int4', 'pg/int4@1'),
            userId: col('int4', 'pg/int4@1'),
          },
          { fks: [fk('post', ['userId'], 'user', ['id'], { onDelete: action })] },
        );
        const s = createContract<SqlStorage>({
          storage: unboundTables({ post: postTable }),
        }).storage;
        expect(() => validateStorage(s)).not.toThrow();
      }
    });

    it('validates storage with FK onDelete and onUpdate', () => {
      const postTable = table(
        {
          id: col('int4', 'pg/int4@1'),
          userId: col('int4', 'pg/int4@1'),
        },
        {
          fks: [
            fk('post', ['userId'], 'user', ['id'], { onDelete: 'cascade', onUpdate: 'noAction' }),
          ],
        },
      );
      const s = createContract<SqlStorage>({
        storage: unboundTables({ post: postTable }),
      }).storage;
      expect(() => validateStorage(s)).not.toThrow();
    });

    it('throws on invalid referential action string', () => {
      const invalid = {
        storageHash: 'test',
        namespaces: {
          [UNBOUND_NAMESPACE_ID]: {
            id: UNBOUND_NAMESPACE_ID,
            entries: {
              table: {
                post: {
                  columns: {
                    id: { nativeType: 'int4', codecId: 'pg/int4@1', nullable: false },
                    userId: { nativeType: 'int4', codecId: 'pg/int4@1', nullable: false },
                  },
                  uniques: [],
                  indexes: [],
                  foreignKeys: [
                    {
                      source: {
                        namespaceId: UNBOUND_NAMESPACE_ID,
                        tableName: 'post',
                        columns: ['userId'],
                      },
                      target: {
                        namespaceId: UNBOUND_NAMESPACE_ID,
                        tableName: 'user',
                        columns: ['id'],
                      },
                      onDelete: 'invalidAction',
                    },
                  ],
                },
              },
            },
          },
        },
      } as unknown;
      expect(() => validateStorage(invalid)).toThrow();
    });

    it('rejects FK whose source coordinates do not match the owning table', () => {
      const rawContract = createContract({
        storage: unboundTables({
          user: {
            columns: { id: { nativeType: 'int4', codecId: 'pg/int4@1', nullable: false } },
            primaryKey: { columns: ['id'] },
            uniques: [],
            indexes: [],
            foreignKeys: [],
          },
          post: {
            columns: {
              id: { nativeType: 'int4', codecId: 'pg/int4@1', nullable: false },
              userId: { nativeType: 'int4', codecId: 'pg/int4@1', nullable: false },
            },
            primaryKey: { columns: ['id'] },
            uniques: [],
            indexes: [],
            foreignKeys: [
              {
                source: {
                  namespaceId: UNBOUND_NAMESPACE_ID,
                  tableName: 'wrongTable',
                  columns: ['userId'],
                },
                target: { namespaceId: UNBOUND_NAMESPACE_ID, tableName: 'user', columns: ['id'] },
              },
            ],
          },
        }),
      });
      expect(() => validateSqlContractFully(rawContract)).toThrow(/mismatched source coordinates/);
    });

    it('resolves cross-namespace FK targets by namespaceId, not by bare table name', () => {
      const rawContract = createContract({
        storage: {
          namespaces: {
            auth: {
              id: 'auth',
              entries: {
                table: {
                  users: {
                    columns: {
                      id: { nativeType: 'int4', codecId: 'pg/int4@1', nullable: false },
                    },
                    primaryKey: { columns: ['id'] },
                    uniques: [],
                    indexes: [],
                    foreignKeys: [],
                  },
                },
              },
            },
            analytics: {
              id: 'analytics',
              entries: {
                table: {
                  users: {
                    columns: {
                      user_uuid: { nativeType: 'uuid', codecId: 'pg/uuid@1', nullable: false },
                    },
                    primaryKey: { columns: ['user_uuid'] },
                    uniques: [],
                    indexes: [],
                    foreignKeys: [],
                  },
                  events: {
                    columns: {
                      id: { nativeType: 'int4', codecId: 'pg/int4@1', nullable: false },
                      user_uuid: { nativeType: 'uuid', codecId: 'pg/uuid@1', nullable: false },
                    },
                    primaryKey: { columns: ['id'] },
                    uniques: [],
                    indexes: [],
                    foreignKeys: [
                      {
                        source: {
                          namespaceId: 'analytics',
                          tableName: 'events',
                          columns: ['user_uuid'],
                        },
                        target: {
                          namespaceId: 'analytics',
                          tableName: 'users',
                          columns: ['user_uuid'],
                        },
                      },
                    ],
                  },
                },
              },
            },
          },
        },
      });
      expect(() => validateSqlContractFully(rawContract)).not.toThrow();
    });

    it('rejects an FK whose target namespaceId points at a different namespace whose same-named table lacks the referenced column', () => {
      // Same fixture as above but the FK target.namespaceId is "auth" instead
      // of "analytics". Pre-fix this validated against the workspace-wide
      // table-name set and silently accepted, because "users" existed in
      // analytics. With namespace-qualified resolution it correctly resolves
      // to auth.users — which has only column "id", not "user_uuid".
      const rawContract = createContract({
        storage: {
          namespaces: {
            auth: {
              id: 'auth',
              entries: {
                table: {
                  users: {
                    columns: {
                      id: { nativeType: 'int4', codecId: 'pg/int4@1', nullable: false },
                    },
                    primaryKey: { columns: ['id'] },
                    uniques: [],
                    indexes: [],
                    foreignKeys: [],
                  },
                },
              },
            },
            analytics: {
              id: 'analytics',
              entries: {
                table: {
                  users: {
                    columns: {
                      user_uuid: { nativeType: 'uuid', codecId: 'pg/uuid@1', nullable: false },
                    },
                    primaryKey: { columns: ['user_uuid'] },
                    uniques: [],
                    indexes: [],
                    foreignKeys: [],
                  },
                  events: {
                    columns: {
                      id: { nativeType: 'int4', codecId: 'pg/int4@1', nullable: false },
                      user_uuid: { nativeType: 'uuid', codecId: 'pg/uuid@1', nullable: false },
                    },
                    primaryKey: { columns: ['id'] },
                    uniques: [],
                    indexes: [],
                    foreignKeys: [
                      {
                        source: {
                          namespaceId: 'analytics',
                          tableName: 'events',
                          columns: ['user_uuid'],
                        },
                        target: {
                          namespaceId: 'auth',
                          tableName: 'users',
                          columns: ['user_uuid'],
                        },
                      },
                    ],
                  },
                },
              },
            },
          },
        },
      });
      expect(() => validateSqlContractFully(rawContract)).toThrow(
        /non-existent column "user_uuid" in table "users"/,
      );
    });
  });

  describe('validateStorageSemantics', () => {
    it('rejects setNull on non-nullable FK column', () => {
      const s = createContract<SqlStorage>({
        storage: unboundTables({
          user: table({ id: col('int4', 'pg/int4@1') }),
          post: table(
            {
              id: col('int4', 'pg/int4@1'),
              userId: col('int4', 'pg/int4@1', false),
            },
            { fks: [fk('post', ['userId'], 'user', ['id'], { onDelete: 'setNull' })] },
          ),
        }),
      }).storage;
      const errors = validateStorageSemantics(s);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('setNull');
      expect(errors[0]).toContain('userId');
    });

    it('allows setNull on nullable FK column', () => {
      const s = createContract<SqlStorage>({
        storage: unboundTables({
          user: table({ id: col('int4', 'pg/int4@1') }),
          post: table(
            {
              id: col('int4', 'pg/int4@1'),
              userId: col('int4', 'pg/int4@1', true),
            },
            { fks: [fk('post', ['userId'], 'user', ['id'], { onDelete: 'setNull' })] },
          ),
        }),
      }).storage;
      const errors = validateStorageSemantics(s);
      expect(errors).toHaveLength(0);
    });

    it('allows cascade on non-nullable FK column', () => {
      const s = createContract<SqlStorage>({
        storage: unboundTables({
          user: table({ id: col('int4', 'pg/int4@1') }),
          post: table(
            {
              id: col('int4', 'pg/int4@1'),
              userId: col('int4', 'pg/int4@1', false),
            },
            { fks: [fk('post', ['userId'], 'user', ['id'], { onDelete: 'cascade' })] },
          ),
        }),
      }).storage;
      const errors = validateStorageSemantics(s);
      expect(errors).toHaveLength(0);
    });

    it('rejects setNull on onUpdate for non-nullable FK column', () => {
      const s = createContract<SqlStorage>({
        storage: unboundTables({
          user: table({ id: col('int4', 'pg/int4@1') }),
          post: table(
            {
              id: col('int4', 'pg/int4@1'),
              userId: col('int4', 'pg/int4@1', false),
            },
            { fks: [fk('post', ['userId'], 'user', ['id'], { onUpdate: 'setNull' })] },
          ),
        }),
      }).storage;
      const errors = validateStorageSemantics(s);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('setNull');
    });

    it('rejects setDefault on non-nullable FK column without DEFAULT', () => {
      const s = createContract<SqlStorage>({
        storage: unboundTables({
          user: table({ id: col('int4', 'pg/int4@1') }),
          post: table(
            {
              id: col('int4', 'pg/int4@1'),
              userId: col('int4', 'pg/int4@1', false),
            },
            { fks: [fk('post', ['userId'], 'user', ['id'], { onDelete: 'setDefault' })] },
          ),
        }),
      }).storage;
      const errors = validateStorageSemantics(s);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('setDefault');
      expect(errors[0]).toContain('userId');
      expect(errors[0]).toContain('NOT NULL');
      expect(errors[0]).toContain('no DEFAULT');
    });

    it('allows setDefault on non-nullable FK column with DEFAULT', () => {
      const s = createContract<SqlStorage>({
        storage: unboundTables({
          user: table({ id: col('int4', 'pg/int4@1') }),
          post: table(
            {
              id: col('int4', 'pg/int4@1'),
              userId: {
                nativeType: 'int4',
                codecId: 'pg/int4@1',
                nullable: false,
                default: { kind: 'literal', value: 0 },
              },
            },
            { fks: [fk('post', ['userId'], 'user', ['id'], { onDelete: 'setDefault' })] },
          ),
        }),
      }).storage;
      const errors = validateStorageSemantics(s);
      expect(errors).toHaveLength(0);
    });

    it('allows setDefault on nullable FK column without DEFAULT', () => {
      const s = createContract<SqlStorage>({
        storage: unboundTables({
          user: table({ id: col('int4', 'pg/int4@1') }),
          post: table(
            {
              id: col('int4', 'pg/int4@1'),
              userId: col('int4', 'pg/int4@1', true),
            },
            { fks: [fk('post', ['userId'], 'user', ['id'], { onDelete: 'setDefault' })] },
          ),
        }),
      }).storage;
      const errors = validateStorageSemantics(s);
      expect(errors).toHaveLength(0);
    });

    it('rejects setDefault on onUpdate for non-nullable FK column without DEFAULT', () => {
      const s = createContract<SqlStorage>({
        storage: unboundTables({
          user: table({ id: col('int4', 'pg/int4@1') }),
          post: table(
            {
              id: col('int4', 'pg/int4@1'),
              userId: col('int4', 'pg/int4@1', false),
            },
            { fks: [fk('post', ['userId'], 'user', ['id'], { onUpdate: 'setDefault' })] },
          ),
        }),
      }).storage;
      const errors = validateStorageSemantics(s);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('setDefault');
    });

    it('rejects duplicate named objects within the same table', () => {
      const s = createContract<SqlStorage>({
        storage: unboundTables({
          user: table(
            {
              id: col('int4', 'pg/int4@1'),
              email: col('text', 'pg/text@1'),
            },
            {
              pk: { columns: ['id'], name: 'user_pkey' },
              indexes: [{ columns: ['id'], name: 'user_pkey', unique: false }],
            },
          ),
        }),
      }).storage;

      const errors = validateStorageSemantics(s);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('user_pkey');
      expect(errors[0]).toContain('primary key');
      expect(errors[0]).toContain('index');
    });

    it('rejects duplicate uniques, and two index entries sharing one name', () => {
      const s = createContract<SqlStorage>({
        storage: unboundTables({
          user: table(
            {
              id: col('int4', 'pg/int4@1'),
              email: col('text', 'pg/text@1'),
            },
            {
              uniques: [unique('email'), unique('email')],
              indexes: [index('user_email_idx', ['email']), index('user_email_idx', ['email'])],
            },
          ),
        }),
      }).storage;

      const errors = validateStorageSemantics(s);
      expect(errors).toHaveLength(2);
      expect(errors[0]).toContain('"user_email_idx" is declared multiple times (index, index)');
      expect(errors[1]).toContain('duplicate unique constraint definition');
    });

    it('two content-identical EXACT indexes under different names validate (legal twins)', () => {
      const s = createContract<SqlStorage>({
        storage: unboundTables({
          user: table(
            {
              id: col('int4', 'pg/int4@1'),
              email: col('text', 'pg/text@1'),
            },
            {
              indexes: [index('user_email_idx1', ['email']), index('user_email_idx2', ['email'])],
            },
          ),
        }),
      }).storage;

      expect(validateStorageSemantics(s)).toEqual([]);
    });

    it('two content-identical MANAGED indexes under different prefixes still reject', () => {
      const s = createContract<SqlStorage>({
        storage: unboundTables({
          user: table(
            {
              id: col('int4', 'pg/int4@1'),
              email: col('text', 'pg/text@1'),
            },
            {
              indexes: [
                index('a_idx_46df9cad', ['email'], { prefix: 'a_idx' }),
                index('b_idx_46df9cad', ['email'], { prefix: 'b_idx' }),
              ],
            },
          ),
        }),
      }).storage;

      const errors = validateStorageSemantics(s);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('duplicate index definition');
    });

    it('rejects duplicate columns inside key, unique, and index definitions', () => {
      const s = createContract<SqlStorage>({
        storage: unboundTables({
          user: table(
            {
              id: col('int4', 'pg/int4@1'),
              email: col('text', 'pg/text@1'),
            },
            {
              pk: pk('id', 'id'),
              uniques: [unique('email', 'email')],
              indexes: [index('user_email_idx', ['email', 'email'])],
            },
          ),
        }),
      }).storage;

      const errors = validateStorageSemantics(s);
      expect(errors).toHaveLength(3);
      expect(errors[0]).toContain('primary key');
      expect(errors[0]).toContain('duplicate column "id"');
      expect(errors[1]).toContain('unique constraint');
      expect(errors[1]).toContain('duplicate column "email"');
      expect(errors[2]).toContain('index');
      expect(errors[2]).toContain('duplicate column "email"');
    });

    it('rejects nullable primary-key columns', () => {
      const s = createContract<SqlStorage>({
        storage: unboundTables({
          user: table(
            {
              id: col('int4', 'pg/int4@1', true),
            },
            {
              pk: pk('id'),
            },
          ),
        }),
      }).storage;

      const errors = validateStorageSemantics(s);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('primary key column "id"');
      expect(errors[0]).toContain('NOT NULL');
    });

    it('detects duplicate managed index definitions whose options differ only in key order', () => {
      const s = createContract<SqlStorage>({
        storage: unboundTables({
          user: table(
            {
              id: col('int4', 'pg/int4@1'),
              email: col('text', 'pg/text@1'),
            },
            {
              indexes: [
                {
                  name: 'gin1_0695c6f4',
                  prefix: 'gin1',
                  columns: ['email'],
                  unique: false,
                  type: 'gin',
                  options: { a: '1', b: '2' },
                },
                {
                  name: 'gin2_0695c6f4',
                  prefix: 'gin2',
                  columns: ['email'],
                  unique: false,
                  type: 'gin',
                  options: { b: '2', a: '1' },
                },
              ],
            },
          ),
        }),
      }).storage;

      const errors = validateStorageSemantics(s);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('duplicate index definition');
    });

    it('a unique index and a plain index on the same column tuple are not duplicates (twins)', () => {
      const s = createContract<SqlStorage>({
        storage: unboundTables({
          user: table(
            {
              id: col('int4', 'pg/int4@1'),
              email: col('text', 'pg/text@1'),
            },
            {
              indexes: [
                { name: 'user_email_unique_idx', columns: ['email'], unique: true },
                { name: 'user_email_plain_idx', columns: ['email'], unique: false },
              ],
            },
          ),
        }),
      }).storage;

      expect(validateStorageSemantics(s)).toHaveLength(0);
    });

    it('two expression indexes with different bodies are not duplicates', () => {
      const s = createContract<SqlStorage>({
        storage: unboundTables({
          user: table(
            {
              id: col('int4', 'pg/int4@1'),
              email: col('text', 'pg/text@1'),
            },
            {
              indexes: [
                { name: 'user_email_lower', expression: 'lower(email)', unique: false },
                { name: 'user_email_upper', expression: 'upper(email)', unique: false },
              ],
            },
          ),
        }),
      }).storage;

      expect(validateStorageSemantics(s)).toHaveLength(0);
    });

    it('two same-column indexes with different where predicates are not duplicates', () => {
      const s = createContract<SqlStorage>({
        storage: unboundTables({
          user: table(
            {
              id: col('int4', 'pg/int4@1'),
              email: col('text', 'pg/text@1'),
            },
            {
              indexes: [
                {
                  name: 'user_email_active',
                  columns: ['email'],
                  where: 'deleted_at IS NULL',
                  unique: false,
                },
                { name: 'user_email_all', columns: ['email'], unique: false },
              ],
            },
          ),
        }),
      }).storage;

      expect(validateStorageSemantics(s)).toHaveLength(0);
    });

    it('detects duplicate MANAGED expression index definitions with identical bodies', () => {
      const s = createContract<SqlStorage>({
        storage: unboundTables({
          user: table(
            {
              id: col('int4', 'pg/int4@1'),
              email: col('text', 'pg/text@1'),
            },
            {
              indexes: [
                {
                  name: 'lower1_17273133',
                  prefix: 'lower1',
                  expression: 'lower(email)',
                  unique: false,
                },
                {
                  name: 'lower2_17273133',
                  prefix: 'lower2',
                  expression: 'lower(email)',
                  unique: false,
                },
              ],
            },
          ),
        }),
      }).storage;

      const errors = validateStorageSemantics(s);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('duplicate index definition');
    });

    it('two content-identical EXACT expression indexes under different names validate (twins)', () => {
      const s = createContract<SqlStorage>({
        storage: unboundTables({
          user: table(
            {
              id: col('int4', 'pg/int4@1'),
              email: col('text', 'pg/text@1'),
            },
            {
              indexes: [
                { name: 'user_email_lower1', expression: 'lower(email)', unique: false },
                { name: 'user_email_lower2', expression: 'lower(email)', unique: false },
              ],
            },
          ),
        }),
      }).storage;

      expect(validateStorageSemantics(s)).toEqual([]);
    });

    it('rejects duplicate foreign key definitions within the same table', () => {
      const s = createContract<SqlStorage>({
        storage: unboundTables({
          user: table(
            {
              id: col('int4', 'pg/int4@1'),
              orgId: col('int4', 'pg/int4@1'),
            },
            {
              fks: [
                fk('user', ['orgId'], 'org', ['id'], { onDelete: 'cascade' }),
                fk('user', ['orgId'], 'org', ['id'], { onDelete: 'cascade' }),
              ],
            },
          ),
          org: table({
            id: col('int4', 'pg/int4@1'),
          }),
        }),
      }).storage;

      const errors = validateStorageSemantics(s);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('duplicate foreign key definition');
    });

    it('returns no errors for storage without FKs', () => {
      const s = createContract<SqlStorage>({
        storage: unboundTables({
          user: table({ id: col('int4', 'pg/int4@1') }),
        }),
      }).storage;
      const errors = validateStorageSemantics(s);
      expect(errors).toHaveLength(0);
    });

    it('returns no errors for a table with a valid check constraint', () => {
      const s = createContract<SqlStorage>({
        storage: unboundTables({
          user: new StorageTable({
            columns: { role: { nativeType: 'text', codecId: 'pg/text@1', nullable: false } },
            uniques: [],
            indexes: [],
            foreignKeys: [],
            checks: [
              new CheckConstraint({
                name: 'user_role_check',
                column: 'role',
                valueSet: {
                  plane: 'storage',
                  entityKind: 'valueSet',
                  namespaceId: UNBOUND_NAMESPACE_ID,
                  entityName: 'Role',
                },
              }),
            ],
          }),
        }),
      }).storage;
      const errors = validateStorageSemantics(s);
      expect(errors).toHaveLength(0);
    });

    it('rejects a check constraint whose name collides with another named object', () => {
      const s = createContract<SqlStorage>({
        storage: unboundTables({
          user: new StorageTable({
            columns: {
              id: { nativeType: 'int4', codecId: 'pg/int4@1', nullable: false },
              role: { nativeType: 'text', codecId: 'pg/text@1', nullable: false },
            },
            uniques: [],
            indexes: [{ columns: ['id'], name: 'shared_name', unique: false }],
            foreignKeys: [],
            checks: [
              new CheckConstraint({
                name: 'shared_name',
                column: 'role',
                valueSet: {
                  plane: 'storage',
                  entityKind: 'valueSet',
                  namespaceId: UNBOUND_NAMESPACE_ID,
                  entityName: 'Role',
                },
              }),
            ],
          }),
        }),
      }).storage;
      const errors = validateStorageSemantics(s);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('shared_name');
      expect(errors[0]).toContain('check constraint');
      expect(errors[0]).toContain('index');
    });

    it('rejects duplicate check constraint definitions (same column + valueSet)', () => {
      const valueSetRef = {
        plane: 'storage' as const,
        entityKind: 'valueSet' as const,
        namespaceId: UNBOUND_NAMESPACE_ID,
        entityName: 'Role',
      };
      const s = createContract<SqlStorage>({
        storage: unboundTables({
          user: new StorageTable({
            columns: { role: { nativeType: 'text', codecId: 'pg/text@1', nullable: false } },
            uniques: [],
            indexes: [],
            foreignKeys: [],
            checks: [
              new CheckConstraint({
                name: 'user_role_check_a',
                column: 'role',
                valueSet: valueSetRef,
              }),
              new CheckConstraint({
                name: 'user_role_check_b',
                column: 'role',
                valueSet: valueSetRef,
              }),
            ],
          }),
        }),
      }).storage;
      const errors = validateStorageSemantics(s);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('duplicate check constraint definition');
      expect(errors[0]).toContain('role');
    });
  });

  describe('validateSqlStorageConsistency', () => {
    it('throws when a check constraint references a non-existent column', () => {
      const rawContract = createContract({
        storage: unboundTables({
          user: new StorageTable({
            columns: { role: { nativeType: 'text', codecId: 'pg/text@1', nullable: false } },
            uniques: [],
            indexes: [],
            foreignKeys: [],
            checks: [
              new CheckConstraint({
                name: 'user_status_check',
                column: 'status',
                valueSet: {
                  plane: 'storage',
                  entityKind: 'valueSet',
                  namespaceId: UNBOUND_NAMESPACE_ID,
                  entityName: 'Status',
                },
              }),
            ],
          }),
        }),
      });
      expect(() => validateSqlStorageConsistency(rawContract as never)).toThrow(
        /non-existent column "status"/,
      );
    });

    it('does not throw when all check constraint columns exist', () => {
      const rawContract = createContract({
        storage: unboundTables({
          user: new StorageTable({
            columns: { status: { nativeType: 'text', codecId: 'pg/text@1', nullable: false } },
            uniques: [],
            indexes: [],
            foreignKeys: [],
            checks: [
              new CheckConstraint({
                name: 'user_status_check',
                column: 'status',
                valueSet: {
                  plane: 'storage',
                  entityKind: 'valueSet',
                  namespaceId: UNBOUND_NAMESPACE_ID,
                  entityName: 'Status',
                },
              }),
            ],
          }),
        }),
      });
      expect(() => validateSqlStorageConsistency(rawContract as never)).not.toThrow();
    });
  });

  describe('validateSqlContractFully strict mode', () => {
    it('rejects unknown top-level properties', () => {
      const c = createContract<SqlStorage>({
        storage: unboundTables({ users: table({ id: col('int4', 'pg/int4@1') }) }),
        models: { User: contractModel('users', { id: { column: 'id' } }) },
      });
      const withUnknown = { ...c, bogusField: 'unexpected' };
      expect(() => validateSqlContractFully(withUnknown)).toThrow();
    });

    it('accepts valid contracts without unknown properties', () => {
      const c = createContract<SqlStorage>({
        storage: unboundTables({ users: table({ id: col('int4', 'pg/int4@1') }) }),
        models: { User: contractModel('users', { id: { column: 'id' } }) },
      });
      expect(() => validateSqlContractFully(c)).not.toThrow();
    });
  });

  describe('ValueSetRef call-site-narrowed schemas', () => {
    const storageSchema = createSqlStorageSchema(composeSqlEntityKinds());

    function makeStorageWithCheckRef(ref: Record<string, unknown>) {
      return {
        storageHash: 'test',
        namespaces: {
          [UNBOUND_NAMESPACE_ID]: {
            id: UNBOUND_NAMESPACE_ID,
            entries: {
              table: {
                users: {
                  columns: { role: { nativeType: 'text', codecId: 'pg/text@1', nullable: false } },
                  uniques: [],
                  indexes: [],
                  foreignKeys: [],
                  checks: [{ name: 'users_role_check', column: 'role', valueSet: ref }],
                },
              },
            },
          },
        },
      };
    }

    it('accepts a storage check ref with plane:storage + entityKind:valueSet', () => {
      const result = storageSchema(
        makeStorageWithCheckRef({
          plane: 'storage',
          entityKind: 'valueSet',
          namespaceId: 'public',
          entityName: 'Role',
        }),
      );
      expect(result).not.toBeInstanceOf(type.errors);
    });

    it('rejects a storage check ref with plane:domain + entityKind:enum', () => {
      const result = storageSchema(
        makeStorageWithCheckRef({
          plane: 'domain',
          entityKind: 'enum',
          namespaceId: 'public',
          entityName: 'Role',
        }),
      );
      expect(result).toBeInstanceOf(type.errors);
    });

    it('rejects a storage check ref with plane:domain + entityKind:valueSet', () => {
      const result = storageSchema(
        makeStorageWithCheckRef({
          plane: 'domain',
          entityKind: 'valueSet',
          namespaceId: 'public',
          entityName: 'Role',
        }),
      );
      expect(result).toBeInstanceOf(type.errors);
    });

    it('accepts a domain field ref with plane:domain + entityKind:enum', () => {
      const result = validateModel({
        fields: {
          role: {
            nullable: false,
            type: { kind: 'scalar', codecId: 'pg/text@1' },
            valueSet: {
              plane: 'domain',
              entityKind: 'enum',
              namespaceId: 'public',
              entityName: 'Role',
            },
          },
        },
        relations: {},
        storage: { table: 'user', namespaceId: 'public', fields: { role: { column: 'role' } } },
      });
      expect(result).toBeDefined();
    });

    it('rejects a domain field ref with plane:storage + entityKind:valueSet', () => {
      expect(() =>
        validateModel({
          fields: {
            role: {
              nullable: false,
              type: { kind: 'scalar', codecId: 'pg/text@1' },
              valueSet: {
                plane: 'storage',
                entityKind: 'valueSet',
                namespaceId: 'public',
                entityName: 'Role',
              },
            },
          },
          relations: {},
          storage: { table: 'user', namespaceId: 'public', fields: { role: { column: 'role' } } },
        }),
      ).toThrow();
    });

    it('StorageValueSetSchema accepts kind valueSet', () => {
      const result = StorageValueSetSchema({ kind: 'valueSet', values: ['a', 'b'] });
      expect(result).not.toBeInstanceOf(type.errors);
    });

    it('StorageValueSetSchema rejects kind value-set', () => {
      const result = StorageValueSetSchema({ kind: 'value-set', values: ['a', 'b'] });
      expect(result).toBeInstanceOf(type.errors);
    });
  });

  describe('composeSqlEntityKinds', () => {
    it('accepts a non-colliding pack kind', () => {
      const packDescriptor = {
        kind: ' table',
        schema: type('unknown'),
        construct: (v: unknown) => v,
      };
      expect(() => composeSqlEntityKinds([packDescriptor])).not.toThrow();
    });

    it('throws on a duplicate entity kind (table)', () => {
      const collidingDescriptor = {
        kind: 'table',
        schema: type('unknown'),
        construct: (v: unknown) => v,
      };
      expect(() => composeSqlEntityKinds([collidingDescriptor])).toThrow(/duplicate entity kind/);
    });

    it('throws on a duplicate entity kind (valueSet)', () => {
      const collidingDescriptor = {
        kind: 'valueSet',
        schema: type('unknown'),
        construct: (v: unknown) => v,
      };
      expect(() => composeSqlEntityKinds([collidingDescriptor])).toThrow(/duplicate entity kind/);
    });

    it('registers non-colliding pack kinds', () => {
      const packDescriptor = {
        kind: 'type',
        schema: type('unknown'),
        construct: (v: unknown) => v,
      };
      const kinds = composeSqlEntityKinds([packDescriptor]);
      expect(kinds.has('type')).toBe(true);
      expect(kinds.has('table')).toBe(true);
      expect(kinds.has('valueSet')).toBe(true);
    });
  });
});

describe('validateSqlContractFully — pre-name-identity index shape', () => {
  // Pinned because the 0.16-to-0.17 upgrade instructions quote these
  // substrings: a consumer loading a 0.16-emitted contract must be able to
  // grep the documented text out of the real error.
  it('rejects a 0.16-shaped index entry naming the missing name and unique fields', () => {
    const contract: unknown = {
      target: 'postgres',
      targetFamily: 'sql',
      profileHash: 'e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0',
      storage: {
        storageHash: 'e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0',
        namespaces: {
          public: {
            id: 'public',
            kind: 'postgres-schema',
            entries: {
              table: {
                user: {
                  columns: {
                    id: { nativeType: 'int4', codecId: 'pg/int4@1', nullable: false },
                    email: { nativeType: 'text', codecId: 'pg/text@1', nullable: false },
                  },
                  primaryKey: { columns: ['id'] },
                  uniques: [],
                  indexes: [{ columns: ['email'] }],
                  foreignKeys: [],
                },
              },
            },
          },
        },
      },
      domain: { namespaces: { __unbound__: { models: {} } } },
      roots: {},
      capabilities: {},
      extensions: {},
      meta: {},
    };

    const validate = () =>
      validateSqlContractFully(contract as Parameters<typeof validateSqlContractFully>[0]);
    expect(validate).toThrow('Contract structural validation failed');
    expect(validate).toThrow('indexes[0].name must be a string (was missing)');
    expect(validate).toThrow('indexes[0].unique must be boolean (was missing)');
  });
});
