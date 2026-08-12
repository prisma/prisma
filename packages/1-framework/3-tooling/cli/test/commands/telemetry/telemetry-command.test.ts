import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { readUserConfig, userConfigPath, writeUserConfig } from '@internal/cli-telemetry';
import { dirname, join } from 'pathe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { isCIMock } = vi.hoisted(() => ({ isCIMock: vi.fn(() => false) }));
vi.mock('../../../src/utils/is-ci', () => ({ isCI: isCIMock }));

import { createTelemetryCommand } from '../../../src/commands/telemetry';

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

class ProcessExitError extends Error {}

describe('prisma-next telemetry command', () => {
  let xdgRoot: string;
  let originalXdg: string | undefined;
  let originalDisable: string | undefined;
  let originalDoNotTrack: string | undefined;
  let stdoutSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    xdgRoot = mkdtempSync(join(tmpdir(), 'telemetry-command-'));
    originalXdg = process.env['XDG_CONFIG_HOME'];
    originalDisable = process.env['PRISMA_NEXT_DISABLE_TELEMETRY'];
    originalDoNotTrack = process.env['DO_NOT_TRACK'];
    process.env['XDG_CONFIG_HOME'] = xdgRoot;
    delete process.env['PRISMA_NEXT_DISABLE_TELEMETRY'];
    delete process.env['DO_NOT_TRACK'];
    mkdirSync(dirname(userConfigPath()), { recursive: true });
    isCIMock.mockReturnValue(false);
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(((): never => {
      throw new ProcessExitError();
    }) as never);
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
    exitSpy.mockRestore();
    restoreEnv('XDG_CONFIG_HOME', originalXdg);
    restoreEnv('PRISMA_NEXT_DISABLE_TELEMETRY', originalDisable);
    restoreEnv('DO_NOT_TRACK', originalDoNotTrack);
    rmSync(xdgRoot, { recursive: true, force: true });
  });

  function run(argv: readonly string[]): string {
    const program = createTelemetryCommand();
    try {
      program.parse(['node', 'telemetry', ...argv]);
    } catch (error) {
      if (!(error instanceof ProcessExitError)) throw error;
    }
    return stdoutSpy.mock.calls.map((call: readonly unknown[]) => String(call[0])).join('');
  }

  describe('status', () => {
    it('reports default-on, the config path, and no stored id when nothing is configured', () => {
      const out = run(['status', '--format', 'pretty']);

      expect(out).toContain('Telemetry is enabled');
      expect(out).toContain('opt-out default');
      expect(out).toContain(userConfigPath());
      expect(out).toContain('Installation ID: not stored');
    });

    it('reports disabled when enableTelemetry is stored false', () => {
      writeUserConfig({ enableTelemetry: false });

      const out = run(['status', '--format', 'pretty']);

      expect(out).toContain('Telemetry is disabled');
      expect(out).toContain('"enableTelemetry": false');
    });

    it('reports disabled with an env opt-out', () => {
      process.env['DO_NOT_TRACK'] = '1';

      const out = run(['status', '--format', 'pretty']);

      expect(out).toContain('Telemetry is disabled');
      expect(out).toContain('environment opt-out');
    });

    it('reports a stored installation id by presence only, never its value', () => {
      writeUserConfig({ installationId: 'secret-id-value' });

      const out = run(['status', '--format', 'pretty']);

      expect(out).toContain('Installation ID: stored');
      expect(out).not.toContain('secret-id-value');
    });

    it('emits machine-readable JSON under --json without the id value', () => {
      writeUserConfig({ installationId: 'secret-id-value' });

      const out = run(['status', '--json']);
      const parsed = JSON.parse(out) as Record<string, unknown>;

      expect(parsed).toMatchObject({ enabled: true, installationIdStored: true });
      expect(out).not.toContain('secret-id-value');
    });
  });

  describe('enable', () => {
    it('stores enableTelemetry true and mints an installation id', () => {
      run(['enable']);

      const config = readUserConfig();
      expect(config.enableTelemetry).toBe(true);
      expect(config.installationId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
    });
  });

  describe('disable', () => {
    it('stores enableTelemetry false and mints no installation id', () => {
      run(['disable']);

      const config = readUserConfig();
      expect(config.enableTelemetry).toBe(false);
      expect(config.installationId).toBeUndefined();
    });
  });
});
