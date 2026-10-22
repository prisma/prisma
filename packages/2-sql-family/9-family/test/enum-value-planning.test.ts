import {
  asNamespaceId,
  type Contract,
  type JsonValue,
  profileHash,
  type StorageHashBase,
} from '@internal/contract/types';
import type {
  ResolvedEnumValueRenameStatement,
  ResolvedNamespaceRenameStatement,
} from '@internal/framework-components/control';
import { SqlStorage, StorageTable } from '@internal/sql-contract/types';
import { describe, expect, it } from 'vitest';
import { createTestSqlNamespace } from '../../1-core/contract/test/test-support';
import { planEnumValueRewrites } from '../src/core/migrations/enum-value-planning';
import type { SchemaTables } from '../src/core/migrations/schema-tables';

interface EnumColumn {
  readonly model: string;
  readonly table: string;
  readonly field?: string;
  readonly column?: string;
  readonly nullable?: boolean;
  readonly many?: boolean;
}

function contractWith(options: {
  readonly members: Readonly<Record<string, JsonValue>>;
  readonly columns: readonly EnumColumn[];
  readonly namespace?: string;
}): Contract<SqlStorage> {
  const namespaceId = options.namespace ?? 'app';
  const valueSet = {
    plane: 'domain' as const,
    namespaceId,
    entityKind: 'enum' as const,
    entityName: 'Status',
  };
  const tables = [...new Set(options.columns.map(({ table }) => table))];
  return {
    target: 'postgres',
    targetFamily: 'sql',
    profileHash: profileHash('test'),
    storage: new SqlStorage({
      storageHash: 'test' as StorageHashBase<string>,
      namespaces: {
        [namespaceId]: createTestSqlNamespace({
          id: namespaceId,
          entries: {
            table: Object.fromEntries(
              tables.map((table) => [
                table,
                new StorageTable({
                  columns: Object.fromEntries(
                    options.columns
                      .filter((column) => column.table === table)
                      .map((column) => [
                        column.column ?? 'status',
                        {
                          dataType: 'test/text',
                          codecId: 'test/text@1',
                          nullable: column.nullable ?? true,
                          ...(column.many === true ? { many: { elementNullable: false } } : {}),
                        },
                      ]),
                  ),
                  uniques: [],
                  indexes: [],
                  foreignKeys: [],
                }),
              ]),
            ),
          },
        }),
      },
    }),
    domain: {
      namespaces: {
        [namespaceId]: {
          enum: {
            Status: {
              codecId: 'test/text@1',
              members: Object.entries(options.members).map(([name, value]) => ({ name, value })),
            },
          },
          models: Object.fromEntries(
            options.columns.map((column) => [
              column.model,
              {
                fields: {
                  [column.field ?? 'status']: {
                    nullable: column.nullable ?? true,
                    type: { kind: 'scalar', codecId: 'test/text@1' },
                    valueSet,
                    ...(column.many === true ? { many: { elementNullable: false } } : {}),
                  },
                },
                relations: {},
                storage: {
                  table: column.table,
                  namespaceId,
                  fields: { [column.field ?? 'status']: { column: column.column ?? 'status' } },
                },
              },
            ]),
          ),
        },
      },
    },
    roots: {},
    capabilities: {},
    extensions: {},
    meta: {},
  };
}

function tablesOf(qualifiedColumns: readonly string[]): SchemaTables {
  const has = (key: string) => qualifiedColumns.includes(key);
  return {
    hasTable: (namespaceId, table) =>
      qualifiedColumns.some((key) => key.startsWith(`${namespaceId}.${table}.`)),
    hasColumn: (namespaceId, table, column) => has(`${namespaceId}.${table}.${column}`),
    tablesNamed: () => [],
    columnsNamed: () => [],
    namespacesWithTable: () => [],
    hasNamespace: () => true,
  };
}

function rename(from: string, to: string, namespace = 'app'): ResolvedEnumValueRenameStatement {
  return {
    kind: 'rename',
    entity: 'enumValue',
    from: { namespaceId: asNamespaceId(namespace), enum: 'Status', member: from },
    to: { namespaceId: asNamespaceId(namespace), enum: 'Status', member: to },
  };
}

