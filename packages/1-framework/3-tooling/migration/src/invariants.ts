import type { MigrationPlanOperation } from '@internal/framework-components/control';
import { errorDuplicateInvariantInEdge, errorInvalidInvariantId } from './errors';
import type { MigrationOps } from './package';

/**
 * Hygiene check for `invariantId`. Rejects empty values plus any
 * whitespace or control character (including Unicode whitespace like
 * NBSP and em space, which are visually identical to ASCII space and
 * routinely sneak in via paste).
 */
export function validateInvariantId(invariantId: string): boolean {
  if (invariantId.length === 0) return false;
  return !/[\p{Cc}\p{White_Space}]/u.test(invariantId);
}

/**
 * Walk a migration's operations and produce its `providedInvariants`
 * aggregate: the sorted, deduplicated list of `invariantId`s declared
 * by ops in the migration. Ops without an `invariantId` are skipped.
 *
 * Both `data`-class ops (data-transforms, e.g. backfills) and
 * `additive`-class opaque DDL (e.g. cipherstash's vendored EQL bundle
 * via `installEqlBundleOp`) may declare invariantIds: the
 * `operationClass` axis classifies *policy gating* (which kinds of ops
 * a `db init` / `db update` policy permits), while `invariantId`
 * classifies *marker bookkeeping* (which named bundles of work a
 * future regeneration knows to skip). The two concerns are
 * intentionally orthogonal — an extension can ship additive
 * non-IR-derivable DDL (the only way the planner can know the bundle
 * is already applied is via the invariantId on the marker) without
 * needing to mis-classify it as `data`-class.
 *
 * Throws `MIGRATION.INVALID_INVARIANT_ID` on a malformed id and
 * `MIGRATION.DUPLICATE_INVARIANT_IN_EDGE` on duplicates.
 *
 * @see docs/architecture docs/adrs/ADR 212 - Contract spaces.md
 *   — extension migrations carry `invariantId`s on additive ops; e.g.
 *   cipherstash's `installEqlBundle` and structural `create-*` ops are
 *   additive-class but carry `cipherstash:*` invariantIds.
 */
export function deriveProvidedInvariants(ops: MigrationOps): readonly string[] {
  const seen = new Set<string>();
  for (const op of ops) {
    const invariantId = readInvariantId(op);
    if (invariantId === undefined) continue;
    if (!validateInvariantId(invariantId)) {
      throw errorInvalidInvariantId(invariantId);
    }
    if (seen.has(invariantId)) {
      throw errorDuplicateInvariantInEdge(invariantId);
    }
    seen.add(invariantId);
  }
  return [...seen].sort();
}

function readInvariantId(op: MigrationPlanOperation): string | undefined {
  if (!Object.hasOwn(op, 'invariantId')) return undefined;
  const candidate = (op as { invariantId?: unknown }).invariantId;
  return typeof candidate === 'string' ? candidate : undefined;
}
