import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { timeouts } from '@repo/test-utils';
import { join } from 'pathe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@clack/prompts', () => ({
  intro: vi.fn(),
  outro: vi.fn(),
  cancel: vi.fn(),
  isCancel: vi.fn(() => false),
  select: vi.fn(async () => 'postgres'),
  text: vi.fn(async () => 'src/prisma/contract.prisma'),
  confirm: vi.fn(async () => true),
  note: vi.fn(),
  log: {
    message: vi.fn(),
    success: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    step: vi.fn(),
  },
  spinner: vi.fn(() => ({
    start: vi.fn(),
    stop: vi.fn(),
    cancel: vi.fn(),
    error: vi.fn(),
    message: vi.fn(),
    clear: vi.fn(),
    isCancelled: false,
  })),
}));

vi.mock('node:child_process', () => ({
  execFile: vi.fn(
    (_cmd: string, _args: string[], _opts: Record<string, unknown>, cb: (err: null) => void) =>
      cb(null),
  ),
}));

vi.mock('../../../src/control-api/operations/contract-emit', () => ({
  executeContractEmit: vi.fn(async () => ({
    storageHash: 'test-hash',
    profileHash: 'test-profile',
    files: { json: 'contract.json', dts: 'contract.d.ts' },
  })),
}));

// init loads the config it just scaffolded before handing it to the emit
// operation; the scaffolded project's dependencies are not installed here.
vi.mock('@internal/config-loader', async () => {
  const { ok } = await import('@internal/utils/result');
  return { loadConfigForSections: vi.fn(async () => ok({ contract: {} })) };
});

import { execFile } from 'node:child_process';
import * as clack from '@clack/prompts';
import { buildCatalogWarnings } from '../../../src/commands/init/catalog-warnings';
import { detectPnpmCatalogOverrides } from '../../../src/commands/init/detect-pnpm-catalog';
import {
  INIT_EXIT_EMIT_FAILED,
  INIT_EXIT_INSTALL_FAILED,
  INIT_EXIT_INTERNAL_ERROR,
  INIT_EXIT_OK,
  INIT_EXIT_PRECONDITION,
  INIT_EXIT_USER_ABORTED,
} from '../../../src/commands/init/exit-codes';
import {
  exitCodeForError,
  hasDirectDep,
  redactSecrets,
  runInit,
} from '../../../src/commands/init/init';
import type { InitFlagOptions } from '../../../src/commands/init/inputs';
import { isRecognisedPnpmResolutionError } from '../../../src/commands/init/pnpm-fallback';
import type { ProbeOverrides } from '../../../src/commands/init/probe-db';
import type { GlobalFlags } from '../../../src/utils/global-flags';

/**
 * Test wrapper that defaults `canPrompt` from `flags.interactive` so the
 * test cases below remain readable. The real action handler in
 * `commands/init/index.ts` derives `canPrompt` from a stdin-TTY check
 * merged with `--interactive`; tests that want to exercise the
 * "decoration on, prompts off" combination (stdout TTY, stdin closed)
 * pass `canPrompt: false` explicitly.
 */
async function runInitTest(
  tmpDir: string,
  args: {
    readonly options: InitFlagOptions;
    readonly flags: GlobalFlags;
    readonly canPrompt?: boolean;
    readonly probeOverrides?: ProbeOverrides;
  },
): Promise<number> {
  return runInit(tmpDir, {
    options: args.options,
    flags: args.flags,
    canPrompt: args.canPrompt ?? args.flags.interactive !== false,
    ...(args.probeOverrides !== undefined ? { probeOverrides: args.probeOverrides } : {}),
  });
}

/**
 * GlobalFlags shape for an interactive run with stdout to a TTY. Tests
 * that drive `runInit` directly construct one of these rather than going
 * through `parseGlobalFlags`, which inspects `process.stdout.isTTY` and
 * is not deterministic across CI / local runs.
 */
const interactiveFlags = (overrides: Partial<GlobalFlags> = {}): GlobalFlags => ({
  format: 'pretty',
  explicitFormat: false,
  json: false,
  quiet: false,
  verbose: 0,
  color: false,
  interactive: true,
  yes: false,
  ...overrides,
});

const noninteractiveFlags = (overrides: Partial<GlobalFlags> = {}): GlobalFlags => ({
  format: 'pretty',
  explicitFormat: false,
  json: false,
  quiet: true,
  verbose: 0,
  color: false,
  interactive: false,
  yes: true,
  ...overrides,
});

