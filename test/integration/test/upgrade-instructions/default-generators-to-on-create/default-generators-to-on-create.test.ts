import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'pathe';
import { afterAll, describe, expect, it } from 'vitest';

const SCRIPT_PATHS = {
  app: 'upgrade-instructions/pending/default-generators-to-on-create/app/scripts/rewrite-default-generators.mjs',
} as const;

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '../../../../..');
const fixturesDir = join(here, 'fixtures');
const script = join(repoRoot, SCRIPT_PATHS.app);
const workDirs: string[] = [];

afterAll(() => {
  for (const dir of workDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function copyBefore(): string {
  const dir = mkdtempSync(join(tmpdir(), 'default-generators-to-on-create-'));
  workDirs.push(dir);
  cpSync(join(fixturesDir, 'before'), dir, { recursive: true });
  return dir;
}

function filesOf(dir: string): Record<string, string> {
  return Object.fromEntries(
    readdirSync(dir).map((name) => [name, readFileSync(join(dir, name), 'utf8')]),
  );
}

function run(dir: string, files: readonly string[]) {
  const result = spawnSync(process.execPath, [script, ...files], { cwd: dir, encoding: 'utf8' });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

describe('rewrite-default-generators', () => {
  it('rewrites every client function in @default of a Prisma 8 file to @onCreate, comments included, and leaves every other file unchanged', () => {
    const dir = copyBefore();
    const result = run(dir, [
      'schema.prisma',
      'older-header.prisma',
      'unchanged.prisma',
      'prisma7.prisma',
      'prisma7-models.prisma',
    ]);
    expect({ status: result.status, stdout: result.stdout, files: filesOf(dir) }).toEqual({
      status: 0,
      stdout: [
        'schema.prisma: rewrote 9 @default calls to @onCreate.',
        'older-header.prisma: rewrote 1 @default calls to @onCreate.',
        'unchanged.prisma: no client function in @default; left unchanged.',
        'prisma7.prisma: does not start with "// use prisma-8", so it is not a Prisma 8 schema; left unchanged. A Prisma 7 schema keeps @default(uuid()).',
        'prisma7-models.prisma: does not start with "// use prisma-8", so it is not a Prisma 8 schema; left unchanged. A Prisma 7 schema keeps @default(uuid()).',
        '',
      ].join('\n'),
      files: filesOf(join(fixturesDir, 'after')),
    });
  });

  it('is idempotent', () => {
    const dir = copyBefore();
    run(dir, ['schema.prisma']);
    const result = run(dir, ['schema.prisma']);
    expect({ status: result.status, schema: filesOf(dir)['schema.prisma'] }).toEqual({
      status: 0,
      schema: filesOf(join(fixturesDir, 'after'))['schema.prisma'],
    });
  });

  it('refuses to run without files and names a file it cannot read', () => {
    const dir = copyBefore();
    expect({ none: run(dir, []).status, missing: run(dir, ['missing.prisma']) }).toEqual({
      none: 1,
      missing: {
        status: 1,
        stdout: '',
        stderr: 'missing.prisma: cannot be read; no file was changed.\n',
      },
    });
  });
});