const ARCHIVED = { namespaceId: asNamespaceId('app'), enum: 'Status', member: 'ARCHIVED' };
const codecRef = { codecId: 'test/text@1' };
const taskColumn = { model: 'Task', table: 'task' };

function rewrites(result: ReturnType<typeof planEnumValueRewrites>) {
  if (!result.ok) throw new Error(`expected rewrites, got: ${result.failure.summary}`);
  return result.value;
}

function refusal(result: ReturnType<typeof planEnumValueRewrites>) {
  if (result.ok) throw new Error('expected a refusal');
  return result.failure;
}

describe('planEnumValueRewrites', () => {
  it('removes a stored value the destination enum no longer has from every column the enum types', () => {
    const columns = [
      taskColumn,
      { model: 'Note', table: 'note', column: 'tags', field: 'tags', many: true },
    ];
    expect(
      rewrites(
        planEnumValueRewrites({
          statements: [],
          fromContract: contractWith({
            members: { ACTIVE: 'active', ARCHIVED: 'archived' },
            columns,
          }),
          contract: contractWith({ members: { ACTIVE: 'active' }, columns }),
          tables: tablesOf(['app.task.status', 'app.note.tags']),
        }),
      ),
    ).toEqual([
      {
        enumValue: ARCHIVED,
        namespaceId: 'app',
        table: 'task',
        column: 'status',
        codecRef,
        many: false,
        from: 'archived',
        to: undefined,
        statement: undefined,
        keptName: undefined,
      },
      {
        enumValue: ARCHIVED,
        namespaceId: 'app',
        table: 'note',
        column: 'tags',
        codecRef,
        many: true,
        from: 'archived',
        to: undefined,
        statement: undefined,
        keptName: undefined,
      },
    ]);
  });

  it('plans nothing for a member renamed with its stored value kept, with or without a statement', () => {
    const fromContract = contractWith({ members: { ARCHIVED: 'archived' }, columns: [taskColumn] });
    const contract = contractWith({ members: { RETIRED: 'archived' }, columns: [taskColumn] });
    const tables = tablesOf(['app.task.status']);

    expect(
      rewrites(planEnumValueRewrites({ statements: [], fromContract, contract, tables })),
    ).toEqual([]);
    expect(
      rewrites(
        planEnumValueRewrites({
          statements: [rename('ARCHIVED', 'RETIRED')],
          fromContract,
          contract,
          tables,
        }),
      ),
    ).toEqual([]);
  });

  it('replaces the stored value when a rename statement changes it', () => {
    const statement = rename('ARCHIVED', 'RETIRED');
    expect(
      rewrites(
        planEnumValueRewrites({
          statements: [statement],
          fromContract: contractWith({ members: { ARCHIVED: 'archived' }, columns: [taskColumn] }),
          contract: contractWith({ members: { RETIRED: 'retired' }, columns: [taskColumn] }),
          tables: tablesOf(['app.task.status']),
        }),
      ),
    ).toEqual([
      {
        enumValue: ARCHIVED,
        namespaceId: 'app',
        table: 'task',
        column: 'status',
        codecRef,
        many: false,
        from: 'archived',
        to: 'retired',
        statement,
        keptName: undefined,
      },
    ]);
  });

  it('removes a stored value that changed under the same member name, and says what it changed to', () => {
    expect(
      rewrites(
        planEnumValueRewrites({
          statements: [],
          fromContract: contractWith({ members: { ARCHIVED: 1 }, columns: [taskColumn] }),
          contract: contractWith({ members: { ARCHIVED: 2 }, columns: [taskColumn] }),
          tables: tablesOf(['app.task.status']),
        }),
      ),
    ).toMatchObject([{ enumValue: ARCHIVED, from: 1, to: undefined, keptName: 2 }]);
  });

  it('leaves out a column the working schema does not have yet, and a table the destination drops', () => {
    expect(
      rewrites(
        planEnumValueRewrites({
          statements: [],
          fromContract: contractWith({
            members: { ACTIVE: 'active', ARCHIVED: 'archived' },
            columns: [taskColumn, { model: 'Old', table: 'old' }],
          }),
          contract: contractWith({
            members: { ACTIVE: 'active' },
            columns: [taskColumn, { model: 'Note', table: 'note' }],
          }),
          tables: tablesOf(['app.task.status', 'app.old.status']),
        }),
      ),
    ).toMatchObject([{ table: 'task' }]);
  });

  it('finds the enum of a renamed namespace under its new name', () => {
    expect(
      rewrites(
        planEnumValueRewrites({
          statements: [
            {
              kind: 'rename',
              entity: 'namespace',
              from: asNamespaceId('app'),
              to: asNamespaceId('crm'),
            } satisfies ResolvedNamespaceRenameStatement,
          ],
          fromContract: contractWith({
            members: { ACTIVE: 'active', ARCHIVED: 'archived' },
            columns: [taskColumn],
          }),
          contract: contractWith({
            members: { ACTIVE: 'active' },
            columns: [taskColumn],
            namespace: 'crm',
          }),
          tables: tablesOf(['crm.task.status']),
        }),
      ),
    ).toMatchObject([{ enumValue: ARCHIVED, namespaceId: 'crm', table: 'task' }]);
  });

  it('plans nothing without an origin contract', () => {
    expect(
      rewrites(
        planEnumValueRewrites({
          statements: [],
          fromContract: null,
          contract: contractWith({ members: { ACTIVE: 'active' }, columns: [taskColumn] }),
          tables: tablesOf(['app.task.status']),
        }),
      ),
    ).toEqual([]);
  });

  it('refuses to remove a stored value from a required scalar column, pointing to a rename', () => {
    expect(
      refusal(
        planEnumValueRewrites({
          statements: [],
          fromContract: contractWith({
            members: { ACTIVE: 'active', ARCHIVED: 'archived' },
            columns: [{ ...taskColumn, nullable: false }],
          }),
          contract: contractWith({
            members: { ACTIVE: 'active' },
            columns: [{ ...taskColumn, nullable: false }],
          }),
          tables: tablesOf(['app.task.status']),
        }),
      ),
    ).toEqual({
      kind: 'nullabilityConflict',
      summary:
        'Cannot remove enum value "Status.ARCHIVED" from column "task"."status": the column is required',
      why: 'Removing an enum value sets it to NULL in each row that holds it, and column "status" of table "task" takes no NULL. Rename the value instead with --rename Status.ARCHIVED:Status.<new name>, or, with migration plan, write the update by hand in migration.ts.',
      location: { namespaceId: 'app', entityKind: 'table', entityName: 'task', column: 'status' },
    });
  });

  it('refuses to remove a changed stored value from a required column, pointing to the update by hand', () => {
    expect(
      refusal(
        planEnumValueRewrites({
          statements: [],
          fromContract: contractWith({
            members: { ARCHIVED: 1 },
            columns: [{ ...taskColumn, nullable: false }],
          }),
          contract: contractWith({
            members: { ARCHIVED: 2 },
            columns: [{ ...taskColumn, nullable: false }],
          }),
          tables: tablesOf(['app.task.status']),
        }),
      ).why,
    ).toBe(
      'Removing an enum value sets it to NULL in each row that holds it, and column "status" of table "task" takes no NULL. Enum value "Status.ARCHIVED" keeps its name with a new stored value, which a statement cannot say: with migration plan, write the update by hand in migration.ts.',
    );
  });

  it('refuses a rename whose old stored value the destination enum still has', () => {
    expect(
      refusal(
        planEnumValueRewrites({
          statements: [rename('ARCHIVED', 'RETIRED')],
          fromContract: contractWith({ members: { ARCHIVED: 'archived' }, columns: [taskColumn] }),
          contract: contractWith({
            members: { RETIRED: 'retired', HIDDEN: 'archived' },
            columns: [taskColumn],
          }),
          tables: tablesOf(['app.task.status']),
        }),
      ),
    ).toMatchObject({
      kind: 'statementRefused',
      summary:
        'Cannot rename enum value "Status.ARCHIVED" to "Status.RETIRED": the destination enum still stores "archived", as enum value "Status.HIDDEN"',
      why: 'A rename changes the stored value in every row that holds it, so the rows that hold "archived" for "Status.HIDDEN" would change too. Leave out this statement.',
    });
  });
});
