import type { SqlPslBuildContext } from '@internal/family-sql/control';
import {
  type AuthoringFieldPresetDescriptor,
  temporalCodecPreset,
} from '@internal/framework-components/authoring';
import { describe, expect, it } from 'vitest';
import {
  PG_DATE_STRING_CODEC_ID,
  PG_TIME_TEMPORAL_CODEC_ID,
  PG_TIMESTAMPTZ_TEMPORAL_CODEC_ID,
  PG_TIMETZ_CODEC_ID,
} from '../../src/core/codec-ids';
import { postgresNowGeneratorIds } from '../../src/core/now-generators';
import { testBuildContext } from './build-context';
import {
  buildModels,
  type ColumnShape,
  fieldText,
  INT_COLUMN,
  TEXT_COLUMN,
  table,
} from './print-support';

describe('generated values', () => {
  function withGenerator(
    column: ColumnShape,
    phases: Record<string, unknown>,
    context?: SqlPslBuildContext,
  ): string | undefined {
    const [model] = buildModels({
      ...(context === undefined ? {} : { context }),
      models: {
        Widget: { table: 'Widget', fields: { id: { column: 'id' }, value: { column: 'value' } } },
      },
      tables: {
        Widget: table({
          columns: { id: INT_COLUMN, value: column },
          primaryKey: { columns: ['id'] },
        }),
      },
      execution: {
        mutations: {
          defaults: [{ ref: { namespace: 'public', entry: 'Widget', field: 'value' }, ...phases }],
        },
      },
    });
    const field = model?.fields[1];
    return field === undefined ? undefined : fieldText(field);
  }

  it('prints an id generator as the default function that produces it', () => {
    expect(withGenerator(TEXT_COLUMN, { onCreate: { kind: 'generator', id: 'uuidv4' } })).toBe(
      'value String @default(uuid())',
    );
    expect(withGenerator(TEXT_COLUMN, { onCreate: { kind: 'generator', id: 'uuidv7' } })).toBe(
      'value String @default(uuid(7))',
    );
    expect(withGenerator(TEXT_COLUMN, { onCreate: { kind: 'generator', id: 'cuid2' } })).toBe(
      'value String @default(cuid(2))',
    );
    expect(withGenerator(TEXT_COLUMN, { onCreate: { kind: 'generator', id: 'ulid' } })).toBe(
      'value String @default(ulid())',
    );
    expect(
      withGenerator(TEXT_COLUMN, {
        onCreate: { kind: 'generator', id: 'nanoid', params: { size: 10 } },
      }),
    ).toBe('value String @default(nanoid(10))');
  });

  it('prints a now generator pair as the temporal preset of the column codec', () => {
    expect(
      withGenerator(
        {
          dataType: 'pg/timestamp',
          codecId: 'pg/timestamp-temporal@1',
          nullable: false,
          typeParams: { precision: 3 },
        },
        {
          onCreate: { kind: 'generator', id: 'plainDateTimeNow' },
          onUpdate: { kind: 'generator', id: 'plainDateTimeNow' },
        },
      ),
    ).toBe('value temporal.timestamp(3, onCreate: now, onUpdate: now)');
  });

  it('refuses generators that no field preset writes together', () => {
    const timestamp = {
      dataType: 'pg/timestamp',
      codecId: 'pg/timestamp-temporal@1',
      nullable: false,
    };
    const refusal = (phases: Record<string, unknown>): unknown => {
      try {
        withGenerator(timestamp, phases);
      } catch (error) {
        return error;
      }
      return undefined;
    };

    expect(
      refusal({
        onCreate: { kind: 'generator', id: 'plainDateTimeNow' },
        onUpdate: { kind: 'generator', id: 'uuidv4' },
      }),
    ).toMatchObject({
      code: 'CONTRACT.PRINT_UNSUPPORTED',
      message: expect.stringContaining(
        'column "public"."Widget"."value" generates "plainDateTimeNow" on create and "uuidv4" on update, which cannot be written in Prisma 8 PSL.',
      ),
      meta: {
        coordinate: '"public"."Widget"."value"',
        onCreate: 'plainDateTimeNow',
        onUpdate: 'uuidv4',
      },
    });
    expect(
      refusal({
        onCreate: { kind: 'generator', id: 'uuidv4' },
        onUpdate: { kind: 'generator', id: 'plainDateTimeNow' },
      }),
    ).toMatchObject({
      code: 'CONTRACT.PRINT_UNSUPPORTED',
      meta: {
        coordinate: '"public"."Widget"."value"',
        onCreate: 'uuidv4',
        onUpdate: 'plainDateTimeNow',
      },
    });
  });

  function refusalOf(run: () => unknown): unknown {
    try {
      run();
    } catch (error) {
      return error;
    }
    return undefined;
  }

  function nowPreset(codecId: string, generatorId: string): AuthoringFieldPresetDescriptor {
    return temporalCodecPreset({ codecId, generatorId });
  }

  const timestamptz = {
    dataType: 'pg/timestamptz',
    codecId: PG_TIMESTAMPTZ_TEMPORAL_CODEC_ID,
    nullable: false,
  };

  it('prints a generator through the default function an extension registers', () => {
    const context = testBuildContext({
      defaultFunctionPrinters: new Map([
        ['slugid', { functionName: 'slugid', printArguments: () => '' }],
      ]),
    });
    expect(
      withGenerator(TEXT_COLUMN, { onCreate: { kind: 'generator', id: 'slugid' } }, context),
    ).toBe('value String @default(slugid())');
  });

  it('refuses a generator that no component in the configured stack registers, and says to add the extension', () => {
    expect(
      refusalOf(() =>
        withGenerator(TEXT_COLUMN, { onCreate: { kind: 'generator', id: 'slugid' } }),
      ),
    ).toMatchObject({
      code: 'CONTRACT.PRINT_UNSUPPORTED',
      message:
        'contract print: column "public"."Widget"."value" is generated by "slugid", which no component in the configured stack registers.',
      fix: 'Add the extension that registers the generator and its default function to the config, or keep authoring this contract in its current source.',
      meta: { coordinate: '"public"."Widget"."value"', onCreate: 'slugid' },
    });
  });

  it('refuses a generator a configured component registers without printArguments, and names the component', () => {
    const context = testBuildContext({
      componentIdsByGenerator: new Map([['slugid', 'slugid-pack']]),
    });
    expect(
      refusalOf(() =>
        withGenerator(TEXT_COLUMN, { onCreate: { kind: 'generator', id: 'slugid' } }, context),
      ),
    ).toMatchObject({
      code: 'CONTRACT.PRINT_UNSUPPORTED',
      message:
        'contract print: column "public"."Widget"."value" is generated by "slugid", which "slugid-pack" registers, but its default function does not say how contract print writes it.',
      fix: 'The author of "slugid-pack" must add `printArguments` for "slugid" to the default function that produces it, as the upgrade instructions "contract-print-generated-values" for extension authors describe. Until then, keep authoring this contract in its current source.',
      meta: {
        coordinate: '"public"."Widget"."value"',
        onCreate: 'slugid',
        componentId: 'slugid-pack',
      },
    });
  });

  it('refuses a generator a configured component without an id registers, without naming it', () => {
    const context = testBuildContext({
      componentIdsByGenerator: new Map([['slugid', undefined]]),
    });
    expect(
      refusalOf(() =>
        withGenerator(TEXT_COLUMN, { onCreate: { kind: 'generator', id: 'slugid' } }, context),
      ),
    ).toMatchObject({
      message:
        'contract print: column "public"."Widget"."value" is generated by "slugid", which a configured component registers, but its default function does not say how contract print writes it.',
      fix: 'The author of the component that registers "slugid" must add `printArguments` for "slugid" to the default function that produces it, as the upgrade instructions "contract-print-generated-values" for extension authors describe. Until then, keep authoring this contract in its current source.',
    });
  });

  it('prints a date and time now generator as the temporal preset of the column codec', () => {
    const generatorId = postgresNowGeneratorIds[PG_DATE_STRING_CODEC_ID];
    expect(
      withGenerator(
        { dataType: 'pg/date', codecId: PG_DATE_STRING_CODEC_ID, nullable: false },
        {
          onCreate: { kind: 'generator', id: generatorId },
          onUpdate: { kind: 'generator', id: generatorId },
        },
      ),
    ).toBe('value temporal.dateString(onCreate: now, onUpdate: now)');
    expect(
      withGenerator(
        { dataType: 'pg/timetz', codecId: PG_TIMETZ_CODEC_ID, nullable: false },
        { onUpdate: { kind: 'generator', id: postgresNowGeneratorIds[PG_TIMETZ_CODEC_ID] } },
      ),
    ).toBe('value temporal.timetz(onUpdate: now)');
  });

  it('skips presets with fixed phases when it looks for the preset of a codec', () => {
    expect(
      withGenerator(timestamptz, {
        onCreate: {
          kind: 'generator',
          id: postgresNowGeneratorIds[PG_TIMESTAMPTZ_TEMPORAL_CODEC_ID],
        },
      }),
    ).toBe('value temporal.timestamptz(onCreate: now)');
  });

  it('prints a now generator through the temporal preset an extension contributes', () => {
    const context = testBuildContext({
      temporalPresets: { clusterClock: nowPreset(PG_TIMESTAMPTZ_TEMPORAL_CODEC_ID, 'clusterNow') },
    });
    expect(
      withGenerator(
        timestamptz,
        {
          onCreate: { kind: 'generator', id: 'clusterNow' },
          onUpdate: { kind: 'generator', id: 'clusterNow' },
        },
        context,
      ),
    ).toBe('value temporal.clusterClock(onCreate: now, onUpdate: now)');
  });

  it('prints a now generator through a preset outside the temporal namespace', () => {
    const context = testBuildContext({
      fieldPresets: {
        clock: { cluster: nowPreset(PG_TIMESTAMPTZ_TEMPORAL_CODEC_ID, 'clusterNow') },
      },
    });
    expect(
      withGenerator(timestamptz, { onUpdate: { kind: 'generator', id: 'clusterNow' } }, context),
    ).toBe('value clock.cluster(onUpdate: now)');
  });

  it('writes the arguments read from a preset template', () => {
    const preset: AuthoringFieldPresetDescriptor = {
      kind: 'fieldPreset',
      args: [
        { name: 'scale', kind: 'number', optional: true, integer: true },
        { name: 'stampedOn', kind: 'option', values: ['insert'], optional: true },
      ],
      output: {
        codecId: PG_TIMESTAMPTZ_TEMPORAL_CODEC_ID,
        typeParams: { precision: { kind: 'arg', index: 0 } },
        executionDefaults: {
          onCreate: {
            kind: 'select',
            index: 1,
            cases: { insert: { kind: 'generator', id: 'clusterNow' } },
          },
        },
      },
    };
    const context = testBuildContext({ fieldPresets: { clock: { stamped: preset } } });
    expect(
      withGenerator(
        { ...timestamptz, typeParams: { precision: 6 } },
        { onCreate: { kind: 'generator', id: 'clusterNow' } },
        context,
      ),
    ).toBe('value clock.stamped(6, stampedOn: insert)');
  });

  it('refuses generators the preset call reads back as different generators', () => {
    const descriptor: AuthoringFieldPresetDescriptor = {
      kind: 'fieldPreset',
      args: [{ name: 'stampedOn', kind: 'option', values: ['insert', 'write'], optional: true }],
      output: {
        codecId: PG_TIMESTAMPTZ_TEMPORAL_CODEC_ID,
        executionDefaults: {
          onCreate: {
            kind: 'select',
            index: 0,
            cases: {
              insert: { kind: 'generator', id: 'clusterNow' },
              write: { kind: 'generator', id: 'clusterLater' },
            },
          },
          onUpdate: {
            kind: 'select',
            index: 0,
            cases: { write: { kind: 'generator', id: 'clusterUpdate' } },
          },
        },
      },
    };
    const phase = (generatorId: string, value: string) => ({
      argument: 'stampedOn',
      index: 0,
      valuesByGenerator: new Map([[generatorId, value]]),
    });
    const preset = {
      path: ['clock', 'shared'],
      descriptor,
      printForm: {
        codecId: PG_TIMESTAMPTZ_TEMPORAL_CODEC_ID,
        typeParams: [],
        onCreate: phase('clusterNow', 'insert'),
        onUpdate: phase('clusterUpdate', 'write'),
      },
    };
    const context: SqlPslBuildContext = {
      ...testBuildContext(),
      fieldPresetsByCodecAndGenerator: new Map([
        [
          PG_TIMESTAMPTZ_TEMPORAL_CODEC_ID,
          new Map([
            ['clusterNow', preset],
            ['clusterUpdate', preset],
          ]),
        ],
      ]),
    };
    expect(
      refusalOf(() =>
        withGenerator(
          timestamptz,
          {
            onCreate: { kind: 'generator', id: 'clusterNow' },
            onUpdate: { kind: 'generator', id: 'clusterUpdate' },
          },
          context,
        ),
      ),
    ).toMatchObject({
      code: 'CONTRACT.PRINT_UNSUPPORTED',
      message:
        'contract print: column "public"."Widget"."value" generates "clusterNow" on create and "clusterUpdate" on update, but field preset clock.shared writes "clusterLater" on create and "clusterUpdate" on update, so the written file would read back differently.',
      meta: {
        coordinate: '"public"."Widget"."value"',
        onCreate: 'clusterNow',
        onUpdate: 'clusterUpdate',
        presetOnCreate: 'clusterLater',
        presetOnUpdate: 'clusterUpdate',
      },
    });
  });

  describe('generator params', () => {
    const time3 = {
      dataType: 'pg/time',
      codecId: PG_TIME_TEMPORAL_CODEC_ID,
      nullable: false,
      typeParams: { precision: 3 },
    };
    const plainTimeNow = postgresNowGeneratorIds[PG_TIME_TEMPORAL_CODEC_ID];

    it('prints a preset whose generators take the params it derives from the column', () => {
      expect(
        withGenerator(time3, {
          onCreate: { kind: 'generator', id: plainTimeNow, params: { precision: 3 } },
          onUpdate: { kind: 'generator', id: plainTimeNow, params: { precision: 3 } },
        }),
      ).toBe('value temporal.time(3, onCreate: now, onUpdate: now)');
    });

    it('prints a preset that derives no params for a generator without params', () => {
      expect(
        withGenerator(
          { dataType: 'pg/time', codecId: PG_TIME_TEMPORAL_CODEC_ID, nullable: false },
          { onCreate: { kind: 'generator', id: plainTimeNow } },
        ),
      ).toBe('value temporal.time(onCreate: now)');
    });

    it('refuses a generator whose params differ from the params the preset derives', () => {
      expect(
        refusalOf(() =>
          withGenerator(time3, {
            onCreate: { kind: 'generator', id: plainTimeNow, params: { precision: 3 } },
            onUpdate: { kind: 'generator', id: plainTimeNow, params: { precision: 0 } },
          }),
        ),
      ).toMatchObject({
        code: 'CONTRACT.PRINT_UNSUPPORTED',
        message:
          'contract print: column "public"."Widget"."value" generates "plainTimeNow" on update with params {"precision":0}, but field preset temporal.time writes it with params {"precision":3}, so the written file would read back differently.',
        meta: {
          coordinate: '"public"."Widget"."value"',
          generator: 'plainTimeNow',
          phase: 'onUpdate',
          params: { precision: 0 },
          presetParams: { precision: 3 },
        },
      });
    });
  });
});
