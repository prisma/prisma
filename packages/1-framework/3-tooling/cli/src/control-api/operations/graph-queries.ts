/**
 * Read-only migration-graph queries commands need at the control-api seam: path existence and the live-marker membership refusal.
 */

import type { LedgerEntryRecord } from '@internal/contract/types';
import type { MigrationGraph } from '@internal/migration-tools/graph';
import { findPath, isGraphNode } from '@internal/migration-tools/migration-graph';
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
