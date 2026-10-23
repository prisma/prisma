import type { StructuredError, StructuredErrorOptions } from '@internal/utils/structured-error';
import { structuredError } from '@internal/utils/structured-error';

export type MysqlTargetErrorCode =
  | 'CONTRACT.ARGUMENT_INVALID'
  | 'CONTRACT.CONSTRAINT_INVALID'
  | 'CONTRACT.IDENTIFIER_INVALID'
  | 'CONTRACT.NAMESPACE_INVALID'
  | 'CONTRACT.TARGET_MISMATCH'
  | 'CONTRACT.TYPE_PARAMS_INVALID'
  | 'MIGRATION.CONTRACT_SPACE_VIOLATION'
  | 'MIGRATION.MARKER_LOCK_TIMEOUT'
  | 'MIGRATION.MYSQL_CONTROL_STACK_MISSING'
  | 'RUNTIME.AST_UNSUPPORTED'
  | 'RUNTIME.DECODE_FAILED'
  | 'RUNTIME.ENCODE_FAILED';

export function mysqlError(
  code: MysqlTargetErrorCode,
  message: string,
  options?: StructuredErrorOptions,
): StructuredError {
  return structuredError(code, message, options);
}

/** The refusal of a query a later slice of the MySQL target can render: `what` names the feature, as in `Lowering queries`. */
export function mysqlQueryNotYetSupported(what: string): StructuredError {
  return mysqlError('RUNTIME.AST_UNSUPPORTED', `${what} is not yet supported on MySQL.`, {
    why: 'The MySQL target emits contracts, introspects databases and reads the marker and ledger; it does not render queries yet.',
    fix: 'Use a Postgres or SQLite target to run queries until the MySQL target supports them.',
    meta: { target: 'mysql', feature: what },
  });
}
