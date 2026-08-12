import type { AggregateMigrationEdgeRef } from './planner-types';

export function buildFabricatedMigrationEdge(args: {
  readonly currentMarkerStorageHash: string | null | undefined;
  readonly destinationStorageHash: string;
  readonly operationCount: number;
  readonly destinationContractJson?: unknown;
}): AggregateMigrationEdgeRef {
  return {
    dirName: '',
    migrationHash: args.destinationStorageHash,
    from: args.currentMarkerStorageHash ?? '',
    to: args.destinationStorageHash,
    operationCount: args.operationCount,
    ...(args.destinationContractJson !== undefined
      ? { destinationContractJson: args.destinationContractJson }
      : {}),
  };
}
