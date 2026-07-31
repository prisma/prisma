import { temporalAuthoringPresets, temporalCodecPreset } from '@internal/family-sql/control';
import { describe, expect, it } from 'vitest';
import { sqliteAuthoringFieldPresets } from '../src/core/authoring';

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
