import { describe, expect, it } from 'vitest';
import { parseRawDefault } from '../../src/core/psl-contract-infer/raw-default-parser';

describe('parseRawDefault', () => {
  it('recognizes nextval (autoincrement)', () => {
    expect(parseRawDefault("nextval('user_id_seq'::regclass)")).toEqual({
      kind: 'function',
      expression: 'autoincrement()',
    });
  });

  it('recognizes now()', () => {
    expect(parseRawDefault('now()')).toEqual({ kind: 'function', expression: 'now()' });
  });

  it('recognizes CURRENT_TIMESTAMP', () => {
    expect(parseRawDefault('CURRENT_TIMESTAMP')).toEqual({
      kind: 'function',
      expression: 'now()',
    });
  });

  it('recognizes clock_timestamp()', () => {
    expect(parseRawDefault('clock_timestamp()')).toEqual({
      kind: 'function',
      expression: 'clock_timestamp()',
    });
  });

  it('recognizes timestamp-cast now() defaults', () => {
    expect(parseRawDefault('now()::timestamp')).toEqual({
      kind: 'function',
      expression: 'now()',
    });
    expect(parseRawDefault("('now'::text)::timestamp without time zone")).toEqual({
      kind: 'function',
      expression: 'now()',
    });
  });

  it('recognizes timestamp-cast clock_timestamp() defaults', () => {
    expect(parseRawDefault('clock_timestamp()::timestamp with time zone')).toEqual({
      kind: 'function',
      expression: 'clock_timestamp()',
    });
  });

  it('preserves timestamp string literals when they are not canonical time functions', () => {
    expect(parseRawDefault("'2024-01-01 00:00:00'::timestamp")).toEqual({
      kind: 'literal',
      value: '2024-01-01 00:00:00',
    });
  });

  it('recognizes gen_random_uuid()', () => {
    expect(parseRawDefault('gen_random_uuid()')).toEqual({
      kind: 'function',
      expression: 'gen_random_uuid()',
    });
  });

  it('recognizes uuid_generate_v4()', () => {
    expect(parseRawDefault('uuid_generate_v4()')).toEqual({
      kind: 'function',
      expression: 'gen_random_uuid()',
    });
  });

  it('recognizes boolean true', () => {
    expect(parseRawDefault('true')).toEqual({ kind: 'literal', value: true });
    expect(parseRawDefault('TRUE')).toEqual({ kind: 'literal', value: true });
  });

  it('recognizes boolean false', () => {
    expect(parseRawDefault('false')).toEqual({ kind: 'literal', value: false });
  });

  it('recognizes NULL literals', () => {
    expect(parseRawDefault('NULL::jsonb')).toEqual({ kind: 'literal', value: null });
  });

  it('recognizes integer literals', () => {
    expect(parseRawDefault('42')).toEqual({ kind: 'literal', value: 42 });
    expect(parseRawDefault('-1')).toEqual({ kind: 'literal', value: -1 });
  });

  it('recognizes decimal literals', () => {
    expect(parseRawDefault('3.14')).toEqual({ kind: 'literal', value: 3.14 });
  });

  it('parses large integer literals as numbers (precision loss expected)', () => {
    const result = parseRawDefault('9223372036854775807');
    expect(result).toEqual({
      kind: 'literal',
      value: Number('9223372036854775807'),
    });
  });

  it('recognizes string literals', () => {
    expect(parseRawDefault("'hello'")).toEqual({ kind: 'literal', value: 'hello' });
  });

  it('recognizes string literals with type cast', () => {
    expect(parseRawDefault("'hello'::text")).toEqual({ kind: 'literal', value: 'hello' });
  });

  it('preserves jsonb string defaults as raw expressions when native type context matters', () => {
    expect(parseRawDefault("'{}'::jsonb", 'jsonb')).toEqual({
      kind: 'function',
      expression: "'{}'::jsonb",
    });
  });

  it('parses inline json literals when no cast is present', () => {
    expect(parseRawDefault('\'{"enabled":true}\'', 'json')).toEqual({
      kind: 'literal',
      value: { enabled: true },
    });
  });

  it('falls back to string literals when inline json parsing fails', () => {
    expect(parseRawDefault("'not-json'", 'jsonb')).toEqual({
      kind: 'literal',
      value: 'not-json',
    });
  });

  it('unescapes single quotes in strings', () => {
    expect(parseRawDefault("'it''s'")).toEqual({ kind: 'literal', value: "it's" });
  });

  it('returns unrecognized function expressions as-is', () => {
    expect(parseRawDefault('my_func()')).toEqual({
      kind: 'function',
      expression: 'my_func()',
    });
  });

  it('trims whitespace', () => {
    expect(parseRawDefault('  true  ')).toEqual({ kind: 'literal', value: true });
  });
});
