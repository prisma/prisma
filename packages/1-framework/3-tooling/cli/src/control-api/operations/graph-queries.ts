/**
 * Read-only migration-graph queries commands need at the control-api seam: path existence and the live-marker membership refusal.
 */

import type { LedgerEntryRecord } from '@internal/contract/types';
import { type ContractSpaceAggregate, requireHeadRef } from '@internal/migration-tools/aggregate';
import type { MigrationGraph } from '@internal/migration-tools/graph';
import { findPath, isGraphNode, isInSpaceHistory } from '@internal/migration-tools/migration-graph';
import type { CliStructuredError } from '../../utils/cli-errors';
import { errorMarkerMismatch, readLedgerQuietly } from '../../utils/marker-mismatch';
import type { CliInvocation } from '../../utils/printed-command';

/** True when the on-disk graph contains a path fromHash → toHash. */
export function hasMigrationPath(graph: MigrationGraph, fromHash: string, toHash: string): boolean {
  return findPath(graph, fromHash, toHash) !== null;
}

/**
 * Refusal for a live marker hash that is not a node of the space's on-disk graph, or null when the
 * marker is a node. The ledger is read only to explain a refusal.
 */
export async function refuseMarkerOutsideGraph(args: {
  readonly spaceId: string;
  readonly markerHash: string;
  readonly targetHash: string;
  readonly graph: MigrationGraph;
  readonly migrationsDir: string;
  readonly invocation: CliInvocation;
  readonly readLedger: () => Promise<readonly LedgerEntryRecord[]>;
}): Promise<CliStructuredError | null> {
  if (isGraphNode(args.markerHash, args.graph)) {
    return null;
  }
  return errorMarkerMismatch({
    spaceId: args.spaceId,
    markerHash: args.markerHash,
    targetHash: args.targetHash,
    graph: args.graph,
    migrationsDir: args.migrationsDir,
    ledger: await readLedgerQuietly(args.readLedger),
    invocation: args.invocation,
  });
}

/**
 * The first refusal across every contract space, the application space first, in the order
 * `migrate` plans them. An extension space with no migrations whose marker is at its head is in its
 * history; the application space's head comes from the emitted contract, so it is not.
 */
export async function refuseMarkersOutsideGraphs(args: {
  readonly aggregate: ContractSpaceAggregate;
  readonly markers: ReadonlyMap<string, { readonly storageHash: string }>;
  readonly appTargetHash: string;
  readonly migrationsDir: string;
  readonly invocation: CliInvocation;
  readonly readLedger: (spaceId: string) => Promise<readonly LedgerEntryRecord[]>;
}): Promise<CliStructuredError | null> {
  const { aggregate } = args;
  for (const space of [aggregate.app, ...aggregate.extensions]) {
    const marker = args.markers.get(space.spaceId);
    if (marker === undefined) {
      continue;
    }
    const isAppSpace = space.spaceId === aggregate.app.spaceId;
    const graph = space.graph();
    const targetHash = isAppSpace ? args.appTargetHash : requireHeadRef(space).hash;
    if (!isAppSpace && isInSpaceHistory(marker.storageHash, { graph, headHash: targetHash })) {
      continue;
    }
    const refusal = await refuseMarkerOutsideGraph({
      spaceId: space.spaceId,
      markerHash: marker.storageHash,
      targetHash,
      graph,
      migrationsDir: args.migrationsDir,
      invocation: args.invocation,
      readLedger: () => args.readLedger(space.spaceId),
    });
    if (refusal !== null) {
      return refusal;
    }
  }
  return null;
}
