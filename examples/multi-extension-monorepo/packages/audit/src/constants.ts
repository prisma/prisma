/**
 * Static identifiers for the `audit` internal contract-space package.
 *
 * Mirrors the convention real extensions follow (see e.g.
 * `packages/3-extensions/pgvector/src/core/contract-space-constants.ts`):
 * a stable space id (used as the consuming app's
 * `migrations/<space-id>/` directory name), a stable invariantId for
 * the baseline op, and a stable baseline-migration directory name.
 */

export const AUDIT_SPACE_ID = 'audit' as const;

export const AUDIT_EVENT_TABLE = 'audit_event' as const;

export const AUDIT_BASELINE_INVARIANT_ID = 'audit:create-audit_event-v1' as const;

export const AUDIT_BASELINE_MIGRATION_NAME = '20260601T0000_create_audit_event' as const;
