import { EMPTY_CONTRACT_HASH } from '@internal/migration-tools/constants';
import { describe, expect, it } from 'vitest';
import {
  buildEdgeAnnotationsByHashFromListEntries,
  buildRefsByHashFromListEntries,
  IDENTITY_MIGRATION_LIST_STYLER,
  migrationGraphFromListEntries,
  renderMigrationList,
  renderMigrationListWithStyle,
} from '../../../src/utils/formatters/migration-list-render';
import type {
  MigrationListEntry,
  MigrationListResult,
  MigrationSpaceListEntry,
} from '../../../src/utils/formatters/migration-list-types';

const HASH_A = 'abcdef0123456789abcdef0123456789abcdef0123456789ab';
const HASH_B = '1234567890abcdef1234567890abcdef1234567890abcdef12';
const HASH_C = '4cb4256c30b7a8123456789012345678901234567890123456';
const HASH_D = '55bada2f123456789012345678901234567890123456789012';
const HASH_E = '2f45cc7123456789012345678901234567890123456789012';
const HASH_F = '804e0181234567890123456789012345678901234567890123';

let migrationHashSeq = 0;

function migration(
  overrides: Pick<MigrationListEntry, 'name' | 'toContract'> &
    Partial<Omit<MigrationListEntry, 'name' | 'toContract'>>,
): MigrationListEntry {
  return {
    hash: overrides.hash ?? `list-mig-${migrationHashSeq++}`,
    fromContract: null,
    operationCount: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    refs: [],
    providedInvariants: [],
    ...overrides,
  };
}

function result(spaces: readonly MigrationSpaceListEntry[], summary: string): MigrationListResult {
  return { ok: true, spaces: [...spaces], summary };
}

function renderListed(listResult: MigrationListResult): string {
  return renderMigrationList(listResult);
}

describe('migrationGraphFromListEntries', () => {
  it('builds a graph edge per list entry', () => {
    const entries = [
      migration({ name: 'init', fromContract: null, toContract: HASH_A }),
      migration({ name: 'next', fromContract: HASH_A, toContract: HASH_B }),
    ];
    const graph = migrationGraphFromListEntries(entries);
    expect(graph.migrationByHash.size).toBe(2);
    expect(graph.forwardChain.get(EMPTY_CONTRACT_HASH)?.[0]?.dirName).toBe('init');
  });

  it('maps edge annotations and refs from list entries', () => {
    const entries = [
      migration({
        name: 'backfill',
        fromContract: HASH_D,
        toContract: HASH_D,
        operationCount: 3,
        providedInvariants: ['inv_a'],
        refs: ['production'],
      }),
    ];
    const annotations = buildEdgeAnnotationsByHashFromListEntries(entries);
    expect(annotations.get(entries[0]!.hash)).toEqual({
      operationCount: 3,
      invariants: ['inv_a'],
    });
    expect(buildRefsByHashFromListEntries(entries).get(HASH_D)).toEqual(['production']);
  });
});