describe('runInit (interactive)', { timeout: timeouts.databaseOperation }, () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'init-test-'));
    writeFileSync(join(tmpDir, 'package.json'), JSON.stringify({ name: 'test-app' }));
    vi.clearAllMocks();
    vi.mocked(clack.isCancel).mockReturnValue(false);
    vi.mocked(clack.select)
      .mockReset()
      .mockResolvedValueOnce('postgres')
      .mockResolvedValueOnce('psl');
    vi.mocked(clack.text).mockResolvedValue('src/prisma/contract.prisma');
    vi.mocked(clack.confirm).mockResolvedValue(true);
  }, timeouts.databaseOperation);

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  }, timeouts.databaseOperation);

  it('scaffolds the per-target files (no skill template — install handled by Prisma Next skills)', async () => {
    const exit = await runInitTest(tmpDir, {
      options: { install: false },
      flags: interactiveFlags(),
    });
    expect(exit).toBe(INIT_EXIT_OK);
    expect(existsSync(join(tmpDir, 'src/prisma/contract.prisma'))).toBe(true);
    expect(existsSync(join(tmpDir, 'prisma-next.config.ts'))).toBe(true);
    expect(existsSync(join(tmpDir, 'src/prisma/db.ts'))).toBe(true);
    expect(existsSync(join(tmpDir, 'prisma-next.md'))).toBe(true);
    // init must not emit `.agents/skills/prisma-8/SKILL.md`.
    expect(existsSync(join(tmpDir, '.agents/skills/prisma-8/SKILL.md'))).toBe(false);
  });

  it('removes retired per-workflow skill directories left by pre-consolidation installs', async () => {
    mkdirSync(join(tmpDir, '.claude/skills/prisma-next-queries'), { recursive: true });
    writeFileSync(join(tmpDir, '.claude/skills/prisma-next-queries/SKILL.md'), '# stale');
    writeFileSync(join(tmpDir, '.claude/skills/prisma-next-queries/postgres.md'), '# stale');
    mkdirSync(join(tmpDir, '.agents/skills/prisma-next-contract'), { recursive: true });
    writeFileSync(join(tmpDir, '.agents/skills/prisma-next-contract/SKILL.md'), '# stale');
    mkdirSync(join(tmpDir, '.agents/skills/prisma-next'), { recursive: true });
    writeFileSync(join(tmpDir, '.agents/skills/prisma-next/SKILL.md'), '# pre-rename');

    const exit = await runInitTest(tmpDir, {
      options: { install: false },
      flags: interactiveFlags(),
    });
    expect(exit).toBe(INIT_EXIT_OK);
    expect(existsSync(join(tmpDir, '.claude/skills/prisma-next-queries'))).toBe(false);
    expect(existsSync(join(tmpDir, '.agents/skills/prisma-next-contract'))).toBe(false);
    expect(existsSync(join(tmpDir, '.agents/skills/prisma-next'))).toBe(false);
  });

  it('generates config with single facade import and contract as string path', async () => {
    await runInitTest(tmpDir, { options: { install: false }, flags: interactiveFlags() });

    const config = readFileSync(join(tmpDir, 'prisma-next.config.ts'), 'utf-8');
    expect(config).toContain("from '@prisma/orm-postgres/config'");
    expect(config).toContain('contract: "./src/prisma/contract.prisma"');
    const imports = config.split('\n').filter((l) => l.includes("from '@prisma/orm-"));
    expect(imports).toHaveLength(1);
  });

  it('generates db.ts with a single runtime import from the database package', async () => {
    await runInitTest(tmpDir, { options: { install: false }, flags: interactiveFlags() });

    const db = readFileSync(join(tmpDir, 'src/prisma/db.ts'), 'utf-8');
    const prismaImports = db.split('\n').filter((l) => l.includes("from '@prisma/orm-"));
    expect(prismaImports).toHaveLength(1);
    expect(prismaImports[0]).toContain('@prisma/orm-postgres/runtime');
  });

  it('generates PSL starter schema with User and Post models', async () => {
    await runInitTest(tmpDir, { options: { install: false }, flags: interactiveFlags() });

    const schema = readFileSync(join(tmpDir, 'src/prisma/contract.prisma'), 'utf-8');
    expect(schema).toContain('model User');
    expect(schema).toContain('model Post');
  });

  it('scaffolds TypeScript contract when typescript authoring is selected', async () => {
    vi.mocked(clack.select)
      .mockReset()
      .mockResolvedValueOnce('postgres')
      .mockResolvedValueOnce('typescript');
    vi.mocked(clack.text).mockResolvedValue('src/prisma/contract.ts');

    await runInitTest(tmpDir, { options: { install: false }, flags: interactiveFlags() });

    const schema = readFileSync(join(tmpDir, 'src/prisma/contract.ts'), 'utf-8');
    expect(schema).toContain('defineContract');
    expect(schema).toContain("from '@prisma/orm-postgres/contract-builder'");

    const config = readFileSync(join(tmpDir, 'prisma-next.config.ts'), 'utf-8');
    expect(config).toContain('contract: "./src/prisma/contract.ts"');
  });

  it('the schema-path prompt rejects an extension that does not match the chosen authoring', async () => {
    // PSL authoring → schema must end in .prisma; TS authoring → must end in .ts.
    // Drive the prompt twice and capture the inline `validate` callback in
    // each direction.
    vi.mocked(clack.select)
      .mockReset()
      .mockResolvedValueOnce('postgres')
      .mockResolvedValueOnce('psl');
    vi.mocked(clack.text).mockResolvedValueOnce('src/prisma/contract.prisma');
    await runInitTest(tmpDir, { options: { install: false }, flags: interactiveFlags() });

    const pslPromptCall = vi.mocked(clack.text).mock.calls[0]?.[0];
    expect(pslPromptCall?.validate).toBeDefined();
    const validatePsl = pslPromptCall?.validate as (v: string | undefined) => string | undefined;
    expect(validatePsl('src/prisma/contract.ts')).toMatch(/\.prisma.*--authoring psl/);
    expect(validatePsl('src/prisma/contract.prisma')).toBeUndefined();

    rmSync(tmpDir, { recursive: true, force: true });
    tmpDir = mkdtempSync(join(tmpdir(), 'init-test-'));
    writeFileSync(join(tmpDir, 'package.json'), JSON.stringify({ name: 'test-app' }));
    vi.mocked(clack.text).mockReset();
    vi.mocked(clack.select)
      .mockReset()
      .mockResolvedValueOnce('postgres')
      .mockResolvedValueOnce('typescript');
    vi.mocked(clack.text).mockResolvedValueOnce('src/prisma/contract.ts');
    await runInitTest(tmpDir, { options: { install: false }, flags: interactiveFlags() });

    const tsPromptCall = vi.mocked(clack.text).mock.calls[0]?.[0];
    const validateTs = tsPromptCall?.validate as (v: string | undefined) => string | undefined;
    expect(validateTs('src/prisma/contract.prisma')).toMatch(/\.ts.*--authoring typescript/);
    expect(validateTs('src/prisma/contract.ts')).toBeUndefined();
  });

  it('exits PRECONDITION if a mismatched schema path bypasses the prompt validator (defence-in-depth)', async () => {
    // The test stub bypasses clack's interactive validate loop, so the
    // post-prompt `validateSchemaPath` is the safety net that keeps a
    // .ts path from being accepted under PSL authoring.
    vi.mocked(clack.select)
      .mockReset()
      .mockResolvedValueOnce('postgres')
      .mockResolvedValueOnce('psl');
    vi.mocked(clack.text).mockResolvedValue('prisma/contract.ts');

    const exit = await runInitTest(tmpDir, {
      options: { install: false },
      flags: interactiveFlags(),
    });
    expect(exit).toBe(INIT_EXIT_PRECONDITION);
    expect(existsSync(join(tmpDir, 'prisma/contract.prisma'))).toBe(false);
    expect(existsSync(join(tmpDir, 'prisma/contract.ts'))).toBe(false);
  });

  it('prompts once to re-initialize when prisma-next.config.ts exists', async () => {
    writeFileSync(join(tmpDir, 'prisma-next.config.ts'), 'existing config');

    // Pass `writeEnv: false` so the FR3.2 opt-in prompt does not fire —
    // we want to lock in the re-init prompt's contract specifically here.
    await runInitTest(tmpDir, {
      options: { install: false, writeEnv: false },
      flags: interactiveFlags(),
    });

    expect(clack.confirm).toHaveBeenCalledTimes(1);
    // Style Guide § Destructive operation confirmation requires the prompt
    // to name the destructive consequence (overwriting generated files)
    // and disclose that it is the project being re-initialised, so the
    // user can decline knowing what's at stake. Lock that contract in.
    expect(clack.confirm).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringMatching(/already initialized.*Re-initialize.*overwrite/i),
        initialValue: false,
      }),
    );
  });

  it('overwrites all files when re-init is accepted', async () => {
    mkdirSync(join(tmpDir, 'src/prisma'), { recursive: true });
    writeFileSync(join(tmpDir, 'prisma-next.config.ts'), 'old config');
    writeFileSync(join(tmpDir, 'src/prisma/contract.prisma'), 'old schema');

    vi.mocked(clack.confirm).mockResolvedValue(true);

    await runInitTest(tmpDir, { options: { install: false }, flags: interactiveFlags() });

    const config = readFileSync(join(tmpDir, 'prisma-next.config.ts'), 'utf-8');
    expect(config).not.toBe('old config');
    expect(config).toContain("from '@prisma/orm-postgres/config'");

    const schema = readFileSync(join(tmpDir, 'src/prisma/contract.prisma'), 'utf-8');
    expect(schema).not.toBe('old schema');
    expect(schema).toContain('model User');
  });

  it('exits with USER_ABORTED and no changes when re-init is declined', async () => {
    writeFileSync(join(tmpDir, 'prisma-next.config.ts'), 'existing config');
    vi.mocked(clack.confirm).mockResolvedValue(false);

    const exit = await runInitTest(tmpDir, {
      options: { install: false },
      flags: interactiveFlags(),
    });

    expect(exit).toBe(INIT_EXIT_USER_ABORTED);
    const config = readFileSync(join(tmpDir, 'prisma-next.config.ts'), 'utf-8');
    expect(config).toBe('existing config');
  });

  it('does not prompt for re-init when prisma-next.config.ts does not exist', async () => {
    // Pass `writeEnv: false` to suppress the FR3.2 opt-in prompt — this
    // test specifically asserts the re-init confirm does not fire on a
    // green-field run.
    await runInitTest(tmpDir, {
      options: { install: false, writeEnv: false },
      flags: interactiveFlags(),
    });

    expect(clack.confirm).not.toHaveBeenCalled();
  });

  it('on target switch, prompts to confirm removing the previous facade dep (FR9.2)', async () => {
    writeFileSync(join(tmpDir, 'prisma-next.config.ts'), 'old config');
    writeFileSync(
      join(tmpDir, 'package.json'),
      JSON.stringify({ name: 'app', dependencies: { '@internal/postgres': '^1.0.0' } }),
    );
    vi.mocked(clack.select).mockReset().mockResolvedValueOnce('mongo').mockResolvedValueOnce('psl');
    // reinit confirm → true, write-env → false, facade removal → true
    vi.mocked(clack.confirm)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);

    await runInitTest(tmpDir, { options: { install: false }, flags: interactiveFlags() });

    expect(clack.confirm).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringMatching(
          /Switching from PostgreSQL to MongoDB.*remove @internal\/postgres/,
        ),
        initialValue: true,
      }),
    );
    const pkg = JSON.parse(readFileSync(join(tmpDir, 'package.json'), 'utf-8')) as {
      dependencies: Record<string, string>;
    };
    expect(pkg.dependencies['@internal/postgres']).toBeUndefined();
  });

  it('keeps the previous facade dep when the target-switch confirm is declined (FR9.2)', async () => {
    writeFileSync(join(tmpDir, 'prisma-next.config.ts'), 'old config');
    writeFileSync(
      join(tmpDir, 'package.json'),
      JSON.stringify({ name: 'app', dependencies: { '@internal/postgres': '^1.0.0' } }),
    );
    vi.mocked(clack.select).mockReset().mockResolvedValueOnce('mongo').mockResolvedValueOnce('psl');
    // reinit confirm → true, write-env → false, facade removal → false
    vi.mocked(clack.confirm)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false);

    await runInitTest(tmpDir, { options: { install: false }, flags: interactiveFlags() });

    const pkg = JSON.parse(readFileSync(join(tmpDir, 'package.json'), 'utf-8')) as {
      dependencies: Record<string, string>;
    };
    expect(pkg.dependencies['@internal/postgres']).toBe('^1.0.0');
  });

  it('prompts for the .env opt-in interactively (FR3.2) and writes .env when accepted', async () => {
    vi.mocked(clack.confirm).mockResolvedValue(true);
    await runInitTest(tmpDir, {
      options: { install: false },
      flags: interactiveFlags(),
    });

    expect(clack.confirm).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringMatching(/\.env/i),
      }),
    );
    expect(existsSync(join(tmpDir, '.env'))).toBe(true);
  });

  it('does not write .env when the FR3.2 prompt is declined', async () => {
    vi.mocked(clack.confirm).mockResolvedValue(false);
    await runInitTest(tmpDir, {
      options: { install: false },
      flags: interactiveFlags(),
    });
    expect(existsSync(join(tmpDir, '.env'))).toBe(false);
    expect(existsSync(join(tmpDir, '.env.example'))).toBe(true);
  });

  it('skips the FR3.2 prompt entirely when --write-env is passed explicitly', async () => {
    vi.mocked(clack.confirm).mockClear();
    await runInitTest(tmpDir, {
      options: { install: false, writeEnv: true },
      flags: interactiveFlags(),
    });
    expect(clack.confirm).not.toHaveBeenCalled();
    expect(existsSync(join(tmpDir, '.env'))).toBe(true);
  });

  it('normalizes configPath when schema path starts with ./', async () => {
    vi.mocked(clack.text).mockResolvedValue('./prisma/contract.prisma');

    await runInitTest(tmpDir, { options: { install: false }, flags: interactiveFlags() });

    const config = readFileSync(join(tmpDir, 'prisma-next.config.ts'), 'utf-8');
    expect(config).toContain('contract: "./prisma/contract.prisma"');
    expect(config).not.toContain('.//');
  });

  it('with --no-install skips dependency installation and emit', async () => {
    await runInitTest(tmpDir, { options: { install: false }, flags: interactiveFlags() });

    const dependencyInstallCalls = vi.mocked(execFile).mock.calls.filter(
      ([, args]) =>
        // `--skill prisma-next` in the skills install carries the same
        // literal as the devDep — exclude skills invocations first.
        !(args as string[]).includes('skills@latest') &&
        (args as string[]).some((arg) =>
          ['@prisma/orm-postgres', 'dotenv', 'prisma-next', '@types/node'].includes(arg),
        ),
    );
    expect(dependencyInstallCalls).toHaveLength(0);
    expect(
      vi.mocked(execFile).mock.calls.some(([, args]) => {
        const commandArgs = args as string[];
        return (
          commandArgs.includes('skills@latest') &&
          commandArgs.includes('add') &&
          commandArgs.some((arg) => arg.includes('/skills#v')) &&
          commandArgs.includes('--agent') &&
          commandArgs.includes('cursor') &&
          commandArgs.includes('claude-code') &&
          commandArgs.includes('codex')
        );
      }),
    ).toBe(true);
    expect(existsSync(join(tmpDir, 'prisma/contract.json'))).toBe(false);
    expect(existsSync(join(tmpDir, 'prisma/contract.d.ts'))).toBe(false);
  });

  it('detects pnpm and installs dependencies', async () => {
    writeFileSync(join(tmpDir, 'pnpm-lock.yaml'), '');

    await runInitTest(tmpDir, { options: { install: true }, flags: interactiveFlags() });

    expect(execFile).toHaveBeenCalledWith(
      'pnpm',
      ['add', '@prisma/orm-postgres', 'dotenv'],
      expect.anything(),
      expect.any(Function),
    );
    expect(execFile).toHaveBeenCalledWith(
      'pnpm',
      ['add', '-D', 'prisma-next', '@types/node'],
      expect.anything(),
      expect.any(Function),
    );
  });

  it('detects deno and installs with npm: prefix', async () => {
    rmSync(join(tmpDir, 'package.json'));
    writeFileSync(join(tmpDir, 'deno.json'), '{}');
    writeFileSync(join(tmpDir, 'deno.lock'), '{}');

    await runInitTest(tmpDir, { options: { install: true }, flags: interactiveFlags() });

    expect(execFile).toHaveBeenCalledWith(
      'deno',
      ['add', 'npm:@prisma/orm-postgres', 'npm:dotenv'],
      expect.anything(),
      expect.any(Function),
    );
    expect(execFile).toHaveBeenCalledWith(
      'deno',
      ['add', '--dev', 'npm:prisma-next', 'npm:@types/node'],
      expect.anything(),
      expect.any(Function),
    );
  });

  it('shows prisma-next.md in outro', async () => {
    writeFileSync(join(tmpDir, 'pnpm-lock.yaml'), '');

    await runInitTest(tmpDir, { options: { install: true }, flags: interactiveFlags() });

    const outroCall = vi.mocked(clack.outro).mock.calls[0]?.[0] as string | undefined;
    expect(outroCall).toContain('prisma-next.md');
  });

  it('auto-creates a minimal package.json when no manifest exists (TML-2496)', async () => {
    rmSync(join(tmpDir, 'package.json'));

    const exit = await runInitTest(tmpDir, {
      options: { install: false },
      flags: interactiveFlags(),
    });

    expect(exit).toBe(INIT_EXIT_OK);
    expect(existsSync(join(tmpDir, 'package.json'))).toBe(true);
    const pkg = JSON.parse(readFileSync(join(tmpDir, 'package.json'), 'utf-8')) as {
      name: string;
      private: boolean;
      type: string;
      scripts: Record<string, string>;
    };
    expect(pkg.name).toBeTypeOf('string');
    expect(pkg.name.length).toBeGreaterThan(0);
    expect(pkg.private).toBe(true);
    expect(pkg.type).toBe('module');
    // The newly-created package.json still flows through the FR3.5 scripts
    // merge, so the contract:emit script lands in one shot.
    expect(pkg.scripts['contract:emit']).toBe('prisma-next contract emit');
    expect(existsSync(join(tmpDir, 'prisma-next.config.ts'))).toBe(true);
  });

  it('does not auto-create package.json when a deno manifest exists', async () => {
    rmSync(join(tmpDir, 'package.json'));
    writeFileSync(join(tmpDir, 'deno.json'), '{}');
    writeFileSync(join(tmpDir, 'deno.lock'), '{}');

    const exit = await runInitTest(tmpDir, {
      options: { install: false },
      flags: interactiveFlags(),
    });

    expect(exit).toBe(INIT_EXIT_OK);
    expect(existsSync(join(tmpDir, 'package.json'))).toBe(false);
  });

  it('accepts deno.json as project manifest', async () => {
    rmSync(join(tmpDir, 'package.json'));
    writeFileSync(join(tmpDir, 'deno.json'), '{}');
    writeFileSync(join(tmpDir, 'deno.lock'), '{}');

    await runInitTest(tmpDir, { options: { install: false }, flags: interactiveFlags() });

    expect(existsSync(join(tmpDir, 'prisma-next.config.ts'))).toBe(true);
  });

  it('accepts deno.jsonc as project manifest', async () => {
    rmSync(join(tmpDir, 'package.json'));
    writeFileSync(join(tmpDir, 'deno.jsonc'), '{}');

    await runInitTest(tmpDir, { options: { install: false }, flags: interactiveFlags() });

    expect(existsSync(join(tmpDir, 'prisma-next.config.ts'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// FR2 / FR3 — Project hygiene + scaffold typechecks (M4)
// ---------------------------------------------------------------------------

describe('runInit hygiene + tsconfig (FR2 / FR3)', { timeout: timeouts.databaseOperation }, () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'init-hygiene-'));
    writeFileSync(join(tmpDir, 'package.json'), JSON.stringify({ name: 'test-app' }));
    vi.clearAllMocks();
  }, timeouts.databaseOperation);

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  }, timeouts.databaseOperation);

  it('writes a fresh tsconfig.json with types: ["node"] (FR2.2)', async () => {
    await runInitTest(tmpDir, {
      options: { target: 'postgres', authoring: 'psl', install: false },
      flags: noninteractiveFlags(),
    });
    const tsconfig = JSON.parse(readFileSync(join(tmpDir, 'tsconfig.json'), 'utf-8')) as {
      compilerOptions: { types: string[] };
    };
    expect(tsconfig.compilerOptions.types).toContain('node');
  });

  it('merges types: ["node"] into an existing tsconfig.json without clobbering user types', async () => {
    writeFileSync(
      join(tmpDir, 'tsconfig.json'),
      JSON.stringify({ compilerOptions: { strict: true, types: ['vitest/globals'] } }),
    );
    await runInitTest(tmpDir, {
      options: { target: 'postgres', authoring: 'psl', install: false },
      flags: noninteractiveFlags(),
    });
    const tsconfig = JSON.parse(readFileSync(join(tmpDir, 'tsconfig.json'), 'utf-8')) as {
      compilerOptions: { strict: boolean; types: string[] };
    };
    expect(tsconfig.compilerOptions.strict).toBe(true);
    expect(tsconfig.compilerOptions.types).toEqual(
      expect.arrayContaining(['vitest/globals', 'node']),
    );
  });

  it('writes a target-appropriate .env.example with min DB version comment (FR3.1)', async () => {
    await runInitTest(tmpDir, {
      options: { target: 'mongodb', authoring: 'psl', install: false },
      flags: noninteractiveFlags(),
    });
    const envExample = readFileSync(join(tmpDir, '.env.example'), 'utf-8');
    expect(envExample).toContain('DATABASE_URL=');
    expect(envExample).toContain('mongodb://');
    expect(envExample).toMatch(/Requires MongoDB >= \d/);
  });

  it('does not write .env when --write-env is not supplied (FR3.2 default)', async () => {
    await runInitTest(tmpDir, {
      options: { target: 'postgres', authoring: 'psl', install: false },
      flags: noninteractiveFlags(),
    });
    expect(existsSync(join(tmpDir, '.env'))).toBe(false);
    expect(existsSync(join(tmpDir, '.env.example'))).toBe(true);
  });

  it('writes .env when --write-env is supplied (FR3.2 opt-in)', async () => {
    await runInitTest(tmpDir, {
      options: { target: 'postgres', authoring: 'psl', writeEnv: true, install: false },
      flags: noninteractiveFlags(),
    });
    const envFile = readFileSync(join(tmpDir, '.env'), 'utf-8');
    expect(envFile).toContain('DATABASE_URL=');
  });

  it('never overwrites an existing .env even with --write-env (secrets are sacred)', async () => {
    writeFileSync(join(tmpDir, '.env'), 'DATABASE_URL=secret://existing');
    await runInitTest(tmpDir, {
      options: { target: 'postgres', authoring: 'psl', writeEnv: true, install: false },
      flags: noninteractiveFlags({ json: true }),
    });
    expect(readFileSync(join(tmpDir, '.env'), 'utf-8')).toBe('DATABASE_URL=secret://existing');
  });

  it('never overwrites an existing README.md when src/index.ts is present', async () => {
    mkdirSync(join(tmpDir, 'src'), { recursive: true });
    writeFileSync(join(tmpDir, 'src/index.ts'), 'export {}');
    writeFileSync(join(tmpDir, 'README.md'), '# user-authored readme');

    const writes: string[] = [];
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown) => {
      if (typeof chunk === 'string') writes.push(chunk);
      else if (chunk instanceof Uint8Array) writes.push(Buffer.from(chunk).toString('utf-8'));
      return true;
    });
    try {
      await runInitTest(tmpDir, {
        options: { target: 'postgres', authoring: 'psl', install: false },
        flags: noninteractiveFlags({ json: true }),
      });
      expect(readFileSync(join(tmpDir, 'README.md'), 'utf-8')).toBe('# user-authored readme');
      const parsed = JSON.parse(writes.join('').trim()) as { warnings: string[] };
      expect(parsed.warnings.join('\n')).toMatch(/README\.md already exists/);
    } finally {
      spy.mockRestore();
    }
  });

  it('writes .gitignore with .env, dist/, node_modules/ when missing (FR3.3)', async () => {
    await runInitTest(tmpDir, {
      options: { target: 'postgres', authoring: 'psl', install: false },
      flags: noninteractiveFlags(),
    });
    const gitignore = readFileSync(join(tmpDir, '.gitignore'), 'utf-8');
    expect(gitignore).toContain('node_modules/');
    expect(gitignore).toContain('dist/');
    expect(gitignore).toContain('.env');
  });

  it('appends only missing entries to an existing .gitignore (FR3.3 idempotent)', async () => {
    writeFileSync(join(tmpDir, '.gitignore'), 'node_modules/\n');
    await runInitTest(tmpDir, {
      options: { target: 'postgres', authoring: 'psl', install: false },
      flags: noninteractiveFlags(),
    });
    const gitignore = readFileSync(join(tmpDir, '.gitignore'), 'utf-8');
    // node_modules/ should appear exactly once.
    expect(gitignore.split('node_modules/').length - 1).toBe(1);
    expect(gitignore).toContain('dist/');
    expect(gitignore).toContain('.env');
  });

  it('writes .gitattributes with linguist-generated lines for emitted artifacts (FR3.4)', async () => {
    await runInitTest(tmpDir, {
      options: { target: 'postgres', authoring: 'psl', install: false },
      flags: noninteractiveFlags(),
    });
    const gitattributes = readFileSync(join(tmpDir, '.gitattributes'), 'utf-8');
    expect(gitattributes).toContain('src/prisma/contract.json linguist-generated');
    expect(gitattributes).toContain('src/prisma/contract.d.ts linguist-generated');
  });

  it('writes .gitattributes relative to a non-default --schema-path (FR3.4)', async () => {
    await runInitTest(tmpDir, {
      options: {
        target: 'postgres',
        authoring: 'psl',
        schemaPath: 'db/schema.prisma',
        install: false,
      },
      flags: noninteractiveFlags(),
    });
    const gitattributes = readFileSync(join(tmpDir, '.gitattributes'), 'utf-8');
    expect(gitattributes).toContain('db/contract.json linguist-generated');
    expect(gitattributes).not.toContain('prisma/contract.json');
  });

  it('adds contract:emit to package.json#scripts (FR3.5)', async () => {
    await runInitTest(tmpDir, {
      options: { target: 'postgres', authoring: 'psl', install: false },
      flags: noninteractiveFlags(),
    });
    const pkg = JSON.parse(readFileSync(join(tmpDir, 'package.json'), 'utf-8')) as {
      scripts?: Record<string, string>;
    };
    expect(pkg.scripts?.['contract:emit']).toBe('prisma-next contract emit');
  });

  it("warns and preserves the user's contract:emit when it maps to a different command (FR3.5)", async () => {
    writeFileSync(
      join(tmpDir, 'package.json'),
      JSON.stringify(
        {
          name: 'test-app',
          scripts: { 'contract:emit': './scripts/custom.sh' },
        },
        null,
        2,
      ),
    );

    const writes: string[] = [];
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown) => {
      if (typeof chunk === 'string') writes.push(chunk);
      else if (chunk instanceof Uint8Array) writes.push(Buffer.from(chunk).toString('utf-8'));
      return true;
    });
    try {
      await runInitTest(tmpDir, {
        options: { target: 'postgres', authoring: 'psl', install: false },
        flags: noninteractiveFlags({ json: true }),
      });
      const parsed = JSON.parse(writes.join('').trim()) as { warnings: string[] };
      expect(parsed.warnings.join('\n')).toMatch(/"contract:emit"/);
      const pkg = JSON.parse(readFileSync(join(tmpDir, 'package.json'), 'utf-8')) as {
        scripts: Record<string, string>;
      };
      expect(pkg.scripts['contract:emit']).toBe('./scripts/custom.sh');
    } finally {
      spy.mockRestore();
    }
  });

  it('adds "type": "module" to package.json so the ESM-only db.ts loads cleanly (TML-2494)', async () => {
    await runInitTest(tmpDir, {
      options: { target: 'postgres', authoring: 'psl', install: false },
      flags: noninteractiveFlags(),
    });
    const pkg = JSON.parse(readFileSync(join(tmpDir, 'package.json'), 'utf-8')) as {
      type?: string;
    };
    expect(pkg.type).toBe('module');
  });

  it('warns and preserves an explicit "type": "commonjs" rather than overwriting it (TML-2494)', async () => {
    writeFileSync(
      join(tmpDir, 'package.json'),
      JSON.stringify({ name: 'test-app', type: 'commonjs' }, null, 2),
    );

    const writes: string[] = [];
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown) => {
      if (typeof chunk === 'string') writes.push(chunk);
      else if (chunk instanceof Uint8Array) writes.push(Buffer.from(chunk).toString('utf-8'));
      return true;
    });
    try {
      await runInitTest(tmpDir, {
        options: { target: 'postgres', authoring: 'psl', install: false },
        flags: noninteractiveFlags({ json: true }),
      });
      const parsed = JSON.parse(writes.join('').trim()) as { warnings: string[] };
      expect(parsed.warnings.join('\n')).toMatch(/"type": "commonjs"/);
      const pkg = JSON.parse(readFileSync(join(tmpDir, 'package.json'), 'utf-8')) as {
        type?: string;
      };
      expect(pkg.type).toBe('commonjs');
    } finally {
      spy.mockRestore();
    }
  });

  it('is idempotent across re-init: second run does not mutate hygiene files (FR9.3)', async () => {
    await runInitTest(tmpDir, {
      options: { target: 'postgres', authoring: 'psl', install: false },
      flags: noninteractiveFlags(),
    });
    const snapshot = {
      gitignore: readFileSync(join(tmpDir, '.gitignore'), 'utf-8'),
      gitattributes: readFileSync(join(tmpDir, '.gitattributes'), 'utf-8'),
      packageJson: readFileSync(join(tmpDir, 'package.json'), 'utf-8'),
      tsconfig: readFileSync(join(tmpDir, 'tsconfig.json'), 'utf-8'),
    };

    await runInitTest(tmpDir, {
      options: { target: 'postgres', authoring: 'psl', force: true, install: false },
      flags: noninteractiveFlags(),
    });

    expect(readFileSync(join(tmpDir, '.gitignore'), 'utf-8')).toBe(snapshot.gitignore);
    expect(readFileSync(join(tmpDir, '.gitattributes'), 'utf-8')).toBe(snapshot.gitattributes);
    expect(readFileSync(join(tmpDir, 'package.json'), 'utf-8')).toBe(snapshot.packageJson);
    expect(readFileSync(join(tmpDir, 'tsconfig.json'), 'utf-8')).toBe(snapshot.tsconfig);
  });

  it('skips adding @types/node when already in devDependencies (FR2.1)', async () => {
    writeFileSync(
      join(tmpDir, 'package.json'),
      JSON.stringify({ name: 'test-app', devDependencies: { '@types/node': '^18.19.0' } }),
    );
    writeFileSync(join(tmpDir, 'pnpm-lock.yaml'), '');

    await runInitTest(tmpDir, {
      options: { target: 'postgres', authoring: 'psl', install: true },
      flags: noninteractiveFlags(),
    });

    expect(execFile).toHaveBeenCalledWith(
      'pnpm',
      ['add', '-D', 'prisma-next'],
      expect.anything(),
      expect.any(Function),
    );
    for (const call of vi.mocked(execFile).mock.calls) {
      const args = call[1];
      expect(args).not.toContain('@types/node');
    }
  });

  it('skips adding @types/node when already in dependencies (FR2.1)', async () => {
    writeFileSync(
      join(tmpDir, 'package.json'),
      JSON.stringify({ name: 'test-app', dependencies: { '@types/node': '^18.19.0' } }),
    );
    writeFileSync(join(tmpDir, 'pnpm-lock.yaml'), '');

    await runInitTest(tmpDir, {
      options: { target: 'postgres', authoring: 'psl', install: true },
      flags: noninteractiveFlags(),
    });

    expect(execFile).toHaveBeenCalledWith(
      'pnpm',
      ['add', '-D', 'prisma-next'],
      expect.anything(),
      expect.any(Function),
    );
  });

  it('still adds @types/node when only an unrelated dep is declared (FR2.1)', async () => {
    writeFileSync(
      join(tmpDir, 'package.json'),
      JSON.stringify({ name: 'test-app', devDependencies: { typescript: '^5.0.0' } }),
    );
    writeFileSync(join(tmpDir, 'pnpm-lock.yaml'), '');

    await runInitTest(tmpDir, {
      options: { target: 'postgres', authoring: 'psl', install: true },
      flags: noninteractiveFlags(),
    });

    expect(execFile).toHaveBeenCalledWith(
      'pnpm',
      ['add', '-D', 'prisma-next', '@types/node'],
      expect.anything(),
      expect.any(Function),
    );
  });

  it('exits PRECONDITION with structured error on a malformed package.json (F01)', async () => {
    writeFileSync(join(tmpDir, 'package.json'), '{ "name": "broken", '); // truncated JSON

    const writes: string[] = [];
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown) => {
      if (typeof chunk === 'string') writes.push(chunk);
      else if (chunk instanceof Uint8Array) writes.push(Buffer.from(chunk).toString('utf-8'));
      return true;
    });
    try {
      const exit = await runInitTest(tmpDir, {
        options: { target: 'postgres', authoring: 'psl', install: false },
        flags: noninteractiveFlags({ json: true }),
      });
      expect(exit).toBe(INIT_EXIT_PRECONDITION);
      const envelope = JSON.parse(writes.join('').trim()) as {
        ok: false;
        code: string;
        meta?: { path?: string };
      };
      expect(envelope.ok).toBe(false);
      expect(envelope.code).toBe('CLI.INIT_INVALID_MANIFEST');
      expect(envelope.meta?.path).toBe('package.json');
    } finally {
      spy.mockRestore();
    }
  });

  it('reports hygiene files in filesWritten via --json (FR1.5)', async () => {
    const writes: string[] = [];
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown) => {
      if (typeof chunk === 'string') writes.push(chunk);
      else if (chunk instanceof Uint8Array) writes.push(Buffer.from(chunk).toString('utf-8'));
      return true;
    });
    try {
      await runInitTest(tmpDir, {
        options: { target: 'postgres', authoring: 'psl', writeEnv: true, install: false },
        flags: noninteractiveFlags({ json: true }),
      });
      const parsed = JSON.parse(writes.join('').trim()) as { filesWritten: string[] };
      expect(parsed.filesWritten).toEqual(
        expect.arrayContaining([
          '.env',
          '.env.example',
          '.gitignore',
          '.gitattributes',
          'package.json',
          'tsconfig.json',
        ]),
      );
    } finally {
      spy.mockRestore();
    }
  });
});

