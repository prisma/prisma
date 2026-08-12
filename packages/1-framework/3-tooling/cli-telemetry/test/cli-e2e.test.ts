import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { timeouts } from '@repo/test-utils';
import { join } from 'pathe';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { type BackendHarness, HARNESS_PATHS, sleep, startBackendHarness } from './backend-harness';

/**
 * End-to-end CLI-process coverage for telemetry. Spawns the compiled
 * `prisma-next` binary via `node dist/bin.mjs …` against an isolated
 * `XDG_CONFIG_HOME` per test, points the in-binary endpoint at the test
 * backend, and asserts the rows the detached sender ends up writing.
 *
 * Complements `integration.test.ts`, which only forks the sender script
 * directly. The hops verified here that are otherwise untested:
 *
 *   - the `program.hook('preAction', …)` wire-up in the CLI entry,
 *   - the preAction-time gating + config-load + sender spawn sequence in
 *     `utils/telemetry.ts`,
 *   - the parent → child IPC handoff under real fork conditions,
 *   - and the survival of the detached child across a parent crash.
 *
 * Each test stands up its own tempdir for `XDG_CONFIG_HOME` and a
 * separate tempdir for the project's cwd. Rows are cleared in
 * `beforeEach`. CI detection is suppressed by explicitly setting
 * `CI=false` in the child env (`ci-info` short-circuits on that value),
 * and `PRISMA_NEXT_DISABLE_TELEMETRY` / `DO_NOT_TRACK` /
 * `PRISMA_NEXT_DEBUG` are stripped so the gating layer behaves the way
 * it would on a real user machine.
 *
 * Row assertions in cases that seed a unique `installationId` use
 * `awaitRowsForInstallation(...)` rather than the unscoped `awaitRows`.
 * The detached sender from a prior case can land a row *after* the
 * next case's `beforeEach` clearRows fires; an installationId-scoped
 * poll eliminates that cross-test contamination by construction.
 */

const CLI_BIN_PATH = HARNESS_PATHS.CLI_BIN_PATH;

let harness: BackendHarness;
const tempDirs: string[] = [];

beforeAll(async () => {
  harness = await startBackendHarness();
}, timeouts.spinUpPpgDev);

let xdgDir: string;
let projectDir: string;

beforeEach(async () => {
  await harness.clearRows();
  xdgDir = mkdtempSync(join(tmpdir(), 'cli-e2e-xdg-'));
  projectDir = mkdtempSync(join(tmpdir(), 'cli-e2e-proj-'));
  tempDirs.push(xdgDir, projectDir);
  writeFileSync(join(projectDir, 'package.json'), JSON.stringify({ name: 'cli-e2e-fixture' }));
});

// Tempdir cleanup is deferred to `afterAll` rather than `afterEach`: the
// detached telemetry sender may still be in flight when a test completes
// (rows assertions prove the row landed, but the child process exits a
// microtask later), and pulling the rug out from under its
// `XDG_CONFIG_HOME` mid-write can produce noisy ENOENT spam.
afterAll(async () => {
  await harness?.stop();
  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
  if (harness?.database !== undefined) {
    await harness.database.close();
  }
}, timeouts.spinUpPpgDev);

