import mysqlAdapter from '@internal/adapter-mysql/control';
import type { MysqlControlDriver } from '@internal/driver-mysql/control';
import mysqlDriver from '@internal/driver-mysql/control';
import sql from '@internal/family-sql/control';
import { createControlStack, diffSchemas } from '@internal/framework-components/control';
import { SqlSchemaIR } from '@internal/sql-schema-ir/types';
import mysql from '@internal/target-mysql/control';
import { withMysqlDatabase } from '@repo/test-utils/mysql-database';
import { describe, expect, it } from 'vitest';
import { exampleContractSchema, exampleTablesDdl, loadExampleContract } from './example-contract';

const autoincrement = { kind: 'function', expression: 'autoincrement()' } as const;

async function introspect(driver: MysqlControlDriver, contract?: unknown): Promise<SqlSchemaIR> {
  const adapter = mysqlAdapter.create(
    createControlStack({ family: sql, target: mysql, adapter: mysqlAdapter, driver: mysqlDriver }),
  );
  return (await adapter.introspect(driver, contract)) as SqlSchemaIR;
}

async function withExampleTables<T>(
  url: string,
  ddl: readonly string[],
  fn: (driver: MysqlControlDriver) => Promise<T>,
): Promise<T> {
  const driver = await mysqlDriver.create(url);
  try {
    for (const statement of ddl) await driver.query(statement);
    return await fn(driver);
  } finally {
    await driver.close();
  }
}

describe('introspecting a MySQL database made by hand', () => {
  it('yields the schema IR the example contract describes', async (test) => {
    await withMysqlDatabase(test, ({ url }) =>
      withExampleTables(url, exampleTablesDdl, async (driver) => {
        const actual = await introspect(driver, loadExampleContract());

        expect(diffSchemas(exampleContractSchema(), actual)).toEqual([]);
        expect(actual).toEqual(
          new SqlSchemaIR({
            tables: {
              Post: {
                name: 'Post',
                columns: {
                  id: {
                    name: 'id',
                    typeText: 'int',
                    nullable: false,
                    resolvedDefault: autoincrement,
                  },
                  title: { name: 'title', typeText: 'varchar(191)', nullable: false },
                  authorId: { name: 'authorId', typeText: 'int', nullable: false },
                },
                primaryKey: { columns: ['id'] },
                foreignKeys: [
                  {
                    columns: ['authorId'],
                    referencedTable: 'User',
                    referencedColumns: ['id'],
                    name: 'Post_authorId_fkey',
                  },
                ],
                uniques: [],
                indexes: [
                  {
                    naming: { kind: 'exact', name: 'Post_authorId_idx_e47547ed' },
                    columns: ['authorId'],
                    unique: false,
                    where: undefined,
                    partial: false,
                    type: undefined,
                    options: undefined,
                    annotations: undefined,
                    dependsOn: undefined,
                  },
                ],
              },
              User: {
                name: 'User',
                columns: {
                  id: {
                    name: 'id',
                    typeText: 'int',
                    nullable: false,
                    resolvedDefault: autoincrement,
                  },
                  email: { name: 'email', typeText: 'varchar(191)', nullable: false },
                  role: { name: 'role', typeText: "enum('USER','ADMIN')", nullable: false },
                },
                primaryKey: { columns: ['id'] },
                foreignKeys: [],
                uniques: [{ columns: ['email'], name: 'User_email_key' }],
                indexes: [],
              },
            },
          }),
        );
      }),
    );
  });

  it('leaves out the index InnoDB creates for a foreign key with no index of its own', async (test) => {
    const [userTable] = exampleTablesDdl;
    const postWithoutIndex = `CREATE TABLE \`Post\` (
      \`id\` int NOT NULL AUTO_INCREMENT,
      \`authorId\` int NOT NULL,
      PRIMARY KEY (\`id\`),
      CONSTRAINT \`Post_authorId_fkey\` FOREIGN KEY (\`authorId\`) REFERENCES \`User\` (\`id\`) ON DELETE CASCADE
    )`;
    await withMysqlDatabase(test, ({ url }) =>
      withExampleTables(url, [userTable, postWithoutIndex], async (driver) => {
        const post = (await introspect(driver)).tables['Post'];
        expect({ indexes: post?.indexes, foreignKeys: post?.foreignKeys }).toEqual({
          indexes: [],
          foreignKeys: [
            expect.objectContaining({
              columns: ['authorId'],
              name: 'Post_authorId_fkey',
              onDelete: 'cascade',
            }),
          ],
        });
      }),
    );
  });

  it('reports a changed enum member as a different column type', async (test) => {
    const [, postTable] = exampleTablesDdl;
    const userWithOtherMembers = exampleTablesDdl[0].replace(
      "enum('USER','ADMIN')",
      "enum('USER','OWNER')",
    );
    await withMysqlDatabase(test, ({ url }) =>
      withExampleTables(url, [userWithOtherMembers, postTable], async (driver) => {
        const actual = await introspect(driver, loadExampleContract());
        expect(
          diffSchemas(exampleContractSchema(), actual).map((issue) => issue.path.join('/')),
        ).toEqual([expect.stringContaining('role')]);
      }),
    );
  });
});
