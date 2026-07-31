import { describe, expect, it } from 'vitest';
import type { AggregateDescriptor } from '../src/shared/aggregate-descriptor';
import { settleAggregateOverloads } from '../src/shared/aggregate-overloads';

const codecs = [
  { codecId: 'lib/int4@1', traits: ['numeric', 'order'] as const },
  { codecId: 'lib/int8@1', traits: ['numeric', 'order'] as const },
  { codecId: 'lib/text@1', traits: ['textual', 'order'] as const },
];

const countAnything: AggregateDescriptor = {
  operation: 'count',
  input: { kind: 'any' },
  output: { kind: 'codec', codecId: 'lib/int8@1' },
  nullable: false,
};

const countRows: AggregateDescriptor = {
  operation: 'count',
  input: { kind: 'none' },
  output: { kind: 'codec', codecId: 'lib/int8@1' },
  nullable: false,
};

const sumNumeric: AggregateDescriptor = {
  operation: 'sum',
  input: { kind: 'trait', trait: 'numeric' },
  output: { kind: 'codec', codecId: 'lib/int8@1' },
  nullable: true,
};

const sumInt8: AggregateDescriptor = {
  operation: 'sum',
  input: { kind: 'codec', codecId: 'lib/int8@1' },
  output: { kind: 'self' },
  nullable: true,
};

function operation(
  settled: ReturnType<typeof settleAggregateOverloads>,
  name: string,
): { byCodecId: ReadonlyMap<string, AggregateDescriptor>; noInput?: unknown; anyInput?: unknown } {
  const entry = settled.operations.get(name);
  if (entry === undefined) throw new Error(`no settled entry for '${name}'`);
  return entry;
}

describe('settleAggregateOverloads', () => {
  it('serves a codec its exact overload', () => {
    const settled = settleAggregateOverloads([sumNumeric, sumInt8], codecs);

    expect(operation(settled, 'sum').byCodecId.get('lib/int8@1')).toBe(sumInt8);
  });

  it('serves a codec the trait overload whose trait it carries', () => {
    const settled = settleAggregateOverloads([sumNumeric, sumInt8], codecs);

    expect(operation(settled, 'sum').byCodecId.get('lib/int4@1')).toBe(sumNumeric);
  });

  it('leaves a codec no trait claims unserved', () => {
    const settled = settleAggregateOverloads([sumNumeric], codecs);

    expect(operation(settled, 'sum').byCodecId.has('lib/text@1')).toBe(false);
  });

  it('expands trait overloads over the codecs it is given and no others', () => {
    const settled = settleAggregateOverloads([sumNumeric], [codecs[0]!]);

    expect([...operation(settled, 'sum').byCodecId.keys()]).toEqual(['lib/int4@1']);
  });

  it('keeps an exact overload for a codec outside the given set', () => {
    const settled = settleAggregateOverloads([sumInt8], []);

    expect(operation(settled, 'sum').byCodecId.get('lib/int8@1')).toBe(sumInt8);
  });

  it('holds the no-input and input-agnostic overloads apart', () => {
    const settled = settleAggregateOverloads([countAnything, countRows], codecs);
    const count = operation(settled, 'count');

    expect(count.noInput).toBe(countRows);
    expect(count.anyInput).toBe(countAnything);
    expect([...count.byCodecId.keys()]).toEqual([]);
  });

  it('reports a codec two trait overloads both claim', () => {
    const settled = settleAggregateOverloads(
      [sumNumeric, { ...sumNumeric, input: { kind: 'trait', trait: 'order' } }],
      codecs,
    );

    expect(settled.ambiguities).toEqual([
      { operation: 'sum', codecId: 'lib/int4@1', traits: ['numeric', 'order'] },
      { operation: 'sum', codecId: 'lib/int8@1', traits: ['numeric', 'order'] },
    ]);
  });

  it('reports no ambiguity where an exact overload settles the codec', () => {
    const settled = settleAggregateOverloads(
      [
        sumNumeric,
        { ...sumNumeric, input: { kind: 'trait', trait: 'order' } },
        { ...sumInt8, input: { kind: 'codec', codecId: 'lib/int4@1' } },
      ],
      [codecs[0]!],
    );

    expect(settled.ambiguities).toEqual([]);
  });
});
