import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import {
  readUserConfig,
  sanitizeCommanderResult,
  type TelemetryRunOutcome,
  userConfigPath,
  writeUserConfig,
} from '@internal/cli-telemetry';
import { Command } from 'commander';
import { dirname, join } from 'pathe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Re-evaluated per test via vi.resetModules() + dynamic import. With the
// CLI vitest config's `isolate: false` + shared-worker setup, any other
// test file that imports `is-ci` first causes `telemetry.ts`'s top-level
// `import { isCI }` binding to permanently reference the real function;
// a plain `vi.mock` here would re-register the mock for future loads but
// not rewrite the already-evaluated binding, so the production call to
// `isCI()` still reaches `ci-info` (returns true under CI=true). Forcing
// the SUT to re-evaluate per test pins the binding to the mocked module.
const isCIMock = vi.fn(() => false);
vi.mock('../../src/utils/is-ci', () => ({ isCI: isCIMock }));

// Partial-mock the telemetry package so the default-on fire path can be
// observed without spawning a real detached child. Everything else
// (gating, user-config read/write/mint, sanitiser) stays real so the
// notice + mint + gate logic is exercised end-to-end.
const { runTelemetryMock } = vi.hoisted(() => ({
  runTelemetryMock: vi.fn<(...args: unknown[]) => TelemetryRunOutcome>(() => ({
    spawned: true,
  })),
}));
vi.mock('@internal/cli-telemetry', async () => {
  const actual =
    await vi.importActual<typeof import('@internal/cli-telemetry')>('@internal/cli-telemetry');
  return { ...actual, runTelemetry: runTelemetryMock };
});

let fireTelemetryFromPreAction: typeof import('../../src/utils/telemetry').fireTelemetryFromPreAction;
let commanderSnapshotForTelemetry: typeof import('../../src/utils/telemetry').commanderSnapshotForTelemetry;

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

