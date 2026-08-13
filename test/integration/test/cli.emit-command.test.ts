import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CompletedEnvelope, ErroredEnvelope } from '@prisma/cli-engine';
import { timeouts } from '@repo/test-utils';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  type EngineRunResult,
  runOnEngine,
  setupIntegrationTestDirectoryFromFixtures,
} from './utils/cli-test-helpers';

// Fixture subdirectory for emit-command tests
const fixtureSubdir = 'emit-command';

/** What the run settled with, read off the terminal frame of the json stream. */
function settledEnvelope(run: EngineRunResult): CompletedEnvelope | ErroredEnvelope | undefined {
  const terminal = run.json.at(-1);
  return terminal !== undefined && terminal.kind === 'result' ? terminal.envelope : undefined;
}

describe('emit command', () => {
  let setup: ReturnType<typeof setupIntegrationTestDirectoryFromFixtures>;

  beforeEach(() => {
    setup = setupIntegrationTestDirectoryFromFixtures(fixtureSubdir);
  });

  afterEach(() => {
    setup.cleanup();
  });

  it('emits contract.json and contract.d.ts with valid contract', {
    timeout: timeouts.typeScriptCompilation,
  }, async () => {
    const run = await runOnEngine(setup, ['contract', 'emit', '--json']);
    expect(run.exitCode).toBe(0);

    const contractJsonPath = join(setup.outputDir, 'contract.json');
    const contractDtsPath = join(setup.outputDir, 'contract.d.ts');

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
  });

  it('creates output directory if it does not exist', {
    timeout: timeouts.typeScriptCompilation,
  }, async () => {
    const newOutputDir = join(setup.testDir, 'new-output');
    // Test with custom output path in config
    const customSetup = setupIntegrationTestDirectoryFromFixtures(
      fixtureSubdir,
      'prisma.config.custom-output.ts',
      { '{{OUTPUT_DIR}}': newOutputDir },
    );

    try {
      const run = await runOnEngine(customSetup, ['contract', 'emit']);
      expect(run.exitCode).toBe(0);

      expect(existsSync(newOutputDir)).toBe(true);
      expect(existsSync(join(newOutputDir, 'contract.json'))).toBe(true);
      expect(existsSync(join(newOutputDir, 'contract.d.ts'))).toBe(true);
    } finally {
      customSetup.cleanup();
    }
  });

  it('handles missing contract in config', {
    timeout: timeouts.typeScriptCompilation,
  }, async () => {
    const noContractSetup = setupIntegrationTestDirectoryFromFixtures(
      fixtureSubdir,
      'prisma.config.no-contract.ts',
    );

    try {
      const run = await runOnEngine(noContractSetup, ['contract', 'emit', '--json']);
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
    } finally {
      noContractSetup.cleanup();
    }
  });

  it('uses default output path when not specified in contract config', {
    timeout: timeouts.typeScriptCompilation,
  }, async () => {
    const defaultsSetup = setupIntegrationTestDirectoryFromFixtures(
      fixtureSubdir,
      'prisma.config.defaults.ts',
    );

    try {
      const run = await runOnEngine(defaultsSetup, ['contract', 'emit']);
      expect(run.exitCode).toBe(0);

      // Default output is 'src/prisma/contract.json'
      const defaultJsonPath = join(defaultsSetup.testDir, 'src/prisma/contract.json');
      const defaultDtsPath = join(defaultsSetup.testDir, 'src/prisma/contract.d.ts');
      expect(existsSync(defaultJsonPath)).toBe(true);
      expect(existsSync(defaultDtsPath)).toBe(true);
    } finally {
      defaultsSetup.cleanup();
    }
  });

  it('handles invalid contract in config', {
    timeout: timeouts.typeScriptCompilation,
  }, async () => {
    const invalidSetup = setupIntegrationTestDirectoryFromFixtures(
      fixtureSubdir,
      'prisma.config.invalid-contract.ts',
    );

    try {
      const run = await runOnEngine(invalidSetup, ['contract', 'emit', '--json']);
      expect(run.exitCode).toBe(2);
      expect(settledEnvelope(run)).toMatchObject({
        ok: false,
        error: { code: 'CLI.UNEXPECTED', summary: expect.any(String) },
      });
    } finally {
      invalidSetup.cleanup();
    }
  });

  it('handles unsupported target family', { timeout: timeouts.typeScriptCompilation }, async () => {
    const documentSetup = setupIntegrationTestDirectoryFromFixtures(
      fixtureSubdir,
      'prisma.config.document-family.ts',
    );

    try {
      const run = await runOnEngine(documentSetup, ['contract', 'emit', '--json']);
      expect(run.exitCode).toBe(2);
      const envelope = settledEnvelope(run);
      expect(envelope).toMatchObject({
        ok: false,
        error: { code: 'CLI.CONFIG_SECTION_INVALID', summary: expect.any(String) },
      });
      expect(envelope?.diagnostics).toEqual(
        expect.arrayContaining([expect.objectContaining({ code: 'CONFIG.VALIDATION_FAILED' })]),
      );
    } finally {
      documentSetup.cleanup();
    }
  });

  it('handles extension paths', { timeout: timeouts.typeScriptCompilation }, async () => {
    // Extensions are now in config, so we just need a valid config
    const run = await runOnEngine(setup, ['contract', 'emit']);
    expect(run.exitCode).toBe(0);

    const contractJsonPath = join(setup.outputDir, 'contract.json');
    expect(existsSync(contractJsonPath)).toBe(true);
  });

  it('handles single string extension path', {
    timeout: timeouts.typeScriptCompilation,
  }, async () => {
    // Extensions are now in config
    const run = await runOnEngine(setup, ['contract', 'emit']);
    expect(run.exitCode).toBe(0);

    const contractJsonPath = join(setup.outputDir, 'contract.json');
    expect(existsSync(contractJsonPath)).toBe(true);
  });

  it('handles multiple extension paths', { timeout: timeouts.typeScriptCompilation }, async () => {
    // Extensions are now in config
    const run = await runOnEngine(setup, ['contract', 'emit']);
    expect(run.exitCode).toBe(0);

    const contractJsonPath = join(setup.outputDir, 'contract.json');
    expect(existsSync(contractJsonPath)).toBe(true);
  });

  it('outputs profileHash when present', { timeout: timeouts.typeScriptCompilation }, async () => {
    const run = await runOnEngine(setup, ['contract', 'emit', '--json']);
    expect(run.exitCode).toBe(0);

    const contractJsonPath = join(setup.outputDir, 'contract.json');
    expect(existsSync(contractJsonPath)).toBe(true);

    expect(run.presented?.data).toMatchObject({
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
  });

  it('handles async contract source function', {
    timeout: timeouts.typeScriptCompilation,
  }, async () => {
    const asyncSetup = setupIntegrationTestDirectoryFromFixtures(
      fixtureSubdir,
      'prisma.config.async-source.ts',
      { '{{OUTPUT_DIR}}': setup.outputDir },
    );

    try {
      const run = await runOnEngine(asyncSetup, ['contract', 'emit']);
      expect(run.exitCode).toBe(0);

      const contractJsonPath = join(setup.outputDir, 'contract.json');
      expect(existsSync(contractJsonPath)).toBe(true);
    } finally {
      asyncSetup.cleanup();
    }
  });

  it('handles provider source function', { timeout: timeouts.typeScriptCompilation }, async () => {
    const syncSetup = setupIntegrationTestDirectoryFromFixtures(
      fixtureSubdir,
      'prisma.config.sync-source.ts',
      { '{{OUTPUT_DIR}}': setup.outputDir },
    );

    try {
      const run = await runOnEngine(syncSetup, ['contract', 'emit']);
      expect(run.exitCode).toBe(0);

      const contractJsonPath = join(setup.outputDir, 'contract.json');
      expect(existsSync(contractJsonPath)).toBe(true);
    } finally {
      syncSetup.cleanup();
    }
  });
});
