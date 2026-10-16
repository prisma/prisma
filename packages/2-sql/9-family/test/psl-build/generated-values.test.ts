import {
  type AuthoringFieldPresetDescriptor,
  assembleFieldPresetsByCodecAndGenerator,
} from '@internal/framework-components/authoring';
import { describe, expect, it } from 'vitest';
import { fieldPresetCallFor } from '../../src/core/psl-build/generated-values';
import { temporalCodecPresetWithPrecision } from '../../src/core/timestamp-now-generator';

const amount: AuthoringFieldPresetDescriptor = {
  kind: 'fieldPreset',
  args: [
    { name: 'precision', kind: 'number', integer: true, optional: true },
    { name: 'stampedOn', kind: 'option', values: ['insert'], optional: true },
  ],
  output: {
    codecId: 'pg/numeric@1',
    typeParams: { precision: { kind: 'arg', index: 0 } },
    executionDefaults: {
      onCreate: {
        kind: 'select',
        index: 1,
        cases: { insert: { kind: 'generator', id: 'ledgerStamp' } },
      },
    },
  },
};

const fieldPresetsByCodecAndGenerator = assembleFieldPresetsByCodecAndGenerator({
  temporal: {
    time: temporalCodecPresetWithPrecision({
      codecId: 'pg/time@1',
      generatorId: 'plainTimeNow',
      nowTakesPrecision: true,
    }),
  },
  money: { amount },
});
const time = fieldPresetsByCodecAndGenerator.get('pg/time@1')?.get('plainTimeNow');
const money = fieldPresetsByCodecAndGenerator.get('pg/numeric@1')?.get('ledgerStamp');

const plainTimeNow = (precision?: number) => ({
  kind: 'generator' as const,
  id: 'plainTimeNow',
  ...(precision === undefined ? {} : { params: { precision } }),
});

describe('fieldPresetCallFor', () => {
  it('writes the call of the preset that reads back with the params it derives from the type params', () => {
    expect(
      fieldPresetCallFor({
        fieldPresetsByCodecAndGenerator,
        column: {
          codecId: 'pg/time@1',
          typeParams: { precision: 3 },
          generators: { onCreate: plainTimeNow(3), onUpdate: plainTimeNow(3) },
        },
      }),
    ).toEqual({
      kind: 'call',
      preset: time,
      arguments: [
        { kind: 'positional', value: '3' },
        { kind: 'named', name: 'onCreate', value: 'now' },
        { kind: 'named', name: 'onUpdate', value: 'now' },
      ],
    });
  });

  it('writes a generator without params when the column has no type params', () => {
    expect(
      fieldPresetCallFor({
        fieldPresetsByCodecAndGenerator,
        column: {
          codecId: 'pg/time@1',
          typeParams: undefined,
          generators: { onUpdate: plainTimeNow() },
        },
      }),
    ).toEqual({
      kind: 'call',
      preset: time,
      arguments: [{ kind: 'named', name: 'onUpdate', value: 'now' }],
    });
  });

  it('finds no preset for a codec no preset writes with the generators', () => {
    expect(
      fieldPresetCallFor({
        fieldPresetsByCodecAndGenerator,
        column: {
          codecId: 'pg/text@1',
          typeParams: undefined,
          generators: { onCreate: plainTimeNow() },
        },
      }),
    ).toEqual({ kind: 'noPreset' });
  });

  it('reports a phase the preset does not write', () => {
    expect(
      fieldPresetCallFor({
        fieldPresetsByCodecAndGenerator,
        column: {
          codecId: 'pg/numeric@1',
          typeParams: { precision: 10 },
          generators: {
            onCreate: { kind: 'generator', id: 'ledgerStamp' },
            onUpdate: { kind: 'generator', id: 'ledgerStamp' },
          },
        },
      }),
    ).toEqual({ kind: 'phasesNotWrittenTogether', preset: money });
  });

  it('reports each part of the column the call reads back differently', () => {
    expect(
      fieldPresetCallFor({
        fieldPresetsByCodecAndGenerator,
        column: {
          codecId: 'pg/time@1',
          typeParams: { precision: 3, zone: 'utc' },
          generators: { onCreate: plainTimeNow(3), onUpdate: plainTimeNow(0) },
        },
      }),
    ).toEqual({
      kind: 'readsBackDifferently',
      preset: time,
      differences: [
        { part: 'typeParams', column: { precision: 3, zone: 'utc' }, printed: { precision: 3 } },
        { part: 'onUpdate', column: plainTimeNow(0), printed: plainTimeNow(3) },
      ],
    });
  });
});
