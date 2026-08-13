import { access } from 'node:fs/promises';
import { SqlConnectionError, SqlQueryError } from '@internal/sql-errors';
import { describe, expect, it } from 'vitest';
import { isAlreadyConnectedError, isPostgresError, normalizePgError } from '../src/normalize-error';

describe('normalizePgError', () => {
  describe('Postgres SQLSTATE errors', () => {
    it('normalizes unique violation error to SqlQueryError', () => {
      const pgError = new Error(
        'duplicate key value violates unique constraint "user_email_unique"',
      );
      (pgError as { code?: string }).code = '23505';
      (pgError as { constraint?: string }).constraint = 'user_email_unique';
      (pgError as { table?: string }).table = 'user';
      (pgError as { column?: string }).column = 'email';
      (pgError as { detail?: string }).detail = 'Key (email)=(test@example.com) already exists.';

      const error = normalizePgError(pgError);
      expect(SqlQueryError.is(error)).toBe(true);
      if (SqlQueryError.is(error)) {
        expect(error.message).toBe(pgError.message);
        expect(error.sqlState).toBe('23505');
        expect(error.constraint).toBe('user_email_unique');
        expect(error.table).toBe('user');
        expect(error.column).toBe('email');
        expect(error.detail).toBe('Key (email)=(test@example.com) already exists.');
        expect(error.cause).toBe(pgError);
      }
    });

    it('normalizes syntax error to SqlQueryError', () => {
      const pgError = new Error('syntax error at or near "INVALID"');
      (pgError as { code?: string }).code = '42601';

      const error = normalizePgError(pgError);
      expect(SqlQueryError.is(error)).toBe(true);
      if (SqlQueryError.is(error)) {
        expect(error.sqlState).toBe('42601');
        expect(error.cause).toBe(pgError);
      }
    });

    it('normalizes permission error to SqlQueryError', () => {
      const pgError = new Error('permission denied for table user');
      (pgError as { code?: string }).code = '42501';

      const error = normalizePgError(pgError);
      expect(SqlQueryError.is(error)).toBe(true);
      if (SqlQueryError.is(error)) {
        expect(error.sqlState).toBe('42501');
        expect(error.cause).toBe(pgError);
      }
    });

    it('normalizes error with partial fields', () => {
      const pgError = new Error('some error');
      (pgError as { code?: string }).code = '23503';
      (pgError as { table?: string }).table = 'post';

      const error = normalizePgError(pgError);
      expect(SqlQueryError.is(error)).toBe(true);
      if (SqlQueryError.is(error)) {
        expect(error.sqlState).toBe('23503');
        expect(error.table).toBe('post');
        expect(error.constraint).toBeUndefined();
        expect(error.column).toBeUndefined();
        expect(error.detail).toBeUndefined();
      }
    });
  });

  describe('Connection errors', () => {
    it('normalizes ECONNRESET to SqlConnectionError', () => {
      const pgError = new Error('Connection terminated unexpectedly');
      (pgError as { code?: string }).code = 'ECONNRESET';

      const error = normalizePgError(pgError);
      expect(SqlConnectionError.is(error)).toBe(true);
      if (SqlConnectionError.is(error)) {
        expect(error.message).toBe(pgError.message);
        expect(error.transient).toBe(true);
        expect(error.cause).toBe(pgError);
      }
    });

    it('normalizes ETIMEDOUT to SqlConnectionError', () => {
      const pgError = new Error('Connection timeout');
      (pgError as { code?: string }).code = 'ETIMEDOUT';

      const error = normalizePgError(pgError);
      expect(SqlConnectionError.is(error)).toBe(true);
      if (SqlConnectionError.is(error)) {
        expect(error.transient).toBe(true);
        expect(error.cause).toBe(pgError);
      }
    });

    it('normalizes ECONNREFUSED to SqlConnectionError', () => {
      const pgError = new Error('Connection refused');
      (pgError as { code?: string }).code = 'ECONNREFUSED';

      const error = normalizePgError(pgError);
      expect(SqlConnectionError.is(error)).toBe(true);
      if (SqlConnectionError.is(error)) {
        expect(error.transient).toBe(false);
        expect(error.cause).toBe(pgError);
      }
    });

    it('normalizes connection error from message', () => {
      const pgError = new Error('Connection terminated unexpectedly');

      const error = normalizePgError(pgError);
      expect(SqlConnectionError.is(error)).toBe(true);
      if (SqlConnectionError.is(error)) {
        expect(error.cause).toBe(pgError);
      }
    });

    it('classifies connection timeout messages as transient', () => {
      const pgError = new Error('Connection timeout while opening socket');
      (pgError as { code?: string }).code = 'CUSTOM_TRANSPORT_CODE';

      const error = normalizePgError(pgError);
      expect(SqlConnectionError.is(error)).toBe(true);
      if (SqlConnectionError.is(error)) {
        expect(error.transient).toBe(true);
        expect(error.cause).toBe(pgError);
      }
    });

    it('normalizes connection closed error from message', () => {
      const pgError = new Error('Connection closed');

      const error = normalizePgError(pgError);
      expect(SqlConnectionError.is(error)).toBe(true);
    });
  });

  describe('Unknown errors', () => {
    it('returns Error for non-Error values', () => {
      const error1 = normalizePgError('string error');
      expect(error1).toBeInstanceOf(Error);
      expect(error1.message).toBe('string error');

      const error2 = normalizePgError(123);
      expect(error2).toBeInstanceOf(Error);
      expect(error2.message).toBe('123');
    });

    it('returns errors without recognized codes or messages as-is', () => {
      const unknownError = new Error('Some unknown error');
      (unknownError as { code?: string }).code = 'UNKNOWN_CODE';

      const error = normalizePgError(unknownError);
      expect(error).toBe(unknownError);
    });

    it('preserves original error when returning as-is', () => {
      const originalError = new Error('Unknown error');
      originalError.stack = 'Error: Unknown error\n    at test.js:1:1';

      const error = normalizePgError(originalError);
      expect(error).toBe(originalError);
      expect(error.stack).toBe('Error: Unknown error\n    at test.js:1:1');
    });
  });

  describe('Stack trace preservation', () => {
    it('preserves original stack trace via cause for SqlQueryError', () => {
      const pgError = new Error('Query failed');
      pgError.stack = 'Error: Query failed\n    at query.js:10:5';
      (pgError as { code?: string }).code = '23505';

      const error = normalizePgError(pgError);
      expect(SqlQueryError.is(error)).toBe(true);
      if (SqlQueryError.is(error)) {
        expect(error.cause).toBe(pgError);
        if (error.cause instanceof Error) {
          expect(error.cause.stack).toBe('Error: Query failed\n    at query.js:10:5');
        }
      }
    });

    it('preserves original stack trace via cause for SqlConnectionError', () => {
      const pgError = new Error('Connection failed');
      pgError.stack = 'Error: Connection failed\n    at connect.js:5:3';
      (pgError as { code?: string }).code = 'ECONNRESET';

      const error = normalizePgError(pgError);
      expect(SqlConnectionError.is(error)).toBe(true);
      if (SqlConnectionError.is(error)) {
        expect(error.cause).toBe(pgError);
        if (error.cause instanceof Error) {
          expect(error.cause.stack).toBe('Error: Connection failed\n    at connect.js:5:3');
        }
      }
    });
  });
});

