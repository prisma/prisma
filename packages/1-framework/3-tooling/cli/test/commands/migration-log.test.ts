import type { LedgerEntryRecord } from '@internal/contract/types';
import { ok } from '@internal/utils/result';
import { type } from 'arktype';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { migrationLogResultSchema } from '../../src/commands/json/schemas';
import {
  createMigrationLogCommand,
  executeMigrationLogCommand,
} from '../../src/commands/migration-log';
import { parseGlobalFlags } from '../../src/utils/global-flags';
import { createTerminalUI } from '../../src/utils/terminal-ui';
import {
  executeCommand,
  parseJsonObjectFromCliCapture,
  setupCommandMocks,
} from '../utils/test-helpers';

const mocks = vi.hoisted(() => ({
  loadConfig: vi.fn(),
  connect: vi.fn(),
  close: vi.fn(),
  readLedger: vi.fn(),
}));

vi.mock('@internal/config-loader', () => ({
  loadConfigForSections: mocks.loadConfig,
}));

vi.mock('../../src/control-api/client', () => ({
  createControlClient: vi.fn(() => ({
    connect: mocks.connect,
    readLedger: mocks.readLedger,
    close: mocks.close,
  })),
}));

afterAll(() => {
  // Repo-wide vitest runs with `isolate: false`, so the `vi.mock` leaks
  // into the next file in the same worker; unmock to restore it.
  vi.doUnmock('@internal/config-loader');
  vi.doUnmock('../../src/control-api/client');
  vi.resetModules();
});

const baseConfig = {
  family: { familyId: 'sql', create: vi.fn() },
  target: { id: 'postgres', familyId: 'sql', targetId: 'postgres', kind: 'target', migrations: {} },
  adapter: { kind: 'adapter', familyId: 'sql', targetId: 'postgres' },
  driver: { kind: 'driver' },
  db: { connection: 'postgres://localhost/test' },
  contract: { output: 'contract.json' },
  migrations: { dir: 'migrations' },
};

function ledgerEntry(
  overrides: Partial<LedgerEntryRecord> & Pick<LedgerEntryRecord, 'migrationName'>,
): LedgerEntryRecord {
  return {
    space: 'app',
    migrationHash: 'mig',
    from: null,
    to: 'dest',
    appliedAt: new Date('2026-06-01T08:00:00.000Z'),
    operationCount: 3,
    ...overrides,
  };
}

