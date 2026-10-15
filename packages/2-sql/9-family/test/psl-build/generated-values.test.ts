import { assembleFieldPresetsByCodecAndGenerator } from '@internal/framework-components/authoring';
import { describe, expect, it } from 'vitest';
import { fieldPresetGenerators } from '../../src/core/psl-build/generated-values';
import { temporalCodecPresetWithPrecision } from '../../src/core/timestamp-now-generator';

function presetFor(codecId: string, generatorId: string, nowTakesPrecision?: true) {
  const presets = assembleFieldPresetsByCodecAndGenerator({
    temporal: {
      clock: temporalCodecPresetWithPrecision({
        codecId,
        generatorId,
        ...(nowTakesPrecision === undefined ? {} : { nowTakesPrecision }),
      }),
    },
  });
  const preset = presets.get(codecId)?.get(generatorId);
  if (preset === undefined) throw new Error('the preset has a print form');
  return preset;
}

describe('fieldPresetGenerators', () => {
  it('reads back the generators of the printed call, with the params the preset derives from the type params', () => {
    expect(
      fieldPresetGenerators({
        preset: presetFor('pg/time@1', 'plainTimeNow', true),
        typeParams: { precision: 3 },
        onCreate: 'plainTimeNow',
        onUpdate: 'plainTimeNow',
      }),
    ).toEqual({
      onCreate: { kind: 'generator', id: 'plainTimeNow', params: { precision: 3 } },
      onUpdate: { kind: 'generator', id: 'plainTimeNow', params: { precision: 3 } },
    });
  });

  it('reads back a generator without params when the column has no type params', () => {
    expect(
      fieldPresetGenerators({
        preset: presetFor('pg/time@1', 'plainTimeNow', true),
        typeParams: undefined,
        onCreate: undefined,
        onUpdate: 'plainTimeNow',
      }),
    ).toEqual({ onUpdate: { kind: 'generator', id: 'plainTimeNow' } });
  });

  it('reads back a generator without params from a preset that derives none', () => {
    expect(
      fieldPresetGenerators({
        preset: presetFor('pg/timestamp@1', 'plainDateTimeNow'),
        typeParams: { precision: 6 },
        onCreate: 'plainDateTimeNow',
        onUpdate: undefined,
      }),
    ).toEqual({ onCreate: { kind: 'generator', id: 'plainDateTimeNow' } });
  });
});
