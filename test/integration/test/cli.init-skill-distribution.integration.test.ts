import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { delimiter as pathDelimiter } from 'node:path';
import { join, resolve } from 'pathe';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_SKILL_AGENTS } from '../../../packages/1-framework/3-tooling/cli/src/commands/init/skill-sources';
import { createIntegrationTestDir } from './utils/cli-test-helpers';

const WORKSPACE_ROOT = resolve(import.meta.dirname, '../../..');
const SKILLS_BIN = resolve(WORKSPACE_ROOT, 'node_modules/.bin/skills');
const CLI_BIN = resolve(WORKSPACE_ROOT, 'packages/1-framework/3-tooling/cli/dist/bin.mjs');

/**
 * Runs the workspace-built engine bin's `init` as a real subprocess with the
 * fake package-manager harness on PATH, so every `pnpm add`/`pnpm dlx` the
 * engine's package capability spawns hits the shim.
 */
function runEngineInit(
  testDir: string,
  env: Readonly<Record<string, string | undefined>>,
): { readonly exitCode: number; readonly stderr: string } {
  const result = spawnSync(
    process.execPath,
    [CLI_BIN, 'orm', 'init', '--target', 'postgres', '--authoring', 'psl', '--yes'],
    { cwd: testDir, encoding: 'utf8', env: { ...process.env, ...env } },
  );
  return { exitCode: result.status ?? 1, stderr: result.stderr ?? '' };
}

interface ParsedSkillMetadata {
  readonly name: string;
}

/**
 * Hermetic fixture: a sparse local clone of the tracked skill surfaces at
 * HEAD, built once per test file. The clone reflects what an external consumer
 * sees: tracked files only, no gitignored install targets like
 * `.agents/skills/`. Discovery against this fixture exercises the same
 * priority-dir traversal the upstream CLI does at consumer machines,
 * without any network round-trip.
 */
let workspaceClone: string;

beforeAll(() => {
  workspaceClone = makeWorkspaceClone();
}, 30_000);

afterAll(() => {
  if (workspaceClone) {
    rmSync(workspaceClone, { recursive: true, force: true });
  }
});

describe('init skill distribution (offline integration, real CLI)', () => {
  const testDirs = new Set<string>();

  afterEach(() => {
    for (const dir of testDirs) {
      rmSync(dir, { recursive: true, force: true });
    }
    testDirs.clear();
  });

  it('invokes the shared skills source once per named skill and installs their union', {
    timeout: 60_000,
  }, async () => {
    const testDir = createIntegrationTestDir();
    testDirs.add(testDir);
    writeFileSync(join(testDir, 'pnpm-lock.yaml'), '', 'utf8');

    const { fakeBinDir, logPath } = createFakeDlxHarness(testDir);

    const { exitCode, stderr } = runEngineInit(testDir, {
      PATH: `${fakeBinDir}${pathDelimiter}${process.env['PATH'] ?? ''}`,
      PRISMA_NEXT_SKILLS_BASE: workspaceClone,
      TEST_FAKE_DLX_LOG: logPath,
      INSTALL_INTERNAL_SKILLS: undefined,
      SKILLS_AGENT_AUTO: 'cursor-cli',
    });

    expect(exitCode, stderr).toBe(0);

    const loggedCommands = readLoggedCommands(logPath);
    const agentFlags = (skill: string) =>
      `--agent ${DEFAULT_SKILL_AGENTS.join(' ')} --skill ${skill} -y`;
    expect(loggedCommands).toContain(
      `dlx skills@latest add ${workspaceClone}/skills ${agentFlags('prisma-8')}`,
    );
    expect(loggedCommands).toContain(
      `dlx skills@latest add ${workspaceClone}/skills ${agentFlags('prisma-next-upgrade')}`,
    );
    expect(loggedCommands).toContain(
      `dlx skills@latest add ${workspaceClone}/skills ${agentFlags('prisma-8-extension-upgrade')}`,
    );

    const installed = readInstalledSkillDirs(testDir);
    const expected = readSkillNamesFrom(join(workspaceClone, 'skills'));
    const expectedSorted = Array.from(new Set(expected)).sort();
    expect(installed).toEqual(expectedSorted);
    expect(installed.length).toBeGreaterThan(0);

    const contributorNames = new Set(readContributorSkillNames());
    const leaks = installed.filter((name) => contributorNames.has(name));
    expect(leaks).toEqual([]);
  });

  it('subpath URL form is invoked verbatim (no implicit fallback to bare repo URL)', {
    timeout: 60_000,
  }, async () => {
    const testDir = createIntegrationTestDir();
    testDirs.add(testDir);
    writeFileSync(join(testDir, 'pnpm-lock.yaml'), '', 'utf8');

    const { fakeBinDir, logPath } = createFakeDlxHarness(testDir);

    runEngineInit(testDir, {
      PATH: `${fakeBinDir}${pathDelimiter}${process.env['PATH'] ?? ''}`,
      PRISMA_NEXT_SKILLS_BASE: workspaceClone,
      TEST_FAKE_DLX_LOG: logPath,
      SKILLS_AGENT_AUTO: 'cursor-cli',
    });

    const loggedCommands = readLoggedCommands(logPath);
    const skillsAddCommands = loggedCommands.filter((c) => c.startsWith('dlx skills@latest add'));
    // One shared source, one consolidated multi-agent install per named skill.
    expect(skillsAddCommands).toHaveLength(3);
    for (const command of skillsAddCommands) {
      // Each call's source ends at the `skills` subpath before any
      // flags. A bare repo URL (no `/skills`) would leak contributor
      // skills via priority discovery of `.agents/skills/`; assert
      // the subpath form here.
      expect(command).toMatch(/\/skills(?:\s|$)/);
      expect(command).toMatch(
        /--skill (?:prisma-8|prisma-next-upgrade|prisma-8-extension-upgrade) /,
      );
    }
  });
});