describe('executeMigrationLogCommand', () => {
  it('returns a structured error when no database connection is configured', async () => {
    mocks.loadConfig.mockResolvedValue(
      ok({
        ...baseConfig,
        db: {},
      }),
    );
    const result = await executeMigrationLogCommand(
      { config: 'prisma-next.config.ts' },
      parseGlobalFlags({}),
      createTerminalUI(parseGlobalFlags({})),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.code).toBe('CONFIG.DB_CONNECTION_REQUIRED');
    expect(result.failure.meta?.['missingFlags']).toEqual(['--db']);
  });

  it('returns the same missing-DB envelope when only the driver is missing', async () => {
    mocks.loadConfig.mockResolvedValue(
      ok({
        ...baseConfig,
        driver: undefined,
      }),
    );
    const result = await executeMigrationLogCommand(
      { config: 'prisma-next.config.ts', db: 'postgres://localhost/test' },
      parseGlobalFlags({}),
      createTerminalUI(parseGlobalFlags({})),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.code).toBe('CONFIG.DB_CONNECTION_REQUIRED');
    expect(result.failure.meta?.['missingFlags']).toEqual([]);
  });

  it('returns an empty array when the ledger has no rows', async () => {
    mocks.loadConfig.mockResolvedValue(ok(baseConfig));
    mocks.connect.mockResolvedValue(undefined);
    mocks.readLedger.mockResolvedValue([]);
    mocks.close.mockResolvedValue(undefined);

    const result = await executeMigrationLogCommand(
      { config: 'prisma-next.config.ts', db: 'postgres://localhost/test' },
      parseGlobalFlags({ json: true }),
      createTerminalUI(parseGlobalFlags({ json: true })),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual([]);
  });

  it('reads the unscoped ledger', async () => {
    mocks.loadConfig.mockResolvedValue(ok(baseConfig));
    mocks.connect.mockResolvedValue(undefined);
    mocks.readLedger.mockResolvedValue([ledgerEntry({ migrationName: '20260301_init' })]);
    mocks.close.mockResolvedValue(undefined);

    const result = await executeMigrationLogCommand(
      { config: 'prisma-next.config.ts', db: 'postgres://localhost/test' },
      parseGlobalFlags({ json: true }),
      createTerminalUI(parseGlobalFlags({ json: true })),
    );
    expect(mocks.readLedger).toHaveBeenCalledWith();
    expect(result.ok).toBe(true);
  });

  it('preserves rollback and re-apply rows as repeated uniform entries', async () => {
    mocks.loadConfig.mockResolvedValue(ok(baseConfig));
    mocks.connect.mockResolvedValue(undefined);
    mocks.readLedger.mockResolvedValue([
      ledgerEntry({
        migrationName: '20260303_add',
        from: null,
        to: 'a',
        appliedAt: new Date('2026-06-01T08:00:00.000Z'),
      }),
      ledgerEntry({
        migrationName: '20260303_add',
        from: 'a',
        to: 'b',
        appliedAt: new Date('2026-06-02T08:00:00.000Z'),
      }),
      ledgerEntry({
        migrationName: '20260303_add',
        from: 'b',
        to: 'a',
        appliedAt: new Date('2026-06-03T08:00:00.000Z'),
      }),
    ]);
    mocks.close.mockResolvedValue(undefined);

    const result = await executeMigrationLogCommand(
      { config: 'prisma-next.config.ts', db: 'postgres://localhost/test' },
      parseGlobalFlags({ json: true }),
      createTerminalUI(parseGlobalFlags({ json: true })),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(3);
    expect(result.value.every((row) => row.migrationName === '20260303_add')).toBe(true);
  });
});

describe('migration log --json envelope', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('emits { ok: true, records: [...], summary } for a populated ledger', async () => {
    mocks.loadConfig.mockResolvedValue(ok(baseConfig));
    mocks.connect.mockResolvedValue(undefined);
    mocks.readLedger.mockResolvedValue([ledgerEntry({ migrationName: '20260301_init' })]);
    mocks.close.mockResolvedValue(undefined);

    const { consoleOutput, cleanup } = setupCommandMocks();
    try {
      await executeCommand(createMigrationLogCommand(), [
        '--json',
        '--db',
        'postgres://localhost/test',
      ]);
    } finally {
      cleanup();
    }

    const envelope = parseJsonObjectFromCliCapture(consoleOutput) as {
      ok: boolean;
      records: ReadonlyArray<{ name: string }>;
      summary: string;
    };
    expect(envelope.ok).toBe(true);
    expect(Array.isArray(envelope.records)).toBe(true);
    expect(envelope.records).toHaveLength(1);
    expect(envelope.records[0]?.name).toBe('20260301_init');
    expect(typeof envelope.summary).toBe('string');
    expect(migrationLogResultSchema(envelope) instanceof type.errors).toBe(false);
  });

  it('emits { ok: true, records: [], summary } for an empty ledger', async () => {
    mocks.loadConfig.mockResolvedValue(ok(baseConfig));
    mocks.connect.mockResolvedValue(undefined);
    mocks.readLedger.mockResolvedValue([]);
    mocks.close.mockResolvedValue(undefined);

    const { consoleOutput, cleanup } = setupCommandMocks();
    try {
      await executeCommand(createMigrationLogCommand(), [
        '--json',
        '--db',
        'postgres://localhost/test',
      ]);
    } finally {
      cleanup();
    }

    const envelope = parseJsonObjectFromCliCapture(consoleOutput) as {
      ok: boolean;
      records: readonly unknown[];
      summary: string;
    };
    expect(envelope.ok).toBe(true);
    expect(envelope.records).toEqual([]);
    expect(typeof envelope.summary).toBe('string');
    expect(migrationLogResultSchema(envelope) instanceof type.errors).toBe(false);
  });
});
