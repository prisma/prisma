/**
 * Policy core of `migration list`: enumerates on-disk contract spaces from the loaded aggregate and assembles the list result.
 */

import type {
  AggregateContractSpace,
  ContractSpaceAggregate,
} from '@internal/migration-tools/aggregate';
import { HEAD_REF_NAME, refsByContractHash } from '@internal/migration-tools/refs';
import {
  APP_SPACE_ID,
  isValidSpaceId,
  listContractSpaceDirectories,
} from '@internal/migration-tools/spaces';
import { notOk, ok, type Result } from '@internal/utils/result';
import {
  type CliStructuredError,
  errorInvalidSpaceId,
  errorSpaceNotFound,
} from '../../utils/cli-errors';
import type {
  MigrationListEntry,
  MigrationListResult,
  MigrationSpaceListEntry,
} from '../../utils/formatters/migration-list-types';

function compareSpaceIds(a: string, b: string): number {
  if (a === APP_SPACE_ID) return b === APP_SPACE_ID ? 0 : -1;
  if (b === APP_SPACE_ID) return 1;
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function compareDirNamesDescending(a: MigrationListEntry, b: MigrationListEntry): number {
  if (a.name < b.name) return 1;
  if (a.name > b.name) return -1;
  return 0;
}

/**
 * Ref names decorating a space's destination contract hashes. The
 * tolerant `space.refs` deliberately omits the structural `head.json`;
 * for extension spaces the old enumerator surfaced it as a `head`
 * decoration on the tip migration, so fold `space.headRef` back in to
 * keep that output. The app space synthesises its head, so it carries
 * no on-disk `head` ref to restore.
 */
export function listRefsByContractHash(
  space: AggregateContractSpace,
): ReadonlyMap<string, readonly string[]> {
  const byHash = new Map(refsByContractHash(space.refs));
  if (space.spaceId !== APP_SPACE_ID && space.headRef !== null) {
    const hash = space.headRef.hash;
    const bucket = byHash.get(hash) ?? [];
    if (!bucket.includes(HEAD_REF_NAME)) {
      byHash.set(hash, [...bucket, HEAD_REF_NAME].sort());
    }
  }
  return byHash;
}

async function orderedOnDiskSpaceIds(projectMigrationsDir: string): Promise<readonly string[]> {
  const candidateDirs = await listContractSpaceDirectories(projectMigrationsDir);
  return candidateDirs.filter(isValidSpaceId).sort(compareSpaceIds);
}

/**
 * Project the loaded {@link ContractSpaceAggregate} into the render-ready
 * {@link MigrationSpaceListEntry} rows `migration list` displays.
 *
 * Space membership matches the on-disk contract-space directories (not the
 * aggregate's always-present synthesized app space when `migrations/app/`
 * is absent); package and ref data come from `aggregate.space(id)`.
 */
export async function migrationSpaceListEntriesFromAggregate(
  aggregate: ContractSpaceAggregate,
  projectMigrationsDir: string,
): Promise<readonly MigrationSpaceListEntry[]> {
  const spaceIds = await orderedOnDiskSpaceIds(projectMigrationsDir);
  const spaces: MigrationSpaceListEntry[] = [];

  for (const spaceId of spaceIds) {
    const space = aggregate.space(spaceId);
    if (space === undefined) {
      continue;
    }
    const refsByHash = listRefsByContractHash(space);
    const migrations: MigrationListEntry[] = space.packages
      .map((pkg) => ({
        name: pkg.dirName,
        hash: pkg.metadata.migrationHash,
        fromContract: pkg.metadata.from,
        toContract: pkg.metadata.to,
        operationCount: pkg.ops.length,
        createdAt: pkg.metadata.createdAt,
        refs: [...(refsByHash.get(pkg.metadata.to) ?? [])],
        providedInvariants: [...pkg.metadata.providedInvariants],
      }))
      .sort(compareDirNamesDescending);

    spaces.push({ space: spaceId, migrations });
  }

  return spaces;
}

/**
 * Inputs for {@link runMigrationList} — the policy core of `migration list`
 * that tests exercise directly.
 *
 * The core does not call `loadConfig`, parse CLI flags, render a styled
 * header, or write to any stream. Enumeration is supplied by the caller
 * (the CLI shell builds it from {@link migrationSpaceListEntriesFromAggregate}).
 */
export interface RunMigrationListInputs {
  readonly spaces: readonly MigrationSpaceListEntry[];
  readonly spaceFilter?: string;
}

function computeSummary(spaces: readonly MigrationSpaceListEntry[]): string {
  const totalMigrations = spaces.reduce((count, space) => count + space.migrations.length, 0);
  if (spaces.length <= 1) {
    return `${totalMigrations} migration(s) on disk`;
  }
  return `${totalMigrations} migration(s) across ${spaces.length} contract space(s)`;
}

/**
 * Policy core of `migration list`: validates `--space`, narrows the
 * pre-enumerated spaces, and assembles a {@link MigrationListResult}.
 *
 * - `migrations/` missing or contains no valid space directories →
 *   caller passes `spaces: []`; this synthesizes `[{ spaceId: APP_SPACE_ID, migrations: [] }]`.
 * - `--space <id>` on an existing-but-empty space → `{ spaceId, migrations: [] }` in the input.
 * - `--space <id>` on a non-existent (or reserved) space → `SPACE_NOT_FOUND`.
 */
export function runMigrationList(
  inputs: RunMigrationListInputs,
): Result<MigrationListResult, CliStructuredError> {
  const { spaces, spaceFilter } = inputs;

  if (spaceFilter !== undefined && !isValidSpaceId(spaceFilter)) {
    return notOk(errorInvalidSpaceId(spaceFilter));
  }

  if (spaceFilter !== undefined && !spaces.some((s) => s.space === spaceFilter)) {
    return notOk(errorSpaceNotFound(spaceFilter, spaces.map((s) => s.space).sort()));
  }

  const scopedSpaces =
    spaceFilter !== undefined ? spaces.filter((s) => s.space === spaceFilter) : spaces;

  const resultSpaces: readonly MigrationSpaceListEntry[] =
    scopedSpaces.length === 0 ? [{ space: APP_SPACE_ID, migrations: [] }] : scopedSpaces;

  return ok({
    ok: true,
    spaces: [...resultSpaces],
    summary: computeSummary(resultSpaces),
  });
}