/**
 * Build a sparse local clone of the tracked skill surfaces at HEAD. Local
 * object sharing avoids copying repository history, and sparse checkout avoids
 * materialising thousands of unrelated tracked files.
 */
function makeWorkspaceClone(): string {
  const cloneRoot = join(
    integrationTempRoot(),
    `skills-clone-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  mkdirSync(cloneRoot, { recursive: true });
  execFileSync('git', ['clone', '--local', '--sparse', '-q', WORKSPACE_ROOT, cloneRoot]);
  execFileSync('git', ['-C', cloneRoot, 'sparse-checkout', 'set', 'skills', 'skills-contrib']);
  return cloneRoot;
}

function integrationTempRoot(): string {
  return resolve(import.meta.dirname, '../.tmp');
}

/**
 * Stand-in for `pnpm dlx`. We can't run real `pnpm dlx skills@latest` from
 * an offline test (it would fetch from the npm registry on first run
 * in a fresh pnpm store), and we want to invoke the *real* `skills`
 * binary, not a re-implementation. So the harness replaces `pnpm` on
 * `PATH` with a Node script that:
 *   - logs every invocation (for assertions on the install URL form)
 *   - leaves behind the part of the "installed" project that init reads next
 *     (a stub `@prisma/cli` with a `prisma-cli` bin — see the shim body)
 *   - forwards `pnpm dlx skills@latest add <args>` to the workspace's
 *     `node_modules/.bin/skills` invoked from the consumer's cwd.
 */
function createFakeDlxHarness(testDir: string): {
  readonly fakeBinDir: string;
  readonly logPath: string;
} {
  const fakeBinDir = join(testDir, '.fake-bin');
  const logPath = join(testDir, '.fake-dlx.log');
  mkdirSync(fakeBinDir, { recursive: true });
  writeFileSync(
    join(fakeBinDir, 'pnpm'),
    `#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const cwd = process.cwd();
const logPath = process.env.TEST_FAKE_DLX_LOG;

if (args[0] === 'add' || args[0] === 'install' || args[0] === 'prisma-next') {
  if (args[0] !== 'prisma-next') {
    materializePrismaCliStub(cwd);
  }
  if (logPath) {
    fs.appendFileSync(logPath, JSON.stringify({ cwd, args, status: 0 }) + '\\n', 'utf8');
  }
  process.exit(0);
}

/**
 * The shim reports a successful install without fetching anything, so the
 * project it leaves behind has to contain what \`init\` reads next: init emits
 * by spawning the project-local \`prisma-cli\` binary it resolves through
 * \`@prisma/cli/package.json\`. Without this stub the emit step fails, init
 * settles at exit 5, and the skill install this file is about never runs.
 *
 * The binary only has to exit 0 — no assertion here reads the emitted
 * contract, and the emit path itself is covered by the CLI's own unit tests
 * and by test/e2e/framework/test/init-emit-subprocess.test.ts.
 */
function materializePrismaCliStub(projectDir) {
  const packageDir = path.join(projectDir, 'node_modules', '@prisma', 'cli');
  fs.mkdirSync(packageDir, { recursive: true });
  fs.writeFileSync(
    path.join(packageDir, 'package.json'),
    JSON.stringify({ name: '@prisma/cli', version: '0.0.0-test', bin: { 'prisma-cli': 'bin.mjs' } }),
    'utf8',
  );
  fs.writeFileSync(path.join(packageDir, 'bin.mjs'), 'process.exit(0);\\n', 'utf8');
}

if (args[0] === 'dlx' && (args[1] === 'skills' || args[1] === 'skills@latest') && args[2] === 'add') {
  // Forward to the real CLI, scoped to the consumer cwd.
  const skillsArgs = args.slice(2);
  const result = spawnSync(${JSON.stringify(SKILLS_BIN)}, skillsArgs, {
    cwd,
    stdio: 'pipe',
    env: { ...process.env, SKILLS_AGENT_AUTO: process.env.SKILLS_AGENT_AUTO || 'cursor-cli' },
  });
  if (logPath) {
    fs.appendFileSync(
      logPath,
      JSON.stringify({
        cwd,
        args,
        status: result.status,
        stdout: result.stdout?.toString('utf8') ?? '',
        stderr: result.stderr?.toString('utf8') ?? '',
      }) + '\\n',
      'utf8',
    );
  }
  if (result.status !== 0) {
    process.stderr.write(result.stderr ?? Buffer.from(''));
    process.stdout.write(result.stdout ?? Buffer.from(''));
  }
  process.exit(result.status ?? 1);
}

if (logPath) {
  fs.appendFileSync(logPath, JSON.stringify({ cwd, args, status: 0 }) + '\\n', 'utf8');
}
process.exit(0);
`,
    'utf8',
  );
  // Make the shim executable (POSIX) and provide a Windows shim for parity.
  // chmod is a no-op on Windows.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { chmodSync } = require('node:fs');
  chmodSync(join(fakeBinDir, 'pnpm'), 0o755);
  writeFileSync(
    join(fakeBinDir, 'pnpm.cmd'),
    '@echo off\r\nnode "%~dp0pnpm" %*\r\nexit /b %ERRORLEVEL%\r\n',
    'utf8',
  );
  return { fakeBinDir, logPath };
}

function readLoggedCommands(logPath: string): readonly string[] {
  if (!existsSync(logPath)) return [];
  return readFileSync(logPath, 'utf8')
    .split('\n')
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as { readonly args: readonly string[] })
    .map((entry) => entry.args.join(' '));
}

function readInstalledSkillDirs(testDir: string): readonly string[] {
  const root = join(testDir, '.agents', 'skills');
  return readSkillDirNames(root);
}

function readSkillDirNames(root: string): readonly string[] {
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() || entry.isSymbolicLink())
    .map((entry) => entry.name)
    .sort();
}

function readContributorSkillNames(): readonly string[] {
  return readSkillNamesFrom(join(workspaceClone, 'skills-contrib'));
}

function readSkillNamesFrom(root: string): readonly string[] {
  if (!existsSync(root)) return [];
  const names: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const skillFile = join(root, entry.name, 'SKILL.md');
    if (!existsSync(skillFile)) continue;
    const metadata = parseSkillMetadata(skillFile);
    if (metadata === null) continue;
    names.push(sanitizeSkillDirName(metadata.name || entry.name));
  }
  return Array.from(new Set(names)).sort();
}

function parseSkillMetadata(skillFile: string): ParsedSkillMetadata | null {
  const source = readFileSync(skillFile, 'utf8');
  const normalized = source.replace(/\r\n/g, '\n');
  if (!normalized.startsWith('---\n')) return null;
  const end = normalized.indexOf('\n---\n', 4);
  if (end === -1) return null;

  const lines = normalized.slice(4, end).split('\n');
  let name = '';
  for (const line of lines) {
    if (line.startsWith('name:')) {
      name = line
        .slice('name:'.length)
        .trim()
        .replace(/^['"]|['"]$/g, '');
      break;
    }
  }
  return { name };
}

function sanitizeSkillDirName(name: string): string {
  const sanitized = name
    .toLowerCase()
    .replace(/[^a-z0-9._]+/g, '-')
    .replace(/^[.-]+|[.-]+$/g, '');
  return sanitized.substring(0, 255) || 'unnamed-skill';
}
