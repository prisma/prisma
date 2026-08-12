import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { delimiter as pathDelimiter } from 'node:path';
import { join, resolve } from 'pathe';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { INIT_EXIT_OK } from '../../../packages/1-framework/3-tooling/cli/src/commands/init/exit-codes';
import { runInit } from '../../../packages/1-framework/3-tooling/cli/src/commands/init/init';
import { DEFAULT_SKILL_AGENTS } from '../../../packages/1-framework/3-tooling/cli/src/commands/init/skill-install';
import { createIntegrationTestDir } from './utils/cli-test-helpers';

const WORKSPACE_ROOT = resolve(import.meta.dirname, '../../..');
const SKILLS_BIN = resolve(WORKSPACE_ROOT, 'node_modules/.bin/skills');

const NONINTERACTIVE_FLAGS = {
  format: 'pretty',
  explicitFormat: false,
  json: false,
  quiet: true,
  verbose: 0,
  color: false,
  interactive: false,
  yes: true,
} as const;

interface ParsedSkillMetadata {
  readonly name: string;
}

/**
 * Hermetic fixture: a `git clone --depth 1` of the working tree at HEAD,
 * built once per test file. The clone reflects what an external consumer
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

    const previousPath = process.env['PATH'];
    const previousBase = process.env['PRISMA_NEXT_SKILLS_BASE'];
    const previousLog = process.env['TEST_FAKE_DLX_LOG'];
    const previousInternal = process.env['INSTALL_INTERNAL_SKILLS'];
    const previousAuto = process.env['SKILLS_AGENT_AUTO'];

    process.env['PATH'] = `${fakeBinDir}${pathDelimiter}${previousPath ?? ''}`;
    process.env['PRISMA_NEXT_SKILLS_BASE'] = workspaceClone;
    process.env['TEST_FAKE_DLX_LOG'] = logPath;
    delete process.env['INSTALL_INTERNAL_SKILLS'];
    process.env['SKILLS_AGENT_AUTO'] = 'cursor-cli';

    try {
      const exitCode = await runInit(testDir, {
        options: { target: 'postgres', authoring: 'psl', install: true },
        flags: NONINTERACTIVE_FLAGS,
        canPrompt: false,
      });

      expect(exitCode).toBe(INIT_EXIT_OK);

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
    } finally {
      restoreEnvVar('PATH', previousPath);
      restoreEnvVar('PRISMA_NEXT_SKILLS_BASE', previousBase);
      restoreEnvVar('TEST_FAKE_DLX_LOG', previousLog);
      restoreEnvVar('INSTALL_INTERNAL_SKILLS', previousInternal);
      restoreEnvVar('SKILLS_AGENT_AUTO', previousAuto);
    }
  });

  it('subpath URL form is invoked verbatim (no implicit fallback to bare repo URL)', {
    timeout: 60_000,
  }, async () => {
    const testDir = createIntegrationTestDir();
    testDirs.add(testDir);
    writeFileSync(join(testDir, 'pnpm-lock.yaml'), '', 'utf8');

    const { fakeBinDir, logPath } = createFakeDlxHarness(testDir);

    const previousPath = process.env['PATH'];
    const previousBase = process.env['PRISMA_NEXT_SKILLS_BASE'];
    const previousLog = process.env['TEST_FAKE_DLX_LOG'];
    const previousAuto = process.env['SKILLS_AGENT_AUTO'];

    process.env['PATH'] = `${fakeBinDir}${pathDelimiter}${previousPath ?? ''}`;
    process.env['PRISMA_NEXT_SKILLS_BASE'] = workspaceClone;
    process.env['TEST_FAKE_DLX_LOG'] = logPath;
    process.env['SKILLS_AGENT_AUTO'] = 'cursor-cli';

    try {
      await runInit(testDir, {
        options: { target: 'postgres', authoring: 'psl', install: true },
        flags: NONINTERACTIVE_FLAGS,
        canPrompt: false,
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
    } finally {
      restoreEnvVar('PATH', previousPath);
      restoreEnvVar('PRISMA_NEXT_SKILLS_BASE', previousBase);
      restoreEnvVar('TEST_FAKE_DLX_LOG', previousLog);
      restoreEnvVar('SKILLS_AGENT_AUTO', previousAuto);
    }
  });
});

/**
 * Build a fresh `git clone --depth 1` of the working tree at HEAD into a
 * tempdir. The clone reflects only tracked files (no `node_modules`, no
 * gitignored `.agents/skills/`), giving us the same view an external
 * consumer would see after `git clone`.
 */
function makeWorkspaceClone(): string {
  const cloneRoot = join(
    integrationTempRoot(),
    `skills-clone-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  mkdirSync(cloneRoot, { recursive: true });
  execFileSync('git', ['clone', '--depth', '1', '--no-local', '-q', WORKSPACE_ROOT, cloneRoot], {
    stdio: 'inherit',
  });
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
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const cwd = process.cwd();
const logPath = process.env.TEST_FAKE_DLX_LOG;

if (args[0] === 'add' || args[0] === 'install' || args[0] === 'prisma-next') {
  if (logPath) {
    fs.appendFileSync(logPath, JSON.stringify({ cwd, args, status: 0 }) + '\\n', 'utf8');
  }
  process.exit(0);
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

function restoreEnvVar(name: string, previous: string | undefined): void {
  if (previous === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = previous;
  }
}
