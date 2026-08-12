/**
 * Every command must declare the config sections it reads, so a malformed
 * section surfaces as a config error instead of leaking into execution as a
 * downstream failure (an unreadable contract, a bad migrations path).
 */
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createDbInitCommand } from '@internal/cli/commands/db-init';
import { createDbSignCommand } from '@internal/cli/commands/db-sign';
import { createDbUpdateCommand } from '@internal/cli/commands/db-update';
import { createDbVerifyCommand } from '@internal/cli/commands/db-verify';
import { createMigrateCommand } from '@internal/cli/commands/migrate';
import { createMigrationCheckCommand } from '@internal/cli/commands/migration-check';
import { createMigrationGraphCommand } from '@internal/cli/commands/migration-graph';
import { createMigrationListCommand } from '@internal/cli/commands/migration-list';
import { createMigrationLogCommand } from '@internal/cli/commands/migration-log';
import { createMigrationStatusCommand } from '@internal/cli/commands/migration-status';
import { timeouts } from '@repo/test-utils';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { executeCommand, setupCommandMocks } from './utils/cli-test-helpers';

type CliCommand = Parameters<typeof executeCommand>[0];

// The temp-dir fixture cannot import @internal/config, so it stamps the
// config-format marker the same way defineConfig does.
function markedConfig(brokenSection: string): string {
  return `
const descriptorBase = { familyId: 'sql', targetId: 'postgres', version: '0.0.1', manifest: {} };
const config = {
  family: { ...descriptorBase, kind: 'family', id: 'sql', emission: {}, create: () => ({}) },
  target: { ...descriptorBase, kind: 'target', id: 'postgres', create: () => ({}) },
  adapter: { ...descriptorBase, kind: 'adapter', id: 'postgres', create: () => ({}) },
  driver: { ...descriptorBase, kind: 'driver', id: 'postgres', create: () => ({}) },
${brokenSection}
};
Object.defineProperty(config, Symbol.for('prisma-next.config-format-version'), {
  value: 1,
  enumerable: false,
});
export default config;
`;
}

let tempDir: string;
let brokenContractConfig: string;
let brokenMigrationsConfig: string;

beforeAll(() => {
  tempDir = realpathSync(mkdtempSync(`${tmpdir()}/cli-config-sections-`));
  brokenContractConfig = `${tempDir}/broken-contract.config.ts`;
  brokenMigrationsConfig = `${tempDir}/broken-migrations.config.ts`;
  writeFileSync(brokenContractConfig, markedConfig('  contract: { source: {} },'));
  writeFileSync(brokenMigrationsConfig, markedConfig("  migrations: 'not-an-object',"));
});

afterAll(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

const readsContract: ReadonlyArray<[string, () => CliCommand, string[]]> = [
  ['migration status', createMigrationStatusCommand, []],
  ['migration list', createMigrationListCommand, []],
  ['migration graph', createMigrationGraphCommand, []],
  ['migration check', createMigrationCheckCommand, []],
  ['migrate', createMigrateCommand, ['--to', 'HEAD']],
  ['db init', createDbInitCommand, []],
  ['db update', createDbUpdateCommand, []],
  ['db sign', createDbSignCommand, []],
  ['db verify', createDbVerifyCommand, []],
];

const readsMigrations: ReadonlyArray<[string, () => CliCommand, string[]]> = [
  ['migration log', createMigrationLogCommand, []],
  ['db init', createDbInitCommand, []],
  ['db update', createDbUpdateCommand, []],
  ['db sign', createDbSignCommand, []],
  ['db verify', createDbVerifyCommand, []],
];

describe('commands declare the config sections they read', () => {
  let consoleOutput: string[] = [];
  let cleanupMocks: () => void;

  beforeEach(() => {
    const mocks = setupCommandMocks({ isTTY: false });
    consoleOutput = mocks.consoleOutput;
    cleanupMocks = mocks.cleanup;
  });

  afterEach(() => {
    cleanupMocks();
  });

  async function envelopeFor(
    create: () => CliCommand,
    configPath: string,
    extraArgs: string[],
  ): Promise<Record<string, unknown>> {
    await executeCommand(create(), [
      '--config',
      configPath,
      '--json',
      '--no-color',
      ...extraArgs,
    ]).catch(() => undefined);
    const json = consoleOutput.find((line) => line.includes('CONFIG.'));
    return JSON.parse(json ?? '{}');
  }

  it.each(readsContract)(
    '%s reports a malformed contract section as a config error',
    async (_name, create, extraArgs) => {
      const envelope = await envelopeFor(create, brokenContractConfig, extraArgs);

      expect(envelope).toMatchObject({
        code: 'CONFIG.VALIDATION_FAILED',
        meta: { section: 'contract' },
      });
    },
    timeouts.typeScriptCompilation,
  );

  it.each(readsMigrations)(
    '%s reports a malformed migrations section as a config error',
    async (_name, create, extraArgs) => {
      const envelope = await envelopeFor(create, brokenMigrationsConfig, extraArgs);

      expect(envelope).toMatchObject({
        code: 'CONFIG.VALIDATION_FAILED',
        meta: { section: 'migrations' },
      });
    },
    timeouts.typeScriptCompilation,
  );
});
