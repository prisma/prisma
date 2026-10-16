import { describe, expect, it } from 'vitest';
import { parseInferredDefault } from '../../src/core/psl-infer/infer-default-parser';

describe('parseInferredDefault ARRAY[...] constructors', () => {
  it('reads a text array constructor with per-element casts', () => {
    expect(parseInferredDefault("ARRAY['a'::text, 'b'::text]", 'text[]')).toEqual({
      kind: 'literal',
      value: ['a', 'b'],
    });
  });

  it('reads a numeric array constructor', () => {
    expect(parseInferredDefault('ARRAY[1, 2]', 'integer[]')).toEqual({
      kind: 'literal',
      value: [1, 2],
    });
  });

  it('reads enum element casts, quoted and schema-qualified', () => {
    expect(parseInferredDefault('ARRAY[\'x\'::"MyEnum"]', 'MyEnum[]')).toEqual({
      kind: 'literal',
      value: ['x'],
    });
    expect(
      parseInferredDefault('ARRAY[\'x\'::sch."MyEnum", \'y\'::sch."MyEnum"]', 'sch.MyEnum[]'),
    ).toEqual({
      kind: 'literal',
      value: ['x', 'y'],
    });
  });

  it('keeps commas and doubled quotes inside an element', () => {
    expect(parseInferredDefault("ARRAY['it''s, ok'::text, 'b'::text]", 'text[]')).toEqual({
      kind: 'literal',
      value: ["it's, ok", 'b'],
    });
  });

  it('reads an empty constructor and a cast constructor', () => {
    expect(parseInferredDefault('ARRAY[]::text[]', 'text[]')).toEqual({
      kind: 'literal',
      value: [],
    });
    expect(parseInferredDefault("ARRAY['a', 'b']::text[]", 'text[]')).toEqual({
      kind: 'literal',
      value: ['a', 'b'],
    });
  });

  it('fails closed for an element it cannot read', () => {
    expect(parseInferredDefault('ARRAY[now()]', 'timestamptz[]')?.kind).toBe('function');
  });
});

describe('parseInferredDefault ARRAY[...] elements Postgres prints with a cast', () => {
  it.each([
    { raw: "ARRAY['-1'::integer, 2]", nativeType: 'int4[]', value: [-1, 2] },
    { raw: 'ARRAY[(1)::bigint, (2)::bigint]', nativeType: 'int8[]', value: ['1', '2'] },
    {
      raw: "ARRAY[('-1'::integer)::bigint, (2)::bigint]",
      nativeType: 'int8[]',
      value: ['-1', '2'],
    },
    {
      raw: 'ARRAY[(1.5)::double precision, (2)::double precision]',
      nativeType: 'float8[]',
      value: [1.5, 2],
    },
    {
      raw: "ARRAY[('-1.5'::numeric)::double precision, (2)::double precision]",
      nativeType: 'float8[]',
      value: [-1.5, 2],
    },
    { raw: 'ARRAY[1.5::numeric(65,30)]', nativeType: 'numeric(65,30)[]', value: ['1.5'] },
    {
      raw: "ARRAY['-1.5'::numeric(65,30), (2)::numeric(65,30)]",
      nativeType: 'numeric(65,30)[]',
      value: ['-1.5', '2'],
    },
    {
      raw: 'ARRAY[12345678901234567890.123456789::numeric(65,30)]',
      nativeType: 'numeric(65,30)[]',
      value: ['12345678901234567890.123456789'],
    },
    {
      raw: "ARRAY[1.5::numeric(10,2), '-2.25'::numeric(10,2)]",
      nativeType: 'numeric(10,2)[]',
      value: ['1.5', '-2.25'],
    },
    { raw: 'ARRAY[(2)::numeric(10,2)]', nativeType: 'numeric(10,2)[]', value: ['2'] },
    {
      raw: "ARRAY['100'::numeric(5,-2), '-9999900'::numeric(5,-2)]",
      nativeType: 'numeric(5,-2)[]',
      value: ['100', '-9999900'],
    },
    {
      raw: "ARRAY[('-1'::integer)::smallint, (2)::smallint]",
      nativeType: 'int2[]',
      value: [-1, 2],
    },
    { raw: 'ARRAY[(1.1)::real]', nativeType: 'float4[]', value: [1.1] },
    {
      raw: "ARRAY['2024-01-01 00:00:00'::timestamp(3) without time zone]",
      nativeType: 'timestamp(3)[]',
      value: ['2024-01-01T00:00:00'],
    },
    {
      raw: "ARRAY['2024-01-01 00:00:00+00'::timestamp(3) with time zone]",
      nativeType: 'timestamptz(3)[]',
      value: ['2024-01-01T00:00:00Z'],
    },
  ])('reads $raw by each element cast', ({ raw, nativeType, value }) => {
    expect(parseInferredDefault(raw, nativeType)).toEqual({ kind: 'literal', value });
  });

  it.each([
    {
      raw: '(ARRAY[]::character varying[])::character varying(32)[]',
      nativeType: 'character varying(32)[]',
      value: [],
    },
    {
      raw: "(ARRAY['a'::character varying])::character varying(32)[]",
      nativeType: 'character varying(32)[]',
      value: ['a'],
    },
  ])('unwraps the outer cast in $raw', ({ raw, nativeType, value }) => {
    expect(parseInferredDefault(raw, nativeType)).toEqual({ kind: 'literal', value });
  });

  it('reads an empty constructor cast to a multi-word type', () => {
    expect(parseInferredDefault('ARRAY[]::character varying[]', 'character varying[]')).toEqual({
      kind: 'literal',
      value: [],
    });
  });
});

describe('parseInferredDefault uuid ARRAY[...] elements', () => {
  it('reads each element as the text Postgres prints', () => {
    expect(
      parseInferredDefault(
        "ARRAY['A0EEBC99-9C0B-4EF8-BB6D-6BB9BD380A11'::uuid, '{B0EEBC99-9C0B4EF8-BB6D6BB9-BD380A11}'::uuid]",
        'uuid[]',
      ),
    ).toEqual({
      kind: 'literal',
      value: ['a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'],
    });
  });
});
