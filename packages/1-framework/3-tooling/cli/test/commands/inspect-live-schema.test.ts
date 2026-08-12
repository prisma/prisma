import { notOk, ok } from '@internal/utils/result';
import { timeouts } from '@repo/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  errorDatabaseConnectionRequired,
  errorDriverRequired,
  errorUnexpected,
} from '../../src/utils/cli-errors';
import { parseGlobalFlags } from '../../src/utils/global-flags';
import { TerminalUI } from '../../src/utils/terminal-ui';
import { setupCommandMocks } from '../utils/test-helpers';

type InspectLiveSchema =
  typeof import('../../src/commands/inspect-live-schema')['inspectLiveSchema'];

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
  db: {
    connection: 'postgres://config_user:config_pass@localhost:5432/from_config',
  },
} as const;

const schemaIR = {
  tables: {},
} as const;

const context = {
  commandName: 'db schema',
  description: 'Inspect the live database schema',
  url: 'https://pris.ly/db-schema',
} as const;

describe('inspectLiveSchema', () => {
  let consoleErrors: string[] = [];
  let cleanupMocks: () => void = () => {};
  let inspectLiveSchema: InspectLiveSchema;

  beforeEach(async () => {
    vi.resetModules();
    ({ inspectLiveSchema } = await import('../../src/commands/inspect-live-schema'));

    const commandMocks = setupCommandMocks();
    consoleErrors = commandMocks.consoleErrors;
    cleanupMocks = commandMocks.cleanup;

    mocks.loadConfigMock.mockResolvedValue(ok(baseConfig));
    mocks.introspectMock.mockResolvedValue(schemaIR);
    mocks.toSchemaViewMock.mockReturnValue(undefined);
    mocks.inferPslContractMock.mockReturnValue(undefined);
    mocks.getPslBlockDescriptorsMock.mockReturnValue({});
    mocks.closeMock.mockResolvedValue(undefined);
    mocks.createControlClientMock.mockClear();
  }, timeouts.typeScriptCompilation);

  afterEach(() => {
    cleanupMocks();
    vi.clearAllMocks();
  });

  function createUi() {
    const flags = parseGlobalFlags({ 'no-color': true });
    const ui = new TerminalUI({ color: flags.color, interactive: flags.interactive });
    return { flags, ui };
  }

  it('uses the explicit db url, masks it in output/meta, and falls back to the default config path', async () => {
    mocks.loadConfigMock.mockResolvedValue(
      ok({
        ...baseConfig,
        extensions: undefined,
      }),
    );

    const { flags, ui } = createUi();
    const result = await inspectLiveSchema(
      { db: 'postgres://flag_user:flag_pass@localhost:5432/from_flag' },
      flags,
      ui,
      0,
      context,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.meta).toEqual({
      configPath: 'prisma-next.config.ts',
      dbUrl: 'postgres://****:****@localhost:5432/from_flag',
    });
    expect(mocks.createControlClientMock).toHaveBeenCalledWith(
      expect.objectContaining({
        extensions: [],
      }),
    );
    expect(mocks.introspectMock).toHaveBeenCalledWith(
      expect.objectContaining({
        connection: 'postgres://flag_user:flag_pass@localhost:5432/from_flag',
        onProgress: expect.any(Function),
      }),
    );
    expect(consoleErrors.join('\n')).toContain('postgres://****:****@localhost:5432/from_flag');
  });

  it('returns a database connection error when no db url is available', async () => {
    mocks.loadConfigMock.mockResolvedValue(
      ok({
        ...baseConfig,
        db: undefined,
      }),
    );

    const { flags, ui } = createUi();
    const result = await inspectLiveSchema({}, flags, ui, 0, context);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.toEnvelope().code).toBe(
      errorDatabaseConnectionRequired().toEnvelope().code,
    );
  });

  it('returns a driver error when config.driver is missing', async () => {
    mocks.loadConfigMock.mockResolvedValue(
      ok({
        ...baseConfig,
        driver: undefined,
      }),
    );

    const { flags, ui } = createUi();
    const result = await inspectLiveSchema({}, flags, ui, 0, context);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.toEnvelope().code).toBe(errorDriverRequired().toEnvelope().code);
  });

  it('passes through structured config-loading failures unchanged', async () => {
    const configError = errorDriverRequired({ why: 'broken config file' });
    mocks.loadConfigMock.mockResolvedValue(notOk(configError));

    const { flags, ui } = createUi();
    const result = await inspectLiveSchema({}, flags, ui, 0, context);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.toEnvelope().code).toBe(configError.toEnvelope().code);
  });

  it('passes through unexpected config-loading failures already wrapped by the loader', async () => {
    mocks.loadConfigMock.mockResolvedValue(
      notOk(errorUnexpected('boom', { why: 'Failed to load config' })),
    );

    const { flags, ui } = createUi();
    const result = await inspectLiveSchema({}, flags, ui, 0, context);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.toEnvelope().code).toBe(
      errorUnexpected('boom', { why: 'Failed to load config' }).toEnvelope().code,
    );
  });

  it('omits masked db metadata when the configured connection is not a url string', async () => {
    mocks.loadConfigMock.mockResolvedValue(
      ok({
        ...baseConfig,
        db: {
          connection: { host: 'localhost', port: 5432 },
        },
      }),
    );

    const { flags, ui } = createUi();
    const result = await inspectLiveSchema({}, flags, ui, 0, context);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.meta).toEqual({
      configPath: 'prisma-next.config.ts',
    });
    expect(consoleErrors.join('\n')).not.toContain('localhost:5432');
  });

  it('passes through structured introspection errors and always closes the client', async () => {
    const introspectError = errorUnexpected('driver exploded');
    mocks.introspectMock.mockRejectedValue(introspectError);

    const { flags, ui } = createUi();
    const result = await inspectLiveSchema({}, flags, ui, 0, context);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.toEnvelope().code).toBe(introspectError.toEnvelope().code);
    expect(mocks.closeMock).toHaveBeenCalledTimes(1);
  });

  it('wraps unexpected Error introspection failures and always closes the client', async () => {
    mocks.introspectMock.mockRejectedValue(new Error('boom'));

    const { flags, ui } = createUi();
    const result = await inspectLiveSchema({}, flags, ui, 0, context);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.toEnvelope().code).toBe(
      errorUnexpected('boom', {
        why: 'Unexpected error during db schema: boom',
      }).toEnvelope().code,
    );
    expect(mocks.closeMock).toHaveBeenCalledTimes(1);
  });

  it('wraps non-Error introspection failures and always closes the client', async () => {
    mocks.introspectMock.mockRejectedValue('boom');

    const { flags, ui } = createUi();
    const result = await inspectLiveSchema({}, flags, ui, 0, context);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.toEnvelope().code).toBe(
      errorUnexpected('boom', {
        why: 'Unexpected error during db schema: boom',
      }).toEnvelope().code,
    );
    expect(mocks.closeMock).toHaveBeenCalledTimes(1);
  });

  it('passes non-SQL schema IR through unchanged when no contract inference is supported', async () => {
    const mongoSchemaIR = { collections: { users: { name: 'users', indexes: [] } } };
    mocks.loadConfigMock.mockResolvedValue(
      ok({
        ...baseConfig,
        family: { familyId: 'mongo' },
        target: { targetId: 'mongo' },
        db: { connection: 'mongodb://localhost:27017/test' },
      }),
    );
    mocks.introspectMock.mockResolvedValue(mongoSchemaIR);
    mocks.inferPslContractMock.mockReturnValue(undefined);

    const { flags, ui } = createUi();
    const result = await inspectLiveSchema({}, flags, ui, 0, context);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.schema).toBe(mongoSchemaIR);
    expect(result.value.target.familyId).toBe('mongo');
    expect(result.value.pslContractAst).toBeUndefined();
  });

  it('exposes the AST returned by client.inferPslContract', async () => {
    const fakeAst = { kind: 'document', namespaces: [] } as unknown;
    mocks.inferPslContractMock.mockReturnValue(fakeAst);

    const { flags, ui } = createUi();
    const result = await inspectLiveSchema({}, flags, ui, 0, context);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.pslContractAst).toBe(fakeAst);
    expect(mocks.inferPslContractMock).toHaveBeenCalledWith(schemaIR);
  });
});
