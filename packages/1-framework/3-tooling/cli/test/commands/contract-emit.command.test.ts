import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ok } from '@internal/utils/result';
import { timeouts } from '@repo/test-utils';
import { join as pathjoin } from 'pathe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { executeCommand, getExitCode, setupCommandMocks } from '../utils/test-helpers';

const mocks = vi.hoisted(() => ({
  loadConfigMock: vi.fn(),
  executeContractEmitMock: vi.fn(),
}));

vi.mock('@internal/config-loader', () => ({
  loadConfigForSections: mocks.loadConfigMock,
}));

vi.mock('../../src/control-api/operations/contract-emit', () => ({
  executeContractEmit: mocks.executeContractEmitMock,
}));

type CreateContractEmitCommand =
  typeof import('../../src/commands/contract-emit')['createContractEmitCommand'];

describe('contract emit command', () => {
  let consoleOutput: string[] = [];
  let cleanupMocks: () => void = () => {};
  let createContractEmitCommand: CreateContractEmitCommand;
  let tmpDir = '';

  beforeEach(async () => {
    vi.resetModules();
    ({ createContractEmitCommand } = await import('../../src/commands/contract-emit'));
    tmpDir = await mkdtemp(join(tmpdir(), 'prisma-next-contract-emit-'));

    const commandMocks = setupCommandMocks({ isTTY: false });
    consoleOutput = commandMocks.consoleOutput;
    cleanupMocks = commandMocks.cleanup;

    mocks.loadConfigMock.mockReset();
    mocks.executeContractEmitMock.mockReset();
  }, timeouts.typeScriptCompilation);

  afterEach(async () => {
    cleanupMocks();
    if (tmpDir.length > 0) {
      await rm(tmpDir, { recursive: true, force: true });
      tmpDir = '';
    }
    vi.clearAllMocks();
  });

  function configWithOutput(outputJsonPath: string) {
    return {
      family: { familyId: 'sql' },
      target: { targetId: 'postgres' },
      adapter: {},
      extensions: [],
      contract: {
        source: { load: vi.fn() },
        output: outputJsonPath,
      },
    };
  }

  function emitResult(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      storageHash: 'storage-hash',
      profileHash: 'profile-hash',
      files: {
        json: join(tmpDir, 'contract.json'),
        dts: join(tmpDir, 'contract.d.ts'),
      },
      ...overrides,
    };
  }

  it('emits human-readable success output on piped stdout with --format pretty', async () => {
    const outputPath = join(tmpDir, 'contract.json');
    mocks.loadConfigMock.mockResolvedValue(ok(configWithOutput(outputPath)));
    mocks.executeContractEmitMock.mockResolvedValue(emitResult());

    const command = createContractEmitCommand();
    await expect(executeCommand(command, ['--format', 'pretty'])).resolves.toBe(0);

    const combined = consoleOutput.join('\n');
    expect(combined).toMatch(/Emitted contract\.json/i);
  });

  it('rejects --format pretty together with --json via structured error', async () => {
    const command = createContractEmitCommand();
    await expect(executeCommand(command, ['--format', 'pretty', '--json'])).rejects.toThrow(
      'process.exit called',
    );
    expect(getExitCode()).toBe(2);
    const combined = consoleOutput.join('\n');
    expect(combined).toContain('CLI.OUTPUT_FORMAT_CONFLICT');
    expect(combined).not.toContain('at resolveOutputFormat');
  });

  it('delegates to executeContractEmit and exits successfully', async () => {
    const outputPath = join(tmpDir, 'contract.json');
    mocks.loadConfigMock.mockResolvedValue(ok(configWithOutput(outputPath)));
    mocks.executeContractEmitMock.mockResolvedValue(emitResult());

    const command = createContractEmitCommand();
    await expect(executeCommand(command, ['--json'])).resolves.toBe(0);

    expect(mocks.executeContractEmitMock).toHaveBeenCalledWith(
      expect.objectContaining({
        configPath: 'prisma-next.config.ts',
        onProgress: expect.any(Function),
      }),
    );
  });

  it('forwards --output-path to executeContractEmit as outputPath resolved against cwd', async () => {
    const outputPath = join(tmpDir, 'contract.json');
    mocks.loadConfigMock.mockResolvedValue(ok(configWithOutput(outputPath)));
    mocks.executeContractEmitMock.mockResolvedValue(emitResult());

    const command = createContractEmitCommand();
    await expect(
      executeCommand(command, ['--output-path', './custom/dir', '--json']),
    ).resolves.toBe(0);

    expect(mocks.executeContractEmitMock).toHaveBeenCalledWith(
      expect.objectContaining({
        outputPath: pathjoin(process.cwd(), 'custom/dir'),
      }),
    );
  });

  it('CLI --output-path wins over config output (CLI > config precedence)', async () => {
    const configOutputPath = join(tmpDir, 'config-contract.json');
    const cliOutputDir = join(tmpDir, 'cli-out');
    mocks.loadConfigMock.mockResolvedValue(ok(configWithOutput(configOutputPath)));
    mocks.executeContractEmitMock.mockResolvedValue(
      emitResult({
        files: {
          json: join(cliOutputDir, 'contract.json'),
          dts: join(cliOutputDir, 'contract.d.ts'),
        },
      }),
    );

    const command = createContractEmitCommand();
    await expect(executeCommand(command, ['--output-path', cliOutputDir, '--json'])).resolves.toBe(
      0,
    );

    expect(mocks.executeContractEmitMock).toHaveBeenCalledWith(
      expect.objectContaining({ outputPath: cliOutputDir }),
    );
  });

  it('resolves relative --output-path against cwd', async () => {
    const outputPath = join(tmpDir, 'contract.json');
    mocks.loadConfigMock.mockResolvedValue(ok(configWithOutput(outputPath)));
    mocks.executeContractEmitMock.mockResolvedValue(emitResult());

    const command = createContractEmitCommand();
    await expect(
      executeCommand(command, ['--output-path', 'relative/dir', '--json']),
    ).resolves.toBe(0);

    const call = mocks.executeContractEmitMock.mock.calls[0]?.[0] as { outputPath?: string };
    expect(call?.outputPath).toBe(pathjoin(process.cwd(), 'relative/dir'));
  });

  it('passes absolute --output-path verbatim', async () => {
    const outputPath = join(tmpDir, 'contract.json');
    const absoluteDir = join(tmpDir, 'abs-out');
    mocks.loadConfigMock.mockResolvedValue(ok(configWithOutput(outputPath)));
    mocks.executeContractEmitMock.mockResolvedValue(emitResult());

    const command = createContractEmitCommand();
    await expect(executeCommand(command, ['--output-path', absoluteDir, '--json'])).resolves.toBe(
      0,
    );

    expect(mocks.executeContractEmitMock).toHaveBeenCalledWith(
      expect.objectContaining({ outputPath: absoluteDir }),
    );
  });

  it('does not forward outputPath when --output-path is not passed', async () => {
    const outputPath = join(tmpDir, 'contract.json');
    mocks.loadConfigMock.mockResolvedValue(ok(configWithOutput(outputPath)));
    mocks.executeContractEmitMock.mockResolvedValue(emitResult());

    const command = createContractEmitCommand();
    await expect(executeCommand(command, ['--json'])).resolves.toBe(0);

    const call = mocks.executeContractEmitMock.mock.calls[0]?.[0] as { outputPath?: string };
    expect(call?.outputPath).toBeUndefined();
  });

  it('surfaces validationWarning via the terminal UI', async () => {
    cleanupMocks();
    // ui.warn is a no-op when not interactive; promote to TTY so the warning surfaces.
    const interactiveMocks = setupCommandMocks({ isTTY: true });
    consoleOutput = interactiveMocks.consoleOutput;
    cleanupMocks = interactiveMocks.cleanup;

    const outputPath = join(tmpDir, 'contract.json');
    mocks.loadConfigMock.mockResolvedValue(ok(configWithOutput(outputPath)));
    mocks.executeContractEmitMock.mockResolvedValue(
      emitResult({ validationWarning: 'sample dependency warning' }),
    );

    const command = createContractEmitCommand();
    await expect(executeCommand(command, [])).resolves.toBe(0);

    expect(consoleOutput.some((line) => line.includes('sample dependency warning'))).toBe(true);
  });
});
