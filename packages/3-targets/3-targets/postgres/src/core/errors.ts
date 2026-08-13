import { CliStructuredError } from '@internal/errors/control';
import type { StructuredError, StructuredErrorOptions } from '@internal/utils/structured-error';
import { structuredError } from '@internal/utils/structured-error';

export type PostgresTargetErrorCode =
  | 'CONTRACT.CODEC_DESCRIPTOR_MISSING'
  | 'CONTRACT.DEFAULT_INVALID'
  | 'CONTRACT.ENTITY_KIND_INVALID'
  | 'CONTRACT.IDENTIFIER_INVALID'
  | 'CONTRACT.INDEX_INVALID'
  | 'CONTRACT.INFER_UNSUPPORTED'
  | 'CONTRACT.MODEL_UNKNOWN'
  | 'CONTRACT.NAME_DUPLICATE'
  | 'CONTRACT.NATIVE_TYPE_INVALID'
  | 'CONTRACT.PACK_CONTRIBUTION_INVALID'
  | 'CONTRACT.POLICY_INVALID'
  | 'CONTRACT.ROLE_INVALID'
  | 'MIGRATION.CONTRACT_SPACE_VIOLATION'
  | 'MIGRATION.POSTGRES_CONTROL_STACK_MISSING'
  | 'MIGRATION.TARGET_MISMATCH'
  | 'RUNTIME.DECODE_FAILED'
  | 'RUNTIME.ENCODE_FAILED'
  | 'RUNTIME.TYPE_PARAMS_INVALID';

export function postgresError(
  code: PostgresTargetErrorCode,
  message: string,
  options?: StructuredErrorOptions,
): StructuredError {
  return structuredError(code, message, options);
}

/**
 * A `PostgresMigration` operation that needs the materialized control adapter
 * — named by `operation` (e.g. `createTable`, `dropColumn`, `dataTransform`) —
 * was invoked, but the migration was constructed without a `ControlStack`.
 * Concrete authoring usage always goes through the migration CLI entrypoint,
 * which assembles a stack from the loaded `prisma.config.ts`; reaching this
 * error means a test fixture or ad-hoc consumer instantiated `PostgresMigration`
 * with the no-arg form (legal for `operations` / `describe` introspection only).
 *
 * The `operation` argument is required so every throw site names the operation
 * that actually failed; a new operation cannot inherit a misattributed message.
 *
 * Distinct from `MIGRATION.UNFILLED_PLACEHOLDER` (placeholder not filled)
 * and `MIGRATION.DATA_TRANSFORM_CONTRACT_MISMATCH` (data-transform query
 * plan against wrong contract) because the missing input is the stack
 * itself, not the per-operation contract.
 *
 * Lives in `@internal/target-postgres/errors` rather than the shared
 * framework migration errors module because the failure is target-specific:
 * the contract it talks about (`PostgresMigration`, the Postgres control
 * adapter, the Postgres-target stack) only exists in this package.
 */
export function errorPostgresMigrationStackMissing(operation: string): CliStructuredError {
  return new CliStructuredError(
    'MIGRATION.POSTGRES_CONTROL_STACK_MISSING',
    `PostgresMigration.${operation} requires a control adapter`,
    {
      why: `PostgresMigration.${operation} was invoked on an instance constructed without a ControlStack, so the stored controlAdapter is undefined and the operation cannot lower its plan.`,
      fix: 'Construct the migration via the migration CLI entrypoint (which assembles a ControlStack from the loaded prisma.config.ts), or pass a ControlStack containing a Postgres adapter to the migration constructor in test fixtures.',
      meta: { operation },
    },
  );
}
