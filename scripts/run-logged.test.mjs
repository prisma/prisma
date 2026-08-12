import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { execPath } from 'node:process';
import { afterEach, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const SCRIPT = join(REPO_ROOT, 'scripts', 'run-logged.mjs');
const WIP_DIR = join(REPO_ROOT, 'wip');

function runWrapper(logname, command, args = [], env = {}) {
  return spawnSync(execPath, [SCRIPT, logname, command, ...args], {
    cwd: REPO_ROOT,
    encoding: 'utf-8',
    env: { ...process.env, ...env },
    timeout: 30_000,
  });
}

function parseLogPath(stdout) {
  const match = stdout.match(/^log: (.+)$/m);
  assert.ok(match, `no "log: " line in wrapper stdout:\n${stdout}`);
  return join(REPO_ROOT, match[1]);
}

function cleanupWip(logname) {
  if (!existsSync(WIP_DIR)) return;
  for (const f of readdirSync(WIP_DIR)) {
    if (f.startsWith(logname)) rmSync(join(WIP_DIR, f));
  }
}

afterEach(() => {
  cleanupWip('selftest-success');
  cleanupWip('selftest-failure');
  cleanupWip('selftest-timeout');
  cleanupWip('selftest-badtimeout');
});

describe('run-logged', () => {
  it('exits 0, writes log containing child output, and writes .exit file on success', () => {
    const result = runWrapper('selftest-success', execPath, [
      '-e',
      "process.stdout.write('hi'); process.exit(0)",
    ]);

    assert.equal(result.status, 0, `wrapper exited ${result.status}; stderr=${result.stderr}`);

    const logPath = parseLogPath(result.stdout);
    assert.ok(existsSync(logPath), `log file not found: ${logPath}`);
    assert.match(readFileSync(logPath, 'utf-8'), /hi/);

    const exitPath = logPath.replace(/\.log$/, '.exit');
    assert.ok(existsSync(exitPath), `.exit file not found: ${exitPath}`);
    assert.equal(readFileSync(exitPath, 'utf-8').trim(), '0');
  });

  it('falls back to the default timeout and warns when AGENT_CMD_TIMEOUT_SECONDS is invalid', () => {
    const result = runWrapper('selftest-badtimeout', execPath, ['-e', 'process.exit(0)'], {
      AGENT_CMD_TIMEOUT_SECONDS: 'not-a-number',
    });

    assert.equal(result.status, 0, `wrapper exited ${result.status}; stderr=${result.stderr}`);
    assert.match(result.stderr, /ignoring invalid AGENT_CMD_TIMEOUT_SECONDS=not-a-number/);

    const exitPath = parseLogPath(result.stdout).replace(/\.log$/, '.exit');
    assert.equal(readFileSync(exitPath, 'utf-8').trim(), '0');
  });

  it('exits with child exit code and writes it to .exit file on failure', () => {
    const result = runWrapper('selftest-failure', execPath, ['-e', 'process.exit(3)']);

    assert.equal(result.status, 3, `wrapper exited ${result.status}; stderr=${result.stderr}`);

    const logPath = parseLogPath(result.stdout);
    const exitPath = logPath.replace(/\.log$/, '.exit');
    assert.ok(existsSync(exitPath), `.exit file not found: ${exitPath}`);
    assert.equal(readFileSync(exitPath, 'utf-8').trim(), '3');
  });

  it('exits 124, writes 124 to .exit, and appends TIMEOUT marker on timeout', () => {
    const result = runWrapper('selftest-timeout', execPath, ['-e', 'setTimeout(()=>{}, 60000)'], {
      AGENT_CMD_TIMEOUT_SECONDS: '1',
    });

    assert.equal(result.status, 124, `wrapper exited ${result.status}; stderr=${result.stderr}`);

    const logPath = parseLogPath(result.stdout);
    assert.ok(existsSync(logPath), `log file not found: ${logPath}`);
    assert.match(readFileSync(logPath, 'utf-8'), /TIMEOUT/);

    const exitPath = logPath.replace(/\.log$/, '.exit');
    assert.ok(existsSync(exitPath), `.exit file not found: ${exitPath}`);
    assert.equal(readFileSync(exitPath, 'utf-8').trim(), '124');
  });

  it('does not overwrite the 124 .exit file after the SIGKILL triggers child close', async () => {
    const result = runWrapper('selftest-timeout', execPath, ['-e', 'setTimeout(()=>{}, 60000)'], {
      AGENT_CMD_TIMEOUT_SECONDS: '1',
    });

    assert.equal(result.status, 124, `wrapper exited ${result.status}; stderr=${result.stderr}`);

    const logPath = parseLogPath(result.stdout);
    const exitPath = logPath.replace(/\.log$/, '.exit');
    assert.equal(readFileSync(exitPath, 'utf-8').trim(), '124');

    await new Promise((resolveSleep) => setTimeout(resolveSleep, 250));
    assert.equal(readFileSync(exitPath, 'utf-8').trim(), '124');
  });
});
