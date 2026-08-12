/**
 * Projects the loaded aggregate into the per-space contracts+migrations rows the `migration graph --json` output serializes.
 */

import type { ContractSpaceAggregate } from '@internal/migration-tools/aggregate';
import { EMPTY_CONTRACT_HASH } from '@internal/migration-tools/constants';
import type { MigrationSpaceGraphEntry } from '../../commands/json/schemas';
import type { MigrationSpaceListEntry } from '../../utils/formatters/migration-list-types';
import { listRefsByContractHash } from './migration-list';

/**
 * Project scoped list entries into the per-space contracts+migrations rows the migration
 * graph --json output serializes (EMPTY_CONTRACT_HASH from-hash → null). Skips space ids
 * the aggregate no longer resolves, mirroring the command loop.
 */
export function buildMigrationSpaceGraphEntries(args: {
  readonly aggregate: ContractSpaceAggregate;
  readonly scopedSpaces: readonly MigrationSpaceListEntry[];
}): readonly MigrationSpaceGraphEntry[] {
  const spaces: MigrationSpaceGraphEntry[] = [];
  for (const spaceEntry of args.scopedSpaces) {
    const space = args.aggregate.space(spaceEntry.space);
    if (space === undefined) {
      continue;
    }
    const graph = space.graph();
    const refsByHash = listRefsByContractHash(space);
    spaces.push({
      space: spaceEntry.space,
      contracts: [...graph.nodes].map((hash) => ({
        hash,
        refs: [...(refsByHash.get(hash) ?? [])],
      })),
      migrations: [...graph.migrationByHash.values()].map((edge) => ({
        name: edge.dirName,
        hash: edge.migrationHash,
        fromContract: edge.from === EMPTY_CONTRACT_HASH ? null : edge.from,
        toContract: edge.to,
      })),
    });
  }
  return spaces;
}