// ---------------------------------------------------------------------------
// FR9 — Re-init cleanup
// ---------------------------------------------------------------------------

describe('runInit re-init cleanup (FR9)', { timeout: timeouts.databaseOperation }, () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'init-reinit-'));
    writeFileSync(join(tmpDir, 'package.json'), JSON.stringify({ name: 'test-app' }));
    vi.clearAllMocks();
  }, timeouts.databaseOperation);

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  }, timeouts.databaseOperation);

  it('deletes previously-emitted contract artifacts on re-init (FR9.1)', async () => {
    await runInitTest(tmpDir, {
      options: { target: 'postgres', authoring: 'psl', install: false },
      flags: noninteractiveFlags(),
    });
    writeFileSync(join(tmpDir, 'src/prisma', 'contract.json'), '{"stale":true}');
    writeFileSync(join(tmpDir, 'src/prisma', 'contract.d.ts'), 'export type Contract = never;');
    writeFileSync(join(tmpDir, 'src/prisma', 'ops.json'), '{"stale":true}');

    await runInitTest(tmpDir, {
      options: { target: 'postgres', authoring: 'psl', force: true, install: false },
      flags: noninteractiveFlags(),
    });

    expect(existsSync(join(tmpDir, 'src/prisma/contract.json'))).toBe(false);
    expect(existsSync(join(tmpDir, 'src/prisma/contract.d.ts'))).toBe(false);
    expect(existsSync(join(tmpDir, 'src/prisma/ops.json'))).toBe(false);
  });

  it('does not delete unrelated files in the schema dir (FR9.1 boundary)', async () => {
    await runInitTest(tmpDir, {
      options: { target: 'postgres', authoring: 'psl', install: false },
      flags: noninteractiveFlags(),
    });
    writeFileSync(join(tmpDir, 'src/prisma', 'seed.ts'), 'export {}');
    writeFileSync(join(tmpDir, 'src/prisma', 'README.md'), '# notes');
    writeFileSync(join(tmpDir, 'src/prisma', 'contract.json'), '{}');

    await runInitTest(tmpDir, {
      options: { target: 'postgres', authoring: 'psl', force: true, install: false },
      flags: noninteractiveFlags(),
    });

    expect(existsSync(join(tmpDir, 'src/prisma/seed.ts'))).toBe(true);
    expect(existsSync(join(tmpDir, 'src/prisma/README.md'))).toBe(true);
    expect(existsSync(join(tmpDir, 'src/prisma/contract.json'))).toBe(false);
  });

  it('does not delete anything on a green-field init (FR9.1)', async () => {
    const writes: string[] = [];
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown) => {
      if (typeof chunk === 'string') writes.push(chunk);
      else if (chunk instanceof Uint8Array) writes.push(Buffer.from(chunk).toString('utf-8'));
      return true;
    });
    try {
      const exit = await runInitTest(tmpDir, {
        options: { target: 'postgres', authoring: 'psl', install: false },
        flags: noninteractiveFlags({ json: true }),
      });
      expect(exit).toBe(INIT_EXIT_OK);
      const parsed = JSON.parse(writes.join('').trim()) as { filesDeleted: string[] };
      expect(parsed.filesDeleted).toEqual([]);
    } finally {
      spy.mockRestore();
    }
  });

  it('reports deleted files in --json filesDeleted on re-init (FR9.1)', async () => {
    await runInitTest(tmpDir, {
      options: { target: 'postgres', authoring: 'psl', install: false },
      flags: noninteractiveFlags(),
    });
    writeFileSync(join(tmpDir, 'src/prisma', 'contract.json'), '{}');
    writeFileSync(join(tmpDir, 'src/prisma', 'contract.d.ts'), 'export {}');

    const writes: string[] = [];
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown) => {
      if (typeof chunk === 'string') writes.push(chunk);
      else if (chunk instanceof Uint8Array) writes.push(Buffer.from(chunk).toString('utf-8'));
      return true;
    });
    try {
      await runInitTest(tmpDir, {
        options: { target: 'postgres', authoring: 'psl', force: true, install: false },
        flags: noninteractiveFlags({ json: true }),
      });
      const parsed = JSON.parse(writes.join('').trim()) as { filesDeleted: string[] };
      expect(parsed.filesDeleted).toEqual(
        expect.arrayContaining(['src/prisma/contract.json', 'src/prisma/contract.d.ts']),
      );
    } finally {
      spy.mockRestore();
    }
  });

  it('drops the previous facade dep on target switch with --force (FR9.2)', async () => {
    writeFileSync(
      join(tmpDir, 'package.json'),
      JSON.stringify(
        {
          name: 'test-app',
          dependencies: { '@internal/postgres': '^1.0.0', dotenv: '^16.0.0' },
        },
        null,
        2,
      ),
    );
    writeFileSync(join(tmpDir, 'prisma-next.config.ts'), 'old config');

    await runInitTest(tmpDir, {
      options: { target: 'mongodb', authoring: 'psl', force: true, install: false },
      flags: noninteractiveFlags(),
    });

    const pkg = JSON.parse(readFileSync(join(tmpDir, 'package.json'), 'utf-8')) as {
      dependencies: Record<string, string>;
    };
    expect(pkg.dependencies['@internal/postgres']).toBeUndefined();
    expect(pkg.dependencies['dotenv']).toBe('^16.0.0');
  });

  it('keeps the facade dep when re-init does not switch targets (FR9.2)', async () => {
    writeFileSync(
      join(tmpDir, 'package.json'),
      JSON.stringify(
        {
          name: 'test-app',
          dependencies: { '@internal/postgres': '^1.0.0' },
        },
        null,
        2,
      ),
    );
    writeFileSync(join(tmpDir, 'prisma-next.config.ts'), 'old config');

    await runInitTest(tmpDir, {
      options: { target: 'postgres', authoring: 'psl', force: true, install: false },
      flags: noninteractiveFlags(),
    });

    const pkg = JSON.parse(readFileSync(join(tmpDir, 'package.json'), 'utf-8')) as {
      dependencies: Record<string, string>;
    };
    expect(pkg.dependencies['@internal/postgres']).toBe('^1.0.0');
  });

  it('does not touch deps on a green-field init (FR9.2 boundary)', async () => {
    writeFileSync(
      join(tmpDir, 'package.json'),
      JSON.stringify(
        {
          name: 'test-app',
          dependencies: { '@internal/mongo': '^1.0.0', someUnrelated: '^2.0.0' },
        },
        null,
        2,
      ),
    );

    await runInitTest(tmpDir, {
      options: { target: 'postgres', authoring: 'psl', install: false },
      flags: noninteractiveFlags(),
    });

    const pkg = JSON.parse(readFileSync(join(tmpDir, 'package.json'), 'utf-8')) as {
      dependencies: Record<string, string>;
    };
    expect(pkg.dependencies['@internal/mongo']).toBe('^1.0.0');
    expect(pkg.dependencies['someUnrelated']).toBe('^2.0.0');
  });

  it('after target switch, project contains no Postgres-target artifacts (FR9 acceptance)', async () => {
    await runInitTest(tmpDir, {
      options: { target: 'postgres', authoring: 'psl', install: false },
      flags: noninteractiveFlags(),
    });
    writeFileSync(
      join(tmpDir, 'package.json'),
      JSON.stringify(
        {
          name: 'test-app',
          dependencies: { '@internal/postgres': '^1.0.0' },
          scripts: { 'contract:emit': 'prisma-next contract emit' },
        },
        null,
        2,
      ),
    );
    writeFileSync(join(tmpDir, 'src/prisma', 'contract.d.ts'), 'export type Contract = unknown;');
    writeFileSync(join(tmpDir, 'src/prisma', 'contract.json'), '{}');

    await runInitTest(tmpDir, {
      options: { target: 'mongodb', authoring: 'psl', force: true, install: false },
      flags: noninteractiveFlags(),
    });

    const pkg = JSON.parse(readFileSync(join(tmpDir, 'package.json'), 'utf-8')) as {
      dependencies: Record<string, string>;
    };
    expect(pkg.dependencies['@internal/postgres']).toBeUndefined();
    expect(existsSync(join(tmpDir, 'src/prisma/contract.json'))).toBe(false);
    expect(existsSync(join(tmpDir, 'src/prisma/contract.d.ts'))).toBe(false);
  });

  it('idempotent .gitignore: partial entries are not duplicated on re-init (FR9.3)', async () => {
    writeFileSync(join(tmpDir, '.gitignore'), 'node_modules/\n');
    await runInitTest(tmpDir, {
      options: { target: 'postgres', authoring: 'psl', install: false },
      flags: noninteractiveFlags(),
    });
    const after = readFileSync(join(tmpDir, '.gitignore'), 'utf-8');
    expect(after.split('\n').filter((l) => l === 'node_modules/')).toHaveLength(1);
    expect(after.split('\n').filter((l) => l === 'dist/')).toHaveLength(1);
    expect(after.split('\n').filter((l) => l === '.env')).toHaveLength(1);
  });

  it('idempotent .gitattributes: existing entries are not duplicated on re-init (FR9.3)', async () => {
    writeFileSync(join(tmpDir, '.gitattributes'), 'prisma/contract.json linguist-generated\n');
    await runInitTest(tmpDir, {
      options: { target: 'postgres', authoring: 'psl', install: false },
      flags: noninteractiveFlags(),
    });
    const after = readFileSync(join(tmpDir, '.gitattributes'), 'utf-8');
    expect(
      after.split('\n').filter((l) => l === 'prisma/contract.json linguist-generated'),
    ).toHaveLength(1);
  });

  it('idempotent package.json#scripts: existing identical entry is not duplicated (FR9.3)', async () => {
    writeFileSync(
      join(tmpDir, 'package.json'),
      JSON.stringify(
        {
          name: 'test-app',
          scripts: { 'contract:emit': 'prisma-next contract emit' },
        },
        null,
        2,
      ),
    );
    await runInitTest(tmpDir, {
      options: { target: 'postgres', authoring: 'psl', install: false },
      flags: noninteractiveFlags(),
    });
    const pkg = JSON.parse(readFileSync(join(tmpDir, 'package.json'), 'utf-8')) as {
      scripts: Record<string, string>;
    };
    expect(pkg.scripts['contract:emit']).toBe('prisma-next contract emit');
    expect(Object.keys(pkg.scripts)).toEqual(['contract:emit']);
  });
});

