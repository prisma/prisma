import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { notOk, ok } from '@internal/utils/result';
import type { MountedTree, StreamEvent } from '@prisma/cli-engine';
import { createTestCli } from '@prisma/cli-engine/testing';
import { timeouts } from '@repo/test-utils';
import { join } from 'pathe';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BIN_GROUPS as BinGroups } from '../../src/orm/cli';

const mocks = vi.hoisted(() => ({
  connect: vi.fn(),
  dbUpdate: vi.fn(),
  close: vi.fn(),
}));

vi.mock('../../src/control-api/client', () => ({
  createControlClient: vi.fn(() => ({
    connect: mocks.connect,
    dbUpdate: mocks.dbUpdate,
    close: mocks.close,
  })),
}));

/**
 * The command tree is imported after the module registry is reset, so the
 * mocked client is the one `db update` closes over. Repo-wide vitest runs with
 * `isolate: false`, and another file that loaded the command tree first would
 * otherwise have baked the real client into it.
 */
let commands: MountedTree;
let groups: typeof BinGroups;

beforeAll(async () => {
  vi.resetModules();
  const cli = await import('../../src/orm/cli');
  commands = cli.BIN_COMMANDS;
  groups = cli.BIN_GROUPS;
}, timeouts.coldTransformImport);

afterAll(() => {
  for (const dir of projectDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
  vi.doUnmock('../../src/control-api/client');
  vi.resetModules();
});

const DESCRIPTOR = { familyId: 'sql', targetId: 'postgres', version: '1.0.0', create: () => ({}) };

const DEST_HASH = 'd'.repeat(64);
const MARKER_HASH = 'a'.repeat(64);
const CONNECTION = 'postgres://user:secret@localhost:5432/appdb';
const TOKEN = 'appdb';

let projectDir: string;
const projectDirs: string[] = [];

beforeEach(() => {
  projectDir = mkdtempSync(join(tmpdir(), 'orm-db-update-consent-'));
  projectDirs.push(projectDir);
  writeFileSync(
    join(projectDir, 'contract.json'),
    JSON.stringify({ storage: { storageHash: MARKER_HASH } }),
  );
  writeFileSync(join(projectDir, 'contract.d.ts'), 'export type Contract = never;\n');
  mocks.connect.mockReset().mockResolvedValue(undefined);
  mocks.close.mockReset().mockResolvedValue(undefined);
  mocks.dbUpdate.mockReset().mockImplementation(refuseUntilAccepted());
});

function ormConfig(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    family: {
      kind: 'family',
      id: 'sql',
      familyId: 'sql',
      version: '1.0.0',
      emission: {},
      create: () => ({}),
    },
    target: { ...DESCRIPTOR, kind: 'target', id: 'postgres', migrations: {} },
    adapter: { ...DESCRIPTOR, kind: 'adapter', id: 'pg' },
    driver: { ...DESCRIPTOR, kind: 'driver', id: 'pg-driver' },
    db: { connection: CONNECTION },
    contract: {
      source: { format: 'typescript', inputs: [], load: async () => ({}) },
      output: join(projectDir, 'contract.json'),
    },
    ...overrides,
  };
}

function applySuccess(): Record<string, unknown> {
  return {
    mode: 'apply',
    destination: { storageHash: DEST_HASH },
    plan: {
      operations: [{ id: 'op-2', label: 'drop relation legacy', operationClass: 'destructive' }],
    },
    execution: { operationsPlanned: 1, operationsExecuted: 1 },
    marker: { storageHash: MARKER_HASH },
    perSpace: [
      {
        spaceId: 'app',
        kind: 'app',
        operations: [{ id: 'op-2', label: 'drop relation legacy', operationClass: 'destructive' }],
        marker: { storageHash: MARKER_HASH },
      },
    ],
    summary: 'Database updated',
  };
}

function destructiveRefusal(): Record<string, unknown> {
  return {
    code: 'DESTRUCTIVE_CHANGES',
    summary: 'Planned 1 destructive operation(s) that require confirmation',
    why: 'Destructive operations require confirmation',
    conflicts: undefined,
    meta: { destructiveOperations: [{ id: 'op-2', label: 'drop relation legacy' }] },
  };
}

/**
 * The control API's own shape: an apply without `acceptDataLoss` refuses when
 * the plan carries destructive operations, and the same call with it applies.
 */
function refuseUntilAccepted() {
  return (options: { readonly acceptDataLoss?: boolean }) =>
    Promise.resolve(
      options.acceptDataLoss === true ? ok(applySuccess()) : notOk(destructiveRefusal()),
    );
}

function harness(config: Record<string, unknown> = ormConfig()) {
  return createTestCli({ commands, groups, config: { orm: config } });
}

function envelopeOf(json: readonly StreamEvent[]): unknown {
  const terminal = json.at(-1);
  return terminal?.kind === 'result' ? terminal.envelope : undefined;
}

function applyCalls(): readonly { readonly acceptDataLoss?: boolean }[] {
  return mocks.dbUpdate.mock.calls.map((call) => call[0]);
}

