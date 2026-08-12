/**
 * Invariant refusals shared by migrate and migration status: unknown ref invariants and unsatisfiable invariant paths.
 */

import { errorNoInvariantPath, errorUnknownInvariant } from '@internal/migration-tools/errors';
import type { MigrationGraph } from '@internal/migration-tools/graph';
import { findPathWithDecision } from '@internal/migration-tools/migration-graph';
import { ifDefined } from '@internal/utils/defined';
import type { CliStructuredError } from '../../utils/cli-errors';
import { collectDeclaredInvariants, toStructuralEdge } from '../../utils/command-helpers';

/** Refuses ref invariants neither declared on any graph edge nor present on the live marker. */
export function refuseUnknownInvariants(args: {
  readonly graph: MigrationGraph;
  readonly markerInvariants: readonly string[];
  readonly refInvariants: readonly string[];
  readonly refName?: string;
}): CliStructuredError | null {
  const declared = collectDeclaredInvariants(args.graph);
  const known = new Set<string>(declared);
  for (const id of args.markerInvariants) known.add(id);
  const unknown = args.refInvariants.filter((id) => !known.has(id));
  if (unknown.length === 0) {
    return null;
  }
  return errorUnknownInvariant({
    ...ifDefined('refName', args.refName),
    unknown,
    declared: [...declared].sort(),
  });
}

/** Refuses a --to target whose missing invariants no path from originHash satisfies. */
export function refuseMissingInvariantPath(args: {
  readonly graph: MigrationGraph;
  readonly originHash: string;
  readonly targetHash: string;
  readonly missing: readonly string[];
  readonly refName?: string;
}): CliStructuredError | null {
  const outcome = findPathWithDecision(args.graph, args.originHash, args.targetHash, {
    ...ifDefined('refName', args.refName),
    required: new Set(args.missing),
  });
  if (outcome.kind !== 'unsatisfiable') {
    return null;
  }
  return errorNoInvariantPath({
    ...ifDefined('refName', args.refName),
    required: [...args.missing].sort(),
    missing: outcome.missing,
    structuralPath: outcome.structuralPath.map(toStructuralEdge),
  });
}
