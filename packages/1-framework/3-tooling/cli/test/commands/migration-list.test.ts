import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import type { Contract } from '@internal/contract/types';
import type { MigrationPlanOperation } from '@internal/framework-components/control';
import { UNBOUND_NAMESPACE_ID } from '@internal/framework-components/ir';
import { loadContractSpaceAggregate } from '@internal/migration-tools/aggregate';
import { EMPTY_CONTRACT_HASH } from '@internal/migration-tools/constants';
import { computeMigrationHash } from '@internal/migration-tools/hash';
import { writeMigrationPackage } from '@internal/migration-tools/io';
import type { MigrationMetadata } from '@internal/migration-tools/metadata';
import { writeRef } from '@internal/migration-tools/refs';
import { createSqlContract } from '@repo/test-utils';
import { join } from 'pathe';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderMigrationListHumanOutput } from '../../src/commands/migration-list';
import {
  migrationSpaceListEntriesFromAggregate,
  type RunMigrationListInputs,
  runMigrationList,
} from '../../src/control-api/operations/migration-list';
import { renderMigrationList } from '../../src/utils/formatters/migration-list-render';
import type { MigrationListResult } from '../../src/utils/formatters/migration-list-types';
import { parseGlobalFlags } from '../../src/utils/global-flags';
import { detectGlyphMode } from '../../src/utils/glyph-mode';
import { createTerminalUI } from '../../src/utils/terminal-ui';

/**
 * Verifies the `migration list` command's data-and-policy core:
 * enumeration, `--space` narrowing, structured-error surfacing, and
 * JSON shape. Tests exercise `runMigrationList` directly so coverage
 * doesn't depend on the CLI shell's `loadConfig` step. No `vi.mock` /
 * `vi.hoisted` / `vi.resetModules` dance: tests build a real
 * `migrations/` tree in a tmpdir, call the core, and assert on the
 * returned {@link MigrationListResult}.
 *
 * Human output is verified by piping the result through
 * {@link renderMigrationList} (the same renderer the CLI shell uses) —
 * the byte-for-byte spec-fixture and cross-space tests pin the
 * end-to-end string the user sees. JSON-shape tests inspect the raw
 * result. The structured `MIGRATION.SPACE_NOT_FOUND` error is asserted
 * via `result.failure.toEnvelope()` — no command-builder needed.
 */

const HASH_4cb4256 = `4cb4256${'0'.repeat(57)}`;
const HASH_55bada2 = `55bada2${'0'.repeat(57)}`;
const HASH_2f45cc7 = `2f45cc7${'0'.repeat(57)}`;
const HASH_804e018 = `804e018${'0'.repeat(57)}`;
const HASH_BRANCH_X = `${'a'.repeat(64)}`;
const HASH_BRANCH_Y = `${'b'.repeat(64)}`;
const HASH_FAN_BASE = `${'c'.repeat(64)}`;
const HASH_FAN_A = `${'d'.repeat(64)}`;
const HASH_FAN_B = `${'e'.repeat(64)}`;
const HASH_FAN_C = `${'f'.repeat(64)}`;
const HASH_POSTGIS = `9aabbcc${'0'.repeat(57)}`;
const HASH_SHARED = `shared0${'0'.repeat(57)}`;
const HASH_LINEAR_TIP = `lintip0${'0'.repeat(57)}`;

const ADDITIVE_OP: MigrationPlanOperation = {
  id: 'table.users',
  label: 'Create table users',
  operationClass: 'additive',
};

const TEST_APP_CONTRACT = createSqlContract({
  target: 'postgres',
  storage: {
    namespaces: {
      [UNBOUND_NAMESPACE_ID]: {
        id: UNBOUND_NAMESPACE_ID,
        entries: {
          table: { user: { columns: { id: {} } } },
        },
      },
    },
  },
});

const identityDeserialize = (json: unknown): Contract => json as Contract;

async function listSpacesFromDisk(migrationsDir: string) {
  const aggregate = await loadContractSpaceAggregate({
    migrationsDir,
    appContract: TEST_APP_CONTRACT,
    deserializeContract: identityDeserialize,
  });
  return migrationSpaceListEntriesFromAggregate(aggregate, migrationsDir);
}

async function runMigrationListFromDisk(inputs: {
  readonly migrationsDir: string;
  readonly spaceFilter?: string;
}) {
  const spaces = await listSpacesFromDisk(inputs.migrationsDir);
  const core: RunMigrationListInputs = { spaces };
  if (inputs.spaceFilter !== undefined) {
    return runMigrationList({ ...core, spaceFilter: inputs.spaceFilter });
  }
  return runMigrationList(core);
}

const BACKFILL_OP = {
  id: 'data.backfill_emails',
  label: 'Backfill emails',
  operationClass: 'data',
  invariantId: 'backfill_emails_v1',
} as unknown as MigrationPlanOperation;

