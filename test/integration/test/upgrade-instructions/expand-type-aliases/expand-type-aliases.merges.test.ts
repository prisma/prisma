import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  type Fixtures,
  generateFixtures,
  type MigrationOp,
  migrationPackage,
  postColumns,
  snapshotForm,
  storageHashOf,
} from './fixture-generator';
import {
  checked,
  fixtureTree,
  formatted,
  makeWorkDir,
  readTree,
  removeWorkDirs,
  runScript,
  type Tree,
  withoutMigration,
  writeTree,
} from './test-helpers';

let generated: Fixtures;

beforeAll(async () => {
  generated = await generateFixtures();
}, 60_000);

afterAll(removeWorkDirs);

const USE_ALIASES = 'migrations/app/20260115T0000_use_aliases';
const BACKFILL: readonly MigrationOp[] = [
  { id: 'data.backfill-slug', label: 'Backfill slug', operationClass: 'data' },
];
const HAND_FORMATTED = '// Formatted by hand.\n';

function initialHashes(): readonly [string, string] {
  const [oldHash, newHash] = generated.hashes[0] ?? [];
  return [oldHash ?? '', newHash ?? ''];
}

/** The before fixture with a first migration to the contract written inline, and a migration that only introduces the aliases, which expanding the aliases turns into one snapshot. */
function inlineThenAliased(): {
  readonly tree: Tree;
  readonly inline: string;
  readonly aliased: string;
} {
  const [aliased, inline] = initialHashes();
  const tree: Tree = Object.fromEntries(
    Object.entries(fixtureTree('before')).filter(
      ([path]) =>
        !path.startsWith('migrations/app/20260101T0000_initial/') || path.endsWith('.prisma'),
    ),
  );
  const after = fixtureTree('after');
  for (const name of ['contract.json', 'contract.d.ts'])
    tree[`migrations/snapshots/${inline}/${name}`] =
      after[`migrations/snapshots/${inline}/${name}`] ?? '';
  Object.assign(
    tree,
    migrationPackage('20260101T0000_initial', null, inline, '2026-01-01T00:00:00.000Z'),
    migrationPackage('20260115T0000_use_aliases', inline, aliased, '2026-01-15T00:00:00.000Z'),
  );
  return { tree, inline, aliased };
}

/** {@link inlineThenAliased} with the migration that introduces the aliases as the app's latest: no later migration, no head ref, and the emitted contract is its target. */
function aliasesInLatestMigration(): {
  readonly tree: Tree;
  readonly inline: string;
  readonly aliased: string;
} {
  const { tree, inline, aliased } = inlineThenAliased();
  const [secondOld] = generated.hashes[1] ?? [];
  const before = fixtureTree('before');
  const latest = withoutMigration(
    withoutMigration(tree, 'migrations/app/20260201T0000_add_title'),
    `migrations/snapshots/${secondOld}`,
  );
  delete latest['migrations/app/refs/head.json'];
  latest['prisma/contract.json'] = before[`migrations/snapshots/${aliased}/contract.json`] ?? '';
  latest['prisma/contract.d.ts'] = before[`migrations/snapshots/${aliased}/contract.d.ts`] ?? '';
  return { tree: latest, inline, aliased };
}

function mergedSnapshotsLine(inline: string, aliased: string, advice: string): string {
  const names = [inline, aliased].sort().join(' and ');
  return `migrations/snapshots: the snapshots ${names} become the same snapshot, ${inline}, once their type aliases are written into their columns. Migration ${USE_ALIASES} goes from ${inline} to ${aliased} and has no data operation, so it would go from ${inline} to itself, which only a migration with a data operation may do. ${advice}\n`;
}

const DELETE_MIGRATION = `Delete the migration directory ${USE_ALIASES} and run the script again.`;

function runIn(tree: Tree): ReturnType<typeof runScript> {
  const root = makeWorkDir();
  writeTree(root, tree);
  return runScript(root);
}

/** The aliased snapshot of the before fixture with its `Slug` alias renamed `Handle`, as a migration that only renames an alias leaves it. */
function renamedAlias(aliased: string): { readonly hash: string; readonly files: Tree } {
  const before = fixtureTree('before');
  const contract = JSON.parse(before[`migrations/snapshots/${aliased}/contract.json`] ?? '{}');
  const { Slug, ...otherTypes } = contract.storage.types;
  contract.storage.types = { ...otherTypes, Handle: Slug };
  (postColumns(contract)['slug'] as Record<string, unknown>)['typeRef'] = 'Handle';
  const hash = storageHashOf(contract);
  contract.storage.storageHash = hash;
  const dts = (before[`migrations/snapshots/${aliased}/contract.d.ts`] ?? '')
    .replaceAll("readonly typeRef: 'Slug'", "readonly typeRef: 'Handle'")
    .replaceAll('readonly Slug: {', 'readonly Handle: {')
    .replaceAll(aliased, hash);
  return { hash, files: { 'contract.json': snapshotForm(contract), 'contract.d.ts': dts } };
}

