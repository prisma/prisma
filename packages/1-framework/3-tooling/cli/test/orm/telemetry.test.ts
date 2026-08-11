import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { userConfigPath, writeUserConfig } from '@internal/cli-telemetry';
import { createTestCli } from '@prisma/cli-engine/testing';
import { join } from 'pathe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BIN_COMMANDS, BIN_GROUPS } from '../../src/orm/cli';

const inCI = vi.hoisted(() => ({ value: false }));
vi.mock('../../src/utils/is-ci', () => ({ isCI: () => inCI.value }));

const harness = { commands: BIN_COMMANDS, groups: BIN_GROUPS };

let configHome = '';
let previousConfigHome: string | undefined;

beforeEach(() => {
  previousConfigHome = process.env['XDG_CONFIG_HOME'];
  configHome = realpathSync(mkdtempSync(join(tmpdir(), 'orm-telemetry-')));
  process.env['XDG_CONFIG_HOME'] = configHome;
});

afterEach(() => {
  inCI.value = false;
  if (previousConfigHome === undefined) {
    delete process.env['XDG_CONFIG_HOME'];
  } else {
    process.env['XDG_CONFIG_HOME'] = previousConfigHome;
  }
  rmSync(configHome, { recursive: true, force: true });
});

function storedConfig(): Record<string, unknown> {
  return JSON.parse(readFileSync(userConfigPath(), 'utf-8')) as Record<string, unknown>;
}

describe('telemetry status', () => {
  it('reports the opt-out default as enabled without writing anything', async () => {
    const cli = createTestCli(harness);

    const run = await cli.run(['telemetry', 'status', '--json'], { env: {} });

    expect(run.exitCode).toBe(0);
    expect(run.presented?.data).toEqual({
      enabled: true,
      reason: 'default-on',
      configPath: userConfigPath(),
      installationIdStored: false,
    });
    expect(() => storedConfig()).toThrow();
  });

  it('reports CI as a hard disable', async () => {
    inCI.value = true;
    const cli = createTestCli(harness);

    const run = await cli.run(['telemetry', 'status', '--json'], { env: {} });

    expect(run.presented?.data).toMatchObject({ enabled: false, reason: 'ci' });
  });

  it('reports an environment opt-out', async () => {
    const cli = createTestCli(harness);

    const run = await cli.run(['telemetry', 'status', '--json'], {
      env: { DO_NOT_TRACK: '1' },
    });

    expect(run.presented?.data).toMatchObject({ enabled: false, reason: 'env-opt-out' });
  });

  it('never discloses the installation id itself', async () => {
    writeUserConfig({ installationId: 'secret-id-value' });
    const cli = createTestCli(harness);

    const run = await cli.run(['telemetry', 'status'], { env: {} });

    expect(run.presented?.data).toMatchObject({ installationIdStored: true });
    expect(`${run.stdout}${run.stderr}`).not.toContain('secret-id-value');
  });

  it('puts the payload lines on stdout and the same reading in blocks', async () => {
    const cli = createTestCli(harness);

    const run = await cli.run(['telemetry', 'status'], { env: {}, isTty: { stdout: true } });

    expect(run.presented?.presentation.stdout).toEqual([
      expect.stringContaining('Telemetry is enabled'),
      `Config file: ${userConfigPath()}`,
      'Installation ID: not stored',
    ]);
    expect(run.presented?.presentation.human).toEqual([
      { kind: 'summary', tone: 'info', text: expect.stringContaining('Telemetry is enabled') },
      {
        kind: 'fields',
        rows: [
          { label: 'Config file', value: userConfigPath() },
          { label: 'Installation ID', value: 'not stored' },
        ],
      },
    ]);
  });
});

describe('telemetry enable', () => {
  it('stores the opt-in and mints an installation id', async () => {
    const cli = createTestCli(harness);

    const run = await cli.run(['telemetry', 'enable'], { env: {} });

    expect(run.exitCode).toBe(0);
    expect(storedConfig()['enableTelemetry']).toBe(true);
    expect(storedConfig()['installationId']).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it('confirms on stdout and reports the decision as json', async () => {
    const cli = createTestCli(harness);

    const run = await cli.run(['telemetry', 'enable'], { env: {}, isTty: { stdout: true } });

    expect(run.presented?.presentation.stdout).toEqual([
      `Telemetry enabled. Preference stored in ${userConfigPath()}.`,
    ]);
    expect(run.presented?.data).toEqual({ enableTelemetry: true, configPath: userConfigPath() });
  });
});

describe('telemetry disable', () => {
  it('stores the opt-out and mints nothing', async () => {
    const cli = createTestCli(harness);

    const run = await cli.run(['telemetry', 'disable'], { env: {} });

    expect(run.exitCode).toBe(0);
    expect(storedConfig()).toEqual({ enableTelemetry: false });
  });
});
