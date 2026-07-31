import { describe, expect, it } from 'vitest';
import { parsePostgresDefault, postgresResolveDefault } from '../src/core/default-normalizer';

describe('parsePostgresDefault array literals', () => {
  it('parses an empty array body', () => {
    expect(parsePostgresDefault("'{}'::text[]", 'text[]')).toEqual({
      kind: 'literal',
      value: [],
    });
  });

  it('parses a numeric array body', () => {
    expect(parsePostgresDefault("'{1,2}'::integer[]", 'integer[]')).toEqual({
      kind: 'literal',
      value: [1, 2],
    });
  });

  it('parses a quoted-string array body', () => {
    expect(parsePostgresDefault('\'{"a","b"}\'::text[]', 'text[]')).toEqual({
      kind: 'literal',
      value: ['a', 'b'],
    });
  });

  it('parses a NULL element', () => {
    expect(parsePostgresDefault("'{NULL}'::text[]", 'text[]')).toEqual({
      kind: 'literal',
      value: [null],
    });
  });

  it('parses boolean array body', () => {
    expect(parsePostgresDefault("'{true,false}'::boolean[]", 'boolean[]')).toEqual({
      kind: 'literal',
      value: [true, false],
    });
  });

  it('fails closed for ambiguous bool tokens t/f (no literal-array normalization)', () => {
    const result = parsePostgresDefault("'{t,f}'::boolean[]", 'boolean[]');
    expect(result?.kind).not.toBe('literal');
  });

  it('fails closed for an unquoted non-numeric element (no literal-array normalization)', () => {
    const result = parsePostgresDefault("'{hello world}'::text[]", 'text[]');
    expect(result?.kind).not.toBe('literal');
  });

  it('keeps a comma inside a quoted element as part of that element', () => {
    expect(parsePostgresDefault('\'{"a,b","c"}\'::text[]', 'text[]')).toEqual({
      kind: 'literal',
      value: ['a,b', 'c'],
    });
  });

  it('unescapes a doubled quote inside a quoted element', () => {
    expect(parsePostgresDefault('\'{"a""b"}\'::text[]', 'text[]')).toEqual({
      kind: 'literal',
      value: ['a"b'],
    });
  });

  it('unescapes a backslash-escaped quote inside a quoted element', () => {
    expect(parsePostgresDefault('\'{"a\\"b"}\'::text[]', 'text[]')).toEqual({
      kind: 'literal',
      value: ['a"b'],
    });
  });

  it('keeps a quoted element that looks like NULL as the literal string', () => {
    expect(parsePostgresDefault('\'{"NULL"}\'::text[]', 'text[]')).toEqual({
      kind: 'literal',
      value: ['NULL'],
    });
  });

  it('parses negative and decimal numeric elements', () => {
    expect(parsePostgresDefault("'{-1,2.5}'::numeric[]", 'numeric[]')).toEqual({
      kind: 'literal',
      value: [-1, 2.5],
    });
  });

  it('falls back to a function expression for an unterminated quoted element', () => {
    expect(parsePostgresDefault("'{\"abc}'::text[]", 'text[]')).toEqual({
      kind: 'function',
      expression: "'{\"abc}'::text[]",
    });
  });

  it('falls back to a function expression for a trailing backslash inside a quoted element', () => {
    expect(parsePostgresDefault("'{\"a\\}'::text[]", 'text[]')).toEqual({
      kind: 'function',
      expression: "'{\"a\\}'::text[]",
    });
  });

  it('skips array parsing when the value is not a brace-delimited literal', () => {
    expect(parsePostgresDefault('NULL', 'text[]')).toEqual({ kind: 'literal', value: null });
  });

  it('does not treat a brace literal as an array default without an array native type', () => {
    expect(parsePostgresDefault("'{1,2}'::integer[]")).toEqual({
      kind: 'function',
      expression: "'{1,2}'::integer[]",
    });
  });
});

describe('parsePostgresDefault sequences', () => {
  it('normalizes nextval(...) to autoincrement()', () => {
    expect(parsePostgresDefault("nextval('foo_id_seq'::regclass)")).toEqual({
      kind: 'function',
      expression: 'autoincrement()',
    });
  });
});