// ---------------------------------------------------------------------------
// FR1 — Non-interactive scriptable mode (TML-2263 headline finding)
// ---------------------------------------------------------------------------

describe('runInit (non-interactive, FR1)', { timeout: timeouts.databaseOperation }, () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'init-noninteractive-test-'));
    writeFileSync(join(tmpDir, 'package.json'), JSON.stringify({ name: 'test-app' }));
    vi.clearAllMocks();
  }, timeouts.databaseOperation);

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  }, timeouts.databaseOperation);

  it('runs without prompts when --target and --authoring are supplied (FR1.3)', async () => {
    const exit = await runInitTest(tmpDir, {
      options: {
        target: 'postgres',
        authoring: 'psl',
        install: false,
      },
      flags: noninteractiveFlags(),
    });

    expect(exit).toBe(INIT_EXIT_OK);
    expect(clack.select).not.toHaveBeenCalled();
    expect(clack.text).not.toHaveBeenCalled();
    expect(clack.confirm).not.toHaveBeenCalled();
    expect(existsSync(join(tmpDir, 'src/prisma/contract.prisma'))).toBe(true);
    expect(existsSync(join(tmpDir, 'prisma-next.config.ts'))).toBe(true);
  });

  it('accepts --target mongodb (the user-facing alias for the internal mongo target)', async () => {
    await runInitTest(tmpDir, {
      options: { target: 'mongodb', authoring: 'psl', install: false },
      flags: noninteractiveFlags(),
    });

    const config = readFileSync(join(tmpDir, 'prisma-next.config.ts'), 'utf-8');
    expect(config).toContain("from '@prisma/orm-mongo/config'");
  });

  it('accepts --authoring typescript (FR1.1)', async () => {
    await runInitTest(tmpDir, {
      options: { target: 'postgres', authoring: 'typescript', install: false },
      flags: noninteractiveFlags(),
    });

    expect(existsSync(join(tmpDir, 'src/prisma/contract.ts'))).toBe(true);
  });

  it('honours --schema-path (FR1.1)', async () => {
    await runInitTest(tmpDir, {
      options: {
        target: 'postgres',
        authoring: 'psl',
        schemaPath: 'db/schema.prisma',
        install: false,
      },
      flags: noninteractiveFlags(),
    });

    expect(existsSync(join(tmpDir, 'db/schema.prisma'))).toBe(true);
    expect(existsSync(join(tmpDir, 'db/db.ts'))).toBe(true);
  });

  it('scaffolds when --authoring and --schema-path extensions match (psl + .prisma)', async () => {
    const exit = await runInitTest(tmpDir, {
      options: {
        target: 'postgres',
        authoring: 'psl',
        schemaPath: 'prisma/schema.prisma',
        install: false,
      },
      flags: noninteractiveFlags(),
    });

    expect(exit).toBe(INIT_EXIT_OK);
    expect(existsSync(join(tmpDir, 'prisma/schema.prisma'))).toBe(true);
  });

  it('scaffolds when --authoring and --schema-path extensions match (typescript + .ts)', async () => {
    const exit = await runInitTest(tmpDir, {
      options: {
        target: 'postgres',
        authoring: 'typescript',
        schemaPath: 'prisma/contract.ts',
        install: false,
      },
      flags: noninteractiveFlags(),
    });

    expect(exit).toBe(INIT_EXIT_OK);
    expect(existsSync(join(tmpDir, 'prisma/contract.ts'))).toBe(true);
  });

  it('exits PRECONDITION when --authoring typescript is paired with a .prisma --schema-path', async () => {
    const writes: string[] = [];
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown) => {
      if (typeof chunk === 'string') writes.push(chunk);
      else if (chunk instanceof Uint8Array) writes.push(Buffer.from(chunk).toString('utf-8'));
      return true;
    });
    try {
      const exit = await runInitTest(tmpDir, {
        options: {
          target: 'postgres',
          authoring: 'typescript',
          schemaPath: 'prisma/schema.prisma',
          install: false,
        },
        flags: noninteractiveFlags({ json: true }),
      });

      expect(exit).toBe(INIT_EXIT_PRECONDITION);
      const envelope = JSON.parse(writes.join('').trim()) as { ok: false; code: string };
      expect(envelope.ok).toBe(false);
      expect(envelope.code).toBe('CLI.INIT_AUTHORING_SCHEMA_PATH_MISMATCH');
      expect(existsSync(join(tmpDir, 'prisma-next.config.ts'))).toBe(false);
      expect(existsSync(join(tmpDir, 'prisma/schema.prisma'))).toBe(false);
    } finally {
      spy.mockRestore();
    }
  });

  it('exits PRECONDITION when --authoring psl is paired with a .ts --schema-path', async () => {
    const writes: string[] = [];
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown) => {
      if (typeof chunk === 'string') writes.push(chunk);
      else if (chunk instanceof Uint8Array) writes.push(Buffer.from(chunk).toString('utf-8'));
      return true;
    });
    try {
      const exit = await runInitTest(tmpDir, {
        options: {
          target: 'postgres',
          authoring: 'psl',
          schemaPath: 'prisma/contract.ts',
          install: false,
        },
        flags: noninteractiveFlags({ json: true }),
      });

      expect(exit).toBe(INIT_EXIT_PRECONDITION);
      const envelope = JSON.parse(writes.join('').trim()) as { ok: false; code: string };
      expect(envelope.ok).toBe(false);
      expect(envelope.code).toBe('CLI.INIT_AUTHORING_SCHEMA_PATH_MISMATCH');
      expect(existsSync(join(tmpDir, 'prisma-next.config.ts'))).toBe(false);
      expect(existsSync(join(tmpDir, 'prisma/contract.ts'))).toBe(false);
    } finally {
      spy.mockRestore();
    }
  });

  it('exits PRECONDITION when --target is missing in non-interactive mode (FR1.4)', async () => {
    const exit = await runInitTest(tmpDir, {
      options: { authoring: 'psl', install: false },
      flags: noninteractiveFlags(),
    });

    expect(exit).toBe(INIT_EXIT_PRECONDITION);
    expect(existsSync(join(tmpDir, 'prisma-next.config.ts'))).toBe(false);
    expect(existsSync(join(tmpDir, 'prisma'))).toBe(false);
  });

  it('exits PRECONDITION when --authoring is missing in non-interactive mode (FR1.4)', async () => {
    const exit = await runInitTest(tmpDir, {
      options: { target: 'postgres', install: false },
      flags: noninteractiveFlags(),
    });

    expect(exit).toBe(INIT_EXIT_PRECONDITION);
    expect(existsSync(join(tmpDir, 'prisma-next.config.ts'))).toBe(false);
  });

  it('exits PRECONDITION when no flags are supplied in non-interactive mode (FR1.4)', async () => {
    const exit = await runInitTest(tmpDir, {
      options: { install: false },
      flags: noninteractiveFlags(),
    });

    expect(exit).toBe(INIT_EXIT_PRECONDITION);
  });

  it('exits PRECONDITION on invalid --target value', async () => {
    const exit = await runInitTest(tmpDir, {
      options: { target: 'sqlite', authoring: 'psl', install: false },
      flags: noninteractiveFlags(),
    });

    expect(exit).toBe(INIT_EXIT_PRECONDITION);
  });

  it('exits PRECONDITION on invalid --authoring value', async () => {
    const exit = await runInitTest(tmpDir, {
      options: { target: 'postgres', authoring: 'graphql', install: false },
      flags: noninteractiveFlags(),
    });

    expect(exit).toBe(INIT_EXIT_PRECONDITION);
  });

  it('refuses --strict-probe without --probe-db (FR8.3 / NFR9 offline-by-default)', async () => {
    const exit = await runInitTest(tmpDir, {
      options: {
        target: 'postgres',
        authoring: 'psl',
        strictProbe: true,
        install: false,
      },
      flags: noninteractiveFlags(),
    });

    expect(exit).toBe(INIT_EXIT_PRECONDITION);
    // Should fail before any file is written — offline guarantee starts at input validation.
    expect(existsSync(join(tmpDir, 'prisma-next.config.ts'))).toBe(false);
  });

  // FR8.3 — offline-by-default + opt-in probe contract. The probe must
  // not run unless `--probe-db` is set; under `--probe-db` the
  // outcome surfaces as a warning by default and as a fatal error
  // under `--strict-probe`.

  it('does not invoke the probe when --probe-db is not set (FR8.3 / NFR9 offline-by-default)', async () => {
    const probePostgres = vi.fn<NonNullable<ProbeOverrides['probePostgres']>>();
    const probeMongo = vi.fn<NonNullable<ProbeOverrides['probeMongo']>>();

    const exit = await runInitTest(tmpDir, {
      options: { target: 'postgres', authoring: 'psl', install: false },
      flags: noninteractiveFlags(),
      probeOverrides: {
        probePostgres,
        probeMongo,
      },
    });

    expect(exit).toBe(INIT_EXIT_OK);
    expect(probePostgres).not.toHaveBeenCalled();
    expect(probeMongo).not.toHaveBeenCalled();
  });

  it('with --probe-db, surfaces a below-minimum result as a warning and exits 0 (FR8.3)', async () => {
    const previousUrl = process.env['DATABASE_URL'];
    process.env['DATABASE_URL'] = 'postgres://localhost:5432/db';
    try {
      const exit = await runInitTest(tmpDir, {
        options: { target: 'postgres', authoring: 'psl', probeDb: true, install: false },
        flags: noninteractiveFlags(),
        probeOverrides: { probePostgres: async () => ({ serverVersion: '12.4' }) },
      });

      expect(exit).toBe(INIT_EXIT_OK);
    } finally {
      if (previousUrl === undefined) delete process.env['DATABASE_URL'];
      else process.env['DATABASE_URL'] = previousUrl;
    }
  });

  it('with --probe-db --strict-probe, escalates a connection failure to PRECONDITION (FR8.3)', async () => {
    const previousUrl = process.env['DATABASE_URL'];
    process.env['DATABASE_URL'] = 'postgres://localhost:5432/db';
    try {
      const exit = await runInitTest(tmpDir, {
        options: {
          target: 'postgres',
          authoring: 'psl',
          probeDb: true,
          strictProbe: true,
          install: false,
        },
        flags: noninteractiveFlags(),
        probeOverrides: {
          probePostgres: () => {
            throw new Error('connect ECONNREFUSED');
          },
        },
      });

      expect(exit).toBe(INIT_EXIT_PRECONDITION);
    } finally {
      if (previousUrl === undefined) delete process.env['DATABASE_URL'];
      else process.env['DATABASE_URL'] = previousUrl;
    }
  });

  it('with --probe-db but no DATABASE_URL, succeeds with a warning (FR8.3)', async () => {
    const previousUrl = process.env['DATABASE_URL'];
    delete process.env['DATABASE_URL'];
    try {
      const probePostgres = vi.fn<NonNullable<ProbeOverrides['probePostgres']>>();
      const exit = await runInitTest(tmpDir, {
        options: { target: 'postgres', authoring: 'psl', probeDb: true, install: false },
        flags: noninteractiveFlags(),
        probeOverrides: { probePostgres },
      });

      expect(exit).toBe(INIT_EXIT_OK);
      expect(probePostgres).not.toHaveBeenCalled();
    } finally {
      if (previousUrl !== undefined) process.env['DATABASE_URL'] = previousUrl;
    }
  });

  it('with --probe-db --strict-probe and no DATABASE_URL, escalates to PRECONDITION (FR8.3)', async () => {
    const previousUrl = process.env['DATABASE_URL'];
    delete process.env['DATABASE_URL'];
    try {
      const exit = await runInitTest(tmpDir, {
        options: {
          target: 'postgres',
          authoring: 'psl',
          probeDb: true,
          strictProbe: true,
          install: false,
        },
        flags: noninteractiveFlags(),
        probeOverrides: {
          probePostgres: () => {
            throw new Error('probe must not be invoked without DATABASE_URL');
          },
        },
      });

      expect(exit).toBe(INIT_EXIT_PRECONDITION);
    } finally {
      if (previousUrl !== undefined) process.env['DATABASE_URL'] = previousUrl;
    }
  });

  it('exits PRECONDITION when re-init is needed but --force is not supplied', async () => {
    writeFileSync(join(tmpDir, 'prisma-next.config.ts'), 'existing');

    const exit = await runInitTest(tmpDir, {
      options: { target: 'postgres', authoring: 'psl', install: false },
      flags: noninteractiveFlags(),
    });

    expect(exit).toBe(INIT_EXIT_PRECONDITION);
    expect(readFileSync(join(tmpDir, 'prisma-next.config.ts'), 'utf-8')).toBe('existing');
  });

  it('overwrites with --force in non-interactive mode', async () => {
    writeFileSync(join(tmpDir, 'prisma-next.config.ts'), 'existing');

    const exit = await runInitTest(tmpDir, {
      options: { target: 'postgres', authoring: 'psl', force: true, install: false },
      flags: noninteractiveFlags(),
    });

    expect(exit).toBe(INIT_EXIT_OK);
    const config = readFileSync(join(tmpDir, 'prisma-next.config.ts'), 'utf-8');
    expect(config).not.toBe('existing');
    expect(config).toContain("from '@prisma/orm-postgres/config'");
  });
});

