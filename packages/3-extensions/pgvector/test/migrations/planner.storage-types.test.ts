import {
  createPostgresBuiltinCodecLookup,
  PostgresControlAdapter,
} from '@internal/adapter-postgres/control';
import { type Contract, coreHash, profileHash } from '@internal/contract/types';
import type { CodecControlHooks, SqlMigrationPlanOperation } from '@internal/family-sql/control';
import { INIT_ADDITIVE_POLICY } from '@internal/family-sql/control';
import type { TargetBoundComponentDescriptor } from '@internal/framework-components/components';
import { APP_SPACE_ID } from '@internal/framework-components/control';
import { UNBOUND_NAMESPACE_ID } from '@internal/framework-components/ir';
import { SqlStorage } from '@internal/sql-contract/types';
import { createPostgresMigrationPlanner } from '@internal/target-postgres/planner';
import type { PostgresPlanTargetDetails } from '@internal/target-postgres/planner-target-details';
import {
  PostgresDatabaseSchemaNode,
  PostgresNamespaceSchemaNode,
  PostgresUnboundSchema,
  postgresCreateNamespace,
} from '@internal/target-postgres/types';
import { applicationDomainOf } from '@repo/test-utils';
import { expectNarrowedType } from '@repo/test-utils/typed-expectations';
import { describe, expect, it } from 'vitest';
import pgvectorDescriptor from '../../src/exports/control';

const testAdapter = new PostgresControlAdapter(createPostgresBuiltinCodecLookup());

const emptySchema = new PostgresDatabaseSchemaNode({
  namespaces: {
    public: new PostgresNamespaceSchemaNode({
      schemaName: 'public',
      tables: {},
    }),
  },
  roles: [],
  existingSchemas: [],
  pgVersion: '',
});

