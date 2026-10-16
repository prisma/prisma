import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'pathe';
import { afterAll, describe, expect, it } from 'vitest';

const SCRIPT_PATHS = {
  app: 'upgrade-instructions/pending/client-takes-contract-value/app/scripts/contract-from-json.ts',
  extension:
    'upgrade-instructions/pending/client-takes-contract-value/extension/scripts/contract-from-json.ts',
} as const;

const GUIDE_PATHS = {
  app: 'upgrade-instructions/pending/client-takes-contract-value/app/instructions.md',
  extension: 'upgrade-instructions/pending/client-takes-contract-value/extension/instructions.md',
} as const;

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '../../../../..');
const fixtures = join(here, 'fixtures');
const workDirs: string[] = [];

afterAll(() => {
  for (const dir of workDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function readTree(root: string, dir = root): Record<string, string> {
  const files: Record<string, string> = {};
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) Object.assign(files, readTree(root, path));
    else files[relative(root, path)] = readFileSync(path, 'utf8');
  }
  return files;
}

function run(fixture: string, side: 'before' | 'after', audience: keyof typeof SCRIPT_PATHS) {
  const root = mkdtempSync(join(tmpdir(), `client-takes-contract-value-${fixture}-`));
  workDirs.push(root);
  cpSync(join(fixtures, fixture, side), root, { recursive: true });
  const result = spawnSync(process.execPath, [join(repoRoot, SCRIPT_PATHS[audience]), root], {
    encoding: 'utf8',
  });
  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
    tree: readTree(root),
  };
}

describe.each(['app', 'extension'] as const)('the %s script', (audience) => {
  it('moves each source file to a contract value and leaves test files alone', () => {
    expect(run('app', 'before', audience)).toEqual({
      status: 0,
      stdout: [
        'src/enums.ts: moved to contractFromJson',
        'src/prisma/db.ts: moved to contractFromJson',
        'src/query.ts: moved to contractFromJson',
        'src/supabase.ts: moved to contractFromJson',
        'src/worker.ts: moved to contractFromJson',
        '',
      ].join('\n'),
      stderr: '',
      tree: readTree(join(fixtures, 'app', 'after')),
    });
  });

  it('changes nothing in a project already moved', () => {
    expect(run('app', 'after', audience)).toEqual({
      status: 0,
      stdout: '',
      stderr: '',
      tree: readTree(join(fixtures, 'app', 'after')),
    });
  });

  it('refuses a file that already has a binding named contract, and exits 1', () => {
    expect(run('refused', 'before', audience)).toEqual({
      status: 1,
      stdout: '',
      stderr:
        'src/db.ts: not moved, because it already declares a binding named contract; choose another name for the value\n',
      tree: readTree(join(fixtures, 'refused', 'before')),
    });
  });
});

function detection(audience: keyof typeof GUIDE_PATHS): RegExp {
  const guide = readFileSync(join(repoRoot, GUIDE_PATHS[audience]), 'utf8');
  const pattern = /^ {8}- '(.*)'$/m.exec(guide)?.[1];
  if (pattern === undefined) throw new Error(`${GUIDE_PATHS[audience]} has no detection pattern`);
  return new RegExp(pattern.replaceAll("''", "'"));
}

describe.each(['app', 'extension'] as const)('the %s detection', (audience) => {
  const detects = (content: string) => detection(audience).test(content);

  it.each([
    ['a one-line call', 'export const db = postgres<Contract>({ contractJson, url });'],
    ['a multi-line call', 'export const db = postgres<Contract>({\n  contractJson,\n  url,\n});'],
    ['an explicit property', 'sqlite({ path, contractJson: json })'],
    ['a static entry', 'mongoStatic<Contract>({ contractJson }).enums'],
    ['the query builder', 'mongoQuery<TContract>({ contractJson: contract })'],
    ['Supabase', 'supabase<Contract>({ url, contractJson, jwtSecret })'],
  ])('finds %s', (_name, content) => {
    expect(detects(content)).toBe(true);
  });

  it.each([
    ['the new form', 'postgres({ contract: contractFromJson<Contract>(contractJson), url })'],
    ['a contract value', 'export const db = postgres({ contract, url });'],
    ['another function', 'withPostgresPort({ contractJson })'],
    ['a method of the same name', 'client.postgres({ contractJson })'],
    ['a control client option', 'client.dbInit({ contract: contractJson })'],
  ])('skips %s', (_name, content) => {
    expect(detects(content)).toBe(false);
  });
});