// ---------------------------------------------------------------------------
// FR1.5 / FR10 — Structured JSON output
// ---------------------------------------------------------------------------

describe('runInit (--json output, FR1.5 / FR10.2)', { timeout: timeouts.databaseOperation }, () => {
  let tmpDir: string;
  let stdoutSpy: ReturnType<typeof vi.spyOn>;
  let captured: string[];

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'init-json-test-'));
    writeFileSync(join(tmpDir, 'package.json'), JSON.stringify({ name: 'test-app' }));
    vi.clearAllMocks();
    captured = [];
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown) => {
      if (typeof chunk === 'string') {
        captured.push(chunk);
      } else if (chunk instanceof Uint8Array) {
        captured.push(Buffer.from(chunk).toString('utf-8'));
      }
      return true;
    });
  }, timeouts.databaseOperation);

  afterEach(() => {
    stdoutSpy.mockRestore();
    rmSync(tmpDir, { recursive: true, force: true });
  }, timeouts.databaseOperation);

  it('writes a single JSON document to stdout with all required fields', async () => {
    const exit = await runInitTest(tmpDir, {
      options: { target: 'postgres', authoring: 'psl', install: false },
      flags: noninteractiveFlags({ json: true }),
    });

    expect(exit).toBe(INIT_EXIT_OK);

    const stdoutText = captured.join('').trim();
    const parsed = JSON.parse(stdoutText) as Record<string, unknown>;
    expect(parsed['ok']).toBe(true);
    expect(parsed['target']).toBe('postgres');
    expect(parsed['authoring']).toBe('psl');
    expect(parsed['schemaPath']).toBe('src/prisma/contract.prisma');
    expect(Array.isArray(parsed['filesWritten'])).toBe(true);
    expect((parsed['filesWritten'] as string[]).length).toBeGreaterThan(0);
    expect(parsed['packagesInstalled']).toMatchObject({ skipped: true });
    // The `nextSteps` array is part of the documented `--json` contract.
    // Agents and CI are expected to surface these strings to the user
    // verbatim, so we lock the canonical anchor tokens (DATABASE_URL,
    // the contract-emit command) rather than just asserting "non-empty".
    // A rewording is fine; dropping any of these anchors needs to be a
    // conscious change.
    const nextSteps = parsed['nextSteps'] as string[];
    expect(Array.isArray(nextSteps)).toBe(true);
    const nextStepsText = nextSteps.join('\n');
    expect(nextStepsText).toContain('DATABASE_URL');
    expect(nextStepsText).toMatch(/(prisma-next|npx prisma-next) contract emit/);
    // `--no-install` only skips dependency install + emit. Skills are
    // installed independently unless `--no-skill` is passed.
    expect(nextStepsText).toContain('Prisma Next skills');
    const warnings = parsed['warnings'] as string[];
    expect(warnings.join('\n')).not.toContain('Skipped Prisma Next skills');
  });

  it('writes a structured error to stdout in JSON mode when preconditions fail', async () => {
    const exit = await runInitTest(tmpDir, {
      options: { install: false },
      flags: noninteractiveFlags({ json: true }),
    });

    expect(exit).toBe(INIT_EXIT_PRECONDITION);

    const stdoutText = captured.join('').trim();
    const parsed = JSON.parse(stdoutText) as Record<string, unknown>;
    expect(parsed['ok']).toBe(false);
    expect(parsed['code']).toBe('CLI.INIT_MISSING_FLAGS');
    expect((parsed['meta'] as Record<string, unknown>)['missingFlags'] as string[]).toContain(
      'target',
    );
  });

  it('reports the mongodb alias (not the internal "mongo") in --json output', async () => {
    await runInitTest(tmpDir, {
      options: { target: 'mongodb', authoring: 'psl', install: false },
      flags: noninteractiveFlags({ json: true }),
    });

    const parsed = JSON.parse(captured.join('').trim()) as Record<string, unknown>;
    expect(parsed['target']).toBe('mongodb');
  });
});

