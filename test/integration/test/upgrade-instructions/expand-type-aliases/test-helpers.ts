import { spawnSync } from 'node:child_process';
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { loadContractSpaceAggregate } from '@internal/migration-tools/aggregate';
import { EMPTY_CONTRACT_HASH } from '@internal/migration-tools/constants';
import { findPath } from '@internal/migration-tools/migration-graph';
import { PostgresContractSerializer } from '@internal/target-postgres/runtime';
import { dirname, join, relative } from 'pathe';

const SCRIPT_PATHS = {
  app: 'upgrade-instructions/pending/expand-type-aliases/app/scripts/expand-type-aliases/expand-type-aliases.ts',
  extension:
    'upgrade-instructions/pending/expand-type-aliases/extension/scripts/expand-type-aliases/expand-type-aliases.ts',
} as const;

const here = dirname(fileURLToPath(import.meta.url));
export const repoRoot = join(here, '../../../../..');
export const fixturesDir = join(here, 'fixtures');
export const appScript = join(repoRoot, SCRIPT_PATHS.app);
export const extensionScript = join(repoRoot, SCRIPT_PATHS.extension);
const workDirs: string[] = [];

export type Tree = Record<string, string>;

export function removeWorkDirs(): void {
  for (const dir of workDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
}

export function makeWorkDir(prefix = 'expand-type-aliases-'): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  workDirs.push(dir);
  return dir;
}

export function readTree(root: string, dir = root): Tree {
  const files: Tree = {};
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) Object.assign(files, readTree(root, path));
    else if (entry.isFile()) files[relative(root, path)] = readFileSync(path, 'utf8');
  }
  return files;
}

export function writeTree(root: string, tree: Tree): void {
  for (const [path, text] of Object.entries(tree)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
}

export function copyFixture(side: 'before' | 'after'): string {
  const root = makeWorkDir();
  cpSync(join(fixturesDir, side), root, { recursive: true });
  return root;
}

export interface Run {
  readonly root: string;
  readonly status: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

export function runScript(root: string, script = appScript): Run {
  const result = spawnSync(process.execPath, [script, root], { encoding: 'utf8' });
  return { root, status: result.status, stdout: result.stdout, stderr: result.stderr };
}

export function fixtureTree(side: 'before' | 'after'): Tree {
  return readTree(join(fixturesDir, side));
}

const SNAPSHOT_IMPORT = /^import [^;]*?'\.\.\/\.\.\/snapshots\/[\s\S]*?;\n/gm;

/** A `migration.ts` with its imports in source order, as a formatter leaves them after the script renames the snapshots they name. */
function withSortedImports(text: string): string {
  const imports = text.match(SNAPSHOT_IMPORT) ?? [];
  const source = (statement: string) => /from '([^']*)'/.exec(statement)?.[1] ?? '';
  const sorted = [...imports].sort((a, b) => (source(a) < source(b) ? -1 : 1));
  let index = 0;
  return text.replace(SNAPSHOT_IMPORT, () => sorted[index++] ?? '');
}

export function formatted(tree: Tree): Tree {
  return Object.fromEntries(
    Object.entries(tree).map(([path, text]) => [
      path,
      path.endsWith('migration.ts') ? withSortedImports(text) : text,
    ]),
  );
}

export function withoutMigration(tree: Tree, dir: string): Tree {
  return Object.fromEntries(Object.entries(tree).filter(([path]) => !path.startsWith(`${dir}/`)));
}

/** What the migration checker finds in the project at `root`: every integrity violation, and the app migrations from the empty contract to the emitted one. */
export async function checked(root: string): Promise<{
  readonly violations: readonly unknown[];
  readonly path: readonly string[] | undefined;
}> {
  const serializer = new PostgresContractSerializer();
  const appContract = serializer.deserializeContract(
    JSON.parse(readFileSync(join(root, 'prisma/contract.json'), 'utf8')),
  );
  const aggregate = await loadContractSpaceAggregate({
    migrationsDir: join(root, 'migrations'),
    deserializeContract: (raw) => serializer.deserializeContract(raw),
    appContract,
  });
  return {
    violations: aggregate.checkIntegrity({ checkContracts: true }),
    path: findPath(
      aggregate.app.graph(),
      EMPTY_CONTRACT_HASH,
      appContract.storage.storageHash,
    )?.map((edge) => edge.dirName),
  };
}
