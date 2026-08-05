import { temporalAuthoringPresets, temporalCodecPreset } from '@internal/family-sql/control';
import { describe, expect, it } from 'vitest';
import { sqliteAuthoringFieldPresets } from '../src/core/authoring';

describe('sqliteAuthoringFieldPresets', () => {
  it('exposes bigIntNumber preset with sqlite/bigintnumber@1 and nativeType integer', () => {
    expect(sqliteAuthoringFieldPresets.bigIntNumber).toEqual({
      kind: 'fieldPreset',
      output: {
        codecId: 'sqlite/bigintnumber@1',
        nativeType: 'integer',
      },
    });
  });

  it('carries no bigint preset, so bare BigInt stays on the scalar-resolved sqlite/bigint@1', () => {
    expect(sqliteAuthoringFieldPresets).not.toHaveProperty('bigint');
  });

  it('carries no unboundedInt preset: SQLite has no lossless unbounded integer storage', () => {
    expect(sqliteAuthoringFieldPresets).not.toHaveProperty('unboundedInt');
  });
});

describe('sqlite temporal per-codec presets', () => {
  it('registers datetime against sqlite/datetime@1, named for the codec base name', () => {
    expect(sqliteAuthoringFieldPresets.temporal.datetime).toEqual(
      temporalCodecPreset({ codecId: 'sqlite/datetime@1', nativeType: 'text' }),
    );
  });

  it('declares no precision argument, since sqlite/datetime@1 takes no params', () => {
    expect(sqliteAuthoringFieldPresets.temporal.datetime.args.map((arg) => arg.name)).toEqual([
      'onCreate',
      'onUpdate',
    ]);
    expect(sqliteAuthoringFieldPresets.temporal.datetime.output).not.toHaveProperty('typeParams');
  });

  it('keeps the createdAt/updatedAt convenience presets alongside the new sibling', () => {
    expect(sqliteAuthoringFieldPresets.temporal).toEqual({
      ...temporalAuthoringPresets({ codecId: 'sqlite/datetime@1', nativeType: 'text' }),
      datetime: temporalCodecPreset({ codecId: 'sqlite/datetime@1', nativeType: 'text' }),
    });
  });
});