describe('db update consent', () => {
  describe('interactively', () => {
    it('applies the destructive plan once the database name is typed', async () => {
      const run = await harness().run(['db', 'update', '--json'], {
        cwd: projectDir,
        isTty: { stdin: true },
        answers: [TOKEN],
      });

      expect(run.exitCode).toBe(0);
      expect(envelopeOf(run.json)).toMatchObject({ ok: true, result: { mode: 'apply' } });
      expect(mocks.connect).toHaveBeenCalledTimes(1);
      expect(applyCalls().map((call) => call.acceptDataLoss)).toEqual([undefined, true]);
    });

    it('names the database and every destructive operation in the question', async () => {
      const run = await harness().run(['db', 'update'], {
        cwd: projectDir,
        isTty: { stdin: true, stdout: true, stderr: true },
        answers: [TOKEN],
      });

      expect(run.stderr).toContain('drop relation legacy');
      expect(run.stderr).toContain('appdb');
    });

    it('applies nothing when the answer is not the database name', async () => {
      const run = await harness().run(['db', 'update', '--json'], {
        cwd: projectDir,
        isTty: { stdin: true },
        answers: ['no'],
      });

      expect(run.exitCode).toBe(2);
      expect(envelopeOf(run.json)).toMatchObject({
        ok: false,
        error: { code: 'CLI.PROMPT_INVALID' },
      });
      expect(applyCalls()).toHaveLength(1);
    });

    it('exits 3 when the prompt is cancelled', async () => {
      const run = await harness().run(['db', 'update', '--json'], {
        cwd: projectDir,
        isTty: { stdin: true },
        stdin: '',
      });

      expect(run.exitCode).toBe(3);
      expect(envelopeOf(run.json)).toMatchObject({
        ok: false,
        error: { code: 'CLI.PROMPT_CANCELLED' },
      });
      expect(applyCalls()).toHaveLength(1);
    });
  });

  describe('non-interactively', () => {
    it('refuses without --confirm, naming the token to pass', async () => {
      const run = await harness().run(['db', 'update', '--json'], { cwd: projectDir });

      expect(run.exitCode).toBe(2);
      expect(envelopeOf(run.json)).toMatchObject({
        ok: false,
        error: { code: 'CLI.CONSENT_REQUIRED', meta: { consentToken: TOKEN } },
      });
      expect(applyCalls()).toHaveLength(1);
    });

    it('applies when --confirm carries the database name', async () => {
      const run = await harness().run(['db', 'update', '--confirm', TOKEN, '--json'], {
        cwd: projectDir,
      });

      expect(run.exitCode).toBe(0);
      expect(envelopeOf(run.json)).toMatchObject({ ok: true, result: { mode: 'apply' } });
      expect(applyCalls().map((call) => call.acceptDataLoss)).toEqual([undefined, true]);
    });

    it('refuses when --confirm carries another name', async () => {
      const run = await harness().run(['db', 'update', '--confirm', 'otherdb', '--json'], {
        cwd: projectDir,
      });

      expect(run.exitCode).toBe(2);
      expect(envelopeOf(run.json)).toMatchObject({
        ok: false,
        error: { code: 'CLI.CONSENT_REQUIRED' },
      });
      expect(applyCalls()).toHaveLength(1);
    });
  });

  describe('--yes', () => {
    it('does not accept data loss on its own', async () => {
      const run = await harness().run(['db', 'update', '--yes', '--json'], {
        cwd: projectDir,
        isTty: { stdin: true },
      });

      expect(run.exitCode).toBe(2);
      expect(envelopeOf(run.json)).toMatchObject({
        ok: false,
        error: { code: 'CLI.CONSENT_REQUIRED' },
      });
      expect(applyCalls()).toHaveLength(1);
    });

    it('does not stop --confirm from granting', async () => {
      const run = await harness().run(['db', 'update', '--yes', '--confirm', TOKEN, '--json'], {
        cwd: projectDir,
      });

      expect(run.exitCode).toBe(0);
      expect(applyCalls().map((call) => call.acceptDataLoss)).toEqual([undefined, true]);
    });
  });

  describe('the consent token', () => {
    it('follows --db rather than the configured connection', async () => {
      const run = await harness().run(
        ['db', 'update', '--db', 'postgres://host/otherdb', '--json'],
        {
          cwd: projectDir,
        },
      );

      expect(envelopeOf(run.json)).toMatchObject({
        ok: false,
        error: { meta: { consentToken: 'otherdb' } },
      });
    });

    it('falls back to the target id when the URL carries no database name', async () => {
      const run = await harness(ormConfig({ db: { connection: 'postgres://localhost:5432' } })).run(
        ['db', 'update', '--json'],
        { cwd: projectDir },
      );

      expect(envelopeOf(run.json)).toMatchObject({
        ok: false,
        error: { meta: { consentToken: 'postgres' } },
      });
    });

    it('falls back to the target id when the connection is not a URL', async () => {
      const run = await harness(
        ormConfig({ db: { connection: { host: 'localhost', database: 'ignored' } } }),
      ).run(['db', 'update', '--json'], { cwd: projectDir });

      expect(envelopeOf(run.json)).toMatchObject({
        ok: false,
        error: { meta: { consentToken: 'postgres' } },
      });
    });
  });

  describe('when nothing destructive is planned', () => {
    beforeEach(() => {
      mocks.dbUpdate.mockReset().mockResolvedValue(ok(applySuccess()));
    });

    it('applies without asking, even non-interactively', async () => {
      const run = await harness().run(['db', 'update', '--json'], { cwd: projectDir });

      expect(run.exitCode).toBe(0);
      expect(applyCalls()).toHaveLength(1);
      expect(applyCalls()[0]?.acceptDataLoss).toBeUndefined();
      expect(run.stderr).not.toContain('confirm');
    });

    it('plans without asking under --dry-run', async () => {
      const run = await harness().run(['db', 'update', '--dry-run', '--json'], { cwd: projectDir });

      expect(run.exitCode).toBe(0);
      expect(mocks.dbUpdate).toHaveBeenCalledWith(expect.objectContaining({ mode: 'plan' }));
      expect(applyCalls()).toHaveLength(1);
    });
  });
});
