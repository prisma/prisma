/**
 * Governance posture for a storage-plane node or for the contract as a whole.
 *
 * - `managed`  — Prisma Next owns the full lifecycle (DDL, migrations, verification).
 * - `tolerated` — node was found in the database but is not schema-managed; Prisma Next
 *   leaves it untouched while tracking its existence.
 * - `external` — node is owned by an external system; Prisma Next never emits DDL for it.
 * - `observed` — read-only access; Prisma Next does not write to or migrate the node.
 */
export type ControlPolicy = 'managed' | 'tolerated' | 'external' | 'observed';

/**
 * Resolves the effective control policy for a storage-plane node.
 *
 * Precedence: node-level value → contract default → `'managed'`.
 *
 * Both parameters are optional raw values so this function stays node-type-agnostic
 * and can be called by any consumer (verifier, planner, etc.) without importing IR classes.
 */
export function effectiveControlPolicy(
  nodeControl: ControlPolicy | undefined,
  defaultControlPolicy: ControlPolicy | undefined,
): ControlPolicy {
  return nodeControl ?? defaultControlPolicy ?? 'managed';
}