// ---------------------------------------------------------------------------
// FR7.2 — pnpm → npm fallback on a recognised workspace/catalog leak
// ---------------------------------------------------------------------------

describe('isRecognisedPnpmResolutionError (FR7.2)', () => {
  it('matches ERR_PNPM_WORKSPACE_PKG_NOT_FOUND (the original TML-2263 leak)', () => {
    expect(
      isRecognisedPnpmResolutionError(
        ' ERR_PNPM_WORKSPACE_PKG_NOT_FOUND  In packages/foo: "@internal/utils@workspace:*" is in the dependencies but no package named "@internal/utils" is present in the workspace',
      ),
    ).toBe(true);
  });

  it('matches "No matching version found in the catalog"', () => {
    expect(
      isRecognisedPnpmResolutionError(
        'ERR_PNPM_NO_MATCHING_VERSION  No matching version found for arktype@catalog: in the catalog',
      ),
    ).toBe(true);
  });

  it('matches a literal "workspace:* is not a valid version" message', () => {
    expect(
      isRecognisedPnpmResolutionError(
        'workspace:* is not a valid version specifier in registry artifacts',
      ),
    ).toBe(true);
  });

  it('does not match unrelated install failures', () => {
    expect(isRecognisedPnpmResolutionError('EACCES: permission denied')).toBe(false);
    expect(isRecognisedPnpmResolutionError('ENOTFOUND registry.npmjs.org')).toBe(false);
    expect(isRecognisedPnpmResolutionError('')).toBe(false);
  });
});

describe('runInit pnpm → npm install fallback (FR7.2)', {
  timeout: timeouts.databaseOperation,
}, () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'init-fallback-test-'));
    writeFileSync(join(tmpDir, 'package.json'), JSON.stringify({ name: 'test-app' }));
    writeFileSync(join(tmpDir, 'pnpm-lock.yaml'), '');
    vi.clearAllMocks();
  }, timeouts.databaseOperation);

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  }, timeouts.databaseOperation);

  function captureStdout(): { writes: string[]; restore: () => void } {
    const writes: string[] = [];
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown) => {
      if (typeof chunk === 'string') writes.push(chunk);
      else if (chunk instanceof Uint8Array) writes.push(Buffer.from(chunk).toString('utf-8'));
      return true;
    });
    return { writes, restore: () => spy.mockRestore() };
  }

  function mockExecFile(handler: (cmd: string) => { stderr?: string } | null) {
    vi.mocked(execFile).mockImplementation(
      (cmd: unknown, _args: unknown, _opts: unknown, cb: unknown) => {
        const callback = cb as (err: unknown, stdout?: string, stderr?: string) => void;
        const result = handler(String(cmd));
        if (result === null) {
          callback(null, '', '');
        } else {
          callback(Object.assign(new Error(`${cmd} failed`), { stderr: result.stderr ?? '' }));
        }
        return undefined as never;
      },
    );
  }

  it('falls back to npm and emits a warning when pnpm leaks workspace:*', async () => {
    mockExecFile((cmd) =>
      cmd === 'pnpm'
        ? {
            stderr:
              'ERR_PNPM_WORKSPACE_PKG_NOT_FOUND In packages/foo: "@internal/utils@workspace:*" is in the dependencies',
          }
        : null,
    );
    const { writes, restore } = captureStdout();
    try {
      const exit = await runInitTest(tmpDir, {
        options: { target: 'postgres', authoring: 'psl', install: true },
        flags: noninteractiveFlags({ json: true }),
      });
      expect(exit).toBe(INIT_EXIT_OK);

      const npmAddCalls = vi.mocked(execFile).mock.calls.filter((c) => c[0] === 'npm');
      expect(npmAddCalls.length).toBe(2);

      const parsed = JSON.parse(writes.join('').trim()) as {
        warnings: string[];
        packagesInstalled: { skipped: boolean };
      };
      expect(parsed.packagesInstalled.skipped).toBe(false);
      expect(parsed.warnings.join('\n')).toMatch(/Falling back to `npm install`/);
    } finally {
      restore();
    }
  });

  it('does not fall back when pnpm fails for an unrelated reason — exits INSTALL_FAILED with structured error', async () => {
    mockExecFile((cmd) => (cmd === 'pnpm' ? { stderr: 'ENOTFOUND registry.npmjs.org' } : null));
    const { writes, restore } = captureStdout();
    try {
      const exit = await runInitTest(tmpDir, {
        options: { target: 'postgres', authoring: 'psl', install: true },
        flags: noninteractiveFlags({ json: true }),
      });
      expect(exit).toBe(INIT_EXIT_INSTALL_FAILED);

      const npmCalls = vi.mocked(execFile).mock.calls.filter((c) => c[0] === 'npm');
      expect(npmCalls.length).toBe(0);

      const parsed = JSON.parse(writes.join('').trim()) as {
        ok: boolean;
        code: string;
        meta: { filesWritten: string[]; stderr: string[] };
      };
      expect(parsed.ok).toBe(false);
      expect(parsed.code).toBe('CLI.INIT_INSTALL_FAILED');
      expect(parsed.meta.filesWritten).toEqual(
        expect.arrayContaining(['prisma-next.config.ts', 'src/prisma/contract.prisma']),
      );
      expect(parsed.meta.stderr.join('\n')).toMatch(/ENOTFOUND/);
    } finally {
      restore();
    }
  });

  it('escalates to INSTALL_FAILED when both pnpm AND the npm fallback fail', async () => {
    mockExecFile(() => ({
      stderr: 'ERR_PNPM_WORKSPACE_PKG_NOT_FOUND followed by npm ETARGET',
    }));
    const { writes, restore } = captureStdout();
    try {
      const exit = await runInitTest(tmpDir, {
        options: { target: 'postgres', authoring: 'psl', install: true },
        flags: noninteractiveFlags({ json: true }),
      });
      expect(exit).toBe(INIT_EXIT_INSTALL_FAILED);

      const parsed = JSON.parse(writes.join('').trim()) as {
        ok: boolean;
        code: string;
      };
      expect(parsed.ok).toBe(false);
      expect(parsed.code).toBe('CLI.INIT_INSTALL_FAILED');
    } finally {
      restore();
    }
  });
});