describe('CLI telemetry bridge', () => {
  let xdgRoot: string;
  let originalXdg: string | undefined;
  let originalDisableTelemetry: string | undefined;
  let originalDoNotTrack: string | undefined;
  let stderrSpy: ReturnType<typeof vi.spyOn>;
  let stdoutSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    xdgRoot = mkdtempSync(join(tmpdir(), 'cli-telemetry-bridge-'));
    originalXdg = process.env['XDG_CONFIG_HOME'];
    originalDisableTelemetry = process.env['PRISMA_NEXT_DISABLE_TELEMETRY'];
    originalDoNotTrack = process.env['DO_NOT_TRACK'];
    process.env['XDG_CONFIG_HOME'] = xdgRoot;
    delete process.env['PRISMA_NEXT_DISABLE_TELEMETRY'];
    delete process.env['DO_NOT_TRACK'];
    mkdirSync(dirname(userConfigPath()), { recursive: true });
    isCIMock.mockReturnValue(false);
    runTelemetryMock.mockClear();
    runTelemetryMock.mockReturnValue({ spawned: true });
    stderrSpy = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    vi.resetModules();
    const telem = await import('../../src/utils/telemetry');
    commanderSnapshotForTelemetry = telem.commanderSnapshotForTelemetry;
    fireTelemetryFromPreAction = telem.fireTelemetryFromPreAction;
  });

  afterEach(() => {
    stderrSpy.mockRestore();
    stdoutSpy.mockRestore();
    restoreEnv('XDG_CONFIG_HOME', originalXdg);
    restoreEnv('PRISMA_NEXT_DISABLE_TELEMETRY', originalDisableTelemetry);
    restoreEnv('DO_NOT_TRACK', originalDoNotTrack);
    rmSync(xdgRoot, { recursive: true, force: true });
  });

  function stderrText(): string {
    return stderrSpy.mock.calls.map((call: readonly unknown[]) => String(call[0])).join('');
  }

  it('projects only user-supplied long flag names from Commander metadata', () => {
    const command = new Command('init')
      .option('--schema-path <path>')
      .option('--no-install')
      .option('--connection-string <url>')
      .option('--dry-run')
      .option('-y, --yes');
    command.parse([
      'node',
      'init',
      '--schema-path',
      '/Users/alice/secrets/schema.prisma',
      '--no-install',
      '--connection-string',
      'postgres://user:pass@host/db',
      '--dry-run',
    ]);

    const snapshot = commanderSnapshotForTelemetry(command);

    expect(snapshot.options).toEqual([
      { attributeName: 'schemaPath', longName: '--schema-path', source: 'cli' },
      { attributeName: 'install', longName: '--no-install', source: 'cli' },
      { attributeName: 'connectionString', longName: '--connection-string', source: 'cli' },
      { attributeName: 'dryRun', longName: '--dry-run', source: 'cli' },
      { attributeName: 'yes', longName: '--yes', source: null },
    ]);
    expect(sanitizeCommanderResult(snapshot).flags).toEqual([
      'schema-path',
      'no-install',
      'connection-string',
      'dry-run',
    ]);
  });

  it('on default-on first run prints the notice to stderr, mints an id, and fires', () => {
    const outcome = fireTelemetryFromPreAction(new Command('init'));

    expect(outcome).toEqual({ spawned: true });
    expect(runTelemetryMock).toHaveBeenCalledTimes(1);

    const minted = readUserConfig().installationId;
    expect(minted).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);

    const notice = stderrText();
    expect(notice).toContain('Prisma Next collects anonymous CLI usage data, enabled by default');
    expect(notice).toContain(userConfigPath());
    expect(notice).toContain('https://prisma-next.dev/docs/cli/telemetry');
    expect(notice).toContain('prisma-next telemetry disable');
    expect(notice).toContain('DO_NOT_TRACK=1');
    expect(notice).toContain('PRISMA_NEXT_DISABLE_TELEMETRY=1');

    expect(stdoutSpy).not.toHaveBeenCalled();

    const refreshedConfig = runTelemetryMock.mock.calls[0]?.[0] as {
      userConfig?: { installationId?: string };
    };
    expect(refreshedConfig.userConfig?.installationId).toBe(minted);
  });

  it('leaves enableTelemetry undefined after minting on the default-on path', () => {
    fireTelemetryFromPreAction(new Command('init'));

    expect(readUserConfig().enableTelemetry).toBeUndefined();
  });

  it('treats a blank stored installationId as missing — reprints the notice and remints', () => {
    writeUserConfig({ installationId: '' });

    const outcome = fireTelemetryFromPreAction(new Command('init'));

    expect(outcome).toEqual({ spawned: true });
    expect(stderrText()).toContain(
      'Prisma Next collects anonymous CLI usage data, enabled by default',
    );
    expect(readUserConfig().installationId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it('on a second run with a stored id, fires silently without printing a notice', () => {
    writeUserConfig({ installationId: 'existing-id' });

    const outcome = fireTelemetryFromPreAction(new Command('init'));

    expect(outcome).toEqual({ spawned: true });
    expect(runTelemetryMock).toHaveBeenCalledTimes(1);
    expect(stderrText()).toBe('');
    expect(readUserConfig().installationId).toBe('existing-id');
  });

  it('with enableTelemetry: false, does not notice, mint, or fire', () => {
    writeUserConfig({ enableTelemetry: false });

    const outcome = fireTelemetryFromPreAction(new Command('init'));

    expect(outcome).toEqual({ spawned: false, reason: 'gated-off' });
    expect(runTelemetryMock).not.toHaveBeenCalled();
    expect(stderrText()).toBe('');
    expect(readUserConfig().installationId).toBeUndefined();
  });

  it('with PRISMA_NEXT_DISABLE_TELEMETRY=1, does not notice, mint, or fire', () => {
    process.env['PRISMA_NEXT_DISABLE_TELEMETRY'] = '1';

    const outcome = fireTelemetryFromPreAction(new Command('init'));

    expect(outcome).toEqual({ spawned: false, reason: 'gated-off' });
    expect(runTelemetryMock).not.toHaveBeenCalled();
    expect(stderrText()).toBe('');
    expect(readUserConfig().installationId).toBeUndefined();
  });

  it('with DO_NOT_TRACK=1, does not notice, mint, or fire', () => {
    process.env['DO_NOT_TRACK'] = '1';

    const outcome = fireTelemetryFromPreAction(new Command('init'));

    expect(outcome).toEqual({ spawned: false, reason: 'gated-off' });
    expect(runTelemetryMock).not.toHaveBeenCalled();
    expect(stderrText()).toBe('');
    expect(readUserConfig().installationId).toBeUndefined();
  });

  it('under CI, does not notice, mint, or fire', () => {
    isCIMock.mockReturnValue(true);

    const outcome = fireTelemetryFromPreAction(new Command('init'));

    expect(outcome).toEqual({ spawned: false, reason: 'ci' });
    expect(runTelemetryMock).not.toHaveBeenCalled();
    expect(stderrText()).toBe('');
    expect(readUserConfig().installationId).toBeUndefined();
  });

  describe('telemetry command is exempt from the preAction fire', () => {
    // Mirrors the real wiring: the `telemetry` command (and its
    // subcommands) live under the `prisma-next` program, so
    // `commandPathFor` reports `['prisma-next', 'telemetry', …]`.
    function telemetrySubcommandUnderProgram(sub: string): Command {
      const program = new Command('prisma-next');
      const telemetry = new Command('telemetry');
      const child = new Command(sub).action(() => {});
      telemetry.addCommand(child);
      program.addCommand(telemetry);
      program.parse(['node', 'prisma-next', 'telemetry', sub]);
      return child;
    }

    it('on telemetry disable, returns the no-op without notice, mint, or send', () => {
      const outcome = fireTelemetryFromPreAction(telemetrySubcommandUnderProgram('disable'));

      expect(outcome).toEqual({ spawned: false, reason: 'gated-off' });
      expect(runTelemetryMock).not.toHaveBeenCalled();
      expect(stderrText()).toBe('');
      expect(readUserConfig().installationId).toBeUndefined();
    });

    it('on telemetry status, returns the no-op without notice, mint, or send', () => {
      const outcome = fireTelemetryFromPreAction(telemetrySubcommandUnderProgram('status'));

      expect(outcome).toEqual({ spawned: false, reason: 'gated-off' });
      expect(runTelemetryMock).not.toHaveBeenCalled();
      expect(stderrText()).toBe('');
      expect(readUserConfig().installationId).toBeUndefined();
    });

    it('on the top-level telemetry command itself, returns the no-op', () => {
      const program = new Command('prisma-next');
      const telemetry = new Command('telemetry').action(() => {});
      program.addCommand(telemetry);
      program.parse(['node', 'prisma-next', 'telemetry']);

      const outcome = fireTelemetryFromPreAction(telemetry);

      expect(outcome).toEqual({ spawned: false, reason: 'gated-off' });
      expect(runTelemetryMock).not.toHaveBeenCalled();
    });
  });
});
