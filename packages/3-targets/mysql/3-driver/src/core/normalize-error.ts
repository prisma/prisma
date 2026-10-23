import { errorRuntime } from '@internal/errors/execution';
import { SqlQueryError } from '@internal/sql-errors';
import { ifDefined } from '@internal/utils/defined';

interface Mysql2Error extends Error {
  readonly sqlState?: string;
  readonly sqlMessage?: string;
}

function isMysql2Error(error: unknown): error is Mysql2Error {
  return error instanceof Error && 'sqlState' in error && typeof error.sqlState === 'string';
}

/** A query error MySQL reported, as the family's `SqlQueryError` with its SQLSTATE; any other error unchanged. */
export function normalizeMysqlError(error: unknown): unknown {
  if (!isMysql2Error(error)) return error;
  return new SqlQueryError(error.sqlMessage ?? error.message, {
    cause: error,
    ...ifDefined('sqlState', error.sqlState),
  });
}

/** Whether mysql2 reported `error` as fatal, which leaves its connection unusable. */
export function isFatal(error: unknown): error is Error {
  return error instanceof Error && 'fatal' in error && error.fatal === true;
}

/** The error a statement ends with when its connection is lost or closed under it. */
export function connectionLost(cause?: unknown): Error {
  return errorRuntime('DRIVER.NOT_CONNECTED', 'MySQL connection lost or closed', {
    why: cause instanceof Error ? cause.message : 'The connection ended.',
    fix: 'Retry the work; the driver opens a new connection.',
    ...(cause === undefined ? {} : { cause }),
  });
}
