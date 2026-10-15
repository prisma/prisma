import { timestampNowRuntimeGenerator } from '@internal/family-sql/runtime';
import { TIMESTAMP_NOW_GENERATOR_ID } from '@internal/framework-components/authoring';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { postgresAuthoringFieldPresets } from '../src/core/authoring';
import {
  dateTextNow,
  plainDateNow,
  plainTimeNow,
  postgresDateTimeNowGenerators,
  timestampTextNow,
  timestamptzTextNow,
  timeTextNow,
  timetzTextNow,
} from '../src/core/date-time-now-generators';
import { INSTANT_NOW_GENERATOR_ID, instantNow } from '../src/core/instant-now-generator';
import { postgresNowGeneratorIdFor, postgresNowGeneratorIds } from '../src/core/now-generators';
import {
  PLAIN_DATE_TIME_NOW_GENERATOR_ID,
  plainDateTimeNow,
} from '../src/core/plain-date-time-now-generator';
import { postgresCodecRegistry } from '../src/core/registry';

const generate: Readonly<Record<string, () => unknown>> = {
  [INSTANT_NOW_GENERATOR_ID]: instantNow,
  [PLAIN_DATE_TIME_NOW_GENERATOR_ID]: plainDateTimeNow,
  [TIMESTAMP_NOW_GENERATOR_ID]: () => timestampNowRuntimeGenerator().generate(),
  ...Object.fromEntries(postgresDateTimeNowGenerators.map(({ id, generate }) => [id, generate])),
};

function presetGeneratorIds(output: object): string[] {
  if (!('executionDefaults' in output)) return [];
  return Object.values(output.executionDefaults as object).map((phase: unknown) => {
    const { id, cases } = phase as { id?: string; cases?: { now: { id: string } } };
    return id ?? cases?.now.id ?? '';
  });
}

const DATE_AND_TIME_CODEC_IDS = [
  'pg/date-temporal@1',
  'pg/date-string@1',
  'pg/time-temporal@1',
  'pg/time-string@1',
  'pg/timetz@1',
  'pg/timestamp-temporal@1',
  'pg/timestamp-string@1',
  'pg/timestamptz-temporal@1',
  'pg/timestamptz-string@1',
  'pg/timestamptz-date@1',
];

function codecFor(codecId: string) {
  return postgresCodecRegistry.descriptorFor(codecId)?.factory({})({ name: '<test>' });
}

describe('the "now" generator for each codec', () => {
  it.each(Object.entries(postgresNowGeneratorIds))(
    'generates a value %s encodes and reads back',
    async (codecId, generatorId) => {
      const value = generate[generatorId]?.();
      const codec = codecFor(codecId);
      const wire = await codec?.encode(value, {});
      expect(typeof wire).toBe('string');
      const json = codec?.encodeJson(value);
      expect(codec?.encodeJson(codec.decodeJson(json ?? null))).toEqual(json);
    },
  );

  it('gives every date and time codec a generator', () => {
    expect(
      DATE_AND_TIME_CODEC_IDS.filter((codecId) => postgresNowGeneratorIdFor(codecId) === undefined),
    ).toEqual([]);
  });

  it('has no generator for a codec without one', () => {
    expect(['pg/text@1', 'pg/interval@1'].map(postgresNowGeneratorIdFor)).toEqual([
      undefined,
      undefined,
    ]);
  });

  it('pairs each date and time codec with its generator', () => {
    expect(postgresNowGeneratorIds).toEqual({
      'pg/date-temporal@1': 'plainDateNow',
      'pg/date-string@1': 'dateTextNow',
      'pg/time-temporal@1': 'plainTimeNow',
      'pg/time-string@1': 'timeTextNow',
      'pg/timetz@1': 'timetzTextNow',
      'pg/timestamp-temporal@1': 'plainDateTimeNow',
      'pg/timestamp-string@1': 'timestampTextNow',
      'pg/timestamptz-temporal@1': 'instantNow',
      'pg/timestamptz-string@1': 'timestamptzTextNow',
      'pg/timestamptz-date@1': 'timestampNow',
    });
  });

  it('gives every temporal preset the generator the lookup gives its codec', () => {
    const presets = Object.entries(postgresAuthoringFieldPresets.temporal).flatMap(
      ([name, preset]) =>
        presetGeneratorIds(preset.output).map((generatorId) => ({
          name,
          codecId: preset.output.codecId,
          generatorId,
        })),
    );
    expect(presets.map(({ name }) => name)).toContain('updatedAtJsDate');
    expect(
      presets.filter(
        ({ codecId, generatorId }) => postgresNowGeneratorIdFor(codecId) !== generatorId,
      ),
    ).toEqual([]);
  });
});

describe('the text "now" generators', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('write the text PostgreSQL prints in a UTC session', () => {
    vi.useFakeTimers({ now: new Date('2024-01-02T03:04:05.678Z') });
    expect([
      timestampTextNow(),
      timestamptzTextNow(),
      dateTextNow(),
      timeTextNow(),
      timetzTextNow(),
    ]).toEqual([
      '2024-01-02 03:04:05.678',
      '2024-01-02 03:04:05.678+00',
      '2024-01-02',
      '03:04:05.678',
      '03:04:05.678+00',
    ]);
  });

  it.each([
    ['2024-01-02T03:04:05.670Z', '2024-01-02 03:04:05.67'],
    ['2024-01-02T03:04:05.600Z', '2024-01-02 03:04:05.6'],
    ['2024-01-02T03:04:00.000Z', '2024-01-02 03:04:00'],
  ])('remove the trailing zeros of the fraction of %s', (now, text) => {
    vi.useFakeTimers({ now: new Date(now) });
    expect(timestampTextNow()).toBe(text);
  });
});

describe('the Temporal date and time "now" generators', () => {
  const DAY_MILLISECONDS = 86_400_000;
  const utcDate = (epochMilliseconds: number) =>
    new Date(epochMilliseconds).toISOString().slice(0, 10);

  it('give the UTC date', () => {
    const before = Date.now();
    const date = plainDateNow();
    const after = Date.now();
    expect(date).toBeInstanceOf(Temporal.PlainDate);
    expect([utcDate(before), utcDate(after)]).toContain(date.toString());
  });

  it('give the UTC time of day', () => {
    const time = plainTimeNow();
    expect(time).toBeInstanceOf(Temporal.PlainTime);
    const skew = Math.abs(
      time.since(new Temporal.PlainTime()).total('millisecond') - (Date.now() % DAY_MILLISECONDS),
    );
    expect(Math.min(skew, DAY_MILLISECONDS - skew)).toBeLessThan(5_000);
  });
});
