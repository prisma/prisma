import type { AuthoringTypeNamespace } from '@internal/framework-components/authoring';
import { collectScalarTypeConstructors } from '@internal/framework-components/authoring';
import { describe, expect, it } from 'vitest';
import { createTestSqlNamespace } from '../../../1-core/contract/test/test-support';
import { fixtureInterpreterTypes } from './fixture-codec-descriptors';
import {
  createBuiltinLikeControlMutationDefaults,
  interpretSqlContract,
  postgresScalarAuthoringTypes,
  postgresTarget,
  sqliteScalarAuthoringTypes,
  sqliteTarget,
} from './fixtures';

const sqlChar = {
  Char: {
    kind: 'typeConstructor',
    args: [{ kind: 'value', dataType: 'pg/int4', name: 'length' }],
    output: { codecId: 'sql/char@1', typeParams: { length: { kind: 'arg', index: 0 } } },
  },
} as const;

function precisionType(codecId: string) {
  return {
    kind: 'typeConstructor',
    args: [{ kind: 'value', dataType: 'pg/int4', name: 'precision', optional: true }],
    output: { codecId, typeParams: { precision: { kind: 'arg', index: 0 } } },
  } as const;
}

function temporalAliases(codecId: string) {
  return {
    CreatedAt: { kind: 'typeAlias', output: { type: { codecId } } },
    UpdatedAt: { kind: 'typeAlias', output: { type: { codecId } } },
  } as const;
}

const postgresTypes: AuthoringTypeNamespace = {
  ...postgresScalarAuthoringTypes,
  DateString: { kind: 'typeConstructor', output: { codecId: 'pg/date-string@1' } },
  TimestampString: precisionType('pg/timestamp-string@1'),
  TimestamptzString: precisionType('pg/timestamptz-string@1'),
  TimestamptzJsDate: precisionType('pg/timestamptz-date@1'),
  TimeString: precisionType('pg/time-string@1'),
  sql: sqlChar,
  temporal: {
    ...temporalAliases('pg/timestamptz-temporal@1'),
    CreatedAtString: {
      kind: 'typeAlias',
      output: { type: { codecId: 'pg/timestamptz-string@1' } },
    },
    UpdatedAtString: {
      kind: 'typeAlias',
      output: { type: { codecId: 'pg/timestamptz-string@1' } },
    },
    CreatedAtJsDate: {
      kind: 'typeAlias',
      output: { type: { codecId: 'pg/timestamptz-date@1' } },
    },
    UpdatedAtJsDate: {
      kind: 'typeAlias',
      output: { type: { codecId: 'pg/timestamptz-date@1' } },
    },
  },
};

const sqliteTypes: AuthoringTypeNamespace = {
  ...sqliteScalarAuthoringTypes,
  sql: sqlChar,
  temporal: temporalAliases('sqlite/datetime@1'),
};

function inputFor(
  types: AuthoringTypeNamespace,
  target: typeof postgresTarget | typeof sqliteTarget,
) {
  return {
    ...fixtureInterpreterTypes,
    target,
    scalarColumnDescriptors: collectScalarTypeConstructors(types),
    authoringContributions: {
      entityTypes: {},
      pslBlockDescriptors: {},
      modelAttributes: {},
      type: types,
    },
    composedExtensionContracts: new Map(),
    createNamespace: createTestSqlNamespace,
    capabilities: {},
    controlMutationDefaults: createBuiltinLikeControlMutationDefaults(),
  } as const;
}

const postgresInput = inputFor(postgresTypes, postgresTarget);
const sqliteInput = inputFor(sqliteTypes, sqliteTarget);

function diagnosticsOf(field: string, input: typeof postgresInput | typeof sqliteInput) {
  const result = interpretSqlContract(
    `model Event {\n  id    Int @id\n  value ${field}\n}\n`,
    input,
  );
  return result.ok
    ? []
    : result.failure.diagnostics.map(({ code, message }) => ({ code, message }));
}

