import { execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { cp, mkdir, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDatabase, type TestDatabase } from './database';

const execFileAsync = promisify(execFile);
const exampleDir = fileURLToPath(new URL('..', import.meta.url));
const prismaBin = join(exampleDir, '..', '..', 'node_modules', '.bin', 'prisma');
const serverUrl = process.env['MYSQL_URL'];

interface CliRun {
  readonly exitCode: number;
  readonly result: Record<string, unknown>;
}

async function prisma(projectDir: string, databaseUrl: string, args: string[]): Promise<CliRun> {
  const { stdout, exitCode } = await execFileAsync(prismaBin, [...args, '--json'], {
    cwd: projectDir,
    env: { ...process.env, MYSQL_URL: databaseUrl },
  }).then(
    ({ stdout }) => ({ stdout, exitCode: 0 }),
    (error: { stdout: string; code: number }) => ({ stdout: error.stdout, exitCode: error.code }),
  );
  const lines = stdout.trim().split('\n');
  const last = JSON.parse(lines[lines.length - 1] ?? '{}');
  return { exitCode, result: last.envelope?.result ?? last.envelope };
}

async function listFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name))
    .sort();
}

describe.skipIf(serverUrl === undefined)(
  'the committed migration against an empty MySQL database',
  () => {
    let database: TestDatabase;
    let projectDir: string;

    beforeAll(async () => {
      database = await createTestDatabase(serverUrl ?? '');
      projectDir = join(exampleDir, '.tmp-output', randomBytes(6).toString('hex'));
      await mkdir(projectDir, { recursive: true });
      for (const entry of ['prisma.config.ts', 'prisma', 'src', 'migrations']) {
        await cp(join(exampleDir, entry), join(projectDir, entry), { recursive: true });
      }
    });

    afterAll(async () => {
      await database?.drop();
      if (projectDir !== undefined) await rm(projectDir, { recursive: true, force: true });
    });

    it('applies with db migrate', async () => {
      const run = await prisma(projectDir, database.url, ['db', 'migrate']);

      expect(run).toMatchObject({
        exitCode: 0,
        result: {
          ok: true,
          migrationsApplied: 1,
          perSpace: [
            {
              spaceId: 'app',
              operations: [
                { label: 'Create table Post' },
                { label: 'Create table User' },
                { label: expect.stringMatching(/^Create index Post_authorId_idx_\w+ on Post$/) },
                { label: 'Add foreign key Post_authorId_fkey on Post' },
              ],
            },
          ],
        },
      });
    });

    it('passes db verify', async () => {
      const run = await prisma(projectDir, database.url, ['db', 'verify']);

      expect(run).toMatchObject({
        exitCode: 0,
        result: {
          ok: true,
          mode: 'full',
          target: { expected: 'mysql' },
          schema: { summary: 'Database schema satisfies contract', warnings: [] },
        },
      });
    });

    it('passes db sign', async () => {
      const run = await prisma(projectDir, database.url, ['db', 'sign']);

      expect(run).toMatchObject({
        exitCode: 0,
        result: { ok: true, summary: 'Database signed' },
      });
    });

    it('plans no new migration from the unchanged contract', async () => {
      const migrationsDir = join(projectDir, 'migrations');
      const before = await listFiles(migrationsDir);

      const run = await prisma(projectDir, database.url, ['migration', 'plan', '--name', 'again']);

      expect(run).toMatchObject({ exitCode: 0, result: { ok: true, noOp: true, operations: [] } });
      expect(await listFiles(migrationsDir)).toEqual(before);
    });
  },
);
