import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { PostgresContractSerializer } from '@internal/target-postgres/runtime';
import { join } from 'pathe';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  emitted,
  type Fixtures,
  generateFixtures,
  postColumns,
  SECOND,
  storageHashOf,
} from './fixture-generator';
import {
  appScript,
  copyFixture,
  extensionScript,
  fixturesDir,
  fixtureTree,
  formatted,
  readTree,
  removeWorkDirs,
  runScript,
  withoutMigration,
  writeTree,
} from './test-helpers';

let generated: Fixtures;

beforeAll(async () => {
  generated = await generateFixtures();
  if (process.env['EXPAND_TYPE_ALIASES_FIXTURES_WRITE'] === '1') {
    rmSync(fixturesDir, { recursive: true, force: true });
    writeTree(join(fixturesDir, 'before'), generated.before);
    writeTree(join(fixturesDir, 'after'), generated.after);
  }
}, 60_000);

afterAll(removeWorkDirs);

function initialHashes(): readonly [string, string] {
  const [oldHash, newHash] = generated.hashes[0] ?? [];
  return [oldHash ?? '', newHash ?? ''];
}

/** The summary line of every storage.types entry the script removed, per contract it wrote. */
function removedEntries(): readonly string[] {
  const entries = 'Code, Embedding, Slug';
  return [
    'Removed storage.types entries:',
    ...generated.hashes
      .map(([, newHash]) => `  migrations/snapshots/${newHash}/contract.json: ${entries}`)
      .sort(),
    `  prisma/contract.json: ${entries}`,
  ];
}

function summary(files: number, directories: number): string {
  return [
    `Rewrote ${files} files and renamed ${directories} snapshot directories. Storage hashes changed (old -> new):`,
    ...[...generated.hashes]
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([oldHash, newHash]) => `  ${oldHash} -> ${newHash}`),
    ...removedEntries(),
    '',
  ].join('\n');
}

const RESTORE = 'restore the file from version control, or re-emit it, and run the script again';

/** A contract of the before fixture changed by `change`, with its stored hash refreshed so only the change is wrong. */
function withChangedContract(change: (contract: Record<string, unknown>) => void): string {
  const root = copyFixture('before');
  const path = join(root, 'prisma/contract.json');
  const contract = JSON.parse(readFileSync(path, 'utf8'));
  change(contract);
  contract.storage.storageHash = storageHashOf(contract);
  writeFileSync(path, JSON.stringify(contract, null, 2));
  return root;
}

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (typeof value !== 'object' || value === null) return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, sortKeysDeep((value as Record<string, unknown>)[key])]),
  );
}

describe('the fixtures', () => {
  it('are what the live framework code builds', () => {
    expect({ before: fixtureTree('before'), after: fixtureTree('after') }).toEqual({
      before: generated.before,
      after: generated.after,
    });
  });

  it('before the upgrade, store a typeRef on each aliased column', () => {
    const [oldHash] = initialHashes();
    const columns = postColumns(
      JSON.parse(fixtureTree('before')[`migrations/snapshots/${oldHash}/contract.json`] ?? '{}'),
    );
    expect({
      slug: (columns['slug'] as Record<string, unknown>)['typeRef'],
      embedding: (columns['embedding'] as Record<string, unknown>)['typeRef'],
    }).toEqual({ slug: 'Slug', embedding: 'Embedding' });
  });

  it('before the upgrade, store the alias the source declares but no column uses in the latest snapshot and in contract.json', () => {
    const [, latest] = generated.hashes[1] ?? [];
    const before = fixtureTree('before');
    const latestOld = generated.hashes[1]?.[0] ?? '';
    const typesOf = (text: string | undefined) =>
      Object.keys(JSON.parse(text ?? '{}').storage?.types ?? {}).sort();
    expect({
      source: SECOND.psl.includes('Code      = Char(8)'),
      snapshot: typesOf(before[`migrations/snapshots/${latestOld}/contract.json`]),
      emitted: typesOf(before['prisma/contract.json']),
      after: typesOf(fixtureTree('after')[`migrations/snapshots/${latest}/contract.json`]),
    }).toEqual({
      source: true,
      snapshot: ['Code', 'Embedding', 'Slug'],
      emitted: ['Code', 'Embedding', 'Slug'],
      after: [],
    });
  });

  it('keep the vector entry of the pgvector space snapshot', () => {
    const pgvectorHead = JSON.parse(
      fixtureTree('after')['migrations/pgvector/refs/head.json'] ?? '{}',
    );
    const snapshot = `migrations/snapshots/${pgvectorHead.hash}/contract.json`;
    expect({
      before: fixtureTree('before')[snapshot],
      after: Object.keys(JSON.parse(fixtureTree('after')[snapshot] ?? '{}').storage.types),
    }).toEqual({ before: fixtureTree('after')[snapshot], after: ['vector'] });
  });

  it('after the upgrade, load as contracts whose stored hashes match their content', () => {
    const serializer = new PostgresContractSerializer();
    const contracts = Object.entries(fixtureTree('after')).filter(([path]) =>
      path.endsWith('contract.json'),
    );
    expect(contracts).toHaveLength(4);
    for (const [path, text] of contracts) {
      const contract = JSON.parse(text);
      expect(() => serializer.deserializeContract(contract), path).not.toThrow();
      expect(storageHashOf(contract), path).toBe(contract.storage.storageHash);
    }
  });

  it('after the upgrade, the latest snapshot and the emitted contract are what the unchanged source emits', async () => {
    const [, latest] = generated.hashes[1] ?? [];
    const after = fixtureTree('after');
    const reemitted = await emitted(SECOND.psl);
    expect({
      hash: latest,
      json: after[`migrations/snapshots/${latest}/contract.json`],
      dts: after[`migrations/snapshots/${latest}/contract.d.ts`],
      emittedJson: after['prisma/contract.json'],
      emittedDts: after['prisma/contract.d.ts'],
    }).toEqual({
      hash: reemitted.hash,
      json: `${JSON.stringify(sortKeysDeep(JSON.parse(reemitted.json)))}\n`,
      dts: reemitted.dts,
      emittedJson: reemitted.json,
      emittedDts: reemitted.dts,
    });
  });
});

