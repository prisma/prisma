import { describe, expect, it } from 'vitest';
import {
  type AuthoringFieldPresetDescriptor,
  assertNoCrossRegistryCollisions,
} from '../src/shared/framework-authoring';
import { temporalCodecPreset } from '../src/shared/temporal-presets';

const clock = (codecId: string, generatorId: string): AuthoringFieldPresetDescriptor =>
  temporalCodecPreset({ codecId, generatorId });

describe('field preset lifts at stack assembly', () => {
  it('lifts the codec, the phase arguments and the generator a temporal preset selects', () => {
    expect(clock('pg/date-string@1', 'dateStringNow').lift).toEqual({
      codecId: 'pg/date-string@1',
      typeParams: [],
      onCreate: { argument: 'onCreate', value: 'now', generatorId: 'dateStringNow' },
      onUpdate: { argument: 'onUpdate', value: 'now', generatorId: 'dateStringNow' },
    });
  });

  it('accepts presets that lift different codecs or generators', () => {
    expect(() =>
      assertNoCrossRegistryCollisions(
        {},
        {
          temporal: {
            dateString: clock('pg/date-string@1', 'dateStringNow'),
            date: clock('pg/date-temporal@1', 'plainDateNow'),
          },
          clock: { cluster: clock('pg/date-temporal@1', 'clusterNow') },
        },
      ),
    ).not.toThrow();
  });

  it('refuses two presets that lift one codec with one generator', () => {
    expect(() =>
      assertNoCrossRegistryCollisions(
        {},
        {
          temporal: { date: clock('pg/date-temporal@1', 'plainDateNow') },
          clock: { day: clock('pg/date-temporal@1', 'plainDateNow') },
        },
      ),
    ).toThrow(
      expect.objectContaining({
        code: 'CONTRACT.PACK_CONTRIBUTION_INVALID',
        message:
          'Field presets "temporal.date" and "clock.day" both write codec "pg/date-temporal@1" with generator "plainDateNow", so `contract print` cannot choose one. Register one of them only.',
      }),
    );
  });

  it('refuses a lift that names another codec than the output', () => {
    const preset = clock('pg/date-temporal@1', 'plainDateNow');
    expect(() =>
      assertNoCrossRegistryCollisions(
        {},
        {
          temporal: { date: { ...preset, lift: { ...preset.lift!, codecId: 'pg/date-string@1' } } },
        },
      ),
    ).toThrow(
      'Field preset "temporal.date" declares a lift that does not match its output: the lift names codec "pg/date-string@1", the output "pg/date-temporal@1".',
    );
  });

  it('refuses a lift whose phase argument does not select the generator it names', () => {
    const preset = clock('pg/date-temporal@1', 'plainDateNow');
    const lift = {
      ...preset.lift!,
      onUpdate: { argument: 'onUpdate', value: 'now', generatorId: 'clusterNow' },
    };
    expect(() =>
      assertNoCrossRegistryCollisions({}, { temporal: { date: { ...preset, lift } } }),
    ).toThrow(
      'Field preset "temporal.date" declares a lift that does not match its output: onUpdate does not select generator "clusterNow" with onUpdate: now.',
    );
  });
});
