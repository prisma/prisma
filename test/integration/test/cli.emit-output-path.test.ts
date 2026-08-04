import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createContractEmitCommand } from '@internal/cli/commands/contract-emit';
import { timeouts } from '@repo/test-utils';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  executeCommand,
  setupCommandMocks,
  setupTestDirectoryFromFixtures,
  withTempDir,
} from './utils/cli-test-helpers';

const fixtureSubdir = 'emit';

withTempDir(({ createTempDir }) => {
  describe('contract emit: output path (integration)', () => {
    let cleanupMocks: () => void;

    beforeEach(() => {
      const mocks = setupCommandMocks();
      cleanupMocks = mocks.cleanup;
    });

    afterEach(() => {
      cleanupMocks();
    });

    it(
      '--output-path redirects artifacts into the given directory with byte-identical JSON content',
      async () => {
        const originalCwd = process.cwd();

        // Run 1: default output path (config has output: 'output/contract.json')
        const defaultSetup = setupTestDirectoryFromFixtures(
          createTempDir,
          fixtureSubdir,
          'prisma-next.config.emit.ts',
        );
        try {
          process.chdir(defaultSetup.testDir);
          await executeCommand(createContractEmitCommand(), ['--config', 'prisma-next.config.ts']);
        } finally {
          process.chdir(originalCwd);
        }

        const defaultJsonPath = join(defaultSetup.outputDir, 'contract.json');
        const defaultDtsPath = join(defaultSetup.outputDir, 'contract.d.ts');
        expect(existsSync(defaultJsonPath)).toBe(true);
        expect(existsSync(defaultDtsPath)).toBe(true);
        const defaultJsonContent = readFileSync(defaultJsonPath, 'utf-8');
        const defaultDtsContent = readFileSync(defaultDtsPath, 'utf-8');

        // Run 2: --output-path overrides the config's output, writing into a new directory
        const overrideSetup = setupTestDirectoryFromFixtures(
          createTempDir,
          fixtureSubdir,
          'prisma-next.config.emit.ts',
        );
        const customDir = join(overrideSetup.testDir, 'custom-out');
        mkdirSync(customDir, { recursive: true });
        const customJsonPath = join(customDir, 'contract.json');
        const customDtsPath = join(customDir, 'contract.d.ts');

        try {
          process.chdir(overrideSetup.testDir);
          await executeCommand(createContractEmitCommand(), [
            '--config',
            'prisma-next.config.ts',
            '--output-path',
            'custom-out',
          ]);
        } finally {
          process.chdir(originalCwd);
        }

        // Artifacts land inside the override directory with canonical filenames
        expect(existsSync(customJsonPath)).toBe(true);
        expect(existsSync(customDtsPath)).toBe(true);
        // Config's default output directory should not have been written
        expect(existsSync(join(overrideSetup.outputDir, 'contract.json'))).toBe(false);

        // JSON content is byte-identical (same contract, same hash, deterministic emission)
        const overrideJsonContent = readFileSync(customJsonPath, 'utf-8');
        expect(overrideJsonContent).toBe(defaultJsonContent);

        // .d.ts content is byte-identical
        const overrideDtsContent = readFileSync(customDtsPath, 'utf-8');
        expect(overrideDtsContent).toBe(defaultDtsContent);
      },
      timeouts.typeScriptCompilation,
    );

    it(
      'config output field routes artifacts to the configured directory',
      async () => {
        const originalCwd = process.cwd();
        const setup = setupTestDirectoryFromFixtures(
          createTempDir,
          fixtureSubdir,
          'prisma-next.config.emit.ts',
        );

        try {
          process.chdir(setup.testDir);
          await executeCommand(createContractEmitCommand(), ['--config', 'prisma-next.config.ts']);
        } finally {
          process.chdir(originalCwd);
        }

        // The fixture config has output: 'output/contract.json'
        expect(existsSync(join(setup.outputDir, 'contract.json'))).toBe(true);
        expect(existsSync(join(setup.outputDir, 'contract.d.ts'))).toBe(true);
      },
      timeouts.typeScriptCompilation,
    );
  });
});
