import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CompletedEnvelope, ErroredEnvelope } from '@prisma/cli-engine';
import { timeouts } from '@repo/test-utils';
import { describe, expect, it } from 'vitest';
import {
  type EngineRunResult,
  runOnEngine,
  setupTestDirectoryFromFixtures,
  withTempDir,
} from './utils/cli-test-helpers';

// Fixture subdirectory for emit tests
const fixtureSubdir = 'emit';

/** What the run settled with, read off the terminal frame of the json stream. */
function settledEnvelope(run: EngineRunResult): CompletedEnvelope | ErroredEnvelope | undefined {
  const terminal = run.json.at(-1);
  return terminal !== undefined && terminal.kind === 'result' ? terminal.envelope : undefined;
}

withTempDir(({ createTempDir }) => {
  describe('contract emit command (e2e)', () => {
    it(
      'emits contract.json and contract.d.ts with canonical command',
      async () => {
        const testSetup = setupTestDirectoryFromFixtures(
          createTempDir,
          fixtureSubdir,
          'prisma.config.emit.ts',
        );
        const outputDir = testSetup.outputDir;

        const run = await runOnEngine(testSetup, ['contract', 'emit', '--json']);
        expect(run.exitCode).toBe(0);

        expect(run.presented?.data).toMatchObject({
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

        // Verify the result document matches the actual files
        expect(run.presented?.data).toMatchObject({
          storageHash: contractJson.storage.storageHash,
          files: {
            json: contractJsonPath,
            dts: contractDtsPath,
          },
        });
      },
      timeouts.typeScriptCompilation,
    );

    it(
      'outputs JSON when --json flag is provided',
      async () => {
        const testSetup = setupTestDirectoryFromFixtures(
          createTempDir,
          fixtureSubdir,
          'prisma.config.emit.ts',
        );

        const run = await runOnEngine(testSetup, ['contract', 'emit', '--json']);
        expect(run.exitCode).toBe(0);

        expect(run.presented?.data).toMatchObject({
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
          'prisma.config.emit.ts',
        );

        const run = await runOnEngine(testSetup, [
          'contract',
          'emit',
          '--config',
          'nonexistent.config.ts',
          '--json',
        ]);

        // Config errors should have exit code 2
        expect(run.exitCode).toBe(2);

        const envelope = settledEnvelope(run);
        expect(envelope).toMatchObject({
          ok: false,
          error: {
            code: 'CONFIG.FILE_NOT_FOUND',
            summary: expect.any(String),
            why: expect.any(String),
          },
        });
        expect(envelope?.nextActions.length).toBeGreaterThan(0);
      },
      timeouts.typeScriptCompilation,
    );

    it(
      'throws error with CONFIG.CONTRACT_MISSING code when contract config is missing',
      async () => {
        const testSetup = setupTestDirectoryFromFixtures(
          createTempDir,
          fixtureSubdir,
          'prisma.config.no-contract.ts',
        );

        const run = await runOnEngine(testSetup, ['contract', 'emit', '--json']);
        expect(run.exitCode).toBe(2);

        const envelope = settledEnvelope(run);
        expect(envelope).toMatchObject({
          ok: false,
          error: {
            code: 'CONFIG.CONTRACT_MISSING',
            summary: expect.any(String),
            why: expect.any(String),
          },
        });
        expect(envelope?.nextActions.length).toBeGreaterThan(0);
      },
      timeouts.spinUpPpgDev,
    );

    it(
      'outputs timings in verbose mode',
      async () => {
        const testSetup = setupTestDirectoryFromFixtures(
          createTempDir,
          fixtureSubdir,
          'prisma.config.emit.ts',
        );

        const run = await runOnEngine(testSetup, ['contract', 'emit', '--verbose']);
        expect(run.exitCode).toBe(0);

        expect(run.stderr).toContain('Total time');
      },
      timeouts.typeScriptCompilation,
    );

    it(
      'suppresses output in quiet mode',
      async () => {
        const testSetup = setupTestDirectoryFromFixtures(
          createTempDir,
          fixtureSubdir,
          'prisma.config.emit.ts',
        );

        const quiet = await runOnEngine(testSetup, ['contract', 'emit', '--quiet']);
        expect(quiet.exitCode).toBe(0);

        const normal = await runOnEngine(testSetup, ['contract', 'emit']);
        expect(normal.exitCode).toBe(0);

        // The engine's --quiet is a log-level shorthand: it drops the progress
        // commentary but still presents the result.
        expect(quiet.stderr).not.toContain('Resolving contract source');
        expect(quiet.stderr).not.toContain('Emitting contract...');
        expect(quiet.stderr.length).toBeLessThan(normal.stderr.length);
      },
      timeouts.typeScriptCompilation,
    );
  });
});
