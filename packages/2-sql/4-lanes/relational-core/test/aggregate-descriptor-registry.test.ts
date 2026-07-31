import type { CodecTrait } from '@prisma-next/framework-components/codec';
import { describe, expect, it } from 'vitest';
import type { SqlAggregateDescriptor } from '../src/aggregate-descriptor';
import { buildSqlAggregateDescriptorRegistry } from '../src/aggregate-descriptor-registry';
import type { AnyCodecDescriptor } from '../src/ast/codec-types';
import { LiteralExpr } from '../src/ast/types';
import { buildCodecDescriptorRegistry } from '../src/codec-descriptor-registry';

const codecStub = (codecId: string, traits: readonly CodecTrait[]): AnyCodecDescriptor =>
  ({
    codecId,
    traits,
    targetTypes: [],
    isParameterized: false,
    paramsSchema: undefined,
    factory: () => () => ({ id: codecId }) as never,
  }) as unknown as AnyCodecDescriptor;

const codecs = buildCodecDescriptorRegistry([
  codecStub('lib/int4@1', ['numeric', 'order', 'equality']),
  codecStub('lib/int8@1', ['numeric', 'order', 'equality']),
  codecStub('lib/numeric@1', ['numeric', 'order', 'equality']),
  codecStub('lib/text@1', ['textual', 'order', 'equality']),
]);

const countRows: SqlAggregateDescriptor = {
  operation: 'count',
  input: { kind: 'none' },
  output: { kind: 'codec', codecId: 'lib/int8@1' },
  nullable: false,
};

const sumNumeric: SqlAggregateDescriptor = {
  operation: 'sum',
  input: { kind: 'trait', trait: 'numeric' },
  output: { kind: 'codec', codecId: 'lib/int8@1' },
  nullable: true,
};

const sumInt8: SqlAggregateDescriptor = {
  operation: 'sum',
  input: { kind: 'codec', codecId: 'lib/int8@1' },
  output: { kind: 'codec', codecId: 'lib/numeric@1' },
  nullable: true,
};

const maxOrdered: SqlAggregateDescriptor = {
  operation: 'max',
  input: { kind: 'trait', trait: 'order' },
  output: { kind: 'self' },
  nullable: true,
};

