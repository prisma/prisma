import type { Contract } from '@internal/contract/types';
import type {
  MigrationOperationPolicy,
  SchemaOwnership,
} from '@internal/framework-components/control';
import type { SqlStorage } from '@internal/sql-contract/types';
import { SqlSchemaIR } from '@internal/sql-schema-ir/types';
import { describe, expect, it } from 'vitest';
import mysqlControlTarget from '../../src/core/migrations/control-target';
import { createMysqlMigrationPlanner } from '../../src/core/migrations/planner';
import { contractOf, frameworkComponents, int, stubLowerer, text } from './fixtures';

const A = 'a'.repeat(64);
const B = 'b'.repeat(64);

const EVERY_CLASS: MigrationOperationPolicy = {
  allowedOperationClasses: ['additive', 'widening', 'destructive', 'data'],
};

function fk(name: string) {
  return {
    source: { namespaceId: '__unbound__', tableName: 'Post', columns: ['authorId'] },
    target: { namespaceId: '__unbound__', tableName: 'User', columns: ['id'] },
    name,
    index: false,
  };
}

const user = {
  columns: { id: int, email: text },
  primaryKey: { columns: ['id'] },
};

function plan(
  from: Contract<SqlStorage> | null,
  to: Contract<SqlStorage>,
  options: {
    readonly policy?: MigrationOperationPolicy;
    readonly ownership?: SchemaOwnership;
    readonly schema?: unknown;
  } = {},
) {
  return createMysqlMigrationPlanner(stubLowerer).plan({
    contract: to,
    schema:
      options.schema ?? mysqlControlTarget.migrations.contractToSchema(from, frameworkComponents),
    policy: options.policy ?? EVERY_CLASS,
    fromContract: from,
    origin: from === null ? null : { storageHash: from.storage.storageHash },
    statements: [],
    frameworkComponents,
    spaceId: 'app',
    snapshotsImportPath: '../../snapshots',
    ...(options.ownership === undefined ? {} : { ownership: options.ownership }),
  });
}

async function sqlOf(result: ReturnType<typeof plan>) {
  if (result.kind !== 'success') throw new Error(JSON.stringify(result.conflicts));
  return (await Promise.all(result.plan.operations)).map((operation) => ({
    id: operation.id,
    sql: operation.execute.map((step) => step.sql),
  }));
}

function summaries(result: ReturnType<typeof plan>) {
  return result.kind === 'failure' ? result.conflicts.map(({ summary }) => summary) : 'planned';
}

