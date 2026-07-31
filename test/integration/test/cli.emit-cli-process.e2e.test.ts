import { execFile } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { loadContractFromTs } from '@internal/cli';
import type { Contract, StorageHashBase } from '@internal/contract/types';
import type { SqlStorage } from '@internal/sql-contract/types';
import { PostgresContractSerializer } from '@internal/target-postgres/runtime';
import { timeouts } from '@repo/test-utils';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setupIntegrationTestDirectoryFromFixtures } from './utils/cli-test-helpers';

const __dirname = dirname(fileURLToPath(import.meta.url));
const execFileAsync = promisify(execFile);

// Fixture subdirectory for emit-command tests
const fixtureSubdir = 'emit-command';

type EmittedContract = Contract<{
  readonly storageHash: StorageHashBase<string>;
  readonly namespaces: {
    readonly public: {
      readonly id: 'public';
      readonly kind: 'postgres-schema';
      readonly entries: {
        readonly table: {
          readonly user: {
            readonly columns: {
              readonly id: {
                readonly nativeType: 'int4';
                readonly codecId: 'pg/int4@1';
                readonly nullable: false;
              };
              readonly email: {
                readonly nativeType: 'text';
                readonly codecId: 'pg/text@1';
                readonly nullable: false;
              };
            };
            readonly primaryKey: { readonly columns: readonly ['id'] };
            readonly uniques: readonly [];
            readonly indexes: readonly [];
            readonly foreignKeys: readonly [];
          };
        };
      };
    };
  };
}>;

describe('contract emit command (CLI process e2e)', () => {
  let testDir: string;
  let contractPath: string;
  let outputDir: string;
  let cleanupDir: () => void;

  beforeEach(() => {
    // Set up test directory from fixtures
    const testSetup = setupIntegrationTestDirectoryFromFixtures(fixtureSubdir);
    testDir = testSetup.testDir;
    contractPath = testSetup.contractPath;
    outputDir = testSetup.outputDir;
    cleanupDir = testSetup.cleanup;
  });

  afterEach(() => {
    cleanupDir();
  });

  it(
    'executes CLI as separate process to emit contract and verifies artifacts',
    async () => {
      const cliPath = resolve(__dirname, '../../../packages/1-framework/3-tooling/cli/dist/cli.js');

      try {
        // Set cwd for spawned process so relative paths in config resolve correctly
        await execFileAsync(
          'node',
          [cliPath, 'contract', 'emit', '--config', 'prisma-next.config.ts'],
          {
            cwd: testDir, // Set working directory for spawned process
          },
        );
      } catch (error: unknown) {
        // Only log output on errors for debugging
        if (error && typeof error === 'object' && 'stderr' in error) {
          console.error('CLI stderr:', error.stderr);
        }
        if (error && typeof error === 'object' && 'stdout' in error) {
          console.log('CLI stdout:', error.stdout);
        }
        throw error;
      }

      const contractJsonPath = join(outputDir, 'contract.json');
      const contractDtsPath = join(outputDir, 'contract.d.ts');

      expect(existsSync(contractJsonPath)).toBe(true);
      expect(existsSync(contractDtsPath)).toBe(true);

      const contractJsonContent = readFileSync(contractJsonPath, 'utf-8');
      const contractDtsContent = readFileSync(contractDtsPath, 'utf-8');

      const contractJson = JSON.parse(contractJsonContent);
      expect(contractJson).toMatchObject({
        targetFamily: 'sql',
        target: 'postgres',
        storage: {
          namespaces: {
            public: {
              entries: {
                table: {
                  user: expect.anything(),
                },
              },
            },
          },
        },
      });

      expect(contractDtsContent).toContain('export type Contract');
      expect(contractDtsContent).toContain('CodecTypes');

      const validatedContract = new PostgresContractSerializer().deserializeContract(
        contractJson,
      ) as EmittedContract;
      expect(validatedContract.targetFamily).toBe('sql');
      expect(validatedContract.target).toBe('postgres');
    },
    timeouts.spinUpPpgDev,
  );

  it(
    'round-trip test: TS contract → CLI emit → parse JSON → compare with loaded TS contract',
    async () => {
      // loadContractFromTs can resolve packages because testDir is within the fixture app
      const originalContract = await loadContractFromTs(contractPath);

      const cliPath = resolve(__dirname, '../../../packages/1-framework/3-tooling/cli/dist/cli.js');

      try {
        // Set cwd for spawned process so relative paths in config resolve correctly
        await execFileAsync(
          'node',
          [cliPath, 'contract', 'emit', '--config', 'prisma-next.config.ts'],
          {
            cwd: testDir, // Set working directory for spawned process
          },
        );
      } catch (error: unknown) {
        // Only log output on errors for debugging
        if (error && typeof error === 'object' && 'stderr' in error) {
          console.error('CLI stderr:', error.stderr);
        }
        if (error && typeof error === 'object' && 'stdout' in error) {
          console.log('CLI stdout:', error.stdout);
        }
        throw error;
      }

      const contractJsonPath = join(outputDir, 'contract.json');
      const contractJsonContent = readFileSync(contractJsonPath, 'utf-8');
      const contractJson = JSON.parse(contractJsonContent) as Record<string, unknown>;

      const validatedContract = new PostgresContractSerializer().deserializeContract(
        contractJson,
      ) as EmittedContract;

      expect(validatedContract.targetFamily).toBe(originalContract.targetFamily);
      expect(validatedContract.target).toBe(originalContract.target);
      const tables = (validatedContract.storage as SqlStorage).namespaces['public']?.entries[
        'table'
      ] as Record<string, unknown> | undefined;
      const originalTables = (originalContract.storage as SqlStorage | undefined)?.namespaces[
        'public'
      ]?.entries['table'] as Record<string, unknown> | undefined;
      const userTable = tables?.['user'] as Record<string, unknown> | undefined;
      const originalUserTable = originalTables?.['user'] as Record<string, unknown> | undefined;
      expect(userTable).toBeDefined();
      expect(originalUserTable).toBeDefined();
      const columns = userTable?.['columns'] as
        | Record<string, { nativeType?: string; codecId?: string }>
        | undefined;
      const originalColumns = originalUserTable?.['columns'] as
        | Record<string, { nativeType?: string; codecId?: string }>
        | undefined;
      expect(columns).toBeDefined();
      expect(originalColumns).toBeDefined();
      expect(columns?.['id']?.codecId).toBe(originalColumns?.['id']?.codecId);
      expect(columns?.['email']?.codecId).toBe(originalColumns?.['email']?.codecId);
      expect(columns?.['id']?.nativeType).toBe(originalColumns?.['id']?.nativeType);
      expect(columns?.['email']?.nativeType).toBe(originalColumns?.['email']?.nativeType);
    },
    timeouts.spinUpPpgDev,
  );
});
