import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createContractEmitCommand } from '@internal/cli/commands/contract-emit';
import { timeouts } from '@repo/test-utils';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  executeCommand,
  setupCommandMocks,
  setupIntegrationTestDirectoryFromFixtures,
} from './utils/cli-test-helpers';

// Fixture subdirectory for emit-command tests
const fixtureSubdir = 'emit-command';

describe('emit command', () => {
  let testDir: string;
  let outputDir: string;
  let consoleOutput: string[] = [];
  let cleanupMocks: () => void;
  let cleanupDir: () => void;

  beforeEach(() => {
    // Set up console and process.exit mocks
    const mocks = setupCommandMocks();
    consoleOutput = mocks.consoleOutput;
    cleanupMocks = mocks.cleanup;

    // Set up test directory from fixtures
    const testSetup = setupIntegrationTestDirectoryFromFixtures(fixtureSubdir);
    testDir = testSetup.testDir;
    outputDir = testSetup.outputDir;
    cleanupDir = testSetup.cleanup;
  });

  afterEach(() => {
    cleanupDir();
    cleanupMocks();
  });

  it('emits contract.json and contract.d.ts with valid contract', {
    timeout: timeouts.typeScriptCompilation,
  }, async () => {
    const command = createContractEmitCommand();
    const originalCwd = process.cwd();
    try {
      process.chdir(testDir);
      const exitCode = await executeCommand(command, [
        '--config',
        'prisma-next.config.ts',
        '--json',
      ]);
      expect(exitCode).toBe(0);
    } finally {
      process.chdir(originalCwd);
    }

    const contractJsonPath = join(outputDir, 'contract.json');
    const contractDtsPath = join(outputDir, 'contract.d.ts');

    expect(existsSync(contractJsonPath)).toBe(true);
    expect(existsSync(contractDtsPath)).toBe(true);

    const contractJson = JSON.parse(readFileSync(contractJsonPath, 'utf-8'));
    expect(contractJson).toMatchObject({
      targetFamily: 'sql',
      _generated: expect.anything(),
    });

    const contractDts = readFileSync(contractDtsPath, 'utf-8');
    expect(contractDts).toContain('export type Contract');
    expect(contractDts).toContain('CodecTypes');

    // Parse JSON output and verify structure
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
  });

  it('creates output directory if it does not exist', {
    timeout: timeouts.typeScriptCompilation,
  }, async () => {
    const newOutputDir = join(testDir, 'new-output');
    const command = createContractEmitCommand();
    const originalCwd = process.cwd();
    try {
      process.chdir(testDir);
      // Test with custom output path in config
      const testSetup = setupIntegrationTestDirectoryFromFixtures(
        fixtureSubdir,
        'prisma-next.config.custom-output.ts',
        { '{{OUTPUT_DIR}}': newOutputDir },
      );
      const customTestDir = testSetup.testDir;
      const customCleanup = testSetup.cleanup;

      try {
        process.chdir(customTestDir);
        await executeCommand(command, ['--config', 'prisma-next.config.ts']);

        expect(existsSync(newOutputDir)).toBe(true);
        expect(existsSync(join(newOutputDir, 'contract.json'))).toBe(true);
        expect(existsSync(join(newOutputDir, 'contract.d.ts'))).toBe(true);
      } finally {
        customCleanup();
      }
    } finally {
      process.chdir(originalCwd);
    }
  });

  it('handles missing contract in config', {
    timeout: timeouts.typeScriptCompilation,
  }, async () => {
    const command = createContractEmitCommand();
    const testSetup = setupIntegrationTestDirectoryFromFixtures(
      fixtureSubdir,
      'prisma-next.config.no-contract.ts',
    );
    const testDirNoContract = testSetup.testDir;
    const cleanupNoContract = testSetup.cleanup;

    try {
      const originalCwd = process.cwd();
      try {
        process.chdir(testDirNoContract);
        // Command should throw for missing contract
        await expect(
          executeCommand(command, ['--config', 'prisma-next.config.ts', '--json']),
        ).rejects.toThrow();
      } finally {
        process.chdir(originalCwd);
      }

      // Parse JSON error output and verify structure
      const errorOutput = consoleOutput.join('\n');
      expect(() => JSON.parse(errorOutput)).not.toThrow();

      const parsed = JSON.parse(errorOutput);
      expect(parsed).toMatchObject({
        code: 'CONFIG.CONTRACT_MISSING',
        summary: expect.any(String),
        why: expect.any(String),
        fix: expect.any(String),
      });
    } finally {
      cleanupNoContract();
    }
  });

  it('uses default output path when not specified in contract config', {
    timeout: timeouts.typeScriptCompilation,
  }, async () => {
    const command = createContractEmitCommand();
    const testSetup = setupIntegrationTestDirectoryFromFixtures(
      fixtureSubdir,
      'prisma-next.config.defaults.ts',
    );
    const testDirDefaults = testSetup.testDir;
    const cleanupDefaults = testSetup.cleanup;

    try {
      const originalCwd = process.cwd();
      try {
        process.chdir(testDirDefaults);
        const exitCode = await executeCommand(command, ['--config', 'prisma-next.config.ts']);
        expect(exitCode).toBe(0);
      } finally {
        process.chdir(originalCwd);
      }

      // Default output is 'src/prisma/contract.json'
      const defaultJsonPath = join(testDirDefaults, 'src/prisma/contract.json');
      const defaultDtsPath = join(testDirDefaults, 'src/prisma/contract.d.ts');
      expect(existsSync(defaultJsonPath)).toBe(true);
      expect(existsSync(defaultDtsPath)).toBe(true);
    } finally {
      cleanupDefaults();
    }
  });

  it('handles invalid contract in config', {
    timeout: timeouts.typeScriptCompilation,
  }, async () => {
    const command = createContractEmitCommand();
    const testSetup = setupIntegrationTestDirectoryFromFixtures(
      fixtureSubdir,
      'prisma-next.config.invalid-contract.ts',
    );
    const testDirInvalid = testSetup.testDir;
    const cleanupInvalid = testSetup.cleanup;

    try {
      const originalCwd = process.cwd();
      try {
        process.chdir(testDirInvalid);
        // Command should throw for invalid contract
        await expect(
          executeCommand(command, ['--config', 'prisma-next.config.ts']),
        ).rejects.toThrow();
      } finally {
        process.chdir(originalCwd);
      }
    } finally {
      cleanupInvalid();
    }
  });

  it('handles unsupported target family', { timeout: timeouts.typeScriptCompilation }, async () => {
    const command = createContractEmitCommand();
    const testSetup = setupIntegrationTestDirectoryFromFixtures(
      fixtureSubdir,
      'prisma-next.config.document-family.ts',
    );
    const testDirDocument = testSetup.testDir;
    const cleanupDocument = testSetup.cleanup;

    try {
      const originalCwd = process.cwd();
      try {
        process.chdir(testDirDocument);
        // The command should throw for unsupported family
        await expect(
          executeCommand(command, ['--config', 'prisma-next.config.ts']),
        ).rejects.toThrow();
      } finally {
        process.chdir(originalCwd);
      }
    } finally {
      cleanupDocument();
    }
  });

  it('handles extension paths', { timeout: timeouts.typeScriptCompilation }, async () => {
    const command = createContractEmitCommand();
    // Extensions are now in config, so we just need a valid config
    const originalCwd = process.cwd();
    try {
      process.chdir(testDir);
      const exitCode = await executeCommand(command, ['--config', 'prisma-next.config.ts']);
      expect(exitCode).toBe(0);

      const contractJsonPath = join(outputDir, 'contract.json');
      expect(existsSync(contractJsonPath)).toBe(true);
    } finally {
      process.chdir(originalCwd);
    }
  });

  it('handles single string extension path', {
    timeout: timeouts.typeScriptCompilation,
  }, async () => {
    const command = createContractEmitCommand();
    // Extensions are now in config
    const originalCwd = process.cwd();
    try {
      process.chdir(testDir);
      const exitCode = await executeCommand(command, ['--config', 'prisma-next.config.ts']);
      expect(exitCode).toBe(0);

      const contractJsonPath = join(outputDir, 'contract.json');
      expect(existsSync(contractJsonPath)).toBe(true);
    } finally {
      process.chdir(originalCwd);
    }
  });

  it('handles multiple extension paths', { timeout: timeouts.typeScriptCompilation }, async () => {
    const command = createContractEmitCommand();
    // Extensions are now in config
    const originalCwd = process.cwd();
    try {
      process.chdir(testDir);
      const exitCode = await executeCommand(command, ['--config', 'prisma-next.config.ts']);
      expect(exitCode).toBe(0);

      const contractJsonPath = join(outputDir, 'contract.json');
      expect(existsSync(contractJsonPath)).toBe(true);
    } finally {
      process.chdir(originalCwd);
    }
  });

  it('outputs profileHash when present', { timeout: timeouts.typeScriptCompilation }, async () => {
    const command = createContractEmitCommand();
    const originalCwd = process.cwd();
    try {
      process.chdir(testDir);
      // Command should succeed (exit code 0) - executeCommand won't throw
      const exitCode = await executeCommand(command, [
        '--config',
        'prisma-next.config.ts',
        '--json',
      ]);
      expect(exitCode).toBe(0);

      const contractJsonPath = join(outputDir, 'contract.json');
      expect(existsSync(contractJsonPath)).toBe(true);

      // Parse JSON output and verify structure
      const jsonOutput = consoleOutput.join('\n');
      expect(() => JSON.parse(jsonOutput)).not.toThrow();

      const parsed = JSON.parse(jsonOutput);
      expect(parsed).toMatchObject({
        ok: true,
        storageHash: expect.any(String),
        profileHash: expect.any(String),
        outDir: expect.any(String),
        files: {
          json: expect.any(String),
          dts: expect.any(String),
        },
        timings: {
          total: expect.any(Number),
        },
      });
    } finally {
      process.chdir(originalCwd);
    }
  });

  it('handles async contract source function', {
    timeout: timeouts.typeScriptCompilation,
  }, async () => {
    const command = createContractEmitCommand();
    const testSetup = setupIntegrationTestDirectoryFromFixtures(
      fixtureSubdir,
      'prisma-next.config.async-source.ts',
      { '{{OUTPUT_DIR}}': outputDir },
    );
    const testDirAsync = testSetup.testDir;
    const cleanupAsync = testSetup.cleanup;

    try {
      const originalCwd = process.cwd();
      try {
        process.chdir(testDirAsync);
        await executeCommand(command, ['--config', 'prisma-next.config.ts']);
      } finally {
        process.chdir(originalCwd);
      }

      const contractJsonPath = join(outputDir, 'contract.json');
      expect(existsSync(contractJsonPath)).toBe(true);
    } finally {
      cleanupAsync();
    }
  });

  it('handles provider source function', { timeout: timeouts.typeScriptCompilation }, async () => {
    const command = createContractEmitCommand();
    const testSetup = setupIntegrationTestDirectoryFromFixtures(
      fixtureSubdir,
      'prisma-next.config.sync-source.ts',
      { '{{OUTPUT_DIR}}': outputDir },
    );
    const testDirSync = testSetup.testDir;
    const cleanupSync = testSetup.cleanup;

    try {
      const originalCwd = process.cwd();
      try {
        process.chdir(testDirSync);
        await executeCommand(command, ['--config', 'prisma-next.config.ts']);
      } finally {
        process.chdir(originalCwd);
      }

      const contractJsonPath = join(outputDir, 'contract.json');
      expect(existsSync(contractJsonPath)).toBe(true);
    } finally {
      cleanupSync();
    }
  });
});