describe('parsePostgresDefault timestamps', () => {
  it('normalizes now()', () => {
    expect(parsePostgresDefault('now()')).toEqual({ kind: 'function', expression: 'now()' });
  });

  it('normalizes CURRENT_TIMESTAMP', () => {
    expect(parsePostgresDefault('CURRENT_TIMESTAMP')).toEqual({
      kind: 'function',
      expression: 'now()',
    });
  });

  it('normalizes clock_timestamp()', () => {
    expect(parsePostgresDefault('clock_timestamp()')).toEqual({
      kind: 'function',
      expression: 'clock_timestamp()',
    });
  });

  it('normalizes now() with a bare ::timestamp cast suffix', () => {
    expect(parsePostgresDefault('now()::timestamp')).toEqual({
      kind: 'function',
      expression: 'now()',
    });
  });

  it('normalizes clock_timestamp() with a ::timestamptz cast suffix', () => {
    expect(parsePostgresDefault('clock_timestamp()::timestamptz')).toEqual({
      kind: 'function',
      expression: 'clock_timestamp()',
    });
  });

  it('normalizes now() with a "with time zone" cast suffix', () => {
    expect(parsePostgresDefault('now()::timestamp with time zone')).toEqual({
      kind: 'function',
      expression: 'now()',
    });
  });

  it('normalizes CURRENT_TIMESTAMP with a "without time zone" cast suffix', () => {
    expect(parsePostgresDefault('CURRENT_TIMESTAMP::timestamp without time zone')).toEqual({
      kind: 'function',
      expression: 'now()',
    });
  });

  it('unwraps a parenthesized now() before a timestamp cast', () => {
    expect(parsePostgresDefault('(now())::timestamp')).toEqual({
      kind: 'function',
      expression: 'now()',
    });
  });

  it('unwraps a parenthesized clock_timestamp() before a timestamp cast', () => {
    expect(parsePostgresDefault('(clock_timestamp())::timestamptz')).toEqual({
      kind: 'function',
      expression: 'clock_timestamp()',
    });
  });

  it("unwraps a parenthesized 'now'::text before a timestamp cast", () => {
    expect(parsePostgresDefault("('now'::text)::timestamp")).toEqual({
      kind: 'function',
      expression: 'now()',
    });
  });

  it('falls back to a function expression when the parenthesized inner expression is unrecognized', () => {
    expect(parsePostgresDefault('(SELECT 2)::timestamp')).toEqual({
      kind: 'function',
      expression: '(SELECT 2)::timestamp',
    });
  });

  it('falls back to a function expression for an unbalanced leading paren before a timestamp cast', () => {
    expect(parsePostgresDefault('(SELECT 1::timestamp')).toEqual({
      kind: 'function',
      expression: '(SELECT 1::timestamp',
    });
  });

  it('treats a quoted date string with a timestamp cast as a plain string literal, not a timestamp function', () => {
    expect(parsePostgresDefault("'2024-01-01'::timestamp")).toEqual({
      kind: 'literal',
      value: '2024-01-01',
    });
  });
});

describe('parsePostgresDefault UUIDs', () => {
  it('normalizes gen_random_uuid()', () => {
    expect(parsePostgresDefault('gen_random_uuid()')).toEqual({
      kind: 'function',
      expression: 'gen_random_uuid()',
    });
  });

  it('normalizes uuid-ossp uuid_generate_v4() to gen_random_uuid()', () => {
    expect(parsePostgresDefault('uuid_generate_v4()')).toEqual({
      kind: 'function',
      expression: 'gen_random_uuid()',
    });
  });
});

describe('parsePostgresDefault null and boolean literals', () => {
  it('parses a bare NULL', () => {
    expect(parsePostgresDefault('NULL')).toEqual({ kind: 'literal', value: null });
  });

  it('parses a NULL with a type cast', () => {
    expect(parsePostgresDefault('NULL::text')).toEqual({ kind: 'literal', value: null });
  });

  it('parses true', () => {
    expect(parsePostgresDefault('true')).toEqual({ kind: 'literal', value: true });
  });

  it('parses false', () => {
    expect(parsePostgresDefault('false')).toEqual({ kind: 'literal', value: false });
  });
});

describe('parsePostgresDefault numeric literals', () => {
  it('parses a positive integer', () => {
    expect(parsePostgresDefault('42')).toEqual({ kind: 'literal', value: 42 });
  });

  it('parses a negative decimal', () => {
    expect(parsePostgresDefault('-3.14')).toEqual({ kind: 'literal', value: -3.14 });
  });

  it('returns undefined for a numeral too large to represent as a finite number', () => {
    const hugeDigits = `1${'0'.repeat(400)}`;
    expect(parsePostgresDefault(hugeDigits)).toBeUndefined();
  });

  it('reads a bigint-typed integer as decimal text', () => {
    expect(parsePostgresDefault('123', 'bigint')).toEqual({ kind: 'literal', value: '123' });
  });

  it('reads a bigint-typed integer past the safe range as decimal text', () => {
    expect(parsePostgresDefault('9007199254740993', 'int8')).toEqual({
      kind: 'literal',
      value: '9007199254740993',
    });
  });
});

