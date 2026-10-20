import { errorNoInvariantPath, type MigrationToolsError } from '@internal/migration-tools/errors';
import type { MigrationGraph } from '@internal/migration-tools/graph';
import { findPathWithDecision } from '@internal/migration-tools/migration-graph';

/**
 * `MIGRATION.NO_INVARIANT_PATH` for a space whose graph reaches `targetHash` from `fromHash` but
 * provides none of `missing`, naming the path that ignores invariants. A space with no marker
 * starts from the empty contract's hash, so the path is found even then.
 */
export function noInvariantPathError(input: {
  readonly graph: MigrationGraph;
  readonly fromHash: string;
  readonly targetHash: string;
  readonly required: readonly string[];
  readonly missing: readonly string[];
  readonly refName?: string;
}): MigrationToolsError {
  const structural = findPathWithDecision(input.graph, input.fromHash, input.targetHash, {
    required: new Set<string>(),
  });
  const structuralPath =
    structural.kind === 'ok'
      ? structural.decision.selectedPath.map((edge) => ({
          dirName: edge.dirName,
          migrationHash: edge.migrationHash,
          from: edge.from,
          to: edge.to,
          invariants: edge.invariants,
        }))
      : [];
  return errorNoInvariantPath({
    ...(input.refName !== undefined ? { refName: input.refName } : {}),
    required: input.required,
    missing: input.missing,
    structuralPath,
  });
}
