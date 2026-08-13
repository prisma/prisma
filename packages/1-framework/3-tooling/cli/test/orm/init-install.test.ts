import { rmSync } from 'node:fs';
import type { MountedTree, PackageManagerId, PackageManagerRunner } from '@prisma/cli-engine';
import { createTestCli } from '@prisma/cli-engine/testing';
import { timeouts } from '@repo/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BIN_COMMANDS, BIN_GROUPS } from '../../src/orm/cli';
import { createInitCommand } from '../../src/orm/init';
import { createTestProjectDir } from '../utils/test-project-dir';

const emit = vi.fn();

/** The production tree, with `init` rebuilt around the injected fake emit. */
const commands: MountedTree = {
  ...BIN_COMMANDS,
  init: createInitCommand({ emitScaffoldedContract: emit }),
};
const groups = BIN_GROUPS;

interface RunnerCall {
  readonly file: string;
  readonly args: readonly string[];
  readonly cwd: string;
}

interface ScriptedResult {
  readonly exitCode: number;
  readonly stderr: string;
}

let projectDir: string;
let calls: RunnerCall[];
let script: ScriptedResult[];

const PNPM_WORKSPACE_LEAK =
  'ERR_PNPM_WORKSPACE_PKG_NOT_FOUND  In : "@prisma/orm-postgres@workspace:*" is in the dependencies but no package named "@prisma/orm-postgres" is present in the workspace';

beforeEach(() => {
  projectDir = createTestProjectDir('orm-init-install');
  calls = [];
  script = [];
  emit.mockReset().mockResolvedValue(undefined);
});

afterEach(() => {
  rmSync(projectDir, { recursive: true, force: true });
});

const runner: PackageManagerRunner = async (request) => {
  calls.push({ file: request.file, args: [...request.args], cwd: request.cwd });
  return script.shift() ?? { exitCode: 0, stderr: '' };
};

function harness(packageManager?: PackageManagerId) {
  return createTestCli({
    commands,
    groups,
    packageManagerRunner: runner,
    ...(packageManager === undefined ? {} : { packageManager }),
  });
}

function scaffoldArgv(...extra: string[]): string[] {
  return ['init', '--target', 'postgres', '--authoring', 'psl', ...extra];
}

function envelopeOf(run: { readonly json: readonly { readonly kind: string }[] }) {
  const terminal = run.json.at(-1);
  return terminal !== undefined && terminal.kind === 'result'
    ? Reflect.get(terminal, 'envelope')
    : undefined;
}

function skillCalls(): readonly RunnerCall[] {
  return calls.filter((call) => call.args.includes('skills@latest'));
}