describe('parsePostgresDefault string literals', () => {
  it('parses a plain string literal', () => {
    expect(parsePostgresDefault("'hello'")).toEqual({ kind: 'literal', value: 'hello' });
  });

  it('unescapes a doubled single quote', () => {
    expect(parsePostgresDefault("'it''s'")).toEqual({ kind: 'literal', value: "it's" });
  });

  it('strips a word-based type cast suffix', () => {
    expect(parsePostgresDefault("'hello'::character varying")).toEqual({
      kind: 'literal',
      value: 'hello',
    });
  });

  it('strips a quoted custom-type cast suffix', () => {
    expect(parsePostgresDefault('\'hello\'::"CustomEnum"')).toEqual({
      kind: 'literal',
      value: 'hello',
    });
  });

  it('strips a sized type cast suffix', () => {
    expect(parsePostgresDefault("'hello'::character varying(10)")).toEqual({
      kind: 'literal',
      value: 'hello',
    });
  });

  it('parses valid json content for a json column into its structured value', () => {
    expect(parsePostgresDefault('\'{"a":1}\'', 'json')).toEqual({
      kind: 'literal',
      value: { a: 1 },
    });
  });

  it('parses valid json content for a jsonb column into its structured value', () => {
    expect(parsePostgresDefault("'[1,2,3]'", 'jsonb')).toEqual({
      kind: 'literal',
      value: [1, 2, 3],
    });
  });

  it('keeps malformed json content as a raw string when it fails to parse', () => {
    expect(parsePostgresDefault("'not valid json'", 'json')).toEqual({
      kind: 'literal',
      value: 'not valid json',
    });
  });

  it('reads a quoted bigint-typed numeral as decimal text', () => {
    expect(parsePostgresDefault("'123'", 'bigint')).toEqual({ kind: 'literal', value: '123' });
  });

  it('reads a quoted bigint-typed numeral past the safe range as decimal text', () => {
    expect(parsePostgresDefault("'9007199254740993'", 'bigint')).toEqual({
      kind: 'literal',
      value: '9007199254740993',
    });
  });

  it('keeps a bigint-typed non-numeric string as-is', () => {
    expect(parsePostgresDefault("'abc'", 'bigint')).toEqual({ kind: 'literal', value: 'abc' });
  });

  it('does not coerce a numeric-looking string default without a bigint type', () => {
    expect(parsePostgresDefault("'123'")).toEqual({ kind: 'literal', value: '123' });
  });
});

describe('parsePostgresDefault unparseable expressions', () => {
  it('falls back to a raw function expression for an arbitrary SQL expression', () => {
    expect(parsePostgresDefault('some_custom_function(1, 2)')).toEqual({
      kind: 'function',
      expression: 'some_custom_function(1, 2)',
    });
  });
});

describe('postgresResolveDefault', () => {
  // The contract-derived (expected) side's `resolveDefault` hook, called at
  // `SchemaIR` construction so the expected side normalizes a `dbgenerated`
  // literal-shaped function default the same way introspection does. If this
  // ever passes the contract default through unnormalized, `db verify`
  // reports permanent drift for a jsonb/text[] literal default that matches
  // the live database exactly.

  it('a literal default passes through unchanged', () => {
    const literal = { kind: 'literal' as const, value: 'draft' };
    expect(postgresResolveDefault(literal, 'text')).toEqual(literal);
  });

  it('resolves a dbgenerated jsonb literal to a literal object, matching introspection', () => {
    const result = postgresResolveDefault({ kind: 'function', expression: "'{}'::jsonb" }, 'jsonb');
    expect(result).toEqual({ kind: 'literal', value: {} });
  });

  it('resolves a dbgenerated text[] literal to a literal array, matching introspection', () => {
    const result = postgresResolveDefault(
      { kind: 'function', expression: "'{}'::text[]" },
      'text[]',
    );
    expect(result).toEqual({ kind: 'literal', value: [] });
  });

  it('normalizes a dbgenerated nextval(...) to autoincrement(), matching a serial/identity column', () => {
    const result = postgresResolveDefault(
      { kind: 'function', expression: "nextval('my_seq'::regclass)" },
      'int4',
    );
    expect(result).toEqual({ kind: 'function', expression: 'autoincrement()' });
  });

  it('keeps gen_random_uuid() a function, unresolved', () => {
    const expression = 'gen_random_uuid()';
    expect(postgresResolveDefault({ kind: 'function', expression }, 'uuid')).toEqual({
      kind: 'function',
      expression,
    });
  });

  it('keeps a now()-plus-interval expression a function, unresolved', () => {
    const expression = "(now() + '00:03:00'::interval)";
    expect(postgresResolveDefault({ kind: 'function', expression }, 'timestamptz')).toEqual({
      kind: 'function',
      expression,
    });
  });

  it('keeps an enum-cast literal a function (unqualified cast type defeats the string-literal pattern)', () => {
    const expression = "'confidential'::auth.oauth_client_type";
    expect(postgresResolveDefault({ kind: 'function', expression }, 'oauth_client_type')).toEqual({
      kind: 'function',
      expression,
    });
  });
});
