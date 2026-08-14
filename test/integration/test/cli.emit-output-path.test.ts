import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { timeouts } from '@repo/test-utils';
import { describe, expect, it } from 'vitest';
import { runOnEngine, setupTestDirectoryFromFixtures, withTempDir } from './utils/cli-test-helpers';

const fixtureSubdir = 'emit';

withTempDir(({ createTempDir }) => {
  describe('contract emit: output path (integration)', () => {
    it(
      '--output-path redirects artifacts into the given directory with byte-identical JSON content',
      async () => {
        // Run 1: default output path (config has output: 'output/contract.json')
        const defaultSetup = setupTestDirectoryFromFixtures(
          createTempDir,
          fixtureSubdir,
          'prisma.config.emit.ts',
        );
        const defaultRun = await runOnEngine(defaultSetup, ['contract', 'emit']);
        expect(defaultRun.exitCode).toBe(0);

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
          'prisma.config.emit.ts',
        );
        const customDir = join(overrideSetup.testDir, 'custom-out');
        mkdirSync(customDir, { recursive: true });
        const customJsonPath = join(customDir, 'contract.json');
        const customDtsPath = join(customDir, 'contract.d.ts');

        const overrideRun = await runOnEngine(overrideSetup, [
          'contract',
          'emit',
          '--output-path',
          'custom-out',
        ]);
        expect(overrideRun.exitCode).toBe(0);

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
        const setup = setupTestDirectoryFromFixtures(
          createTempDir,
          fixtureSubdir,
          'prisma.config.emit.ts',
        );

        const run = await runOnEngine(setup, ['contract', 'emit']);
        expect(run.exitCode).toBe(0);

        // The fixture config has output: 'output/contract.json'
        expect(existsSync(join(setup.outputDir, 'contract.json'))).toBe(true);
        expect(existsSync(join(setup.outputDir, 'contract.d.ts'))).toBe(true);
      },
      timeouts.typeScriptCompilation,
    );
  });
});