describe('isAlreadyConnectedError', () => {
  it('returns false for non-Error values', () => {
    expect(isAlreadyConnectedError('already connected')).toBe(false);
  });
});

describe('isPostgresError', () => {
  describe('Postgres SQLSTATE errors', () => {
    it('returns true for errors with SQLSTATE codes', () => {
      const pgError = new Error('duplicate key value violates unique constraint');
      (pgError as { code?: string }).code = '23505';

      expect(isPostgresError(pgError)).toBe(true);
    });

    it('returns true for errors with SQLSTATE codes and pg-specific properties', () => {
      const pgError = new Error('duplicate key value violates unique constraint');
      (pgError as { code?: string }).code = '23505';
      (pgError as { constraint?: string }).constraint = 'user_email_unique';
      (pgError as { table?: string }).table = 'user';

      expect(isPostgresError(pgError)).toBe(true);
    });
  });

  describe('Postgres errors with pg-specific properties', () => {
    it('returns true for errors with constraint property', () => {
      const pgError = new Error('constraint violation');
      (pgError as { constraint?: string }).constraint = 'user_email_unique';

      expect(isPostgresError(pgError)).toBe(true);
    });

    it('returns true for errors with table property', () => {
      const pgError = new Error('table error');
      (pgError as { table?: string }).table = 'user';

      expect(isPostgresError(pgError)).toBe(true);
    });

    it('returns true for errors with column property', () => {
      const pgError = new Error('column error');
      (pgError as { column?: string }).column = 'email';

      expect(isPostgresError(pgError)).toBe(true);
    });
  });

  describe('Node.js system errors', () => {
    it('returns false for ENOENT errors', async () => {
      // File system operation on non-existent file - fast and reliable
      const nodeError = (await access('/this/file/definitely/does/not/exist-12345').catch(
        (error) => error,
      )) as Error & { code: string };

      expect(nodeError.code).toBe('ENOENT');
      expect(isPostgresError(nodeError)).toBe(false);
    });
  });

  describe('Other errors', () => {
    it('returns false for errors without code or pg-specific properties', () => {
      const genericError = new Error('Some generic error');

      expect(isPostgresError(genericError)).toBe(false);
    });

    it('returns false for non-Error values', () => {
      expect(isPostgresError('string')).toBe(false);
      expect(isPostgresError(123)).toBe(false);
      expect(isPostgresError(null)).toBe(false);
      expect(isPostgresError(undefined)).toBe(false);
    });

    it('returns false for errors with unknown code format', () => {
      const unknownError = new Error('Unknown error');
      (unknownError as { code?: string }).code = 'UNKNOWN_CODE';

      expect(isPostgresError(unknownError)).toBe(false);
    });
  });
});