interface CliResult {
  readonly exitCode: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

/**
 * Spawn the compiled CLI binary as `node dist/bin.mjs …`. Returns
 * everything the parent process produced; the detached telemetry sender
 * the CLI forks is *not* observable through these handles (it's
 * `unref()`d and inherits no stdio), so callers verify its work via
 * `harness.awaitRows(...)`.
 */
function spawnCli(
  args: readonly string[],
  options: { readonly env: NodeJS.ProcessEnv; readonly cwd: string },
): Promise<CliResult> {
  return new Promise((resolveCli, reject) => {
    const child = spawn('node', [CLI_BIN_PATH, ...args], {
      cwd: options.cwd,
      env: options.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    child.stdout?.on('data', (chunk: Buffer) => stdoutChunks.push(chunk));
    child.stderr?.on('data', (chunk: Buffer) => stderrChunks.push(chunk));
    child.on('error', reject);
    child.on('exit', (code) =>
      resolveCli({
        exitCode: code,
        stdout: Buffer.concat(stdoutChunks).toString('utf-8'),
        stderr: Buffer.concat(stderrChunks).toString('utf-8'),
      }),
    );
  });
}

/**
 * Build the child env for a CLI spawn. Strips every signal that would
 * gate telemetry off (so the production gating logic is what's being
 * exercised), pins `CI=false` so `ci-info` reports a non-CI environment
 * regardless of where the test runs, and points the build-time-pinned
 * endpoint at the test backend via the integration-testing override.
 */
function buildEnv(xdg: string): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env };
  delete env['PRISMA_NEXT_DISABLE_TELEMETRY'];
  delete env['DO_NOT_TRACK'];
  delete env['PRISMA_NEXT_DEBUG'];
  return {
    ...env,
    CI: 'false',
    XDG_CONFIG_HOME: xdg,
    PRISMA_NEXT_TELEMETRY_ENDPOINT: harness.endpointBase,
    // Opt in to test-only CLI commands (currently the hidden
    // `__telemetry-crash-test`). Outside this env var, the command is
    // not even registered, so a shipped binary cannot dispatch it.
    // Set unconditionally so every spawn (including `--help`) goes
    // through the same env shape.
    PRISMA_NEXT_ENABLE_TEST_COMMANDS: '1',
  };
}

/**
 * Seed `$XDG_CONFIG_HOME/prisma-next/config.json` with a pre-generated
 * consent + installation id. The spawned CLI's gating layer treats this
 * as a real consenting user and emits telemetry. Generating the
 * installation id in the test (rather than letting the CLI mint one)
 * means the assertion can pin the exact value rather than just `is-uuid`.
 */
function seedConsent(xdg: string, installationId: string): void {
  const dir = join(xdg, 'prisma-next');
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, 'config.json'),
    `${JSON.stringify({ enableTelemetry: true, installationId }, null, 2)}\n`,
  );
}

const V4_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('cli-telemetry e2e — real CLI binary against the real backend', () => {
  it('prisma-next --help on a fresh XDG_CONFIG_HOME writes no config.json and emits no event', async () => {
    const result = await spawnCli(['--help'], { env: buildEnv(xdgDir), cwd: projectDir });

    expect(result.exitCode).toBe(0);
    expect(existsSync(join(xdgDir, 'prisma-next', 'config.json'))).toBe(false);

    // Grace window: the preAction hook does not fire for --help (Commander
    // handles it before action dispatch), so no fork should ever happen.
    // Wait a beat anyway so a hypothetical future regression that spawned
    // the sender for --help would show up as a row arriving.
    await sleep(1000);
    expect(await harness.readRows()).toHaveLength(0);
  });

  it('a CLI command with seeded consent emits one backend row carrying the stored installationId', async () => {
    const installationId = randomUUID();
    seedConsent(xdgDir, installationId);

    await spawnCli(['__telemetry-crash-test'], { env: buildEnv(xdgDir), cwd: projectDir });
    const rows = await harness.awaitRowsForInstallation(installationId, 1);

    expect(rows[0]?.installationId).toBe(installationId);
    expect(rows[0]?.installationId).toMatch(V4_UUID);
    expect(rows[0]?.command).toBe('__telemetry-crash-test');
  });

  it('a second CLI invocation reusing the same XDG_CONFIG_HOME produces a second row sharing the installationId', async () => {
    const installationId = randomUUID();
    seedConsent(xdgDir, installationId);

    await spawnCli(['__telemetry-crash-test'], { env: buildEnv(xdgDir), cwd: projectDir });
    await spawnCli(['__telemetry-crash-test'], { env: buildEnv(xdgDir), cwd: projectDir });
    const rows = await harness.awaitRowsForInstallation(installationId, 2);

    expect(rows).toHaveLength(2);
    expect(rows[0]?.installationId).toBe(installationId);
    expect(rows[1]?.installationId).toBe(installationId);
  });

  it('a CLI command that crashes after the preAction hook still results in a backend row', async () => {
    const installationId = randomUUID();
    seedConsent(xdgDir, installationId);

    const result = await spawnCli(['__telemetry-crash-test'], {
      env: buildEnv(xdgDir),
      cwd: projectDir,
    });

    // The hidden command throws synchronously after a tiny sleep that
    // exists only to flush the parent's IPC send to the detached
    // sender. The preAction hook has already `fork()`ed the child
    // before this action body runs, so the child outlives the
    // parent's crash — that's the invariant under test.
    expect(result.exitCode).not.toBe(0);
    const rows = await harness.awaitRowsForInstallation(installationId, 1);
    expect(rows[0]?.installationId).toBe(installationId);
  });
});
