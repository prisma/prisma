import { SqlConnectionError, SqlQueryError } from '@internal/sql-errors';

interface SqliteError extends Error {
  readonly code?: string;
  readonly errcode?: number;
  readonly errstr?: string;
}

// SQLite extended error code ranges (base code * 256 + extended)
// Base code 19 = SQLITE_CONSTRAINT
const SQLITE_CONSTRAINT_BASE = 19;
const SQLITE_CONSTRAINT_UNIQUE = 2067; // 19 + 8*256
const SQLITE_CONSTRAINT_PRIMARYKEY = 1555; // 19 + 6*256
const SQLITE_CONSTRAINT_FOREIGNKEY = 787; // 19 + 3*256
const SQLITE_CONSTRAINT_NOTNULL = 1299; // 19 + 5*256
const SQLITE_CONSTRAINT_CHECK = 275; // 19 + 1*256

// Base code 5 = SQLITE_BUSY
const SQLITE_BUSY = 5;
// Base code 6 = SQLITE_LOCKED
const SQLITE_LOCKED = 6;

function isConstraintError(errcode: number): boolean {
  return (errcode & 0xff) === SQLITE_CONSTRAINT_BASE;
}

function isBusyOrLocked(errcode: number): boolean {
  const base = errcode & 0xff;
  return base === SQLITE_BUSY || base === SQLITE_LOCKED;
}

export function isSqliteError(error: unknown): error is SqliteError {
  if (!(error instanceof Error)) {
    return false;
  }
  return (error as SqliteError).code === 'ERR_SQLITE_ERROR';
}

function constraintNameFromMessage(message: string): string | undefined {
  // SQLite constraint messages follow patterns like:
  // "UNIQUE constraint failed: table.column"
  // "FOREIGN KEY constraint failed"
  // "NOT NULL constraint failed: table.column"
  const match = /constraint failed: (.+)/.exec(message);
  return match?.[1];
}

function mapErrCodeToSqlState(errcode: number): string {
  switch (errcode) {
    case SQLITE_CONSTRAINT_UNIQUE:
    case SQLITE_CONSTRAINT_PRIMARYKEY:
      return '23505'; // unique_violation
    case SQLITE_CONSTRAINT_FOREIGNKEY:
      return '23503'; // foreign_key_violation
    case SQLITE_CONSTRAINT_NOTNULL:
      return '23502'; // not_null_violation
    case SQLITE_CONSTRAINT_CHECK:
      return '23514'; // check_violation
    default:
      if (isConstraintError(errcode)) {
        return '23000'; // integrity_constraint_violation
      }
      return 'HY000'; // general error
  }
}

export function normalizeSqliteError(error: unknown): SqlQueryError | SqlConnectionError | Error {
  if (!(error instanceof Error)) {
    return new Error(String(error));
  }

  if (isSqliteError(error)) {
    const sqliteErr = error as SqliteError;
    const errcode = sqliteErr.errcode ?? 0;

    if (isBusyOrLocked(errcode)) {
      return new SqlConnectionError(error.message, {
        cause: error,
        transient: true,
      });
    }

    const sqlState = mapErrCodeToSqlState(errcode);
    const constraint = constraintNameFromMessage(error.message);

    return new SqlQueryError(error.message, {
      cause: error,
      sqlState,
      ...(constraint !== undefined ? { constraint } : {}),
    });
  }

  // Connection-related Node.js errors
  if (
    error.message.includes('database is locked') ||
    error.message.includes('unable to open database')
  ) {
    return new SqlConnectionError(error.message, {
      cause: error,
      transient: false,
    });
  }

  return error;
}
