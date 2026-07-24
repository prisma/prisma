import { createHash } from 'node:crypto';
import { normalizeSqlBody } from '@prisma-next/sql-schema-ir/naming';

export type RlsPolicyOperation = 'select' | 'insert' | 'update' | 'delete' | 'all';

/**
 * Which predicate each RLS operation admits, mirroring Postgres: SELECT and
 * DELETE decide row visibility/eligibility with `USING` only; INSERT
 * validates the new row with `WITH CHECK` only; UPDATE and ALL take either
 * or both. Single-homed here so the PSL lowering and the TS handle
 * constructors enforce the same matrix.
 */
export const POLICY_OPERATION_PREDICATES: Readonly<
  Record<RlsPolicyOperation, { readonly using: boolean; readonly withCheck: boolean }>
> = {
  select: { using: true, withCheck: false },
  insert: { using: false, withCheck: true },
  update: { using: true, withCheck: true },
  delete: { using: true, withCheck: false },
  all: { using: true, withCheck: true },
};

export interface ContentHashParts {
  readonly using?: string;
  readonly withCheck?: string;
  readonly roles: readonly string[];
  readonly operation: RlsPolicyOperation;
  readonly permissive: boolean;
}

/**
 * Returns the first 8 lowercase hex characters of the SHA-256 digest over the
 * canonical content tuple for an RLS policy:
 *
 *   [normalizeSqlBody(using), normalizeSqlBody(withCheck), sortedRoles, operation, permissive]
 *
 * Schema and table are excluded (they are orthogonal to policy equivalence).
 * Uses `JSON.stringify` for a deterministic encoding.
 */
export function computeContentHash(parts: ContentHashParts): string {
  const using = normalizeSqlBody(parts.using ?? '');
  const withCheck = normalizeSqlBody(parts.withCheck ?? '');
  const roles = [...new Set(parts.roles)].sort();
  const permissive = parts.permissive ? 'permissive' : 'restrictive';

  const tuple = JSON.stringify([using, withCheck, roles, parts.operation, permissive]);
  return createHash('sha256').update(tuple).digest('hex').slice(0, 8);
}
