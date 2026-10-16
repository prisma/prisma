import { describe, expect, it } from 'vitest';
import { parseInferredDefault } from '../../src/core/psl-infer/infer-default-parser';

describe('parseInferredDefault sequences', () => {
  it('normalizes nextval(...) to autoincrement()', () => {
    expect(parseInferredDefault("nextval('foo_id_seq'::regclass)")).toEqual({
      kind: 'function',
      expression: 'autoincrement()',
    });
  });
});

describe('parseInferredDefault timestamps', () => {
  it('normalizes now()', () => {
    expect(parseInferredDefault('now()')).toEqual({ kind: 'function', expression: 'now()' });
  });

  it('normalizes CURRENT_TIMESTAMP', () => {
    expect(parseInferredDefault('CURRENT_TIMESTAMP')).toEqual({
      kind: 'function',
      expression: 'now()',
    });
  });

  it('normalizes clock_timestamp()', () => {
    expect(parseInferredDefault('clock_timestamp()')).toEqual({
      kind: 'function',
      expression: 'clock_timestamp()',
    });
  });

  it('normalizes now() with a bare ::timestamp cast suffix', () => {
    expect(parseInferredDefault('now()::timestamp')).toEqual({
      kind: 'function',
      expression: 'now()',
    });
  });

  it('normalizes clock_timestamp() with a ::timestamptz cast suffix', () => {
    expect(parseInferredDefault('clock_timestamp()::timestamptz')).toEqual({
      kind: 'function',
      expression: 'clock_timestamp()',
    });
  });

  it('normalizes now() with a "with time zone" cast suffix', () => {
    expect(parseInferredDefault('now()::timestamp with time zone')).toEqual({
      kind: 'function',
      expression: 'now()',
    });
  });

  it('normalizes CURRENT_TIMESTAMP with a "without time zone" cast suffix', () => {
    expect(parseInferredDefault('CURRENT_TIMESTAMP::timestamp without time zone')).toEqual({
      kind: 'function',
      expression: 'now()',
    });
  });

  it('unwraps a parenthesized now() before a timestamp cast', () => {
    expect(parseInferredDefault('(now())::timestamp')).toEqual({
      kind: 'function',
      expression: 'now()',
    });
  });

  it('unwraps a parenthesized clock_timestamp() before a timestamp cast', () => {
    expect(parseInferredDefault('(clock_timestamp())::timestamptz')).toEqual({
      kind: 'function',
      expression: 'clock_timestamp()',
    });
  });

  it("unwraps a parenthesized 'now'::text before a timestamp cast", () => {
    expect(parseInferredDefault("('now'::text)::timestamp")).toEqual({
      kind: 'function',
      expression: 'now()',
    });
  });

  it('falls back to a function expression when the parenthesized inner expression is unrecognized', () => {
    expect(parseInferredDefault('(SELECT 2)::timestamp')).toEqual({
      kind: 'function',
      expression: '(SELECT 2)::timestamp',
    });
  });

  it('falls back to a function expression for an unbalanced leading paren before a timestamp cast', () => {
    expect(parseInferredDefault('(SELECT 1::timestamp')).toEqual({
      kind: 'function',
      expression: '(SELECT 1::timestamp',
    });
  });

  it('treats a quoted date string with a timestamp cast as a plain string literal, not a timestamp function', () => {
    expect(parseInferredDefault("'2024-01-01'::timestamp")).toEqual({
      kind: 'literal',
      value: '2024-01-01',
    });
  });
});

describe('parseInferredDefault UUIDs', () => {
  it('normalizes gen_random_uuid()', () => {
    expect(parseInferredDefault('gen_random_uuid()')).toEqual({
      kind: 'function',
      expression: 'gen_random_uuid()',
    });
  });

  it('normalizes uuid-ossp uuid_generate_v4() to gen_random_uuid()', () => {
    expect(parseInferredDefault('uuid_generate_v4()')).toEqual({
      kind: 'function',
      expression: 'gen_random_uuid()',
    });
  });
});

describe('parseInferredDefault unparseable expressions', () => {
  it('falls back to a raw function expression for an arbitrary SQL expression', () => {
    expect(parseInferredDefault('some_custom_function(1, 2)')).toEqual({
      kind: 'function',
      expression: 'some_custom_function(1, 2)',
    });
  });
});

describe('parseInferredDefault expressions that are not literals', () => {
  it.each([
    { raw: '(- (1.5)::double precision)', nativeType: 'float8' },
    { raw: '(- 1.5::numeric(10,2))', nativeType: 'numeric(10,2)' },
    { raw: '((1 + 2))::bigint', nativeType: 'int8' },
    { raw: "('a'::text || 'b'::text)", nativeType: 'text' },
    { raw: 'round(1.555, 2)', nativeType: 'numeric' },
    { raw: 'ARRAY[(1 + 1)]', nativeType: 'int4[]' },
    { raw: 'ARRAY[ARRAY[1, 2]]', nativeType: 'int4[]' },
    { raw: '(1.5)::integer', nativeType: 'int4' },
    { raw: 'ARRAY[(1.5)::integer]', nativeType: 'int4[]' },
    { raw: "('now'::text)::date", nativeType: 'date' },
    { raw: "ARRAY[('today'::text)::date]", nativeType: 'date[]' },
  ])('keeps $raw a raw expression', ({ raw, nativeType }) => {
    expect(parseInferredDefault(raw, nativeType)).toEqual({ kind: 'function', expression: raw });
  });
});