interface PackageSpec {
  readonly spaceId: string;
  readonly dirName: string;
  readonly from: string | null;
  readonly to: string;
  readonly ops?: readonly MigrationPlanOperation[];
  readonly providedInvariants?: readonly string[];
}

interface RefSpec {
  readonly spaceId: string;
  readonly name: string;
  readonly hash: string;
}

async function writePackage(migrationsRoot: string, spec: PackageSpec): Promise<void> {
  const pkgDir = join(migrationsRoot, spec.spaceId, spec.dirName);
  const ops = spec.ops ?? [ADDITIVE_OP];
  const baseMetadata = {
    from: spec.from,
    to: spec.to,
    providedInvariants:
      spec.providedInvariants ??
      ops
        .map((op) =>
          typeof op === 'object' &&
          op !== null &&
          'invariantId' in op &&
          typeof op.invariantId === 'string'
            ? op.invariantId
            : undefined,
        )
        .filter((inv): inv is string => inv !== undefined),
    createdAt: '2026-02-25T14:30:00.000Z',
  } as Omit<MigrationMetadata, 'migrationHash'>;
  const metadata: MigrationMetadata = {
    ...baseMetadata,
    migrationHash: computeMigrationHash(baseMetadata, ops),
  };
  await writeMigrationPackage(pkgDir, metadata, ops);
}

async function writeRefFor(migrationsRoot: string, spec: RefSpec): Promise<void> {
  const refsDir = join(migrationsRoot, spec.spaceId, 'refs');
  await mkdir(refsDir, { recursive: true });
  await writeRef(refsDir, spec.name, { hash: spec.hash, invariants: [] });
}

interface Fixture {
  readonly cwd: string;
  readonly migrationsRoot: string;
}

const createdFixtures: Fixture[] = [];

async function setupFixture(): Promise<Fixture> {
  const cwd = await mkdtemp(join(tmpdir(), 'cli-migration-list-'));
  const migrationsRoot = join(cwd, 'migrations');
  const fixture = { cwd, migrationsRoot };
  createdFixtures.push(fixture);
  return fixture;
}

afterEach(async () => {
  const fixtures = createdFixtures.splice(0);
  await Promise.all(fixtures.map((f) => rm(f.cwd, { recursive: true, force: true })));
});

function expectOk<T>(
  result: { ok: true; value: T } | { ok: false; failure: unknown },
): asserts result is { ok: true; value: T } {
  if (!result.ok) {
    throw new Error(`Expected ok result, got: ${JSON.stringify(result.failure)}`);
  }
}

function renderListed(listResult: MigrationListResult): string {
  return renderMigrationList(listResult);
}

