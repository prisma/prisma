import { ok } from '@internal/utils/result';
import { timeouts } from '@repo/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { executeCommand, setupCommandMocks } from '../utils/test-helpers';

type CreateDbSchemaCommand = typeof import('../../src/commands/db-schema')['createDbSchemaCommand'];

const mocks = vi.hoisted(() => {
  const loadConfigMock = vi.fn();
  const introspectMock = vi.fn();
  const toSchemaViewMock = vi.fn();
  const inferPslContractMock = vi.fn();
  const getPslBlockDescriptorsMock = vi.fn();
  const closeMock = vi.fn();
  const createControlClientMock = vi.fn(() => ({
    introspect: introspectMock,
    toSchemaView: toSchemaViewMock,
    inferPslContract: inferPslContractMock,
    getPslBlockDescriptors: getPslBlockDescriptorsMock,
    close: closeMock,
  }));

  return {
    loadConfigMock,
    introspectMock,
    toSchemaViewMock,
    inferPslContractMock,
    getPslBlockDescriptorsMock,
    closeMock,
    createControlClientMock,
  };
});

vi.mock('@internal/config-loader', () => ({
  loadConfigForSections: mocks.loadConfigMock,
}));

vi.mock('../../src/control-api/client', () => ({
  createControlClient: mocks.createControlClientMock,
}));

const baseConfig = {
  family: { familyId: 'sql' },
  target: { targetId: 'postgres' },
  adapter: {},
  driver: {},
  extensions: [],
  db: {
    connection: 'postgres://user:pass@localhost:5432/prisma_next',
  },
} as const;

const schemaIR = {
  tables: {
    user: {
      name: 'user',
      columns: {
        id: {
          name: 'id',
          nativeType: 'int4',
          nullable: false,
        },
        email: {
          name: 'email',
          nativeType: 'text',
          nullable: false,
        },
      },
      primaryKey: {
        columns: ['id'],
      },
      foreignKeys: [],
      uniques: [{ columns: ['email'] }],
      indexes: [],
    },
  },
} as const;

const schemaView = {
  root: {
    kind: 'root',
    id: 'sql-schema',
    label: 'sql schema (tables: 1)',
    children: [
      {
        kind: 'entity',
        id: 'table-user',
        label: 'table user',
        children: [
          {
            kind: 'collection',
            id: 'columns-user',
            label: 'columns',
            children: [
              {
                kind: 'field',
                id: 'column-user-id',
                label: 'id: int4 (not null)',
              },
              {
                kind: 'field',
                id: 'column-user-email',
                label: 'email: text (not null)',
              },
            ],
          },
        ],
      },
    ],
  },
} as const;

describe('createDbSchemaCommand', () => {
  let consoleOutput: string[] = [];
  let consoleErrors: string[] = [];
  let cleanupMocks: () => void = () => {};
  let createDbSchemaCommand: CreateDbSchemaCommand;

  beforeEach(async () => {
    vi.resetModules();
    ({ createDbSchemaCommand } = await import('../../src/commands/db-schema'));

    const commandMocks = setupCommandMocks();
    consoleOutput = commandMocks.consoleOutput;
    consoleErrors = commandMocks.consoleErrors;
    cleanupMocks = commandMocks.cleanup;

    mocks.loadConfigMock.mockResolvedValue(ok(baseConfig));
    mocks.introspectMock.mockResolvedValue(schemaIR);
    mocks.toSchemaViewMock.mockReturnValue(schemaView);
    mocks.inferPslContractMock.mockReturnValue(undefined);
    mocks.getPslBlockDescriptorsMock.mockReturnValue({});
    mocks.closeMock.mockResolvedValue(undefined);
    mocks.createControlClientMock.mockClear();
  }, timeouts.typeScriptCompilation);

  afterEach(() => {
    cleanupMocks();
    vi.clearAllMocks();
  });

  it('prints schema JSON when --json is provided', async () => {
    await executeCommand(createDbSchemaCommand(), [
      '--config',
      'prisma-next.config.ts',
      '--json',
      '--no-color',
    ]);

    expect(consoleErrors).toEqual([]);

    const parsed = JSON.parse(consoleOutput.join('\n')) as {
      readonly summary: string;
      readonly schema: {
        readonly tables: {
          readonly user: { readonly columns: { readonly email: { readonly nativeType: string } } };
        };
      };
      readonly meta: { readonly configPath: string; readonly dbUrl: string };
    };
    expect(parsed.summary).toBe('Schema read successfully');
    expect(parsed.meta).toMatchObject({
      configPath: 'prisma-next.config.ts',
      dbUrl: 'postgres://****:****@localhost:5432/prisma_next',
    });
    expect(parsed.schema.tables.user.columns.email.nativeType).toBe('text');
  });

  it('prints the rendered schema tree in human-readable mode', async () => {
    await executeCommand(createDbSchemaCommand(), [
      '--config',
      'prisma-next.config.ts',
      '--no-color',
    ]);

    const output = consoleOutput.join('\n');
    expect(output).toContain('sql schema (tables: 1)');
    expect(output).toContain('table user');
    expect(output).toContain('id: int4 (not null)');
    expect(output).toContain('email: text (not null)');
  });

  it('emits no rendered output in quiet mode', async () => {
    await executeCommand(createDbSchemaCommand(), [
      '--config',
      'prisma-next.config.ts',
      '--quiet',
      '--no-color',
    ]);

    expect(consoleOutput).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });
});
