import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createContractEmitCommand } from '@internal/cli/commands/contract-emit';
import { timeouts } from '@repo/test-utils';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  executeCommand,
  getExitCode,
  setupCommandMocks,
  setupTestDirectoryFromFixtures,
  withTempDir,
} from './utils/cli-test-helpers';

// Fixture subdirectory for emit tests
const fixtureSubdir = 'emit';

withTempDir(({ createTempDir }) => {
  describe('contract emit command (e2e)', () => {
    let consoleOutput: string[] = [];
    let cleanupMocks: () => void;

    beforeEach(() => {
      // Set up console and process.exit mocks
      const mocks = setupCommandMocks();
      consoleOutput = mocks.consoleOutput;
      cleanupMocks = mocks.cleanup;
    });

    afterEach(() => {
      cleanupMocks();
    });

    it(
      'emits contract.json and contract.d.ts with canonical command',
      async () => {
        // Set up test directory from fixtures
        const testSetup = setupTestDirectoryFromFixtures(
          createTempDir,
          fixtureSubdir,
          'prisma-next.config.emit.ts',
        );
        const testDir = testSetup.testDir;
        const outputDir = testSetup.outputDir;

        const command = createContractEmitCommand();
        const originalCwd = process.cwd();
        try {
          process.chdir(testDir);
          // executeCommand doesn't throw for exit code 0, so if it completes, we know it succeeded
          await executeCommand(command, ['--config', 'prisma-next.config.ts', '--json']);
        } finally {
          process.chdir(originalCwd);
        }

        // Check exit code is 0 (success)
        const exitCode = getExitCode();
        expect(exitCode).toBe(0);

        // Parse and verify JSON output
        const jsonOutput = consoleOutput.join('\n');
        expect(() => JSON.parse(jsonOutput)).not.toThrow();

        const parsed = JSON.parse(jsonOutput);
        expect(parsed).toMatchObject({
          ok: true,
          storageHash: expect.any(String),
          outDir: expect.any(String),
          files: {
            json: expect.any(String),
            dts: expect.any(String),
          },
          timings: {
            total: expect.any(Number),
          },
        });

        // Verify files were actually created
        const contractJsonPath = join(outputDir, 'contract.json');
        const contractDtsPath = join(outputDir, 'contract.d.ts');

        expect(existsSync(contractJsonPath)).toBe(true);
        expect(existsSync(contractDtsPath)).toBe(true);

        // Verify contract.json content
        const contractJson = JSON.parse(readFileSync(contractJsonPath, 'utf-8'));
        expect(contractJson).toMatchObject({
          targetFamily: 'sql',
          _generated: expect.anything(),
        });

        // Verify contract.d.ts content
        const contractDts = readFileSync(contractDtsPath, 'utf-8');
        expect(contractDts).toContain('export type Contract');
        expect(contractDts).toContain('CodecTypes');

        // Verify temporary publication artifacts were cleaned up
        expect(readdirSync(outputDir).filter((entry) => entry.endsWith('.tmp'))).toEqual([]);

        // Verify JSON output matches actual files
        expect(parsed.files.json).toBe(contractJsonPath);
        expect(parsed.files.dts).toBe(contractDtsPath);
        expect(parsed.storageHash).toBe(contractJson.storage.storageHash);
      },
      timeouts.typeScriptCompilation,
    );

    it(
      'outputs JSON when --json flag is provided',
      async () => {
        // Set up test directory from fixtures
        const testSetup = setupTestDirectoryFromFixtures(
          createTempDir,
          fixtureSubdir,
          'prisma-next.config.emit.ts',
        );
        const testDir = testSetup.testDir;

        const command = createContractEmitCommand();
        const originalCwd = process.cwd();
        try {
          process.chdir(testDir);
          await executeCommand(command, ['--config', 'prisma-next.config.ts', '--json']);
        } finally {
          process.chdir(originalCwd);
        }

        // Check exit code is 0 (success)
        const exitCode = getExitCode();
        expect(exitCode).toBe(0);

        // Check that output is valid JSON
        const jsonOutput = consoleOutput.join('\n');
        expect(() => JSON.parse(jsonOutput)).not.toThrow();

        const parsed = JSON.parse(jsonOutput);
        expect(parsed).toMatchObject({
          ok: true,
          storageHash: expect.any(String),
          outDir: expect.any(String),
          files: {
            json: expect.any(String),
            dts: expect.any(String),
          },
          timings: {
            total: expect.any(Number),
          },
        });
      },
      timeouts.typeScriptCompilation,
    );

    it(
      'throws error with CONFIG.FILE_NOT_FOUND code when config file is missing',
      async () => {
        // Set up test directory from fixtures (but we'll use a non-existent config)
        const testSetup = setupTestDirectoryFromFixtures(
          createTempDir,
          fixtureSubdir,
          'prisma-next.config.emit.ts',
        );
        const testDir = testSetup.testDir;

        const command = createContractEmitCommand();
        const originalCwd = process.cwd();
        try {
          process.chdir(testDir);
          // Commands don't throw - they call process.exit() with non-zero exit code
          // executeCommand will catch the process.exit error and re-throw for non-zero codes
          await expect(
            executeCommand(command, ['--config', 'nonexistent.config.ts', '--json']),
          ).rejects.toThrow('process.exit called');
        } finally {
          process.chdir(originalCwd);
        }

        // Check exit code is non-zero (error)
        const exitCode = getExitCode();
        expect(exitCode).not.toBe(0);
        expect(exitCode).toBe(2); // Config errors should have exit code 2

        // Parse and verify JSON error output
        const errorOutput = consoleOutput.join('\n');
        expect(() => JSON.parse(errorOutput)).not.toThrow();

        const parsed = JSON.parse(errorOutput);
        expect(parsed).toMatchObject({
          code: 'CONFIG.FILE_NOT_FOUND',
          summary: expect.any(String),
          why: expect.any(String),
          fix: expect.any(String),
        });
      },
      timeouts.typeScriptCompilation,
    );

    it(
      'throws error with CONFIG.CONTRACT_MISSING code when contract config is missing',
      async () => {
        // Set up test directory from fixtures with no-contract config
        const testSetup = setupTestDirectoryFromFixtures(
          createTempDir,
          fixtureSubdir,
          'prisma-next.config.no-contract.ts',
        );
        const testDir = testSetup.testDir;

        const command = createContractEmitCommand();
        const originalCwd = process.cwd();
        try {
          process.chdir(testDir);
          // Commands don't throw - they call process.exit() with non-zero exit code
          // executeCommand will catch the process.exit error and re-throw for non-zero codes
          await expect(
            executeCommand(command, ['--config', 'prisma-next.config.ts', '--json']),
          ).rejects.toThrow('process.exit called');
        } finally {
          process.chdir(originalCwd);
        }

        // Check exit code is non-zero (error)
        const exitCode = getExitCode();
        expect(exitCode).not.toBe(0);

        // Parse and verify JSON error output
        const errorOutput = consoleOutput.join('\n');
        expect(() => JSON.parse(errorOutput)).not.toThrow();

        const parsed = JSON.parse(errorOutput);
        expect(parsed).toMatchObject({
          code: 'CONFIG.CONTRACT_MISSING',
          summary: expect.any(String),
          why: expect.any(String),
          fix: expect.any(String),
        });
      },
      timeouts.spinUpPpgDev,
    );

    it(
      'outputs timings in verbose mode',
      async () => {
        // Set up test directory from fixtures
        const testSetup = setupTestDirectoryFromFixtures(
          createTempDir,
          fixtureSubdir,
          'prisma-next.config.emit.ts',
        );
        const testDir = testSetup.testDir;

        const command = createContractEmitCommand();
        const originalCwd = process.cwd();
        try {
          process.chdir(testDir);
          await executeCommand(command, ['--config', 'prisma-next.config.ts', '--verbose']);
        } finally {
          process.chdir(originalCwd);
        }

        // Check exit code is 0 (success)
        const exitCode = getExitCode();
        expect(exitCode).toBe(0);

        // Check that output includes timing information
        const output = consoleOutput.join('\n');
        expect(output).toContain('Total time');
      },
      timeouts.typeScriptCompilation,
    );

    it(
      'suppresses output in quiet mode',
      async () => {
        // Set up test directory from fixtures
        const testSetup = setupTestDirectoryFromFixtures(
          createTempDir,
          fixtureSubdir,
          'prisma-next.config.emit.ts',
        );
        const testDir = testSetup.testDir;

        const command = createContractEmitCommand();
        const originalCwd = process.cwd();
        try {
          process.chdir(testDir);
          await executeCommand(command, ['--config', 'prisma-next.config.ts', '--quiet']);
        } finally {
          process.chdir(originalCwd);
        }

        // Check exit code is 0 (success)
        const exitCode = getExitCode();
        expect(exitCode).toBe(0);

        // In quiet mode, only errors should be output
        // Since this is a success case, consoleOutput should be empty or minimal
        const output = consoleOutput.join('\n');
        expect(output).toBe('');
      },
      timeouts.typeScriptCompilation,
    );
  });
});
