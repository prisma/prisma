import type { TypeCast } from 'mysql2';
import { describe, expect, it } from 'vitest';
import { normalizeMysqlError } from '../src/core/normalize-error';
import { serverText } from '../src/core/server-text';

type Field = Parameters<Extract<TypeCast, (...args: never[]) => unknown>>[0];

function field(type: string) {
  const calls: string[] = [];
  const value = {
    type,
    string: (encoding?: string) => {
      calls.push(`string:${encoding}`);
      return 'text';
    },
    buffer: () => {
      calls.push('buffer');
      return Buffer.from('bytes');
    },
  } as unknown as Field;
  return { value, calls };
}

const cast = serverText as Extract<TypeCast, (...args: never[]) => unknown>;

describe('serverText', () => {
  it.each([
    ['LONG', 'string:utf8'],
    ['LONGLONG', 'string:utf8'],
    ['NEWDECIMAL', 'string:utf8'],
    ['DATETIME', 'string:utf8'],
    ['TIMESTAMP', 'string:utf8'],
    ['JSON', 'string:utf8'],
    ['BIT', 'buffer'],
    ['GEOMETRY', 'buffer'],
  ])('reads a %s column with %s', (type, call) => {
    const { value, calls } = field(type);
    cast(value, () => 'next');
    expect(calls).toEqual([call]);
  });

  it.each(['BLOB', 'VAR_STRING', 'STRING', 'LONG_BLOB'])(
    'leaves a %s column to mysql2, which reads a binary one as bytes and any other as text',
    (type) => {
      const { value, calls } = field(type);
      expect(cast(value, () => 'next')).toBe('next');
      expect(calls).toEqual([]);
    },
  );
});

describe('normalizeMysqlError', () => {
  it('turns an error MySQL reports into a SqlQueryError with its SQLSTATE', () => {
    const error = Object.assign(new Error('raw'), {
      sqlState: '42S02',
      sqlMessage: "Table 'x' doesn't exist",
    });
    expect(normalizeMysqlError(error)).toEqual(
      expect.objectContaining({
        kind: 'sql_query',
        sqlState: '42S02',
        message: "Table 'x' doesn't exist",
      }),
    );
  });

  it('leaves any other error as it is', () => {
    const error = new Error('socket hang up');
    expect(normalizeMysqlError(error)).toBe(error);
  });
});