describe('buildSqlAggregateDescriptorRegistry — resolution', () => {
  it('resolves a no-input operation to its declared output codec', () => {
    const registry = buildSqlAggregateDescriptorRegistry([countRows], codecs);

    expect(registry.resolve('count')).toEqual({
      operation: 'count',
      output: { codecId: 'lib/int8@1' },
      nullable: false,
      lower: undefined,
    });
  });

  it('resolves a trait match when no exact descriptor claims the input codec', () => {
    const registry = buildSqlAggregateDescriptorRegistry([sumNumeric, sumInt8], codecs);

    expect(registry.resolve('sum', { codecId: 'lib/int4@1' })?.output).toEqual({
      codecId: 'lib/int8@1',
    });
  });

  it('prefers an exact codec match over a trait match', () => {
    const registry = buildSqlAggregateDescriptorRegistry([sumNumeric, sumInt8], codecs);

    expect(registry.resolve('sum', { codecId: 'lib/int8@1' })?.output).toEqual({
      codecId: 'lib/numeric@1',
    });
  });

  it('prefers an exact codec match regardless of contribution order', () => {
    const registry = buildSqlAggregateDescriptorRegistry([sumInt8, sumNumeric], codecs);

    expect(registry.resolve('sum', { codecId: 'lib/int8@1' })?.output).toEqual({
      codecId: 'lib/numeric@1',
    });
  });

  it('matches an exact descriptor for a codec the codec registry does not know', () => {
    const registry = buildSqlAggregateDescriptorRegistry(
      [{ ...sumInt8, input: { kind: 'codec', codecId: 'ext/money@1' } }],
      codecs,
    );

    expect(registry.resolve('sum', { codecId: 'ext/money@1' })?.output).toEqual({
      codecId: 'lib/numeric@1',
    });
  });

  it('carries the declared nullability of the matched descriptor', () => {
    const registry = buildSqlAggregateDescriptorRegistry([countRows, sumNumeric], codecs);

    expect(registry.resolve('count')?.nullable).toBe(false);
    expect(registry.resolve('sum', { codecId: 'lib/int4@1' })?.nullable).toBe(true);
  });

  it('returns the input codec, type parameters included, for a self output', () => {
    const registry = buildSqlAggregateDescriptorRegistry([maxOrdered], codecs);

    expect(
      registry.resolve('max', { codecId: 'lib/numeric@1', typeParams: { precision: 10 } }),
    ).toEqual({
      operation: 'max',
      output: { codecId: 'lib/numeric@1', typeParams: { precision: 10 } },
      nullable: true,
      lower: undefined,
    });
  });

  it('resolves output type parameters from the input reference', () => {
    const registry = buildSqlAggregateDescriptorRegistry(
      [
        {
          ...sumNumeric,
          output: {
            kind: 'codec',
            codecId: 'lib/numeric@1',
            typeParams: (input: { typeParams?: unknown } | undefined) => input?.typeParams,
          },
        },
      ],
      codecs,
    );

    expect(
      registry.resolve('sum', { codecId: 'lib/int4@1', typeParams: { precision: 4 } })?.output,
    ).toEqual({ codecId: 'lib/numeric@1', typeParams: { precision: 4 } });
  });

  it('reports the declared output codec even when lowering builds an unrelated expression', () => {
    const lower = () => LiteralExpr.of('lowered');
    const registry = buildSqlAggregateDescriptorRegistry([{ ...sumNumeric, lower }], codecs);

    const resolved = registry.resolve('sum', { codecId: 'lib/int4@1' });

    expect(resolved?.output).toEqual({ codecId: 'lib/int8@1' });
    expect(resolved?.lower).toBe(lower);
  });

  it('returns undefined for an unregistered operation', () => {
    const registry = buildSqlAggregateDescriptorRegistry([countRows], codecs);

    expect(registry.resolve('stddev', { codecId: 'lib/int4@1' })).toBeUndefined();
  });

  it('returns undefined when no descriptor claims the input codec', () => {
    const registry = buildSqlAggregateDescriptorRegistry([sumNumeric], codecs);

    expect(registry.resolve('sum', { codecId: 'lib/text@1' })).toBeUndefined();
  });

  it('returns undefined when an operation requires an input and none is supplied', () => {
    const registry = buildSqlAggregateDescriptorRegistry([sumNumeric], codecs);

    expect(registry.resolve('sum')).toBeUndefined();
  });

  it('values() yields every validated descriptor', () => {
    const registry = buildSqlAggregateDescriptorRegistry([countRows, sumNumeric], codecs);

    expect([...registry.values()]).toEqual([countRows, sumNumeric]);
  });
});

describe('buildSqlAggregateDescriptorRegistry — composition-time validation', () => {
  it('rejects a duplicate operation and input pair', () => {
    expect(() =>
      buildSqlAggregateDescriptorRegistry([sumNumeric, { ...sumNumeric, nullable: false }], codecs),
    ).toThrow(/Duplicate aggregate descriptor for 'sum:trait:numeric'/);
  });

  it('rejects a malformed contribution', () => {
    expect(() =>
      buildSqlAggregateDescriptorRegistry([{ operation: 'sum', nullable: true }], codecs),
    ).toThrow(/is not a valid SQL aggregate descriptor/);
  });

  it('rejects a non-function lowering hook', () => {
    expect(() =>
      buildSqlAggregateDescriptorRegistry([{ ...sumNumeric, lower: 'sum(x)' }], codecs),
    ).toThrow(/is not a valid SQL aggregate descriptor/);
  });

  it('rejects two trait descriptors that both claim a registered codec', () => {
    expect(() =>
      buildSqlAggregateDescriptorRegistry(
        [sumNumeric, { ...sumNumeric, input: { kind: 'trait', trait: 'order' } }],
        codecs,
      ),
    ).toThrow(/Ambiguous aggregate descriptors for 'sum' over codec 'lib\/int4@1'/);
  });

  it('accepts overlapping traits when an exact descriptor settles every affected codec', () => {
    const registry = buildSqlAggregateDescriptorRegistry(
      [
        { ...sumNumeric, input: { kind: 'trait', trait: 'textual' } },
        { ...sumNumeric, input: { kind: 'trait', trait: 'order' } },
        { ...sumInt8, input: { kind: 'codec', codecId: 'lib/text@1' } },
      ],
      buildCodecDescriptorRegistry([codecStub('lib/text@1', ['textual', 'order'])]),
    );

    expect(registry.resolve('sum', { codecId: 'lib/text@1' })?.output).toEqual({
      codecId: 'lib/numeric@1',
    });
  });
});
