import {
  temporalAuthoringPresets,
  temporalCodecPresetWithPrecision,
} from '@internal/family-sql/control';
import { describe, expect, it } from 'vitest';
import { postgresAuthoringFieldPresets } from '../src/core/authoring';

describe('postgresAuthoringFieldPresets', () => {
  it('exposes uuidNative preset with pg/uuid@1 and nativeType uuid', () => {
    expect(postgresAuthoringFieldPresets.uuidNative).toMatchObject({
      kind: 'fieldPreset',
      output: {
        codecId: 'pg/uuid@1',
        nativeType: 'uuid',
      },
    });
  });

  it('exposes id.uuidv4Native preset with pg/uuid@1, uuidv4 generator, and id flag', () => {
    expect(postgresAuthoringFieldPresets.id.uuidv4Native).toMatchObject({
      kind: 'fieldPreset',
      output: {
        codecId: 'pg/uuid@1',
        nativeType: 'uuid',
        executionDefaults: { onCreate: { kind: 'generator', id: 'uuidv4' } },
        id: true,
      },
    });
  });

  it('exposes id.uuidv7Native preset with pg/uuid@1, uuidv7 generator, and id flag', () => {
    expect(postgresAuthoringFieldPresets.id.uuidv7Native).toMatchObject({
      kind: 'fieldPreset',
      output: {
        codecId: 'pg/uuid@1',
        nativeType: 'uuid',
        executionDefaults: { onCreate: { kind: 'generator', id: 'uuidv7' } },
        id: true,
      },
    });
  });
});

describe('postgres temporal per-codec presets', () => {
  it('registers timestamp against pg/timestamp@1, named for the codec base name', () => {
    expect(postgresAuthoringFieldPresets.temporal.timestamp).toEqual(
      temporalCodecPresetWithPrecision({ codecId: 'pg/timestamp@1', nativeType: 'timestamp' }),
    );
  });

  it('registers timestamptz against pg/timestamptz@1, named for the codec base name', () => {
    expect(postgresAuthoringFieldPresets.temporal.timestamptz).toEqual(
      temporalCodecPresetWithPrecision({ codecId: 'pg/timestamptz@1', nativeType: 'timestamptz' }),
    );
  });

  it('keeps the createdAt/updatedAt convenience presets alongside the new siblings', () => {
    expect(postgresAuthoringFieldPresets.temporal).toEqual({
      ...temporalAuthoringPresets({ codecId: 'pg/timestamptz@1', nativeType: 'timestamptz' }),
      timestamp: temporalCodecPresetWithPrecision({
        codecId: 'pg/timestamp@1',
        nativeType: 'timestamp',
      }),
      timestamptz: temporalCodecPresetWithPrecision({
        codecId: 'pg/timestamptz@1',
        nativeType: 'timestamptz',
      }),
    });
  });

  it('backs updatedAt and timestamptz with the same codec, so the convenience form is a shorthand', () => {
    expect(postgresAuthoringFieldPresets.temporal.updatedAt.output.codecId).toBe(
      postgresAuthoringFieldPresets.temporal.timestamptz.output.codecId,
    );
  });
});