describe('expand-type-aliases, when two snapshots become one', () => {
  it('stops without changing a file when a migration with no data operation goes between them', () => {
    const { tree, inline, aliased } = inlineThenAliased();
    const run = runIn(tree);
    expect({
      status: run.status,
      stdout: run.stdout,
      stderr: run.stderr,
      tree: readTree(run.root),
    }).toEqual({
      status: 1,
      stdout: '',
      stderr: mergedSnapshotsLine(inline, aliased, DELETE_MIGRATION),
      tree,
    });
  });

  it('stops the same way when those two snapshots would have different files', () => {
    const { tree, inline, aliased } = inlineThenAliased();
    tree[`migrations/snapshots/${inline}/contract.d.ts`] =
      `${HAND_FORMATTED}${tree[`migrations/snapshots/${inline}/contract.d.ts`] ?? ''}`;
    const run = runIn(tree);
    expect({
      status: run.status,
      stdout: run.stdout,
      stderr: run.stderr,
      tree: readTree(run.root),
    }).toEqual({
      status: 1,
      stdout: '',
      stderr: mergedSnapshotsLine(inline, aliased, DELETE_MIGRATION),
      tree,
    });
  });

  it('names the target snapshot to delete too when the migration is the latest and nothing else names its target', () => {
    const { tree, inline, aliased } = aliasesInLatestMigration();
    const run = runIn(tree);
    expect({
      status: run.status,
      stdout: run.stdout,
      stderr: run.stderr,
      tree: readTree(run.root),
    }).toEqual({
      status: 1,
      stdout: '',
      stderr: mergedSnapshotsLine(
        inline,
        aliased,
        `Delete the migration directory ${USE_ALIASES} and the snapshot directory migrations/snapshots/${aliased}, which no other migration or ref names, and run the script again.`,
      ),
      tree,
    });
  });

  it('stops naming the unreadable ops.json, not advising to delete the migration, when ops.json is not valid JSON', () => {
    const { tree } = inlineThenAliased();
    tree[`${USE_ALIASES}/ops.json`] = '{';
    const run = runIn(tree);
    expect({
      status: run.status,
      stdout: run.stdout,
      stderr: run.stderr,
      tree: readTree(run.root),
    }).toEqual({
      status: 1,
      stdout: '',
      stderr: `${USE_ALIASES}/ops.json: not valid JSON\n`,
      tree,
    });
  });

  it('upgrades the project once the migration it stopped on is deleted, and the migration checker accepts it', async () => {
    const { tree } = inlineThenAliased();
    const run = runIn(withoutMigration(tree, USE_ALIASES));
    expect({
      status: run.status,
      stderr: run.stderr,
      tree: formatted(readTree(run.root)),
      checked: await checked(run.root),
    }).toEqual({
      status: 0,
      stderr: '',
      tree: fixtureTree('after'),
      checked: { violations: [], path: ['20260101T0000_initial', '20260201T0000_add_title'] },
    });
  });

  it('upgrades the project once the latest migration and its target snapshot are deleted, and the migration checker accepts it', async () => {
    const { tree, inline, aliased } = aliasesInLatestMigration();
    const deleted = withoutMigration(
      withoutMigration(tree, USE_ALIASES),
      `migrations/snapshots/${aliased}`,
    );
    const run = runIn(deleted);
    const after = fixtureTree('after');
    expect({
      status: run.status,
      stdout: run.stdout,
      stderr: run.stderr,
      tree: formatted(readTree(run.root)),
      checked: await checked(run.root),
    }).toEqual({
      status: 0,
      stdout: [
        'Rewrote 2 files and renamed 0 snapshot directories. Storage hashes changed (old -> new):',
        `  ${aliased} -> ${inline}`,
        'Removed storage.types entries:',
        '  prisma/contract.json: Code, Embedding, Slug',
        '',
      ].join('\n'),
      stderr: '',
      tree: {
        ...deleted,
        'prisma/contract.json': after[`migrations/snapshots/${inline}/contract.json`],
        'prisma/contract.d.ts': after[`migrations/snapshots/${inline}/contract.d.ts`],
      },
      checked: { violations: [], path: ['20260101T0000_initial'] },
    });
  });

  it('upgrades a migration between them that has a data operation, keeps the merged directory that exists, and the migration checker accepts it', async () => {
    const { tree, inline, aliased } = inlineThenAliased();
    const inlineDts = `migrations/snapshots/${inline}/contract.d.ts`;
    tree[inlineDts] = `${HAND_FORMATTED}${tree[inlineDts] ?? ''}`;
    const createdAt = '2026-01-15T00:00:00.000Z';
    Object.assign(
      tree,
      migrationPackage('20260115T0000_use_aliases', inline, aliased, createdAt, BACKFILL),
    );
    const run = runIn(tree);
    const upgraded = formatted(readTree(run.root));
    const migrationTs = `${USE_ALIASES}/migration.ts`;
    expect({
      status: run.status,
      stderr: run.stderr,
      tree: { ...upgraded, [migrationTs]: undefined },
      migrationTs: upgraded[migrationTs]?.includes(aliased),
      checked: await checked(run.root),
    }).toEqual({
      status: 0,
      stderr: '',
      tree: {
        ...fixtureTree('after'),
        ...migrationPackage('20260115T0000_use_aliases', inline, inline, createdAt, BACKFILL),
        [inlineDts]: tree[inlineDts],
        [migrationTs]: undefined,
      },
      migrationTs: false,
      checked: {
        violations: [],
        path: ['20260101T0000_initial', '20260201T0000_add_title'],
      },
    });
  });

  it('writes one of two changed snapshots that merge, when a migration with a data operation only renamed an alias, and the migration checker accepts it', async () => {
    const [aliased, inline] = initialHashes();
    const before = fixtureTree('before');
    const after = fixtureTree('after');
    const renamed = renamedAlias(aliased);
    const handFormatted = `${HAND_FORMATTED}${renamed.files['contract.d.ts'] ?? ''}`;
    const createdAt = '2026-01-15T00:00:00.000Z';
    const rename = 'migrations/app/20260115T0000_rename_alias';
    const tree: Tree = {
      'prisma/contract.json': renamed.files['contract.json'] ?? '',
      'prisma/contract.d.ts': renamed.files['contract.d.ts'] ?? '',
      [`migrations/snapshots/${aliased}/contract.json`]:
        before[`migrations/snapshots/${aliased}/contract.json`] ?? '',
      [`migrations/snapshots/${aliased}/contract.d.ts`]:
        before[`migrations/snapshots/${aliased}/contract.d.ts`] ?? '',
      [`migrations/snapshots/${renamed.hash}/contract.json`]: renamed.files['contract.json'] ?? '',
      [`migrations/snapshots/${renamed.hash}/contract.d.ts`]: handFormatted,
      ...migrationPackage('20260101T0000_initial', null, aliased, '2026-01-01T00:00:00.000Z'),
      ...migrationPackage('20260115T0000_rename_alias', aliased, renamed.hash, createdAt, BACKFILL),
    };
    const run = runIn(tree);
    const upgraded = formatted(readTree(run.root));
    const migrationTs = `${rename}/migration.ts`;
    const inlineDts = after[`migrations/snapshots/${inline}/contract.d.ts`] ?? '';
    const writtenFirst = aliased < renamed.hash ? inlineDts : `${HAND_FORMATTED}${inlineDts}`;
    expect({
      status: run.status,
      stdout: run.stdout,
      stderr: run.stderr,
      tree: { ...upgraded, [migrationTs]: undefined },
      migrationTs: [aliased, renamed.hash].some((hash) => upgraded[migrationTs]?.includes(hash)),
      checked: await checked(run.root),
    }).toEqual({
      status: 0,
      stdout: [
        'Rewrote 6 files and renamed 2 snapshot directories. Storage hashes changed (old -> new):',
        ...[aliased, renamed.hash].sort().map((hash) => `  ${hash} -> ${inline}`),
        'Removed storage.types entries:',
        `  migrations/snapshots/${inline}/contract.json: Code, Embedding, Handle, Slug`,
        '  prisma/contract.json: Code, Embedding, Handle',
        '',
      ].join('\n'),
      stderr: '',
      tree: {
        'prisma/contract.json': after[`migrations/snapshots/${inline}/contract.json`],
        'prisma/contract.d.ts': inlineDts,
        [`migrations/snapshots/${inline}/contract.json`]:
          after[`migrations/snapshots/${inline}/contract.json`],
        [`migrations/snapshots/${inline}/contract.d.ts`]: writtenFirst,
        ...migrationPackage('20260101T0000_initial', null, inline, '2026-01-01T00:00:00.000Z'),
        ...migrationPackage('20260115T0000_rename_alias', inline, inline, createdAt, BACKFILL),
        [migrationTs]: undefined,
      },
      migrationTs: false,
      checked: { violations: [], path: ['20260101T0000_initial'] },
    });
  });
});