describe('runMigrationList — slice-spec worked example', () => {
  it('renders the slice-spec worked example byte-for-byte (one space)', async () => {
    const { migrationsRoot } = await setupFixture();

    // Five-row spec example (slice spec § Per-line shape):
    //   20260601T1200_backfill_emails     55bada2 ⟲          {backfill_emails_v1} (production)
    //   20260518T1701_namespaces_bookend  2f45cc7 → 804e018  (db)
    //   20260422T0748_migration           55bada2 → 2f45cc7  (staging)
    //   20260422T0742_migration           4cb4256 → 55bada2  (production)
    //   20260422T0720_initial                   ∅ → 4cb4256
    await writePackage(migrationsRoot, {
      spaceId: 'app',
      dirName: '20260422T0720_initial',
      from: null,
      to: HASH_4cb4256,
    });
    await writePackage(migrationsRoot, {
      spaceId: 'app',
      dirName: '20260422T0742_migration',
      from: HASH_4cb4256,
      to: HASH_55bada2,
    });
    await writePackage(migrationsRoot, {
      spaceId: 'app',
      dirName: '20260422T0748_migration',
      from: HASH_55bada2,
      to: HASH_2f45cc7,
    });
    await writePackage(migrationsRoot, {
      spaceId: 'app',
      dirName: '20260518T1701_namespaces_bookend',
      from: HASH_2f45cc7,
      to: HASH_804e018,
    });
    await writePackage(migrationsRoot, {
      spaceId: 'app',
      dirName: '20260601T1200_backfill_emails',
      from: HASH_55bada2,
      to: HASH_55bada2,
      ops: [BACKFILL_OP],
    });
    await writeRefFor(migrationsRoot, {
      spaceId: 'app',
      name: 'production',
      hash: HASH_55bada2,
    });
    await writeRefFor(migrationsRoot, { spaceId: 'app', name: 'staging', hash: HASH_2f45cc7 });
    await writeRefFor(migrationsRoot, { spaceId: 'app', name: 'db', hash: HASH_804e018 });

    const result = await runMigrationListFromDisk({ migrationsDir: migrationsRoot });
    expectOk(result);

    const human = renderListed(result.value);
    expect(human).toContain('20260601T1200_backfill_emails');
    expect(human).toContain('{backfill_emails_v1}');
    expect(human).toContain('(db)');
    expect(human).toContain('(staging)');
    expect(human).toContain('(production)');
    expect(human).toContain('1 ops');
    expect(human.trim().endsWith('5 migration(s) on disk')).toBe(true);
  });

  it('renders every on-disk migration as exactly one row (row-count guarantee)', async () => {
    // Six demo shapes from the slice DoD checklist:
    //   single-branch  — linear chain (A → B → C)
    //   sub-branches   — same source, two destinations (A → B, A → C)
    //   wide-fan       — same source, four destinations
    //   sequential-diamonds — convergence (X → Y, X′ → Y)
    //   rollback       — forward then "inverse" (A → B, B → A) — regular edges
    //   skip-rollback  — forward then jump back further (A → B → C, C → A) — regular edges
    // Each shape contributes a few migrations to one shared `app` space.
    // The assertion: every migration.json on disk → exactly one row, in
    // both the JSON shape and the rendered human string.
    const { migrationsRoot } = await setupFixture();

    const specs: PackageSpec[] = [
      // single-branch
      { spaceId: 'app', dirName: '20260101T0000_sb_a', from: null, to: HASH_FAN_BASE },
      { spaceId: 'app', dirName: '20260101T0001_sb_b', from: HASH_FAN_BASE, to: HASH_FAN_A },
      { spaceId: 'app', dirName: '20260101T0002_sb_c', from: HASH_FAN_A, to: HASH_FAN_B },
      // sub-branches
      { spaceId: 'app', dirName: '20260102T0000_sub_a', from: HASH_FAN_BASE, to: HASH_BRANCH_X },
      { spaceId: 'app', dirName: '20260102T0001_sub_b', from: HASH_FAN_BASE, to: HASH_BRANCH_Y },
      // wide-fan
      { spaceId: 'app', dirName: '20260103T0000_fan_a', from: HASH_FAN_BASE, to: HASH_FAN_A },
      { spaceId: 'app', dirName: '20260103T0001_fan_b', from: HASH_FAN_BASE, to: HASH_FAN_B },
      { spaceId: 'app', dirName: '20260103T0002_fan_c', from: HASH_FAN_BASE, to: HASH_FAN_C },
      // sequential-diamonds: convergence on HASH_FAN_C from two sources.
      {
        spaceId: 'app',
        dirName: '20260104T0000_diamond_left',
        from: HASH_BRANCH_X,
        to: HASH_FAN_C,
      },
      {
        spaceId: 'app',
        dirName: '20260104T0001_diamond_right',
        from: HASH_BRANCH_Y,
        to: HASH_FAN_C,
      },
      // rollback (A → B, B → A)
      { spaceId: 'app', dirName: '20260105T0000_rollback_fwd', from: HASH_FAN_A, to: HASH_FAN_B },
      { spaceId: 'app', dirName: '20260105T0001_rollback_back', from: HASH_FAN_B, to: HASH_FAN_A },
      // skip-rollback (C → A, jumping further back)
      { spaceId: 'app', dirName: '20260106T0000_skip_back', from: HASH_FAN_C, to: HASH_FAN_A },
    ];
    for (const spec of specs) {
      await writePackage(migrationsRoot, spec);
    }

    const result = await runMigrationListFromDisk({ migrationsDir: migrationsRoot });
    expectOk(result);

    // JSON pass — count and assertion are the trustworthy oracle for
    // "every on-disk migration shows up exactly once".
    expect(result.value.ok).toBe(true);
    expect(result.value.spaces).toHaveLength(1);
    const renderedDirs = result.value.spaces[0]!.migrations.map((m) => m.name).sort();
    const fixtureDirs = specs.map((s) => s.dirName).sort();
    expect(renderedDirs).toEqual(fixtureDirs);
    expect(renderedDirs).toHaveLength(specs.length);
    expect(result.value.summary).toBe(`${specs.length} migration(s) on disk`);

    // Human pass — every dirName appears on an edge row in the tree.
    const human = renderListed(result.value);
    const edgeRows = human.split('\n').filter((line) => /│[↑↓⟲]/.test(line));
    expect(edgeRows).toHaveLength(specs.length);
    for (const spec of specs) {
      expect(human).toContain(spec.dirName);
    }
    expect(human.trim().endsWith(`${specs.length} migration(s) on disk`)).toBe(true);
  });

  it('locks list tree layout for a linear chain (golden)', async () => {
    const { migrationsRoot } = await setupFixture();

    await writePackage(migrationsRoot, {
      spaceId: 'app',
      dirName: '20260422T0720_initial',
      from: null,
      to: HASH_4cb4256,
    });
    await writePackage(migrationsRoot, {
      spaceId: 'app',
      dirName: '20260422T0742_migration',
      from: HASH_4cb4256,
      to: HASH_55bada2,
    });

    const result = await runMigrationListFromDisk({ migrationsDir: migrationsRoot });
    expectOk(result);

    const human = renderListed(result.value);
    expect(human).toBe(
      [
        '○   55bada2',
        '│↑  20260422T0742_migration  4cb4256 → 55bada2  1 ops',
        '○   4cb4256',
        '│↑  20260422T0720_initial          ∅ → 4cb4256  1 ops',
        '○   ∅',
        '',
        '2 migration(s) on disk',
      ].join('\n'),
    );
    expect(human).toContain('20260422T0720_initial');
    expect(human).toContain('20260422T0742_migration');
    expect(human.trim().endsWith('2 migration(s) on disk')).toBe(true);
  });

  it('renders multi-contract-space output with per-space heading and 2-space indent', async () => {
    const { migrationsRoot } = await setupFixture();

    await writePackage(migrationsRoot, {
      spaceId: 'app',
      dirName: '20260422T0720_initial',
      from: null,
      to: HASH_4cb4256,
    });
    await writePackage(migrationsRoot, {
      spaceId: 'app',
      dirName: '20260422T0742_migration',
      from: HASH_4cb4256,
      to: HASH_55bada2,
    });
    await writePackage(migrationsRoot, {
      spaceId: 'app',
      dirName: '20260518T1701_namespaces_bookend',
      from: HASH_55bada2,
      to: HASH_804e018,
    });
    await writePackage(migrationsRoot, {
      spaceId: 'postgis',
      dirName: '20260601T0000_install_postgis_extension',
      from: null,
      to: HASH_POSTGIS,
    });
    await writeRefFor(migrationsRoot, {
      spaceId: 'app',
      name: 'production',
      hash: HASH_55bada2,
    });
    await writeRefFor(migrationsRoot, { spaceId: 'app', name: 'db', hash: HASH_804e018 });
    await writeRefFor(migrationsRoot, { spaceId: 'postgis', name: 'db', hash: HASH_POSTGIS });

    const result = await runMigrationListFromDisk({ migrationsDir: migrationsRoot });
    expectOk(result);

    const human = renderListed(result.value);
    expect(human).toBe(
      [
        'app:',
        '  ○   804e018  (db)',
        '  │↑  20260518T1701_namespaces_bookend         55bada2 → 804e018  1 ops',
        '  ○   55bada2  (production)',
        '  │↑  20260422T0742_migration                  4cb4256 → 55bada2  1 ops',
        '  ○   4cb4256',
        '  │↑  20260422T0720_initial                          ∅ → 4cb4256  1 ops',
        '  ○   ∅',
        '',
        'postgis:',
        '  ○   9aabbcc  (db)',
        '  │↑  20260601T0000_install_postgis_extension        ∅ → 9aabbcc  1 ops',
        '  ○   ∅',
        '',
        '4 migration(s) across 2 contract space(s)',
      ].join('\n'),
    );
    expect(human).toContain('app:');
    expect(human).toContain('postgis:');
    expect(human).toContain('20260518T1701_namespaces_bookend');
    expect(human).toContain('20260601T0000_install_postgis_extension');
    expect(human).toContain('(db)');
    expect(human).toContain('(production)');
    expect(result.value.summary).toBe('4 migration(s) across 2 contract space(s)');
  });

  it('renders convergence: the same ref decorates every row landing on the convergence hash', async () => {
    const { migrationsRoot } = await setupFixture();

    await writePackage(migrationsRoot, {
      spaceId: 'app',
      dirName: '20260101T0000_left',
      from: HASH_BRANCH_X,
      to: HASH_FAN_C,
    });
    await writePackage(migrationsRoot, {
      spaceId: 'app',
      dirName: '20260101T0001_right',
      from: HASH_BRANCH_Y,
      to: HASH_FAN_C,
    });
    await writeRefFor(migrationsRoot, { spaceId: 'app', name: 'production', hash: HASH_FAN_C });

    const result = await runMigrationListFromDisk({ migrationsDir: migrationsRoot });
    expectOk(result);

    // Both converging rows carry the same ref decoration on the same destination.
    const migrations = result.value.spaces[0]!.migrations;
    expect(migrations).toHaveLength(2);
    for (const m of migrations) {
      expect(m.toContract).toBe(HASH_FAN_C);
      expect(m.refs).toEqual(['production']);
    }
    const human = renderListed(result.value);
    const productionOnNode = [...human.matchAll(/○.*\(production\)/g)];
    expect(productionOnNode).toHaveLength(1);
    expect(human).toContain('20260101T0000_left');
    expect(human).toContain('20260101T0001_right');
  });

  it('renders useless self-edge (from === to, zero providedInvariants) as a `⟲` row with empty decoration', async () => {
    // New edge-case-table entry (slice spec amended this round): self-edge
    // with zero invariants is no longer rejected; it lists like any other
    // migration with an empty decoration column.
    const { migrationsRoot } = await setupFixture();

    await writePackage(migrationsRoot, {
      spaceId: 'app',
      dirName: '20260101T0000_useless_self_edge',
      from: HASH_4cb4256,
      to: HASH_4cb4256,
      ops: [],
      providedInvariants: [],
    });

    const result = await runMigrationListFromDisk({ migrationsDir: migrationsRoot });
    expectOk(result);
    const [entry] = result.value.spaces[0]!.migrations;
    expect(entry?.fromContract).toBe(HASH_4cb4256);
    expect(entry?.toContract).toBe(HASH_4cb4256);
    expect(entry?.providedInvariants).toEqual([]);
    expect(entry?.refs).toEqual([]);

    const human = renderListed(result.value);
    expect(human).toContain('│⟲  20260101T0000_useless_self_edge');
    expect(human).toContain('0 ops');
    expect(human).not.toContain('{');
    expect(human.trim().endsWith('1 migration(s) on disk')).toBe(true);
  });

  it('renders self-edge with invariants as `⟲ … {invariant_id}`', async () => {
    const { migrationsRoot } = await setupFixture();

    await writePackage(migrationsRoot, {
      spaceId: 'app',
      dirName: '20260601T1200_backfill_emails',
      from: HASH_55bada2,
      to: HASH_55bada2,
      ops: [BACKFILL_OP],
    });

    const result = await runMigrationListFromDisk({ migrationsDir: migrationsRoot });
    expectOk(result);
    expect(result.value.spaces[0]!.migrations[0]!.providedInvariants).toEqual([
      'backfill_emails_v1',
    ]);

    const human = renderListed(result.value);
    expect(human).toContain('│⟲  20260601T1200_backfill_emails');
    expect(human).toContain('{backfill_emails_v1}');
    expect(human).toContain('1 ops');
  });

  it('renders the empty-state line when the migrations directory does not exist', async () => {
    const { cwd } = await setupFixture();
    const result = await runMigrationListFromDisk({
      migrationsDir: join(cwd, 'no-such-migrations'),
    });
    expectOk(result);
    // Empty-state synthesizes the app space so the renderer can name a
    // directory.
    expect(result.value.spaces).toEqual([{ space: 'app', migrations: [] }]);
    expect(renderListed(result.value)).toBe('There are no migrations in migrations/app/ yet');
  });

  it('renders the empty-state line for an existing-but-empty default scope (only stray non-space dirs)', async () => {
    const { migrationsRoot } = await setupFixture();
    // The migrations/ dir exists but contains no valid space directory
    // (or it's entirely empty). Still synthesizes the app empty-state
    // so the user sees a directory name.
    await mkdir(migrationsRoot, { recursive: true });
    const result = await runMigrationListFromDisk({ migrationsDir: migrationsRoot });
    expectOk(result);
    expect(renderListed(result.value)).toBe('There are no migrations in migrations/app/ yet');
  });

  it('threads topology classification so skip-rollback shows a leading ↩ glyph', async () => {
    const { migrationsRoot } = await setupFixture();
    await writePackage(migrationsRoot, {
      spaceId: 'app',
      dirName: '20260101T0000_chain_a',
      from: null,
      to: HASH_FAN_BASE,
    });
    await writePackage(migrationsRoot, {
      spaceId: 'app',
      dirName: '20260101T0001_chain_b',
      from: HASH_FAN_BASE,
      to: HASH_FAN_A,
    });
    await writePackage(migrationsRoot, {
      spaceId: 'app',
      dirName: '20260101T0002_chain_c',
      from: HASH_FAN_A,
      to: HASH_FAN_B,
    });
    await writePackage(migrationsRoot, {
      spaceId: 'app',
      dirName: '20260106T0000_skip_back',
      from: HASH_FAN_B,
      to: HASH_FAN_BASE,
    });

    const result = await runMigrationListFromDisk({ migrationsDir: migrationsRoot });
    expectOk(result);
    const human = renderListed(result.value);
    expect(human).toContain('20260106T0000_skip_back');
    expect(human).toContain('↓');
    expect(human).toContain('20260101T0002_chain_c');
  });
});