describe('PostgresMigrationPlanner - storage types', () => {
  it('plans type operations before table operations', async () => {
    const planner = createPostgresMigrationPlanner(testAdapter);
    const hooks: CodecControlHooks = {
      planTypeOperations: (_options) => ({
        operations: [
          {
            id: 'type.Role',
            label: 'Create type Role',
            operationClass: 'additive',
            target: { id: 'postgres' },
            precheck: [],
            execute: [{ description: 'create type', sql: "CREATE TYPE role AS ENUM ('USER')" }],
            postcheck: [],
          },
        ],
      }),
    };

    const frameworkComponents: ReadonlyArray<TargetBoundComponentDescriptor<'sql', string>> = [
      {
        kind: 'adapter',
        id: 'test',
        familyId: 'sql',
        targetId: 'postgres',
        version: '0.0.0-test',
        types: {
          codecTypes: {
            controlPlaneHooks: {
              'app/test-type@1': hooks,
            },
          },
        },
      },
    ];

    const contract: Contract<SqlStorage> = {
      target: 'postgres',
      targetFamily: 'sql',
      profileHash: profileHash('test'),
      storage: new SqlStorage({
        storageHash: coreHash('test'),
        types: {
          Role: {
            kind: 'codec-instance',
            codecId: 'app/test-type@1',
            nativeType: 'role',
            typeParams: { values: ['USER'] },
          },
        },
        namespaces: {
          [UNBOUND_NAMESPACE_ID]: postgresCreateNamespace({
            id: UNBOUND_NAMESPACE_ID,
            entries: {
              table: {
                user: {
                  columns: {
                    id: { nativeType: 'uuid', codecId: 'pg/uuid@1', nullable: false },
                    role: {
                      nativeType: 'role',
                      codecId: 'app/test-type@1',
                      nullable: false,
                      typeRef: 'Role',
                    },
                  },
                  primaryKey: { columns: ['id'] },
                  uniques: [],
                  indexes: [],
                  foreignKeys: [],
                },
              },
            },
          }),
        },
      }),
      roots: {},
      domain: applicationDomainOf({ models: {} }),
      capabilities: {},
      extensions: {},
      meta: {},
    };

    const result = planner.plan({
      contract,
      schema: emptySchema,
      policy: INIT_ADDITIVE_POLICY,
      fromContract: null,
      frameworkComponents,
      spaceId: APP_SPACE_ID,
      snapshotsImportPath: '../../snapshots',
    });

    expectNarrowedType(result.kind === 'success');
    const ops = (await Promise.all(
      result.plan.operations,
    )) as SqlMigrationPlanOperation<PostgresPlanTargetDetails>[];
    expect(ops.map((op) => op.id)).toEqual(['type.Role', 'table.user']);
  });

  it('fails when storage type operations are non-additive under init policy', () => {
    const planner = createPostgresMigrationPlanner(testAdapter);
    const hooks: CodecControlHooks = {
      planTypeOperations: (_options) => ({
        operations: [
          {
            id: 'type.Role.drop',
            label: 'Drop type Role',
            operationClass: 'destructive',
            target: { id: 'postgres' },
            precheck: [],
            execute: [{ description: 'drop type', sql: 'DROP TYPE role' }],
            postcheck: [],
          },
        ],
      }),
    };

    const frameworkComponents: ReadonlyArray<TargetBoundComponentDescriptor<'sql', string>> = [
      {
        kind: 'adapter',
        id: 'test',
        familyId: 'sql',
        targetId: 'postgres',
        version: '0.0.0-test',
        types: {
          codecTypes: {
            controlPlaneHooks: {
              'app/test-type@1': hooks,
            },
          },
        },
      },
    ];

    const contract: Contract<SqlStorage> = {
      target: 'postgres',
      targetFamily: 'sql',
      profileHash: profileHash('test'),
      storage: new SqlStorage({
        storageHash: coreHash('test'),
        types: {
          Role: {
            kind: 'codec-instance',
            codecId: 'app/test-type@1',
            nativeType: 'role',
            typeParams: { values: ['USER'] },
          },
        },
        namespaces: { [UNBOUND_NAMESPACE_ID]: PostgresUnboundSchema.instance },
      }),
      roots: {},
      domain: applicationDomainOf({ models: {} }),
      capabilities: {},
      extensions: {},
      meta: {},
    };

    const result = planner.plan({
      contract,
      schema: emptySchema,
      policy: INIT_ADDITIVE_POLICY,
      fromContract: null,
      frameworkComponents,
      spaceId: APP_SPACE_ID,
      snapshotsImportPath: '../../snapshots',
    });

    expect(result).toMatchObject({
      kind: 'failure',
      conflicts: [
        expect.objectContaining({
          kind: 'missingButNonAdditive',
        }),
      ],
    });
  });

  it('quotes custom type names in CREATE TABLE to preserve case', async () => {
    const planner = createPostgresMigrationPlanner(testAdapter);
    const hooks: CodecControlHooks = {
      planTypeOperations: (_options) => ({
        operations: [
          {
            id: 'type.UserKind',
            label: 'Create type UserKind',
            operationClass: 'additive',
            target: { id: 'postgres' },
            precheck: [],
            execute: [
              { description: 'create type', sql: 'CREATE TYPE "UserKind" AS ENUM (\'ADMIN\')' },
            ],
            postcheck: [],
          },
        ],
      }),
    };

    const frameworkComponents: ReadonlyArray<TargetBoundComponentDescriptor<'sql', string>> = [
      {
        kind: 'adapter',
        id: 'test',
        familyId: 'sql',
        targetId: 'postgres',
        version: '0.0.0-test',
        types: {
          codecTypes: {
            controlPlaneHooks: {
              'app/test-type@1': hooks,
            },
          },
        },
      },
    ];

    const contract: Contract<SqlStorage> = {
      target: 'postgres',
      targetFamily: 'sql',
      profileHash: profileHash('test'),
      storage: new SqlStorage({
        storageHash: coreHash('test'),
        types: {
          UserKind: {
            kind: 'codec-instance',
            codecId: 'app/test-type@1',
            nativeType: 'UserKind',
            typeParams: { values: ['ADMIN', 'USER'] },
          },
        },
        namespaces: {
          [UNBOUND_NAMESPACE_ID]: postgresCreateNamespace({
            id: UNBOUND_NAMESPACE_ID,
            entries: {
              table: {
                user: {
                  columns: {
                    id: { nativeType: 'uuid', codecId: 'pg/uuid@1', nullable: false },
                    kind: {
                      nativeType: 'UserKind',
                      codecId: 'app/test-type@1',
                      nullable: false,
                      typeRef: 'UserKind',
                    },
                  },
                  primaryKey: { columns: ['id'] },
                  uniques: [],
                  indexes: [],
                  foreignKeys: [],
                },
              },
            },
          }),
        },
      }),
      roots: {},
      domain: applicationDomainOf({ models: {} }),
      capabilities: {},
      extensions: {},
      meta: {},
    };

    const result = planner.plan({
      contract,
      schema: emptySchema,
      policy: INIT_ADDITIVE_POLICY,
      fromContract: null,
      frameworkComponents,
      spaceId: APP_SPACE_ID,
      snapshotsImportPath: '../../snapshots',
    });

    expectNarrowedType(result.kind === 'success');

    const ops = (await Promise.all(
      result.plan.operations,
    )) as SqlMigrationPlanOperation<PostgresPlanTargetDetails>[];
    const tableOp = ops.find((op) => op.id === 'table.user');
    expect(tableOp).toBeDefined();

    const createTableSql = tableOp!.execute[0]?.sql;

    expect(createTableSql).toContain('"UserKind"');
  });

  it('expands parameterized storage type refs when creating tables', async () => {
    const planner = createPostgresMigrationPlanner(testAdapter);
    const contract: Contract<SqlStorage> = {
      target: 'postgres',
      targetFamily: 'sql',
      profileHash: profileHash('test'),
      storage: new SqlStorage({
        storageHash: coreHash('test'),
        types: {
          Embedding1536: {
            kind: 'codec-instance',
            codecId: 'pg/vector@1',
            nativeType: 'vector',
            typeParams: { length: 1536 },
          },
        },
        namespaces: {
          [UNBOUND_NAMESPACE_ID]: postgresCreateNamespace({
            id: UNBOUND_NAMESPACE_ID,
            entries: {
              table: {
                document: {
                  columns: {
                    id: { nativeType: 'int4', codecId: 'pg/int4@1', nullable: false },
                    embedding: {
                      nativeType: 'vector',
                      codecId: 'pg/vector@1',
                      nullable: false,
                      typeRef: 'Embedding1536',
                    },
                  },
                  primaryKey: { columns: ['id'] },
                  uniques: [],
                  indexes: [],
                  foreignKeys: [],
                },
              },
            },
          }),
        },
      }),
      roots: {},
      domain: applicationDomainOf({ models: {} }),
      capabilities: {},
      extensions: {},
      meta: {},
    };

    const result = planner.plan({
      contract,
      schema: emptySchema,
      policy: INIT_ADDITIVE_POLICY,
      fromContract: null,
      frameworkComponents: [pgvectorDescriptor],
      spaceId: APP_SPACE_ID,
      snapshotsImportPath: '../../snapshots',
    });

    expectNarrowedType(result.kind === 'success');

    const ops = (await Promise.all(
      result.plan.operations,
    )) as SqlMigrationPlanOperation<PostgresPlanTargetDetails>[];
    const tableOp = ops.find((op) => op.id === 'table.document');
    expect(tableOp).toBeDefined();

    const createTableSql = tableOp?.execute[0]?.sql ?? '';
    expect(createTableSql).toContain('"embedding" vector(1536) NOT NULL');
    expect(createTableSql).not.toContain('"embedding" "vector(1536)"');
  });

  it('fails when parameterized storage type refs cannot expand without codec hooks', () => {
    const planner = createPostgresMigrationPlanner(testAdapter);
    const contract: Contract<SqlStorage> = {
      target: 'postgres',
      targetFamily: 'sql',
      profileHash: profileHash('test'),
      storage: new SqlStorage({
        storageHash: coreHash('test'),
        types: {
          Embedding1536: {
            kind: 'codec-instance',
            codecId: 'pg/vector@1',
            nativeType: 'vector',
            typeParams: { length: 1536 },
          },
        },
        namespaces: {
          [UNBOUND_NAMESPACE_ID]: postgresCreateNamespace({
            id: UNBOUND_NAMESPACE_ID,
            entries: {
              table: {
                document: {
                  columns: {
                    id: { nativeType: 'int4', codecId: 'pg/int4@1', nullable: false },
                    embedding: {
                      nativeType: 'vector',
                      codecId: 'pg/vector@1',
                      nullable: false,
                      typeRef: 'Embedding1536',
                    },
                  },
                  primaryKey: { columns: ['id'] },
                  uniques: [],
                  indexes: [],
                  foreignKeys: [],
                },
              },
            },
          }),
        },
      }),
      roots: {},
      domain: applicationDomainOf({ models: {} }),
      capabilities: {},
      extensions: {},
      meta: {},
    };

    expect(() =>
      planner.plan({
        contract,
        schema: emptySchema,
        policy: INIT_ADDITIVE_POLICY,
        fromContract: null,
        frameworkComponents: [],
        spaceId: APP_SPACE_ID,
        snapshotsImportPath: '../../snapshots',
      }),
    ).toThrow(
      'Column declares typeParams for nativeType "vector" but no expandNativeType hook is registered for codecId "pg/vector@1".',
    );
  });
});