describe('expand-type-aliases', () => {
  it('writes each alias into its columns, renames the snapshots and rewrites every reference to their hashes', () => {
    const run = runScript(copyFixture('before'));
    expect({
      status: run.status,
      stdout: run.stdout,
      stderr: run.stderr,
      tree: formatted(readTree(run.root)),
    }).toEqual({
      status: 0,
      stdout: summary(7, 2),
      stderr: '',
      tree: fixtureTree('after'),
    });
  });

  it('points the snapshot imports of each migration.ts at the renamed directories', () => {
    const run = runScript(copyFixture('before'));
    const tree = readTree(run.root);
    const imported = Object.entries(tree)
      .filter(([path]) => path.endsWith('migration.ts'))
      .flatMap(([, text]) => [
        ...text.matchAll(/'\.\.\/\.\.\/(snapshots\/[0-9a-f]{64})\/contract/g),
      ])
      .map((match) => `migrations/${match[1]}/contract.json`);
    expect(imported.length).toBeGreaterThan(0);
    expect(imported.filter((path) => tree[path] === undefined)).toEqual([]);
    expect(new Set(imported)).toEqual(
      new Set(
        generated.hashes.map(([, newHash]) => `migrations/snapshots/${newHash}/contract.json`),
      ),
    );
  });

  it('changes nothing in a project that stores no typeRef', () => {
    const run = runScript(copyFixture('after'));
    expect({ status: run.status, stdout: run.stdout, tree: readTree(run.root) }).toEqual({
      status: 0,
      stdout: 'No contract stores a type alias; nothing changed.\n',
      tree: fixtureTree('after'),
    });
  });

  it('finishes an upgrade that stopped after writing a new snapshot directory', () => {
    const root = copyFixture('before');
    const [, newHash] = initialHashes();
    const snapshot = `migrations/snapshots/${newHash}`;
    mkdirSync(join(root, snapshot), { recursive: true });
    for (const name of ['contract.json', 'contract.d.ts'])
      writeFileSync(join(root, snapshot, name), fixtureTree('after')[`${snapshot}/${name}`] ?? '');
    const run = runScript(root);
    expect({ status: run.status, tree: formatted(readTree(root)) }).toEqual({
      status: 0,
      tree: fixtureTree('after'),
    });
  });

  it('stops without changing a file when a new snapshot directory exists with other content', () => {
    const root = copyFixture('before');
    const [, newHash] = initialHashes();
    mkdirSync(join(root, 'migrations/snapshots', newHash), { recursive: true });
    writeFileSync(join(root, 'migrations/snapshots', newHash, 'contract.json'), '{}\n');
    const before = readTree(root);
    const run = runScript(root);
    expect({ status: run.status, stderr: run.stderr, tree: readTree(root) }).toEqual({
      status: 1,
      stderr: `migrations/snapshots/${newHash}: snapshot directory already exists with different content\n`,
      tree: before,
    });
  });

  it('stops without changing a file when a snapshot directory is not named after its content', () => {
    const root = copyFixture('before');
    const [oldHash] = initialHashes();
    const misnamed = 'a'.repeat(64);
    renameSync(
      join(root, 'migrations/snapshots', oldHash),
      join(root, 'migrations/snapshots', misnamed),
    );
    const before = readTree(root);
    const run = runScript(root);
    expect({
      status: run.status,
      stdout: run.stdout,
      stderr: run.stderr,
      tree: readTree(root),
    }).toEqual({
      status: 1,
      stdout: '',
      stderr: `migrations/snapshots/${misnamed}/contract.json: the stored storage hash ${misnamed} does not match the contract's content, which hashes to ${oldHash}; restore the file from version control, or re-emit it, and run the script again\n`,
      tree: before,
    });
  });

  it('stops without changing a file when an alias has another codec than the column it types', () => {
    const root = copyFixture('before');
    const path = join(root, 'prisma/contract.json');
    const contract = JSON.parse(readFileSync(path, 'utf8'));
    contract.storage.types.Slug.codecId = 'sql/char@1';
    contract.storage.storageHash = storageHashOf(contract);
    writeFileSync(path, JSON.stringify(contract, null, 2));
    const before = readTree(root);
    const run = runScript(root);
    expect({
      status: run.status,
      stdout: run.stdout,
      stderr: run.stderr,
      tree: readTree(root),
    }).toEqual({
      status: 1,
      stdout: '',
      stderr: [
        'prisma/contract.json: column post.slug has codec sql/varchar@1 and data type pg/varchar, but its type alias Slug has codec sql/char@1 and data type pg/varchar; restore the file from version control, or re-emit it, and run the script again',
        'prisma/contract.json: column post.title has codec sql/varchar@1 and data type pg/varchar, but its type alias Slug has codec sql/char@1 and data type pg/varchar; restore the file from version control, or re-emit it, and run the script again',
        '',
      ].join('\n'),
      tree: before,
    });
  });

  it('stops without changing a file when a column names an alias storage.types does not declare', () => {
    const root = withChangedContract((contract) => {
      delete (contract['storage'] as { types: Record<string, unknown> }).types['Slug'];
    });
    const before = readTree(root);
    const run = runScript(root);
    expect({
      status: run.status,
      stdout: run.stdout,
      stderr: run.stderr,
      tree: readTree(root),
    }).toEqual({
      status: 1,
      stdout: '',
      stderr: [
        `prisma/contract.json: column post.slug is typed by the type alias "Slug", which storage.types does not declare; ${RESTORE}`,
        `prisma/contract.json: column post.title is typed by the type alias "Slug", which storage.types does not declare; ${RESTORE}`,
        '',
      ].join('\n'),
      tree: before,
    });
  });

  it('stops without changing a file when a column stores both typeRef and typeParams', () => {
    const root = withChangedContract((contract) => {
      (postColumns(contract)['slug'] as Record<string, unknown>)['typeParams'] = { length: 64 };
    });
    const before = readTree(root);
    const run = runScript(root);
    expect({
      status: run.status,
      stdout: run.stdout,
      stderr: run.stderr,
      tree: readTree(root),
    }).toEqual({
      status: 1,
      stdout: '',
      stderr: `prisma/contract.json: column post.slug stores both typeRef and typeParams; ${RESTORE}\n`,
      tree: before,
    });
  });

  it('stops without changing a file when a contract, migration or ref is not valid JSON', () => {
    const root = copyFixture('before');
    for (const path of [
      'prisma/contract.json',
      'migrations/app/20260201T0000_add_title/migration.json',
      'migrations/app/refs/head.json',
    ])
      writeFileSync(join(root, path), '{');
    const before = readTree(root);
    const run = runScript(root);
    expect({
      status: run.status,
      stdout: run.stdout,
      stderr: run.stderr,
      tree: readTree(root),
    }).toEqual({
      status: 1,
      stdout: '',
      stderr: [
        'migrations/app/20260201T0000_add_title/migration.json: not valid JSON',
        'migrations/app/refs/head.json: not valid JSON',
        'prisma/contract.json: not valid JSON',
        '',
      ].join('\n'),
      tree: before,
    });
  });

  it('keeps the vector entry of a pgvector space snapshot that no migration or ref names', () => {
    const root = copyFixture('before');
    rmSync(join(root, 'migrations/pgvector'), { recursive: true });
    const run = runScript(root);
    expect({
      status: run.status,
      stdout: run.stdout,
      stderr: run.stderr,
      tree: formatted(readTree(root)),
    }).toEqual({
      status: 0,
      stdout: summary(7, 2),
      stderr: '',
      tree: withoutMigration(fixtureTree('after'), 'migrations/pgvector'),
    });
  });

  it('ships the same script for extensions', () => {
    expect(readFileSync(extensionScript, 'utf8')).toBe(readFileSync(appScript, 'utf8'));
  });
});