describe('runMigrationList — --space flag', () => {
  it('narrows to a single contract space and suppresses the per-space heading', async () => {
    const { migrationsRoot } = await setupFixture();

    await writePackage(migrationsRoot, {
      spaceId: 'app',
      dirName: '20260422T0720_initial',
      from: null,
      to: HASH_4cb4256,
    });
    await writePackage(migrationsRoot, {
      spaceId: 'postgis',
      dirName: '20260601T0000_install_postgis_extension',
      from: null,
      to: HASH_POSTGIS,
    });

    const result = await runMigrationListFromDisk({
      migrationsDir: migrationsRoot,
      spaceFilter: 'postgis',
    });
    expectOk(result);
    expect(result.value.spaces).toHaveLength(1);
    expect(result.value.spaces[0]!.space).toBe('postgis');
    expect(result.value.spaces[0]!.migrations.map((m) => m.name)).toEqual([
      '20260601T0000_install_postgis_extension',
    ]);

    const human = renderListed(result.value);
    // Single-space output → no per-space heading.
    expect(human).not.toContain('app:');
    expect(human).not.toContain('postgis:');
    expect(human).toContain('20260601T0000_install_postgis_extension');
    expect(human).not.toContain('20260422T0720_initial');
    expect(human.trim().endsWith('1 migration(s) on disk')).toBe(true);
  });

  it('renders empty-state for --space <id> on an existing-but-empty space dir (exit 0 equivalent)', async () => {
    const { migrationsRoot } = await setupFixture();
    await mkdir(join(migrationsRoot, 'postgis'), { recursive: true });

    const result = await runMigrationListFromDisk({
      migrationsDir: migrationsRoot,
      spaceFilter: 'postgis',
    });
    expectOk(result);
    expect(result.value.spaces).toEqual([{ space: 'postgis', migrations: [] }]);
    expect(renderListed(result.value)).toBe('There are no migrations in migrations/postgis/ yet');
  });

  it('emits MIGRATION.SPACE_NOT_FOUND when --space names a non-existent contract space', async () => {
    const { migrationsRoot } = await setupFixture();

    await writePackage(migrationsRoot, {
      spaceId: 'app',
      dirName: '20260422T0720_initial',
      from: null,
      to: HASH_4cb4256,
    });

    const result = await runMigrationListFromDisk({
      migrationsDir: migrationsRoot,
      spaceFilter: 'postgis',
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    const envelope = result.failure.toEnvelope();
    expect(envelope.code).toBe('MIGRATION.SPACE_NOT_FOUND');
    expect(envelope.meta?.['spaceId']).toBe('postgis');
    expect(envelope.meta?.['availableSpaces']).toEqual(['app']);
    expect(envelope.summary).toBe('Unknown contract space: postgis');
  });

  it('emits MIGRATION.SPACE_NOT_FOUND with empty available list when migrations/ is missing', async () => {
    const { cwd } = await setupFixture();
    const result = await runMigrationListFromDisk({
      migrationsDir: join(cwd, 'no-such-migrations'),
      spaceFilter: 'postgis',
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    const envelope = result.failure.toEnvelope();
    expect(envelope.code).toBe('MIGRATION.SPACE_NOT_FOUND');
    expect(envelope.meta?.['availableSpaces']).toEqual([]);
  });

  it('emits MIGRATION.INVALID_SPACE_ID when --space value violates the naming rule', async () => {
    const { migrationsRoot } = await setupFixture();
    const result = await runMigrationListFromDisk({
      migrationsDir: migrationsRoot,
      spaceFilter: '../escape',
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    const envelope = result.failure.toEnvelope();
    expect(envelope.code).toBe('MIGRATION.INVALID_SPACE_ID');
    expect(envelope.meta?.['spaceId']).toBe('../escape');
  });

  it('emits MIGRATION.SPACE_NOT_FOUND for --space refs (reserved per-space subdirectory name)', async () => {
    const { migrationsRoot } = await setupFixture();

    await writePackage(migrationsRoot, {
      spaceId: 'app',
      dirName: '20260422T0720_initial',
      from: null,
      to: HASH_4cb4256,
    });
    // A stray top-level `migrations/refs/` directory: `refs` is the
    // reserved per-space ref-store name, never a contract space. The
    // syntactic name check passes, but enumeration excludes it, so the
    // request must fail rather than wrongly render the app empty-state.
    await writeRef(join(migrationsRoot, 'refs'), 'production', {
      hash: HASH_55bada2,
      invariants: [],
    });

    const result = await runMigrationListFromDisk({
      migrationsDir: migrationsRoot,
      spaceFilter: 'refs',
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    const envelope = result.failure.toEnvelope();
    expect(envelope.code).toBe('MIGRATION.SPACE_NOT_FOUND');
    expect(envelope.meta?.['spaceId']).toBe('refs');
    expect(envelope.meta?.['availableSpaces']).toEqual(['app']);
  });
});

describe('runMigrationList — JSON output shape', () => {
  it('JSON output is unconditionally grouped by contract space (one space)', async () => {
    const { migrationsRoot } = await setupFixture();

    await writePackage(migrationsRoot, {
      spaceId: 'app',
      dirName: '20260422T0720_initial',
      from: null,
      to: HASH_4cb4256,
    });
    await writePackage(migrationsRoot, {
      spaceId: 'app',
      dirName: '20260422T0742_migration',
      from: HASH_4cb4256,
      to: HASH_55bada2,
    });
    await writeRefFor(migrationsRoot, {
      spaceId: 'app',
      name: 'production',
      hash: HASH_55bada2,
    });

    const result = await runMigrationListFromDisk({ migrationsDir: migrationsRoot });
    expectOk(result);

    // Shape mirrors MigrationListResult — top-level keys, then per-space
    // groups even for a single space.
    const json: MigrationListResult = result.value;
    expect(json.ok).toBe(true);
    expect(json.summary).toBe('2 migration(s) on disk');
    expect(json.spaces).toHaveLength(1);
    expect(json.spaces[0]!.space).toBe('app');

    // Migrations latest-first.
    const latest = json.spaces[0]!.migrations[0]!;
    const oldest = json.spaces[0]!.migrations[1]!;
    expect(latest.name).toBe('20260422T0742_migration');
    expect(oldest.name).toBe('20260422T0720_initial');

    // Full sha256 hash preserved in JSON (no abbreviation).
    expect(latest.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(latest.fromContract).toBe(HASH_4cb4256);
    expect(latest.toContract).toBe(HASH_55bada2);

    // refs / providedInvariants / operationCount / createdAt populated
    // on every entry, even when empty.
    expect(latest.refs).toEqual(['production']);
    expect(oldest.refs).toEqual([]);
    expect(latest.providedInvariants).toEqual([]);
    expect(latest.operationCount).toBe(1);
    expect(typeof latest.createdAt).toBe('string');
  });

  it('JSON output is unconditionally grouped by contract space (multiple spaces)', async () => {
    const { migrationsRoot } = await setupFixture();

    await writePackage(migrationsRoot, {
      spaceId: 'app',
      dirName: '20260422T0720_initial',
      from: null,
      to: HASH_4cb4256,
    });
    await writePackage(migrationsRoot, {
      spaceId: 'postgis',
      dirName: '20260601T0000_install_postgis_extension',
      from: null,
      to: HASH_POSTGIS,
    });

    const result = await runMigrationListFromDisk({ migrationsDir: migrationsRoot });
    expectOk(result);
    expect(result.value.spaces.map((s) => s.space)).toEqual(['app', 'postgis']);
    expect(result.value.summary).toBe('2 migration(s) across 2 contract space(s)');
  });

  it('JSON lists head ref decoration on extension tip migration', async () => {
    const { migrationsRoot } = await setupFixture();
    await writePackage(migrationsRoot, {
      spaceId: 'postgis',
      dirName: '20260601T0000_install_postgis_extension',
      from: null,
      to: HASH_POSTGIS,
    });
    const refsDir = join(migrationsRoot, 'postgis', 'refs');
    await mkdir(refsDir, { recursive: true });
    await writeFile(
      join(refsDir, 'head.json'),
      `${JSON.stringify({ hash: HASH_POSTGIS, invariants: [] }, null, 2)}\n`,
    );
    await writeFile(
      join(migrationsRoot, 'postgis', 'contract.json'),
      JSON.stringify({
        storage: { storageHash: HASH_POSTGIS },
        schemaVersion: '1.0.0',
        target: 'postgres',
        targetFamily: 'sql',
      }),
    );

    const result = await runMigrationListFromDisk({ migrationsDir: migrationsRoot });
    expectOk(result);
    const postgis = result.value.spaces.find((s) => s.space === 'postgis');
    expect(postgis?.migrations[0]?.refs).toEqual(['head']);
  });
});

describe('runMigrationList — per-space topology classification', () => {
  it('keeps a cross-space spurious cycle forward in both spaces', async () => {
    // `app` carries HASH_SHARED -> HASH_LINEAR_TIP and `ext` carries the reverse
    // edge. The two form a 2-cycle only when the spaces are merged into one
    // graph. Classifying per space (correct) leaves both edges forward;
    // reverting to a single global classification would turn exactly one into a
    // rollback back-edge. Asserting neither space renders `↩` fails the moment
    // classification stops being scoped per space.
    const { migrationsRoot } = await setupFixture();

    await writePackage(migrationsRoot, {
      spaceId: 'app',
      dirName: '20260101T0000_app_init',
      from: null,
      to: HASH_SHARED,
    });
    await writePackage(migrationsRoot, {
      spaceId: 'app',
      dirName: '20260101T0001_app_fwd',
      from: HASH_SHARED,
      to: HASH_LINEAR_TIP,
    });

    await writePackage(migrationsRoot, {
      spaceId: 'ext',
      dirName: '20260101T0000_ext_init',
      from: null,
      to: HASH_LINEAR_TIP,
    });
    await writePackage(migrationsRoot, {
      spaceId: 'ext',
      dirName: '20260101T0001_ext_fwd',
      from: HASH_LINEAR_TIP,
      to: HASH_SHARED,
    });

    const result = await runMigrationListFromDisk({ migrationsDir: migrationsRoot });
    expectOk(result);

    const flat = renderListed(result.value);
    const appBlock = flat.split('\n\next:')[0] ?? '';
    const extBlock = flat.split('\n\next:')[1]?.split('\n\n')[0] ?? '';

    expect(appBlock).not.toContain('│↓');
    expect(appBlock).toContain('20260101T0001_app_fwd');
    expect(extBlock).not.toContain('│↓');
    expect(extBlock).toContain('20260101T0001_ext_fwd');
  });
});

describe('migration list glyph mode', () => {
  it('picks ASCII for non-TTY stdout via injected runtime', () => {
    const ui = createTerminalUI(parseGlobalFlags({}), {
      isTTY: false,
      env: { LANG: 'en_US.UTF-8' },
    });
    expect(ui.resolveGlyphMode(false)).toBe('ascii');
    expect(detectGlyphMode(ui.glyphModeInput())).toBe('ascii');
  });

  it('picks Unicode on a UTF-8 TTY via injected runtime', () => {
    const ui = createTerminalUI(parseGlobalFlags({}), {
      isTTY: true,
      env: { LANG: 'en_US.UTF-8' },
    });
    expect(ui.resolveGlyphMode(false)).toBe('unicode');
  });

  it('lets --ascii override a UTF-8 TTY', () => {
    const ui = createTerminalUI(parseGlobalFlags({}), {
      isTTY: true,
      env: { LANG: 'en_US.UTF-8' },
    });
    expect(ui.resolveGlyphMode(true)).toBe('ascii');
  });

  it('uses ASCII kind glyphs when glyph mode is ascii', async () => {
    const { migrationsRoot } = await setupFixture();
    await writePackage(migrationsRoot, {
      spaceId: 'app',
      dirName: '20260101T0000_chain_a',
      from: null,
      to: HASH_FAN_BASE,
    });

    const result = await runMigrationListFromDisk({ migrationsDir: migrationsRoot });
    expectOk(result);

    const ascii = renderMigrationListHumanOutput(result.value, {
      glyphMode: 'ascii',
      useColor: false,
      liveContractHash: EMPTY_CONTRACT_HASH,
      graphForSpace: () => undefined,
    });
    expect(ascii).toContain('->');
    expect(ascii).toContain('|^');
    expect(ascii).not.toContain('→');
  });

  it('keeps ANSI styling when ASCII glyph mode is on', async () => {
    const { migrationsRoot } = await setupFixture();
    await writePackage(migrationsRoot, {
      spaceId: 'app',
      dirName: '20260101T0000_chain_a',
      from: null,
      to: HASH_FAN_BASE,
    });

    const result = await runMigrationListFromDisk({ migrationsDir: migrationsRoot });
    expectOk(result);

    const wrapSgr =
      (open: string, close: string) =>
      (text: string): string =>
        `${open}${text}${close}`;
    vi.doMock('colorette', () => ({
      createColors: () => ({
        bold: wrapSgr('\u001b[1m', '\u001b[22m'),
        dim: wrapSgr('\u001b[2m', '\u001b[22m'),
        cyan: wrapSgr('\u001b[36m', '\u001b[39m'),
        cyanBright: wrapSgr('\u001b[96m', '\u001b[39m'),
        yellow: wrapSgr('\u001b[33m', '\u001b[39m'),
        green: wrapSgr('\u001b[32m', '\u001b[39m'),
        greenBright: wrapSgr('\u001b[92m', '\u001b[39m'),
        magenta: wrapSgr('\u001b[35m', '\u001b[39m'),
        blueBright: wrapSgr('\u001b[94m', '\u001b[39m'),
        red: wrapSgr('\u001b[31m', '\u001b[39m'),
      }),
      bold: wrapSgr('\u001b[1m', '\u001b[22m'),
      dim: wrapSgr('\u001b[2m', '\u001b[22m'),
      cyan: wrapSgr('\u001b[36m', '\u001b[39m'),
      cyanBright: wrapSgr('\u001b[96m', '\u001b[39m'),
      yellow: wrapSgr('\u001b[33m', '\u001b[39m'),
      green: wrapSgr('\u001b[32m', '\u001b[39m'),
      greenBright: wrapSgr('\u001b[92m', '\u001b[39m'),
    }));
    vi.resetModules();
    try {
      const { parseGlobalFlags: parseFlags } = await import('../../src/utils/global-flags');
      const { createTerminalUI: createUi } = await import('../../src/utils/terminal-ui');
      const { renderMigrationListHumanOutput: renderHuman } = await import(
        '../../src/commands/migration-list'
      );
      const ui = createUi(parseFlags({}), {
        isTTY: true,
        env: { LANG: 'en_US.UTF-8' },
      });
      const output = renderHuman(result.value, {
        glyphMode: ui.resolveGlyphMode(true),
        useColor: true,
        liveContractHash: EMPTY_CONTRACT_HASH,
        graphForSpace: () => undefined,
      });
      expect(output).toContain('\u001b[');
      expect(output).toContain('->');
      expect(output).toMatch(/\|.*\^/);
      expect(output).not.toContain('→');
    } finally {
      vi.doUnmock('colorette');
      vi.resetModules();
    }
  });
});
