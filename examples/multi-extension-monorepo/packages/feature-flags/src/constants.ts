/**
 * Static identifiers for the `feature-flags` internal contract-space
 * package. Same shape as `packages/audit/constants.ts`; the duplication
 * is intentional — each "internal package" owns its own identifiers.
 */

export const FEATURE_FLAGS_SPACE_ID = 'feature-flags' as const;

export const FEATURE_FLAG_TABLE = 'feature_flag' as const;

export const FEATURE_FLAGS_BASELINE_INVARIANT_ID = 'feature-flags:create-feature_flag-v1' as const;

export const FEATURE_FLAGS_BASELINE_MIGRATION_NAME = '20260601T0000_create_feature_flag' as const;