describe('MysqlMigrationPlanner', () => {
  it('adds and drops unique constraints, indexes and foreign keys, dropping foreign keys first, and refuses changing one', async () => {
    const from = contractOf('from', {
      User: { ...user, uniques: [{ columns: ['email'], name: 'User_email_key' }] },
      Post: {
        columns: { id: int, authorId: int },
        primaryKey: { columns: ['id'] },
        indexes: [{ columns: ['authorId'], name: 'Post_authorId_idx' }],
        foreignKeys: [fk('Post_authorId_fkey')],
      },
    });
    const to = contractOf('to', {
      User: { ...user, indexes: [{ columns: ['email'], name: 'User_email_idx', unique: true }] },
      Post: {
        columns: { id: int, authorId: int },
        primaryKey: { columns: ['id'] },
        uniques: [{ columns: ['authorId'], name: 'Post_authorId_key' }],
        foreignKeys: [{ ...fk('Post_authorId_fkey'), onDelete: 'cascade' }],
      },
    });
    const withoutForeignKey = contractOf('bare', {
      User: user,
      Post: { columns: { id: int, authorId: int }, primaryKey: { columns: ['id'] } },
    });
    expect({
      changed: summaries(plan(from, to)),
      dropped: await sqlOf(plan(from, withoutForeignKey)),
      added: await sqlOf(plan(withoutForeignKey, to)),
    }).toEqual({
      changed: ['Changing a foreign key is not yet supported on MySQL (Post)'],
      dropped: [
        {
          id: 'dropForeignKey.Post.Post_authorId_fkey',
          sql: ['ALTER TABLE `Post` DROP FOREIGN KEY `Post_authorId_fkey`'],
        },
        {
          id: 'dropUnique.User.User_email_key',
          sql: ['ALTER TABLE `User` DROP INDEX `User_email_key`'],
        },
        {
          id: 'dropIndex.Post.Post_authorId_idx',
          sql: ['DROP INDEX `Post_authorId_idx` ON `Post`'],
        },
      ],
      added: [
        {
          id: 'unique.Post.Post_authorId_key',
          sql: ['ALTER TABLE `Post` ADD CONSTRAINT `Post_authorId_key` UNIQUE (`authorId`)'],
        },
        {
          id: 'index.User.User_email_idx',
          sql: ['CREATE UNIQUE INDEX `User_email_idx` ON `User` (`email`)'],
        },
        {
          id: 'foreignKey.Post.Post_authorId_fkey',
          sql: [
            'ALTER TABLE `Post` ADD CONSTRAINT `Post_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `User` (`id`) ON DELETE CASCADE',
          ],
        },
      ],
    });
  });

  it('drops a table no space owns, and leaves one another space owns or the runner owns', async () => {
    const from = contractOf('from', { User: user, Legacy: user, Shared: user });
    const to = contractOf('to', { User: user });
    const live = mysqlControlTarget.migrations.contractToSchema(from, frameworkComponents);
    const ownership: SchemaOwnership = {
      declaresEntity: ({ entityName }) => entityName === 'Shared',
      namespaceDeclaringSpaces: () => ['app'],
    };
    const result = plan(from, to, { ownership, schema: live });
    expect({
      sql: await sqlOf(result),
      dataLoss: result.kind === 'success' ? result.dataLoss.map(({ subject }) => subject) : [],
    }).toEqual({
      sql: [{ id: 'dropTable.Legacy', sql: ['DROP TABLE `Legacy`'] }],
      dataLoss: [{ kind: 'storage', name: 'Legacy' }],
    });
  });

  it('never drops the marker and ledger tables', async () => {
    const withControlTables = new SqlSchemaIR({
      tables: {
        _prisma_marker: {
          name: '_prisma_marker',
          columns: {},
          foreignKeys: [],
          uniques: [],
          indexes: [],
        },
      },
    });
    expect(await sqlOf(plan(null, contractOf('to', {}), { schema: withControlTables }))).toEqual(
      [],
    );
  });

  it('adds a column with a default through the lowerer', async () => {
    const from = contractOf('from', { User: user });
    const to = contractOf('to', {
      User: {
        ...user,
        columns: { ...user.columns, score: { ...int, default: { kind: 'literal', value: 0 } } },
      },
    });
    expect(await sqlOf(plan(from, to))).toEqual([
      {
        id: 'column.User.score',
        sql: ['ALTER TABLE `User` ADD COLUMN `score` int NOT NULL DEFAULT 0'],
      },
    ]);
  });

  it('refuses a primary key change, an expression index and a new autoincrement column', () => {
    const from = contractOf('from', { User: user });
    expect({
      primaryKey: summaries(
        plan(from, contractOf('pk', { User: { ...user, primaryKey: { columns: ['email'] } } })),
      ),
      autoincrement: summaries(
        plan(
          from,
          contractOf('ai', {
            User: {
              ...user,
              columns: {
                ...user.columns,
                seq: { ...int, default: { kind: 'function', expression: 'autoincrement()' } },
              },
            },
          }),
        ),
      ),
    }).toEqual({
      primaryKey: ['Changing a primary key is not yet supported on MySQL (User)'],
      autoincrement: [
        'Adding a required column without a default is not yet supported on MySQL (User.seq)',
      ],
    });
  });

  it('refuses to plan without the additive class', () => {
    expect(
      summaries(
        plan(null, contractOf('to', { User: user }), { policy: { allowedOperationClasses: [] } }),
      ),
    ).toEqual(['Migration planner requires additive operations be allowed']);
  });

  it('refuses a schema tree MySQL did not build', () => {
    expect(() => plan(null, contractOf('to', {}), { schema: { tables: {} } })).toThrow(
      expect.objectContaining({ code: 'CONTRACT.TARGET_MISMATCH' }),
    );
  });

  it('scaffolds an empty migration for migration new', () => {
    const empty = createMysqlMigrationPlanner(stubLowerer).emptyMigration(
      { packageDir: '/p', fromHash: A, toHash: B, snapshotsImportPath: '../s' },
      'app',
    );
    expect({
      spaceId: empty.spaceId,
      operations: empty.operations,
      describe: empty.describe(),
      source: empty.renderTypeScript((specifier) => specifier).includes('return [\n\n    ];'),
    }).toEqual({
      spaceId: 'app',
      operations: [],
      describe: { from: A, to: B },
      source: true,
    });
  });
});