// ---------------------------------------------------------------------------
// F02 / F07 / F09 — emit failure + secret redaction
// ---------------------------------------------------------------------------

describe('runInit emit failure (F02 / F07)', { timeout: timeouts.databaseOperation }, () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'init-emit-test-'));
    writeFileSync(join(tmpDir, 'package.json'), JSON.stringify({ name: 'test-app' }));
    vi.clearAllMocks();
    vi.mocked(execFile).mockImplementation(
      (_cmd: unknown, _args: unknown, _opts: unknown, cb: unknown) => {
        const callback = cb as (err: null) => void;
        callback(null);
        return undefined as never;
      },
    );
  }, timeouts.databaseOperation);

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  }, timeouts.databaseOperation);

  it('exits EMIT_FAILED with CLI.INIT_EMIT_FAILED and surfaces the underlying cause', async () => {
    const { executeContractEmit } = await import(
      '../../../src/control-api/operations/contract-emit'
    );
    vi.mocked(executeContractEmit).mockRejectedValueOnce(new Error('contract.prisma is invalid'));

    const writes: string[] = [];
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown) => {
      if (typeof chunk === 'string') writes.push(chunk);
      else if (chunk instanceof Uint8Array) writes.push(Buffer.from(chunk).toString('utf-8'));
      return true;
    });
    try {
      const exit = await runInitTest(tmpDir, {
        options: { target: 'postgres', authoring: 'psl', install: true },
        flags: noninteractiveFlags({ json: true }),
      });
      expect(exit).toBe(INIT_EXIT_EMIT_FAILED);

      const parsed = JSON.parse(writes.join('').trim()) as {
        ok: boolean;
        code: string;
        meta: { cause: string; filesWritten: string[] };
      };
      expect(parsed.ok).toBe(false);
      expect(parsed.code).toBe('CLI.INIT_EMIT_FAILED');
      expect(parsed.meta.cause).toContain('contract.prisma is invalid');
      expect(parsed.meta.filesWritten).toEqual(expect.arrayContaining(['prisma-next.config.ts']));
    } finally {
      spy.mockRestore();
    }
  });
});

describe('redactSecrets (F09)', () => {
  it('redacts userinfo from URLs in stderr', () => {
    expect(redactSecrets('failed: https://user:pass@registry.example.com/foo')).toBe(
      'failed: https://***@registry.example.com/foo',
    );
  });

  it('redacts a bare token URL', () => {
    expect(redactSecrets('npm error: https://npm-token-123@registry.npmjs.org/')).toBe(
      'npm error: https://***@registry.npmjs.org/',
    );
  });

  it('leaves URLs without userinfo untouched', () => {
    expect(redactSecrets('ENOTFOUND https://registry.npmjs.org/')).toBe(
      'ENOTFOUND https://registry.npmjs.org/',
    );
  });

  it('handles empty input', () => {
    expect(redactSecrets('')).toBe('');
  });

  it('redacts even when the URL is in the middle of a longer line', () => {
    expect(
      redactSecrets('GET https://alice:secret@registry.example.com/foo failed: 401 Unauthorized'),
    ).toBe('GET https://***@registry.example.com/foo failed: 401 Unauthorized');
  });
});

// ---------------------------------------------------------------------------
// F03 / FR7.3 — pnpm workspace catalog detection + structured warning
// ---------------------------------------------------------------------------

describe('detectPnpmCatalogOverrides (F03)', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'init-catalog-detect-'));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns null when no pnpm-workspace.yaml exists in any ancestor', () => {
    const result = detectPnpmCatalogOverrides(tmpDir, ['prisma-next']);
    expect(result).toBeNull();
  });

  it('returns matching catalog entries with their raw version strings', () => {
    writeFileSync(
      join(tmpDir, 'pnpm-workspace.yaml'),
      [
        'packages:',
        '  - packages/*',
        '',
        'catalog:',
        '  arktype: ^2.0.0',
        '  prisma-next: 1.2.3',
        "  '@internal/postgres': ^1.0.0",
        '',
      ].join('\n'),
    );
    const result = detectPnpmCatalogOverrides(tmpDir, [
      'prisma-next',
      '@internal/postgres',
      '@internal/mongo',
    ]);
    expect(result).not.toBeNull();
    expect(result?.entries).toEqual([
      { name: 'prisma-next', version: '1.2.3' },
      { name: '@internal/postgres', version: '^1.0.0' },
    ]);
  });

  it('returns an empty entries list when the catalog has no relevant overrides', () => {
    writeFileSync(
      join(tmpDir, 'pnpm-workspace.yaml'),
      ['catalog:', '  arktype: ^2.0.0', '  vitest: 4.0.0', ''].join('\n'),
    );
    const result = detectPnpmCatalogOverrides(tmpDir, ['prisma-next']);
    expect(result?.entries).toEqual([]);
  });

  it('finds pnpm-workspace.yaml in an ancestor directory', () => {
    writeFileSync(
      join(tmpDir, 'pnpm-workspace.yaml'),
      ['catalog:', "  '@internal/postgres': 2.0.0", ''].join('\n'),
    );
    const child = join(tmpDir, 'apps', 'web');
    mkdirSync(child, { recursive: true });
    writeFileSync(join(child, 'package.json'), JSON.stringify({ name: 'web' }));

    const result = detectPnpmCatalogOverrides(child, ['@internal/postgres']);
    expect(result?.entries).toEqual([{ name: '@internal/postgres', version: '2.0.0' }]);
  });

  it('stops scanning the catalog block at the next top-level key', () => {
    writeFileSync(
      join(tmpDir, 'pnpm-workspace.yaml'),
      ['catalog:', '  prisma-next: 1.0.0', 'overrides:', '  prisma-next: 9.9.9', ''].join('\n'),
    );
    const result = detectPnpmCatalogOverrides(tmpDir, ['prisma-next']);
    expect(result?.entries).toEqual([{ name: 'prisma-next', version: '1.0.0' }]);
  });

  it('ignores `catalogs:` (named catalogs) — only the unnamed top-level catalog applies', () => {
    writeFileSync(
      join(tmpDir, 'pnpm-workspace.yaml'),
      ['catalogs:', '  legacy:', '    prisma-next: 0.0.1', ''].join('\n'),
    );
    const result = detectPnpmCatalogOverrides(tmpDir, ['prisma-next']);
    expect(result?.entries).toEqual([]);
  });
});

describe('buildCatalogWarnings (F03 message shape)', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'init-catalog-warn-'));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns no warnings when no workspace exists', () => {
    expect(buildCatalogWarnings(tmpDir, ['prisma-next'])).toEqual([]);
  });

  it('returns a single structured warning naming each overridden entry and the source file', () => {
    writeFileSync(
      join(tmpDir, 'pnpm-workspace.yaml'),
      ['catalog:', '  prisma-next: 1.2.3', "  '@internal/postgres': ^1.0.0", ''].join('\n'),
    );
    const warnings = buildCatalogWarnings(tmpDir, ['prisma-next', '@internal/postgres']);
    expect(warnings).toHaveLength(1);
    const text = warnings[0] ?? '';
    expect(text).toContain('pnpm workspace catalog overrides detected');
    expect(text).toContain('prisma-next: 1.2.3');
    expect(text).toContain('@internal/postgres: ^1.0.0');
    expect(text).toContain('pnpm-workspace.yaml');
    expect(text).toMatch(/remove or update the catalog entry/);
  });
});

describe('runInit catalog warning surface (F03 / FR7.3)', {
  timeout: timeouts.databaseOperation,
}, () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'init-catalog-runinit-'));
    writeFileSync(join(tmpDir, 'package.json'), JSON.stringify({ name: 'test-app' }));
    // `pnpm-lock.yaml` makes the package-manager detector pick pnpm —
    // catalog warnings only fire for pnpm runs.
    writeFileSync(join(tmpDir, 'pnpm-lock.yaml'), '');
    vi.clearAllMocks();
    vi.mocked(execFile).mockImplementation(
      (_cmd: unknown, _args: unknown, _opts: unknown, cb: unknown) => {
        const callback = cb as (err: null) => void;
        callback(null);
        return undefined as never;
      },
    );
  }, timeouts.databaseOperation);

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  }, timeouts.databaseOperation);

  it('surfaces a catalog override warning in --json output when pnpm-workspace.yaml pins our packages', async () => {
    writeFileSync(
      join(tmpDir, 'pnpm-workspace.yaml'),
      ['catalog:', "  '@prisma/orm-postgres': 1.0.0", '  prisma-next: 1.2.3', ''].join('\n'),
    );

    const writes: string[] = [];
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown) => {
      if (typeof chunk === 'string') writes.push(chunk);
      else if (chunk instanceof Uint8Array) writes.push(Buffer.from(chunk).toString('utf-8'));
      return true;
    });
    try {
      const exit = await runInitTest(tmpDir, {
        options: { target: 'postgres', authoring: 'psl', install: true },
        flags: noninteractiveFlags({ json: true }),
      });
      expect(exit).toBe(INIT_EXIT_OK);

      const parsed = JSON.parse(writes.join('').trim()) as { warnings: string[] };
      const allWarnings = parsed.warnings.join('\n');
      expect(allWarnings).toMatch(/catalog overrides detected/);
      expect(allWarnings).toContain('@prisma/orm-postgres: 1.0.0');
      expect(allWarnings).toContain('prisma-next: 1.2.3');
    } finally {
      spy.mockRestore();
    }
  });

  it('does not surface a catalog warning when the workspace catalog has no relevant entries', async () => {
    writeFileSync(
      join(tmpDir, 'pnpm-workspace.yaml'),
      ['catalog:', '  vitest: 4.0.0', ''].join('\n'),
    );

    const writes: string[] = [];
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown) => {
      if (typeof chunk === 'string') writes.push(chunk);
      else if (chunk instanceof Uint8Array) writes.push(Buffer.from(chunk).toString('utf-8'));
      return true;
    });
    try {
      const exit = await runInitTest(tmpDir, {
        options: { target: 'postgres', authoring: 'psl', install: true },
        flags: noninteractiveFlags({ json: true }),
      });
      expect(exit).toBe(INIT_EXIT_OK);

      const parsed = JSON.parse(writes.join('').trim()) as { warnings: string[] };
      expect(parsed.warnings.join('\n')).not.toMatch(/catalog overrides detected/);
    } finally {
      spy.mockRestore();
    }
  });

  it('still surfaces the catalog warning under --no-install (manual-steps path)', async () => {
    writeFileSync(
      join(tmpDir, 'pnpm-workspace.yaml'),
      ['catalog:', '  prisma-next: 1.2.3', ''].join('\n'),
    );

    const writes: string[] = [];
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown) => {
      if (typeof chunk === 'string') writes.push(chunk);
      else if (chunk instanceof Uint8Array) writes.push(Buffer.from(chunk).toString('utf-8'));
      return true;
    });
    try {
      const exit = await runInitTest(tmpDir, {
        options: { target: 'postgres', authoring: 'psl', install: false },
        flags: noninteractiveFlags({ json: true }),
      });
      expect(exit).toBe(INIT_EXIT_OK);

      const parsed = JSON.parse(writes.join('').trim()) as { warnings: string[] };
      expect(parsed.warnings.join('\n')).toMatch(/catalog overrides detected/);
    } finally {
      spy.mockRestore();
    }
  });

  it('suppresses the catalog warning when the pnpm → npm fallback fires (npm bypasses the catalog)', async () => {
    writeFileSync(
      join(tmpDir, 'pnpm-workspace.yaml'),
      ['catalog:', '  prisma-next: 1.2.3', ''].join('\n'),
    );
    vi.mocked(execFile).mockImplementation(
      (cmd: unknown, _args: unknown, _opts: unknown, cb: unknown) => {
        const callback = cb as (err: unknown, stdout?: string, stderr?: string) => void;
        if (cmd === 'pnpm') {
          callback(
            Object.assign(new Error('pnpm failed'), {
              stderr:
                'ERR_PNPM_WORKSPACE_PKG_NOT_FOUND In packages/foo: "@internal/utils@workspace:*"',
            }),
          );
        } else {
          callback(null, '', '');
        }
        return undefined as never;
      },
    );

    const writes: string[] = [];
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown) => {
      if (typeof chunk === 'string') writes.push(chunk);
      else if (chunk instanceof Uint8Array) writes.push(Buffer.from(chunk).toString('utf-8'));
      return true;
    });
    try {
      const exit = await runInitTest(tmpDir, {
        options: { target: 'postgres', authoring: 'psl', install: true },
        flags: noninteractiveFlags({ json: true }),
      });
      expect(exit).toBe(INIT_EXIT_OK);

      const parsed = JSON.parse(writes.join('').trim()) as { warnings: string[] };
      const allWarnings = parsed.warnings.join('\n');
      // Fallback warning replaces the catalog warning so the user gets
      // one consistent message rather than two contradictory ones.
      expect(allWarnings).toMatch(/Falling back to `npm install`/);
      expect(allWarnings).not.toMatch(/catalog overrides detected/);
    } finally {
      spy.mockRestore();
    }
  });
});