function removed(call: string, rewrite: string) {
  return [
    {
      code: 'PSL_UNRESOLVED_REFERENCE',
      message: `${call} was a field preset, and Prisma 8 removed field presets. ${rewrite}`,
    },
  ];
}

describe('a removed field preset in a SQL schema', () => {
  describe('on Postgres', () => {
    it.each([
      ['uuidString()', 'Write sql.Char(36).'],
      ['ulid()', 'Write sql.Char(26).'],
      ['nanoid()', 'Write sql.Char(21).'],
      ['nanoid({ size: 12 })', 'Write sql.Char(12).'],
      ['cuid2()', 'Write sql.Char(24).'],
      ['ksuid()', 'Write sql.Char(27).'],
      ['id.uuidv4String()', 'Write sql.Char(36) @id @onCreate(uuid()).'],
      ['id.uuidv7String()', 'Write sql.Char(36) @id @onCreate(uuid(7)).'],
      ['id.ulid()', 'Write sql.Char(26) @id @onCreate(ulid()).'],
      ['id.nanoid()', 'Write sql.Char(21) @id @onCreate(nanoid()).'],
      ['id.nanoid({ size: 16 })', 'Write sql.Char(16) @id @onCreate(nanoid(16)).'],
      ['id.cuid2()', 'Write sql.Char(24) @id @onCreate(cuid(2)).'],
      ['id.ksuid()', 'Write sql.Char(27) @id @onCreate(ksuid()).'],
      ['text()', 'Write String.'],
      ['int()', 'Write Int.'],
      ['bigint()', 'Write BigInt.'],
      ['float()', 'Write Float.'],
      ['decimal()', 'Write Decimal.'],
      ['boolean()', 'Write Boolean.'],
      ['json()', 'Write Jsonb.'],
      ['bytes()', 'Write Bytes.'],
      ['dateTime()', 'Write DateTime.'],
      ['uuidNative()', 'Write Uuid.'],
      ['id.uuidv4Native()', 'Write Uuid @id @onCreate(uuid()).'],
      ['id.uuidv7Native()', 'Write Uuid @id @onCreate(uuid(7)).'],
      ['temporal.createdAt()', 'Write temporal.CreatedAt.'],
      ['temporal.updatedAt()', 'Write temporal.UpdatedAt.'],
      ['temporal.createdAtString()', 'Write temporal.CreatedAtString.'],
      ['temporal.updatedAtString()', 'Write temporal.UpdatedAtString.'],
      ['temporal.createdAtJsDate()', 'Write temporal.CreatedAtJsDate.'],
      ['temporal.updatedAtJsDate()', 'Write temporal.UpdatedAtJsDate.'],
      [
        'temporal.timestamp(3, onCreate: now, onUpdate: now)',
        'Write Timestamp(3) @onCreate(now()) @onUpdate(now()).',
      ],
      ['temporal.timestamp(precision: 6, onCreate: now)', 'Write Timestamp(6) @onCreate(now()).'],
      ['temporal.timestamp(3, now, now)', 'Write Timestamp(3) @onCreate(now()) @onUpdate(now()).'],
      ['temporal.timestamptz()', 'Write Timestamptz.'],
      ['temporal.timestamptz(onUpdate: now)', 'Write Timestamptz @onUpdate(now()).'],
      ['temporal.timestampString(6, onUpdate: now)', 'Write TimestampString(6) @onUpdate(now()).'],
      [
        'temporal.timestamptzString(3, onCreate: now, onUpdate: now)',
        'Write TimestamptzString(3) @onCreate(now()) @onUpdate(now()).',
      ],
      [
        'temporal.timestamptzJsDate(3, onCreate: now)',
        'Write TimestamptzJsDate(3) @onCreate(now()).',
      ],
      ['temporal.date(onCreate: now)', 'Write Date @onCreate(now()).'],
      [
        'temporal.dateString(onCreate: now, onUpdate: now)',
        'Write DateString @onCreate(now()) @onUpdate(now()).',
      ],
      ['temporal.time(3, onUpdate: now)', 'Write Time(3) @onUpdate(now()).'],
      ['temporal.time(3, onUpdate: now, now)', 'Write Time(3) @onCreate(now()) @onUpdate(now()).'],
      ['temporal.timeString(3, onCreate: now)', 'Write TimeString(3) @onCreate(now()).'],
      [
        'temporal.timetz(6, onCreate: now, onUpdate: now)',
        'Write Timetz(6) @onCreate(now()) @onUpdate(now()).',
      ],
    ])('refuses %s with its rewrite', (call, rewrite) => {
      expect(diagnosticsOf(call, postgresInput)).toEqual(removed(call, rewrite));
    });

    it.each([
      ['temporal.timestamp(onCreate: later)', 'Timestamp(...)'],
      ['temporal.timestamp(onCreate: "now")', 'Timestamp(...)'],
      ['temporal.timestamp(3, precision: 4)', 'Timestamp(...)'],
      ['temporal.timestamp(frequency: now)', 'Timestamp(...)'],
      ['temporal.timestamp(-1)', 'Timestamp(...)'],
      ['temporal.time(onCreate: now, 3, now)', 'Time(...)'],
      ['temporal.date(3)', 'Date'],
    ])(
      'names the rewrite without the arguments of %s, which the preset did not take',
      (call, type) => {
        expect(diagnosticsOf(call, postgresInput)).toEqual(
          removed(
            call,
            `Write ${type} with @onCreate(now()) and @onUpdate(now()) for the phases the preset set.`,
          ),
        );
      },
    );

    it('names the nanoid rewrite for a size it cannot read', () => {
      expect(diagnosticsOf('id.nanoid({ length: 16 })', postgresInput)).toEqual(
        removed(
          'id.nanoid({ length: 16 })',
          'Write sql.Char(21) @id @onCreate(nanoid()), or sql.Char(n) @id @onCreate(nanoid(n)) for a size of n.',
        ),
      );
    });

    it('keeps the binder message for a preset written without a call', () => {
      expect(diagnosticsOf('temporal.createdAt', postgresInput)).toEqual([
        { code: 'PSL_UNRESOLVED_REFERENCE', message: 'Cannot find type "temporal.createdAt"' },
      ]);
    });

    it('refuses each preset field once, keeping the field modifiers out of the call', () => {
      expect(diagnosticsOf('temporal.createdAt()?', postgresInput)).toEqual(
        removed('temporal.createdAt()', 'Write temporal.CreatedAt.'),
      );
    });

    it('keeps the binder message for a SQLite preset', () => {
      expect(diagnosticsOf('temporal.datetime(onCreate: now)', postgresInput)).toEqual([
        {
          code: 'PSL_UNRESOLVED_REFERENCE',
          message: 'Cannot find type "temporal.datetime"',
        },
      ]);
    });
  });

  describe('on SQLite', () => {
    it.each([
      ['temporal.datetime(onCreate: now)', 'Write DateTime @onCreate(now()).'],
      [
        'temporal.datetime(onCreate: now, onUpdate: now)',
        'Write DateTime @onCreate(now()) @onUpdate(now()).',
      ],
      ['temporal.createdAt()', 'Write temporal.CreatedAt.'],
      ['temporal.updatedAt()', 'Write temporal.UpdatedAt.'],
      ['id.uuidv4String()', 'Write sql.Char(36) @id @onCreate(uuid()).'],
      ['nanoid({ size: 12 })', 'Write sql.Char(12).'],
    ])('refuses %s with its rewrite', (call, rewrite) => {
      expect(diagnosticsOf(call, sqliteInput)).toEqual(removed(call, rewrite));
    });

    it.each([
      ['json()', 'json'],
      ['text()', 'text'],
      ['dateTime()', 'dateTime'],
      ['temporal.timestamp(3)', 'temporal.timestamp'],
      ['temporal.createdAtString()', 'temporal.createdAtString'],
    ])('keeps the binder message for %s, which was never a SQLite preset', (call, written) => {
      expect(diagnosticsOf(call, sqliteInput)).toEqual([
        { code: 'PSL_UNRESOLVED_REFERENCE', message: `Cannot find type "${written}"` },
      ]);
    });
  });
});