describe('init installs', () => {
  it(
    'adds the runtime and development dependencies through the capability, then emits',
    async () => {
      const run = await harness().run(scaffoldArgv(), { cwd: projectDir });

      expect(run.exitCode).toBe(0);
      expect(calls.slice(0, 2)).toEqual([
        {
          file: expect.any(String),
          args: ['add', '@prisma/orm-postgres', 'dotenv'],
          cwd: projectDir,
        },
        {
          file: expect.any(String),
          args: ['add', '-D', '@prisma/cli@next', '@prisma/cli-engine', '@types/node'],
          cwd: projectDir,
        },
      ]);
      expect(emit).toHaveBeenCalledWith({ cwd: projectDir });
      expect(run.presented?.data).toMatchObject({
        packagesInstalled: {
          status: 'installed',
          deps: ['@prisma/orm-postgres', 'dotenv'],
          devDeps: ['@prisma/cli@next', '@prisma/cli-engine', '@types/node'],
        },
        contractEmitted: true,
      });
      expect(run.spawns).toEqual([]);
    },
    timeouts.coldTransformImport,
  );

  it(
    'announces each package-manager run as a step',
    async () => {
      const run = await harness().run(scaffoldArgv('--skip-skills'), { cwd: projectDir });

      expect(run.events).toContainEqual(
        expect.objectContaining({
          kind: 'step-started',
          step: expect.stringContaining('add @prisma/orm-postgres dotenv'),
        }),
      );
    },
    timeouts.coldTransformImport,
  );

  it(
    'completes at exit 4 with the install failure as a finding',
    async () => {
      script = [{ exitCode: 1, stderr: 'ENOTFOUND registry.npmjs.org' }];

      const run = await harness().run(scaffoldArgv(), { cwd: projectDir });

      expect(run.exitCode).toBe(4);
      expect(envelopeOf(run)).toMatchObject({
        ok: true,
        exitCode: 4,
        diagnostics: [{ code: 'CLI.INIT_INSTALL_FAILED', severity: 'error' }],
      });
      expect(emit).not.toHaveBeenCalled();
      expect(skillCalls()).toEqual([]);
    },
    timeouts.coldTransformImport,
  );

  it(
    'writes a document that says the install failed, not that it was skipped',
    async () => {
      script = [{ exitCode: 1, stderr: 'ENOTFOUND registry.npmjs.org' }];

      const run = await harness().run(scaffoldArgv(), { cwd: projectDir });

      expect(run.presented?.data).toMatchObject({
        ok: true,
        packagesInstalled: { status: 'failed', deps: [], devDeps: [] },
        contractEmitted: false,
      });
      expect(run.presented?.presentation.json).toMatchObject({
        nextSteps: expect.arrayContaining([
          expect.stringMatching(/Install the project dependencies.*failed/),
        ]),
      });
    },
    timeouts.coldTransformImport,
  );

  it(
    'completes at exit 5 when the contract emit fails after a good install',
    async () => {
      emit.mockRejectedValue(new Error('contract source is not readable'));

      const run = await harness().run(scaffoldArgv(), { cwd: projectDir });

      expect(run.exitCode).toBe(5);
      expect(envelopeOf(run)).toMatchObject({
        ok: true,
        exitCode: 5,
        diagnostics: [{ code: 'CLI.INIT_EMIT_FAILED', severity: 'error' }],
      });
      expect(run.presented?.data).toMatchObject({ contractEmitted: false });
      expect(skillCalls()).toEqual([]);
    },
    timeouts.coldTransformImport,
  );

  it(
    'completes at exit 6 when the agent-skill install fails',
    async () => {
      script = [
        { exitCode: 0, stderr: '' },
        { exitCode: 0, stderr: '' },
        { exitCode: 1, stderr: 'skills: registry unreachable' },
      ];

      const run = await harness().run(scaffoldArgv(), { cwd: projectDir });

      expect(run.exitCode).toBe(6);
      expect(envelopeOf(run)).toMatchObject({
        ok: true,
        exitCode: 6,
        diagnostics: [{ code: 'CLI.INIT_SKILL_INSTALL_FAILED', severity: 'error' }],
      });
      expect(skillCalls()).toHaveLength(1);
    },
    timeouts.coldTransformImport,
  );

  it(
    'sends a failed skill install to the skill commands, never back through init',
    async () => {
      script = [
        { exitCode: 0, stderr: '' },
        { exitCode: 0, stderr: '' },
        { exitCode: 1, stderr: 'skills: registry unreachable' },
      ];

      const run = await harness().run(scaffoldArgv(), { cwd: projectDir });
      const finding = envelopeOf(run)?.diagnostics?.[0];

      expect(finding?.nextActions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            kind: 'run-command',
            command: expect.stringContaining('skills@latest add'),
          }),
        ]),
      );
      expect(JSON.stringify(finding?.nextActions)).not.toContain('prisma-next init');
    },
    timeouts.coldTransformImport,
  );

  it(
    'runs one skill install per source, naming the skill and the agents',
    async () => {
      await harness().run(scaffoldArgv(), { cwd: projectDir });

      const first = skillCalls()[0];

      expect(skillCalls()).toHaveLength(3);
      expect(first).toMatchObject({ cwd: projectDir });
      expect(first?.args).toEqual(
        expect.arrayContaining(['skills@latest', 'add', '--skill', 'prisma-8']),
      );
      expect(first?.args.at(-1)).toBe('-y');
    },
    timeouts.coldTransformImport,
  );

  describe('the pnpm fallback', () => {
    it(
      'retries the pair with npm when pnpm leaks a workspace specifier',
      async () => {
        script = [{ exitCode: 1, stderr: PNPM_WORKSPACE_LEAK }];

        const run = await harness('pnpm').run(scaffoldArgv('--skip-skills'), { cwd: projectDir });

        expect(run.exitCode).toBe(0);
        expect(calls.map((call) => `${call.file} ${call.args.join(' ')}`)).toEqual([
          'pnpm add @prisma/orm-postgres dotenv',
          'npm add @prisma/orm-postgres dotenv',
          'npm add -D @prisma/cli@next @prisma/cli-engine @types/node',
        ]);
        expect(run.events).toContainEqual(
          expect.objectContaining({
            kind: 'message',
            severity: 'warn',
            text: expect.stringContaining('package-lock.json'),
          }),
        );
      },
      timeouts.coldTransformImport,
    );

    it(
      'keeps registry credentials out of the fallback warning',
      async () => {
        script = [
          {
            exitCode: 1,
            stderr: `${PNPM_WORKSPACE_LEAK} https://alice:hunter2@registry.example.com/ //registry.npmjs.org/:_authToken=npm_realsecret`,
          },
        ];

        const run = await harness('pnpm').run(scaffoldArgv('--skip-skills'), { cwd: projectDir });
        const warnings = run.presented?.data;

        expect(JSON.stringify(warnings)).not.toContain('hunter2');
        expect(JSON.stringify(warnings)).not.toContain('npm_realsecret');
        expect(warnings).toMatchObject({
          warnings: expect.arrayContaining([expect.stringContaining('ERR_PNPM_WORKSPACE')]),
        });
      },
      timeouts.coldTransformImport,
    );

    it(
      'drives the agent-skill install with the manager that worked',
      async () => {
        script = [{ exitCode: 1, stderr: PNPM_WORKSPACE_LEAK }];

        await harness('pnpm').run(scaffoldArgv(), { cwd: projectDir });

        expect(skillCalls()[0]?.file).toBe('npx');
      },
      timeouts.coldTransformImport,
    );

    it(
      'completes at exit 4 when npm fails too',
      async () => {
        script = [
          { exitCode: 1, stderr: PNPM_WORKSPACE_LEAK },
          { exitCode: 1, stderr: 'npm ERR! 404 Not Found' },
        ];

        const run = await harness('pnpm').run(scaffoldArgv(), { cwd: projectDir });

        expect(run.exitCode).toBe(4);
        expect(envelopeOf(run)).toMatchObject({
          diagnostics: [{ code: 'CLI.INIT_INSTALL_FAILED' }],
        });
        expect(run.presented?.data).toMatchObject({
          warnings: expect.arrayContaining([
            expect.stringContaining('ERR_PNPM_WORKSPACE_PKG_NOT_FOUND'),
          ]),
        });
      },
      timeouts.coldTransformImport,
    );

    it(
      'does not retry a pnpm failure it does not recognise',
      async () => {
        script = [{ exitCode: 1, stderr: 'EACCES: permission denied' }];

        const run = await harness('pnpm').run(scaffoldArgv(), { cwd: projectDir });

        expect(run.exitCode).toBe(4);
        expect(calls).toHaveLength(1);
      },
      timeouts.coldTransformImport,
    );

    it(
      'does not retry a manager other than pnpm',
      async () => {
        script = [{ exitCode: 1, stderr: PNPM_WORKSPACE_LEAK }];

        const run = await harness('yarn').run(scaffoldArgv(), { cwd: projectDir });

        expect(run.exitCode).toBe(4);
        expect(calls).toHaveLength(1);
      },
      timeouts.coldTransformImport,
    );
  });

  describe('the skip flags', () => {
    it(
      'installs nothing and emits nothing under --skip-install',
      async () => {
        const run = await harness().run(scaffoldArgv('--skip-install', '--skip-skills'), {
          cwd: projectDir,
        });

        expect(run.exitCode).toBe(0);
        expect(calls).toEqual([]);
        expect(emit).not.toHaveBeenCalled();
        expect(run.presented?.data).toMatchObject({
          packagesInstalled: { status: 'skipped', deps: [], devDeps: [] },
          contractEmitted: false,
        });
        expect(run.presented?.presentation.next).toContainEqual(
          expect.objectContaining({ kind: 'run-command', command: 'prisma-cli contract emit' }),
        );
      },
      timeouts.coldTransformImport,
    );

    it(
      'still installs the agent skills when only the dependencies are skipped',
      async () => {
        const run = await harness().run(scaffoldArgv('--skip-install'), { cwd: projectDir });

        expect(run.exitCode).toBe(0);
        expect(skillCalls()).toHaveLength(3);
      },
      timeouts.coldTransformImport,
    );

    it(
      'warns about the skipped skills under --skip-skills, naming the install commands',
      async () => {
        const run = await harness().run(scaffoldArgv('--skip-skills'), { cwd: projectDir });
        const warnings = run.presented?.presentation.json;

        expect(skillCalls()).toEqual([]);
        expect(warnings).toMatchObject({
          warnings: expect.arrayContaining([
            expect.stringContaining('--skip-skills'),
            expect.stringContaining('skills@latest add'),
          ]),
        });
        expect(JSON.stringify(warnings)).not.toContain('prisma-next init --skip-install');
      },
      timeouts.coldTransformImport,
    );
  });

  describe('a host with no package-manager runner', () => {
    it(
      'reports the install failure rather than pretending it installed',
      async () => {
        const run = await createTestCli({ commands, groups }).run(scaffoldArgv(), {
          cwd: projectDir,
        });

        expect(run.exitCode).toBe(4);
        expect(envelopeOf(run)).toMatchObject({
          diagnostics: [{ code: 'CLI.INIT_INSTALL_FAILED' }],
        });
      },
      timeouts.coldTransformImport,
    );
  });
});