// ---------------------------------------------------------------------------
// FR6 — Hostile-input survival + atomic init
// ---------------------------------------------------------------------------

describe('runInit hostile inputs (FR6)', { timeout: timeouts.databaseOperation }, () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'init-hostile-'));
    writeFileSync(join(tmpDir, 'package.json'), JSON.stringify({ name: 'test-app' }));
    vi.clearAllMocks();
    vi.mocked(execFile).mockImplementation(
      (_cmd: unknown, _args: unknown, _opts: unknown, cb: unknown) => {
        const callback = cb as (err: null) => void;
        callback(null);
        return undefined as never;
      },
    );
  }, timeouts.databaseOperation);

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  }, timeouts.databaseOperation);

  it('merges into a JSONC tsconfig.json with comments and trailing commas (FR6.1)', async () => {
    // Real-world JSONC straight out of a Vite / TS-team-blessed template:
    // line comments, block comments, trailing commas. The pre-jsonc-parser
    // implementation crashed here mid-init.
    const jsoncTsconfig = [
      '// Project tsconfig — JSONC is the TS team default.',
      '{',
      '  /* compiler options */',
      '  "compilerOptions": {',
      '    "strict": true, // user override',
      '    "target": "ES2022",',
      '    "types": [',
      '      "vitest/globals", // for tests',
      '    ],',
      '  },',
      '}',
      '',
    ].join('\n');
    writeFileSync(join(tmpDir, 'tsconfig.json'), jsoncTsconfig);

    const exit = await runInitTest(tmpDir, {
      options: { target: 'postgres', authoring: 'psl', install: false },
      flags: noninteractiveFlags(),
    });
    expect(exit).toBe(INIT_EXIT_OK);

    const merged = readFileSync(join(tmpDir, 'tsconfig.json'), 'utf-8');
    // Comments survive the merge (FR6.1 "preserved where possible").
    expect(merged).toContain('// Project tsconfig');
    expect(merged).toContain('/* compiler options */');
    expect(merged).toContain('// user override');
    // The required compiler options are merged in.
    expect(merged).toContain('"moduleResolution"');
    expect(merged).toContain('"node"');
    expect(merged).toContain('vitest/globals');
  });

  it('exits PRECONDITION on an unparseable tsconfig.json with CLI.INIT_INVALID_TSCONFIG (FR6.1)', async () => {
    // Bare JSON syntax error (unclosed brace) — well beyond JSONC tolerance.
    writeFileSync(join(tmpDir, 'tsconfig.json'), '{ "compilerOptions": { "strict": true ');

    const writes: string[] = [];
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown) => {
      if (typeof chunk === 'string') writes.push(chunk);
      else if (chunk instanceof Uint8Array) writes.push(Buffer.from(chunk).toString('utf-8'));
      return true;
    });
    try {
      const exit = await runInitTest(tmpDir, {
        options: { target: 'postgres', authoring: 'psl', install: false },
        flags: noninteractiveFlags({ json: true }),
      });
      expect(exit).toBe(INIT_EXIT_PRECONDITION);

      const envelope = JSON.parse(writes.join('').trim()) as {
        ok: false;
        code: string;
        meta?: { path?: string };
      };
      expect(envelope.ok).toBe(false);
      expect(envelope.code).toBe('CLI.INIT_INVALID_TSCONFIG');
      expect(envelope.meta?.path).toBe('tsconfig.json');
    } finally {
      spy.mockRestore();
    }
  });

  it('leaves the project byte-identical when an unparseable tsconfig.json aborts init (FR6.2 atomicity)', async () => {
    const originalTsconfig = '{ "compilerOptions": { broken syntax';
    writeFileSync(join(tmpDir, 'tsconfig.json'), originalTsconfig);
    const originalPkgJson = readFileSync(join(tmpDir, 'package.json'), 'utf-8');

    const exit = await runInitTest(tmpDir, {
      options: { target: 'postgres', authoring: 'psl', install: false },
      flags: noninteractiveFlags({ json: true, quiet: true }),
    });
    expect(exit).toBe(INIT_EXIT_PRECONDITION);

    // tsconfig.json untouched.
    expect(readFileSync(join(tmpDir, 'tsconfig.json'), 'utf-8')).toBe(originalTsconfig);
    // package.json untouched.
    expect(readFileSync(join(tmpDir, 'package.json'), 'utf-8')).toBe(originalPkgJson);
    // None of the scaffold files were written.
    expect(existsSync(join(tmpDir, 'prisma-next.config.ts'))).toBe(false);
    expect(existsSync(join(tmpDir, 'prisma'))).toBe(false);
    expect(existsSync(join(tmpDir, 'prisma-next.md'))).toBe(false);
    expect(existsSync(join(tmpDir, '.agents'))).toBe(false);
    expect(existsSync(join(tmpDir, '.env.example'))).toBe(false);
    expect(existsSync(join(tmpDir, '.gitignore'))).toBe(false);
    expect(existsSync(join(tmpDir, '.gitattributes'))).toBe(false);
  });

  it('leaves the project byte-identical when a malformed package.json aborts init (FR6.2)', async () => {
    // The `runInit hygiene` block already locks in the CLI.INIT_INVALID_MANIFEST surface;
    // here we additionally lock in the FR6.2 atomicity contract — no
    // partial scaffold survives the precondition failure.
    const brokenPkg = '{ "name": "broken", ';
    writeFileSync(join(tmpDir, 'package.json'), brokenPkg);
    writeFileSync(join(tmpDir, 'tsconfig.json'), JSON.stringify({}));
    const originalTsconfig = readFileSync(join(tmpDir, 'tsconfig.json'), 'utf-8');

    const exit = await runInitTest(tmpDir, {
      options: { target: 'postgres', authoring: 'psl', install: false },
      flags: noninteractiveFlags({ json: true }),
    });
    expect(exit).toBe(INIT_EXIT_PRECONDITION);

    expect(readFileSync(join(tmpDir, 'package.json'), 'utf-8')).toBe(brokenPkg);
    expect(readFileSync(join(tmpDir, 'tsconfig.json'), 'utf-8')).toBe(originalTsconfig);
    expect(existsSync(join(tmpDir, 'prisma-next.config.ts'))).toBe(false);
    expect(existsSync(join(tmpDir, 'prisma'))).toBe(false);
    expect(existsSync(join(tmpDir, '.env.example'))).toBe(false);
  });
});

describe('hasDirectDep (FR2.1)', () => {
  it('detects a direct devDependency', () => {
    expect(hasDirectDep({ devDependencies: { '@types/node': '^18' } }, '@types/node')).toBe(true);
  });

  it('detects a direct (runtime) dependency', () => {
    expect(hasDirectDep({ dependencies: { '@types/node': '^18' } }, '@types/node')).toBe(true);
  });

  it('returns false when the field is absent', () => {
    expect(hasDirectDep({ name: 'pkg' }, '@types/node')).toBe(false);
  });

  it('returns false when the field is null', () => {
    expect(hasDirectDep({ devDependencies: null }, '@types/node')).toBe(false);
  });

  it('does not inspect peerDependencies (irrelevant for the clobber-risk path)', () => {
    expect(hasDirectDep({ peerDependencies: { '@types/node': '*' } }, '@types/node')).toBe(false);
  });
});

describe('exitCodeForError', () => {
  it('maps CLI.INIT_INVALID_OUTPUT_DOCUMENT (invalid output document) to INTERNAL_ERROR, not PRECONDITION', () => {
    expect(exitCodeForError({ code: 'CLI.INIT_INVALID_OUTPUT_DOCUMENT' })).toBe(
      INIT_EXIT_INTERNAL_ERROR,
    );
    expect(exitCodeForError({ code: 'CLI.INIT_INVALID_OUTPUT_DOCUMENT' })).not.toBe(
      INIT_EXIT_PRECONDITION,
    );
  });

  it('maps unrecognised internal codes to INTERNAL_ERROR (default branch)', () => {
    expect(exitCodeForError({ code: 'CLI.UNKNOWN_FUTURE_CODE' })).toBe(INIT_EXIT_INTERNAL_ERROR);
    expect(exitCodeForError({ code: 'SOMETHING.ELSE' })).toBe(INIT_EXIT_INTERNAL_ERROR);
  });

  it('maps user-facing precondition codes to PRECONDITION', () => {
    for (const code of [
      'CLI.INIT_REINIT_NEEDS_FORCE',
      'CLI.INIT_MISSING_FLAGS',
      'CLI.INIT_INVALID_FLAG_VALUE',
      'CLI.INIT_STRICT_PROBE_WITHOUT_PROBE',
      'CLI.INIT_INVALID_MANIFEST',
      'CLI.INIT_INVALID_TSCONFIG',
      'CLI.INIT_PROBE_FAILED',
      'CLI.INIT_AUTHORING_SCHEMA_PATH_MISMATCH',
    ]) {
      expect(exitCodeForError({ code })).toBe(INIT_EXIT_PRECONDITION);
    }
  });

  it('maps lifecycle codes to their dedicated exit codes', () => {
    expect(exitCodeForError({ code: 'CLI.INIT_USER_ABORTED' })).toBe(INIT_EXIT_USER_ABORTED);
    expect(exitCodeForError({ code: 'CLI.INIT_INSTALL_FAILED' })).toBe(INIT_EXIT_INSTALL_FAILED);
    expect(exitCodeForError({ code: 'CLI.INIT_EMIT_FAILED' })).toBe(INIT_EXIT_EMIT_FAILED);
  });
});
