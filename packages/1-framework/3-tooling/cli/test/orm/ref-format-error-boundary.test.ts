import { CliStructuredError } from '@internal/errors/control';
import type { ErroredEnvelope, MountedTree, StreamEvent } from '@prisma/cli-engine';
import { createTestCli } from '@prisma/cli-engine/testing';
import { timeouts } from '@repo/test-utils';
import type { Mock } from 'vitest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BIN_GROUPS as BinGroups } from '../../src/orm/cli';

const mocks = vi.hoisted(() => ({
  executeFormat: vi.fn(),
  executeRefDeleteCommand: vi.fn(),
  executeRefListCommand: vi.fn(),
  executeRefSetCommand: vi.fn(),
}));

vi.mock('../../src/control-api/operations/format', () => ({
  executeFormat: mocks.executeFormat,
}));

vi.mock('../../src/control-api/operations/ref', () => ({
  executeRefDeleteCommand: mocks.executeRefDeleteCommand,
  executeRefListCommand: mocks.executeRefListCommand,
  executeRefSetCommand: mocks.executeRefSetCommand,
}));

/**
 * The command tree is imported after the module registry is reset, so the
 * mocked operations are the ones these commands close over. Repo-wide vitest
 * runs with `isolate: false`, and another file that loaded the command tree
 * first would otherwise have baked the real operations into it.
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
  // The `vi.mock` leaks into the next file in the same worker; unmock and
  // reset so the next file loads the real operations.
  vi.doUnmock('../../src/control-api/operations/format');
  vi.doUnmock('../../src/control-api/operations/ref');
  vi.resetModules();
});

beforeEach(() => {
  for (const operation of Object.values(mocks)) {
    operation.mockReset();
  }
});

const DESCRIPTOR = {
  familyId: 'sql',
  targetId: 'postgres',
  version: '1.0.0',
  create: () => ({}),
};

function harness() {
  return createTestCli({
    commands,
    groups,
    config: {
      orm: {
        family: {
          kind: 'family',
          id: 'sql',
          familyId: 'sql',
          version: '1.0.0',
          emission: {},
          create: () => ({}),
        },
        target: { ...DESCRIPTOR, kind: 'target', id: 'postgres' },
        adapter: { ...DESCRIPTOR, kind: 'adapter', id: 'pg' },
      },
    },
  });
}

function erroredEnvelope(run: { readonly json: readonly StreamEvent[] }): ErroredEnvelope {
  const terminal = run.json.at(-1);
  if (terminal === undefined || terminal.kind !== 'result' || terminal.envelope.ok) {
    throw new Error('the run did not settle as an errored envelope');
  }
  return terminal.envelope;
}

/**
 * A structured error as prisma/prisma raises one: `fix` prose, and no typed
 * next actions. Its class shares a name with the engine's, so the engine's
 * duck test accepts it and settles it through a `toEnvelope` that writes the
 * non-protocol `fix` field — unless the command's own boundary converts it
 * first.
 */
const RAISED_BY_PRISMA = new CliStructuredError(
  'CONFIG.VALIDATION_FAILED',
  'Prisma Next configuration is not usable',
  {
    why: 'contract.source.inputs names a file that does not exist.',
    fix: 'Correct contract.source.inputs in prisma-next.config.ts and re-run',
  },
);

interface BoundaryCase {
  readonly command: string;
  readonly argv: readonly string[];
  readonly operation: Mock;
}

const HASH = `4cb4256${'0'.repeat(57)}`;

const CASES: readonly BoundaryCase[] = [
  { command: 'format', argv: ['format'], operation: mocks.executeFormat },
  {
    command: 'ref delete',
    argv: ['ref', 'delete', 'staging'],
    operation: mocks.executeRefDeleteCommand,
  },
  { command: 'ref list', argv: ['ref', 'list'], operation: mocks.executeRefListCommand },
  {
    command: 'ref set',
    argv: ['ref', 'set', 'staging', HASH],
    operation: mocks.executeRefSetCommand,
  },
];

describe.each(CASES)('$command', ({ argv, operation }) => {
  describe('an operation that throws a prisma/prisma structured error', () => {
    it('settles a protocol envelope carrying typed next actions', async () => {
      operation.mockRejectedValue(RAISED_BY_PRISMA);

      const run = await harness().run([...argv, '--json'], { cwd: process.cwd() });
      const envelope = erroredEnvelope(run);

      expect(run.exitCode).toBe(2);
      expect(envelope.error).toMatchObject({ code: 'CONFIG.VALIDATION_FAILED' });
      expect(envelope.error).not.toHaveProperty('fix');
      expect(envelope.nextActions).toEqual([
        {
          kind: 'user-choice',
          label: 'Correct contract.source.inputs in prisma-next.config.ts and re-run',
        },
      ]);
    });
  });

  describe('an operation that throws a bare Error', () => {
    it('settles CLI.UNEXPECTED at exit 2 rather than an engine bug at exit 1', async () => {
      operation.mockRejectedValue(new Error('connection reset'));

      const run = await harness().run([...argv, '--json'], { cwd: process.cwd() });

      expect(run.exitCode).toBe(2);
      expect(erroredEnvelope(run).error).toMatchObject({
        code: 'CLI.UNEXPECTED',
        summary: 'connection reset',
      });
    });
  });
});