describe('renderMigrationList', () => {
  it('uses ASCII tree glyphs when glyph mode is ascii', () => {
    const eUsers = migration({
      name: '20250115_add_users',
      fromContract: null,
      toContract: HASH_A,
    });
    const ePosts = migration({
      name: '20250203_add_posts',
      fromContract: HASH_A,
      toContract: HASH_B,
    });
    const eComments = migration({
      name: '20250310_add_comments',
      fromContract: HASH_B,
      toContract: HASH_C,
    });
    const eRollback = migration({
      name: '20250312_full_rollback',
      fromContract: HASH_C,
      toContract: HASH_A,
      hash: 'rollback-edge',
    });
    const output = renderMigrationListWithStyle(
      result(
        [
          {
            space: 'app',
            migrations: [eRollback, eComments, ePosts, eUsers],
          },
        ],
        '4 migration(s) on disk',
      ),
      IDENTITY_MIGRATION_LIST_STYLER,
      'ascii',
    );
    expect(output).toContain('20250312_full_rollback');
    expect(output).toContain('->');
    expect(output).toContain('|v');
    expect(output).not.toContain('→');
    expect(output).not.toContain('↩');
  });

  it('renders a linear chain as a tree with operation counts', () => {
    const output = renderListed(
      result(
        [
          {
            space: 'app',
            migrations: [
              migration({
                name: '20260422T0720_initial',
                fromContract: null,
                toContract: HASH_C,
              }),
            ],
          },
        ],
        '1 migration(s) on disk',
      ),
    );
    expect(output).toMatchInlineSnapshot(`
      "○   4cb4256
      │↑  20260422T0720_initial        ∅ → 4cb4256  1 ops
      ○   ∅

      1 migration(s) on disk"
    `);
  });

  it('renders refs on destination contract nodes', () => {
    const output = renderListed(
      result(
        [
          {
            space: 'app',
            migrations: [
              migration({
                name: '20260422T0742_migration',
                fromContract: HASH_A,
                toContract: HASH_B,
                refs: ['production'],
              }),
            ],
          },
        ],
        '1 migration(s) on disk',
      ),
    );
    expect(output).toContain('(production)');
    expect(output).toContain('20260422T0742_migration');
    expect(output).toContain('1 ops');
  });

  it('renders invariants and operation count on edge rows', () => {
    const output = renderListed(
      result(
        [
          {
            space: 'app',
            migrations: [
              migration({
                name: '20260601T1200_backfill',
                fromContract: HASH_D,
                toContract: HASH_D,
                operationCount: 2,
                providedInvariants: ['a', 'b'],
              }),
            ],
          },
        ],
        '1 migration(s) on disk',
      ),
    );
    expect(output).toContain('2 ops');
    expect(output).toContain('{a, b}');
    expect(output).toContain('│⟲');
  });

  it('renders branching topology as a diamond', () => {
    const output = renderListed(
      result(
        [
          {
            space: 'app',
            migrations: [
              migration({ name: 'init', fromContract: null, toContract: HASH_A }),
              migration({ name: 'branch_a', fromContract: HASH_A, toContract: HASH_B }),
              migration({ name: 'branch_b', fromContract: HASH_A, toContract: HASH_C }),
            ],
          },
        ],
        '3 migration(s) on disk',
      ),
    );
    expect(output).toContain('branch_a');
    expect(output).toContain('branch_b');
    // Corner renderer: the merge/fork connector is a continuous trunk + a yielding
    // corner (│─╮ / │─╯), never a tee (├─). No ├ ┬ ┴ ┼ in the corner alphabet.
    expect(output).toMatch(/[│─]─[╮╯]/);
    expect(output).not.toMatch(/[├┬┴┼]/u);
  });

  it('renders skip-rollback with a down arrow in the tree gutter', () => {
    const output = renderListed(
      result(
        [
          {
            space: 'app',
            migrations: [
              migration({ name: 'chain_a', fromContract: null, toContract: HASH_A }),
              migration({ name: 'chain_b', fromContract: HASH_A, toContract: HASH_B }),
              migration({ name: 'chain_c', fromContract: HASH_B, toContract: HASH_C }),
              migration({
                name: 'skip_back',
                fromContract: HASH_C,
                toContract: HASH_A,
                hash: 'skip-back',
              }),
            ],
          },
        ],
        '4 migration(s) on disk',
      ),
    );
    expect(output).toContain('skip_back');
    expect(output).toContain('│↓');
  });

  it('renders multi-space output with headings and tree indent', () => {
    const output = renderListed(
      result(
        [
          {
            space: 'app',
            migrations: [
              migration({
                name: '20260518T1701_namespaces_bookend',
                fromContract: HASH_D,
                toContract: HASH_F,
                refs: ['db'],
              }),
              migration({
                name: '20260422T0720_initial',
                fromContract: null,
                toContract: HASH_D,
              }),
            ],
          },
          {
            space: 'postgis',
            migrations: [
              migration({
                name: '20260601T0000_install_postgis_extension',
                fromContract: null,
                toContract: '9aabbcc123456789012345678901234567890123456789012',
              }),
            ],
          },
        ],
        '3 migration(s) across 2 contract space(s)',
      ),
    );
    expect(output).toContain('app:');
    expect(output).toContain('postgis:');
    expect(output).toContain('(db)');
    expect(output).toContain('20260518T1701_namespaces_bookend');
    expect(output).toContain('20260601T0000_install_postgis_extension');
  });

  it('suppresses heading for one-space output', () => {
    const output = renderListed(
      result(
        [
          {
            space: 'app',
            migrations: [
              migration({
                name: '20260422T0742_migration',
                fromContract: HASH_A,
                toContract: HASH_B,
                refs: ['production'],
              }),
            ],
          },
        ],
        '1 migration(s) on disk',
      ),
    );
    expect(output).not.toContain('app:');
    expect(output).toContain('(production)');
  });

  it('renders empty state for single space', () => {
    const output = renderListed(
      result([{ space: 'app', migrations: [] }], '0 migration(s) on disk'),
    );
    expect(output).toMatchInlineSnapshot(`"There are no migrations in migrations/app/ yet"`);
  });

  it('renders the slice-spec worked example as a package-annotated tree', () => {
    const output = renderListed(
      result(
        [
          {
            space: 'app',
            migrations: [
              migration({
                name: '20260601T1200_backfill_emails',
                fromContract: HASH_D,
                toContract: HASH_D,
                providedInvariants: ['backfill_emails_v1'],
                refs: ['production'],
              }),
              migration({
                name: '20260518T1701_namespaces_bookend',
                fromContract: HASH_E,
                toContract: HASH_F,
                refs: ['db'],
              }),
              migration({
                name: '20260422T0748_migration',
                fromContract: HASH_D,
                toContract: HASH_E,
                refs: ['staging'],
              }),
              migration({
                name: '20260422T0742_migration',
                fromContract: HASH_C,
                toContract: HASH_D,
                refs: ['production'],
              }),
              migration({
                name: '20260422T0720_initial',
                fromContract: null,
                toContract: HASH_C,
              }),
            ],
          },
        ],
        '5 migration(s) on disk',
      ),
    );
    expect(output).toContain('20260601T1200_backfill_emails');
    expect(output).toContain('{backfill_emails_v1}');
    expect(output).toContain('(db)');
    expect(output).toContain('(staging)');
    expect(output).toContain('(production)');
    expect(output).toContain('1 ops');
    expect(output.trim().endsWith('5 migration(s) on disk')).toBe(true);
  });

  it('renders empty state for multiple spaces with per-space headings', () => {
    const output = renderListed(
      result(
        [
          { space: 'app', migrations: [] },
          { space: 'postgis', migrations: [] },
        ],
        '0 migration(s) across 2 contract space(s)',
      ),
    );
    expect(output).toMatchInlineSnapshot(`
      "app:
        There are no migrations in migrations/app/ yet

      postgis:
        There are no migrations in migrations/postgis/ yet"
    `);
  });

  it('with appSpaceId: @contract appears only under app:, not under extension spaces', () => {
    // Topology: app chain ∅→HASH_A→HASH_B (liveContractHash = HASH_B = @contract node)
    //           pgvector chain ∅→HASH_C
    // With appSpaceId='app', @contract must appear in app section only.
    const appInit = migration({ name: 'app_init', fromContract: null, toContract: HASH_A });
    const appNext = migration({ name: 'app_next', fromContract: HASH_A, toContract: HASH_B });
    const pgvectorInit = migration({
      name: 'pgvector_init',
      fromContract: null,
      toContract: HASH_C,
    });
    const listResult = result(
      [
        { space: 'app', migrations: [appInit, appNext] },
        { space: 'pgvector', migrations: [pgvectorInit] },
      ],
      '3 migration(s) across 2 contract space(s)',
    );

    const output = renderMigrationListWithStyle(
      listResult,
      IDENTITY_MIGRATION_LIST_STYLER,
      'unicode',
      {
        liveContractHash: HASH_B,
        appSpaceId: 'app',
      },
    );

    const appSection = output.split('pgvector:')[0] ?? '';
    const pgvectorSection = output.split('pgvector:')[1] ?? '';

    // @contract must appear in the app section (HASH_B is the liveContractHash and matches app)
    expect(appSection).toContain('@contract');
    // @contract must NOT appear in the pgvector extension section
    expect(pgvectorSection).not.toContain('@contract');
  });
});
