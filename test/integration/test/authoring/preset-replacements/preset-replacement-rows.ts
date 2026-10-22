import type { ContractFieldType, ExecutionMutationDefaultPhases } from '@internal/contract/types';
import type mongoFamilyPack from '@internal/family-mongo/pack';
import type sqlFamilyPack from '@internal/family-sql/pack';
import { cuid2, ksuid, nanoid, ulid, uuidv4, uuidv7 } from '@internal/ids';
import type {
  ContractFactory,
  EnumTypeHandle,
  FieldBuilder,
} from '@internal/mongo-contract-ts/contract-builder';
import { now } from '@internal/postgres/contract-builder';
import type {
  ComposedAuthoringHelpers,
  ScalarFieldBuilder,
} from '@internal/sql-contract-ts/contract-builder';
import type mongoTargetPack from '@internal/target-mongo/pack';
import type postgresPack from '@internal/target-postgres/pack';
import type sqlitePack from '@internal/target-sqlite/pack';

export type PostgresHelpers = ComposedAuthoringHelpers<
  typeof sqlFamilyPack,
  typeof postgresPack,
  undefined
>;
export type SqliteHelpers = ComposedAuthoringHelpers<
  typeof sqlFamilyPack,
  typeof sqlitePack,
  undefined
>;
export type MongoHelpers = Parameters<
  ContractFactory<
    Record<never, never>,
    Record<never, never>,
    undefined,
    typeof mongoFamilyPack,
    typeof mongoTargetPack,
    undefined
  >
>[0];

/**
 * A removed field preset and what replaces it, in PSL and TypeScript. The field is the model's id when `id` is set, and a field beside an `Int` id otherwise. A row with no PSL preset is a TypeScript-only helper, `field.generated(...)`.
 */
export interface PresetReplacementRow<Helpers, Field> {
  readonly model: string;
  readonly id?: true;
  readonly psl: { readonly preset?: string; readonly replacement: string };
  readonly ts: {
    readonly preset: (helpers: Helpers) => Field;
    readonly replacement: (helpers: Helpers) => Field;
  };
}

export type SqlRow<Helpers> = PresetReplacementRow<Helpers, ScalarFieldBuilder>;
type MongoField = FieldBuilder<
  ContractFieldType,
  boolean,
  false,
  EnumTypeHandle | undefined,
  ExecutionMutationDefaultPhases | undefined
>;

export type MongoRow = PresetReplacementRow<MongoHelpers, MongoField>;

type FamilyHelpers = PostgresHelpers | SqliteHelpers;

/** The SQL family's presets, on a target whose fixed-length text is written `char` in PSL and `charType` in TypeScript. */
function familyRows<Helpers extends FamilyHelpers>(
  char: (length: number) => string,
  charType: (helpers: Helpers, length: number) => ScalarFieldBuilder,
): readonly SqlRow<Helpers>[] {
  return [
    {
      model: 'UuidString',
      psl: { preset: 'uuidString()', replacement: char(36) },
      ts: { preset: ({ field }) => field.uuidString(), replacement: (h) => charType(h, 36) },
    },
    {
      model: 'Ulid',
      psl: { preset: 'ulid()', replacement: char(26) },
      ts: { preset: ({ field }) => field.ulid(), replacement: (h) => charType(h, 26) },
    },
    {
      model: 'Nanoid',
      psl: { preset: 'nanoid()', replacement: char(21) },
      ts: { preset: ({ field }) => field.nanoid(), replacement: (h) => charType(h, 21) },
    },
    {
      model: 'NanoidSized',
      psl: { preset: 'nanoid({ size: 12 })', replacement: char(12) },
      ts: {
        preset: ({ field }) => field.nanoid({ size: 12 }),
        replacement: (h) => charType(h, 12),
      },
    },
    {
      model: 'Cuid2',
      psl: { preset: 'cuid2()', replacement: char(24) },
      ts: { preset: ({ field }) => field.cuid2(), replacement: (h) => charType(h, 24) },
    },
    {
      model: 'Ksuid',
      psl: { preset: 'ksuid()', replacement: char(27) },
      ts: { preset: ({ field }) => field.ksuid(), replacement: (h) => charType(h, 27) },
    },
    {
      model: 'IdUuidv4String',
      id: true,
      psl: { preset: 'id.uuidv4String()', replacement: `${char(36)} @id @onCreate(uuid())` },
      ts: {
        preset: ({ field }) => field.id.uuidv4String(),
        replacement: (h) => charType(h, 36).id().onCreate(h.gen.uuid()),
      },
    },
    {
      model: 'IdUuidv7String',
      id: true,
      psl: { preset: 'id.uuidv7String()', replacement: `${char(36)} @id @onCreate(uuid(7))` },
      ts: {
        preset: ({ field }) => field.id.uuidv7String(),
        replacement: (h) => charType(h, 36).id().onCreate(h.gen.uuid(7)),
      },
    },
    {
      model: 'IdUlid',
      id: true,
      psl: { preset: 'id.ulid()', replacement: `${char(26)} @id @onCreate(ulid())` },
      ts: {
        preset: ({ field }) => field.id.ulid(),
        replacement: (h) => charType(h, 26).id().onCreate(h.gen.ulid()),
      },
    },
    {
      model: 'IdNanoid',
      id: true,
      psl: { preset: 'id.nanoid()', replacement: `${char(21)} @id @onCreate(nanoid())` },
      ts: {
        preset: ({ field }) => field.id.nanoid(),
        replacement: (h) => charType(h, 21).id().onCreate(h.gen.nanoid()),
      },
    },
    {
      model: 'IdNanoidSized',
      id: true,
      psl: {
        preset: 'id.nanoid({ size: 16 })',
        replacement: `${char(16)} @id @onCreate(nanoid(16))`,
      },
      ts: {
        preset: ({ field }) => field.id.nanoid({ size: 16 }),
        replacement: (h) => charType(h, 16).id().onCreate(h.gen.nanoid(16)),
      },
    },
    {
      model: 'IdCuid2',
      id: true,
      psl: { preset: 'id.cuid2()', replacement: `${char(24)} @id @onCreate(cuid(2))` },
      ts: {
        preset: ({ field }) => field.id.cuid2(),
        replacement: (h) => charType(h, 24).id().onCreate(h.gen.cuid(2)),
      },
    },
    {
      model: 'IdKsuid',
      id: true,
      psl: { preset: 'id.ksuid()', replacement: `${char(27)} @id @onCreate(ksuid())` },
      ts: {
        preset: ({ field }) => field.id.ksuid(),
        replacement: (h) => charType(h, 27).id().onCreate(h.gen.ksuid()),
      },
    },
  ];
}

/** `field.generated(...)`, which only the SQL TypeScript builder has. */
function generatedRows<Helpers extends FamilyHelpers>(
  char: (length: number) => string,
  charType: (helpers: Helpers, length: number) => ScalarFieldBuilder,
): readonly SqlRow<Helpers>[] {
  return [
    {
      model: 'GeneratedUuidv4',
      psl: { replacement: `${char(36)} @onCreate(uuid())` },
      ts: {
        preset: ({ field }) => field.generated(uuidv4()),
        replacement: (h) => charType(h, 36).onCreate(h.gen.uuid()),
      },
    },
    {
      model: 'GeneratedUuidv7',
      psl: { replacement: `${char(36)} @onCreate(uuid(7))` },
      ts: {
        preset: ({ field }) => field.generated(uuidv7()),
        replacement: (h) => charType(h, 36).onCreate(h.gen.uuid(7)),
      },
    },
    {
      model: 'GeneratedUlid',
      psl: { replacement: `${char(26)} @onCreate(ulid())` },
      ts: {
        preset: ({ field }) => field.generated(ulid()),
        replacement: (h) => charType(h, 26).onCreate(h.gen.ulid()),
      },
    },
    {
      model: 'GeneratedNanoid',
      psl: { replacement: `${char(21)} @onCreate(nanoid())` },
      ts: {
        preset: ({ field }) => field.generated(nanoid()),
        replacement: (h) => charType(h, 21).onCreate(h.gen.nanoid()),
      },
    },
    {
      model: 'GeneratedNanoidSized',
      psl: { replacement: `${char(16)} @onCreate(nanoid(16))` },
      ts: {
        preset: ({ field }) => field.generated(nanoid({ size: 16 })),
        replacement: (h) => charType(h, 16).onCreate(h.gen.nanoid(16)),
      },
    },
    {
      model: 'GeneratedCuid2',
      psl: { replacement: `${char(24)} @onCreate(cuid(2))` },
      ts: {
        preset: ({ field }) => field.generated(cuid2()),
        replacement: (h) => charType(h, 24).onCreate(h.gen.cuid(2)),
      },
    },
    {
      model: 'GeneratedKsuid',
      psl: { replacement: `${char(27)} @onCreate(ksuid())` },
      ts: {
        preset: ({ field }) => field.generated(ksuid()),
        replacement: (h) => charType(h, 27).onCreate(h.gen.ksuid()),
      },
    },
    {
      model: 'GeneratedUuidv4Id',
      id: true,
      psl: { replacement: `${char(36)} @id @onCreate(uuid())` },
      ts: {
        preset: ({ field }) => field.generated(uuidv4()).id(),
        replacement: (h) => charType(h, 36).id().onCreate(h.gen.uuid()),
      },
    },
  ];
}

export const postgresRows: readonly SqlRow<PostgresHelpers>[] = [
  ...familyRows<PostgresHelpers>(
    (length) => `Char(${length})`,
    ({ field, type }, length) => field.column(type.Char(length)),
  ),
  ...generatedRows<PostgresHelpers>(
    (length) => `Char(${length})`,
    ({ field, type }, length) => field.column(type.Char(length)),
  ),
  {
    model: 'Text',
    psl: { preset: 'text()', replacement: 'String' },
    ts: {
      preset: ({ field }) => field.text(),
      replacement: ({ field, type }) => field.column(type.String()),
    },
  },
  {
    model: 'Int4',
    psl: { preset: 'int()', replacement: 'Int' },
    ts: {
      preset: ({ field }) => field.int(),
      replacement: ({ field, type }) => field.column(type.Int()),
    },
  },
  {
    model: 'Int8',
    psl: { preset: 'bigint()', replacement: 'BigInt' },
    ts: {
      preset: ({ field }) => field.bigint(),
      replacement: ({ field, type }) => field.column(type.BigInt()),
    },
  },
  {
    model: 'Float8',
    psl: { preset: 'float()', replacement: 'Float' },
    ts: {
      preset: ({ field }) => field.float(),
      replacement: ({ field, type }) => field.column(type.Float()),
    },
  },
  {
    model: 'Numeric',
    psl: { preset: 'decimal()', replacement: 'Decimal' },
    ts: {
      preset: ({ field }) => field.decimal(),
      replacement: ({ field, type }) => field.column(type.Decimal()),
    },
  },
  {
    model: 'Bool',
    psl: { preset: 'boolean()', replacement: 'Boolean' },
    ts: {
      preset: ({ field }) => field.boolean(),
      replacement: ({ field, type }) => field.column(type.Boolean()),
    },
  },
  {
    model: 'JsonbColumn',
    psl: { preset: 'json()', replacement: 'Jsonb' },
    ts: {
      preset: ({ field }) => field.json(),
      replacement: ({ field, type }) => field.column(type.Jsonb()),
    },
  },
  {
    model: 'Bytea',
    psl: { preset: 'bytes()', replacement: 'Bytes' },
    ts: {
      preset: ({ field }) => field.bytes(),
      replacement: ({ field, type }) => field.column(type.Bytes()),
    },
  },
  {
    model: 'DateTimeColumn',
    psl: { preset: 'dateTime()', replacement: 'DateTime' },
    ts: {
      preset: ({ field }) => field.dateTime(),
      replacement: ({ field, type }) => field.column(type.DateTime()),
    },
  },
  {
    model: 'UuidNative',
    psl: { preset: 'uuidNative()', replacement: 'Uuid' },
    ts: {
      preset: ({ field }) => field.uuidNative(),
      replacement: ({ field, type }) => field.column(type.Uuid()),
    },
  },
  {
    model: 'IdUuidv4Native',
    id: true,
    psl: { preset: 'id.uuidv4Native()', replacement: 'Uuid @id @onCreate(uuid())' },
    ts: {
      preset: ({ field }) => field.id.uuidv4Native(),
      replacement: ({ field, type, gen }) => field.column(type.Uuid()).id().onCreate(gen.uuid()),
    },
  },
  {
    model: 'IdUuidv7Native',
    id: true,
    psl: { preset: 'id.uuidv7Native()', replacement: 'Uuid @id @onCreate(uuid(7))' },
    ts: {
      preset: ({ field }) => field.id.uuidv7Native(),
      replacement: ({ field, type, gen }) => field.column(type.Uuid()).id().onCreate(gen.uuid(7)),
    },
  },
  {
    model: 'CreatedAt',
    psl: { preset: 'temporal.createdAt()', replacement: 'temporal.CreatedAt' },
    ts: {
      preset: ({ field }) => field.temporal.createdAt(),
      replacement: ({ field, type }) => field.column(type.temporal.CreatedAt()),
    },
  },
  {
    model: 'UpdatedAt',
    psl: { preset: 'temporal.updatedAt()', replacement: 'temporal.UpdatedAt' },
    ts: {
      preset: ({ field }) => field.temporal.updatedAt(),
      replacement: ({ field, type }) => field.column(type.temporal.UpdatedAt()),
    },
  },
  {
    model: 'CreatedAtString',
    psl: { preset: 'temporal.createdAtString()', replacement: 'temporal.CreatedAtString' },
    ts: {
      preset: ({ field }) => field.temporal.createdAtString(),
      replacement: ({ field, type }) => field.column(type.temporal.CreatedAtString()),
    },
  },
  {
    model: 'UpdatedAtString',
    psl: { preset: 'temporal.updatedAtString()', replacement: 'temporal.UpdatedAtString' },
    ts: {
      preset: ({ field }) => field.temporal.updatedAtString(),
      replacement: ({ field, type }) => field.column(type.temporal.UpdatedAtString()),
    },
  },
  {
    model: 'CreatedAtJsDate',
    psl: { preset: 'temporal.createdAtJsDate()', replacement: 'temporal.CreatedAtJsDate' },
    ts: {
      preset: ({ field }) => field.temporal.createdAtJsDate(),
      replacement: ({ field, type }) => field.column(type.temporal.CreatedAtJsDate()),
    },
  },
  {
    model: 'UpdatedAtJsDate',
    psl: { preset: 'temporal.updatedAtJsDate()', replacement: 'temporal.UpdatedAtJsDate' },
    ts: {
      preset: ({ field }) => field.temporal.updatedAtJsDate(),
      replacement: ({ field, type }) => field.column(type.temporal.UpdatedAtJsDate()),
    },
  },
  {
    model: 'TimestampBothPhases',
    psl: {
      preset: 'temporal.timestamp(3, onCreate: now, onUpdate: now)',
      replacement: 'Timestamp(3) @onCreate(now()) @onUpdate(now())',
    },
    ts: {
      preset: ({ field }) => field.temporal.timestamp(3, 'now', 'now'),
      replacement: ({ field, type, gen }) =>
        field.column(type.Timestamp(3)).onCreate(gen.now()).onUpdate(gen.now()),
    },
  },
  {
    model: 'TimestampNamedPrecision',
    psl: {
      preset: 'temporal.timestamp(precision: 6, onCreate: now)',
      replacement: 'Timestamp(6) @onCreate(now())',
    },
    ts: {
      preset: ({ field }) => field.temporal.timestamp(6, 'now'),
      replacement: ({ field, type, gen }) => field.column(type.Timestamp(6)).onCreate(gen.now()),
    },
  },
  {
    model: 'TimestampBare',
    psl: { preset: 'temporal.timestamp()', replacement: 'Timestamp' },
    ts: {
      preset: ({ field }) => field.temporal.timestamp(),
      replacement: ({ field, type }) => field.column(type.Timestamp()),
    },
  },
  {
    model: 'TimestamptzOnCreate',
    psl: {
      preset: 'temporal.timestamptz(onCreate: now)',
      replacement: 'Timestamptz @onCreate(now())',
    },
    ts: {
      preset: ({ field }) => field.temporal.timestamptz(undefined, 'now'),
      replacement: ({ field, type, gen }) => field.column(type.Timestamptz()).onCreate(gen.now()),
    },
  },
  {
    model: 'TimestamptzBare',
    psl: { preset: 'temporal.timestamptz()', replacement: 'Timestamptz' },
    ts: {
      preset: ({ field }) => field.temporal.timestamptz(),
      replacement: ({ field, type }) => field.column(type.Timestamptz()),
    },
  },
  {
    model: 'TimestampStringOnUpdate',
    psl: {
      preset: 'temporal.timestampString(6, onUpdate: now)',
      replacement: 'TimestampString(6) @onUpdate(now())',
    },
    ts: {
      preset: ({ field }) => field.temporal.timestampString(6, undefined, 'now'),
      replacement: ({ field, type, gen }) =>
        field.column(type.TimestampString(6)).onUpdate(gen.now()),
    },
  },
  {
    model: 'TimestamptzStringBothPhases',
    psl: {
      preset: 'temporal.timestamptzString(3, onCreate: now, onUpdate: now)',
      replacement: 'TimestamptzString(3) @onCreate(now()) @onUpdate(now())',
    },
    ts: {
      preset: ({ field }) => field.temporal.timestamptzString(3, 'now', 'now'),
      replacement: ({ field, type, gen }) =>
        field.column(type.TimestamptzString(3)).onCreate(gen.now()).onUpdate(gen.now()),
    },
  },
  {
    model: 'TimestamptzJsDateOnCreate',
    psl: {
      preset: 'temporal.timestamptzJsDate(3, onCreate: now)',
      replacement: 'TimestamptzJsDate(3) @onCreate(now())',
    },
    ts: {
      preset: ({ field }) => field.temporal.timestamptzJsDate(3, 'now'),
      replacement: ({ field, type, gen }) =>
        field.column(type.TimestamptzJsDate(3)).onCreate(gen.now()),
    },
  },
  {
    model: 'DateColumn',
    psl: { preset: 'temporal.date(onCreate: now)', replacement: 'Date @onCreate(now())' },
    ts: {
      preset: ({ field }) => field.temporal.date('now'),
      replacement: ({ field, type, gen }) => field.column(type.Date()).onCreate(gen.now()),
    },
  },
  {
    model: 'DateStringBothPhases',
    psl: {
      preset: 'temporal.dateString(onCreate: now, onUpdate: now)',
      replacement: 'DateString @onCreate(now()) @onUpdate(now())',
    },
    ts: {
      preset: ({ field }) => field.temporal.dateString('now', 'now'),
      replacement: ({ field, type, gen }) =>
        field.column(type.DateString()).onCreate(gen.now()).onUpdate(gen.now()),
    },
  },
  {
    model: 'TimeOnUpdate',
    psl: { preset: 'temporal.time(3, onUpdate: now)', replacement: 'Time(3) @onUpdate(now())' },
    ts: {
      preset: ({ field }) => field.temporal.time(3, undefined, 'now'),
      replacement: ({ field, type, gen }) => field.column(type.Time(3)).onUpdate(gen.now()),
    },
  },
  {
    model: 'TimeWithoutPrecision',
    psl: { preset: 'temporal.time(onCreate: now)', replacement: 'Time @onCreate(now())' },
    ts: {
      preset: ({ field }) => field.temporal.time(undefined, 'now'),
      replacement: ({ field, type, gen }) => field.column(type.Time()).onCreate(gen.now()),
    },
  },
  {
    model: 'TimeStringOnCreate',
    psl: {
      preset: 'temporal.timeString(3, onCreate: now)',
      replacement: 'TimeString(3) @onCreate(now())',
    },
    ts: {
      preset: ({ field }) => field.temporal.timeString(3, 'now'),
      replacement: ({ field, type, gen }) => field.column(type.TimeString(3)).onCreate(gen.now()),
    },
  },
  {
    model: 'TimetzBothPhases',
    psl: {
      preset: 'temporal.timetz(6, onCreate: now, onUpdate: now)',
      replacement: 'Timetz(6) @onCreate(now()) @onUpdate(now())',
    },
    ts: {
      preset: ({ field }) => field.temporal.timetz(6, 'now', 'now'),
      replacement: ({ field, type, gen }) =>
        field.column(type.Timetz(6)).onCreate(gen.now()).onUpdate(gen.now()),
    },
  },
  {
    model: 'OptionalCreatedAt',
    psl: { preset: 'temporal.createdAt()?', replacement: 'temporal.CreatedAt?' },
    ts: {
      preset: ({ field }) => field.temporal.createdAt().optional(),
      replacement: ({ field, type }) => field.column(type.temporal.CreatedAt()).optional(),
    },
  },
  {
    model: 'MappedUpdatedAt',
    psl: {
      preset: 'temporal.updatedAt() @map("updated_at")',
      replacement: 'temporal.UpdatedAt @map("updated_at")',
    },
    ts: {
      preset: ({ field }) => field.temporal.updatedAt().column('updated_at'),
      replacement: ({ field, type }) =>
        field.column(type.temporal.UpdatedAt()).column('updated_at'),
    },
  },
  {
    model: 'UpdateOnlyWithOnCreate',
    psl: {
      preset: 'temporal.timestamptz(onUpdate: now) @onCreate(now())',
      replacement: 'Timestamptz @onCreate(now()) @onUpdate(now())',
    },
    ts: {
      preset: ({ field, gen }) =>
        field.temporal.timestamptz(undefined, undefined, 'now').onCreate(gen.now()),
      replacement: ({ field, type, gen }) =>
        field.column(type.Timestamptz()).onCreate(gen.now()).onUpdate(gen.now()),
    },
  },
  {
    model: 'UpdateOnlyWithDefault',
    psl: {
      preset: 'temporal.timestamptz(onUpdate: now) @default(now())',
      replacement: 'Timestamptz @onUpdate(now()) @default(now())',
    },
    ts: {
      preset: ({ field }) => field.temporal.timestamptz(undefined, undefined, 'now').default(now()),
      replacement: ({ field, type, gen }) =>
        field.column(type.Timestamptz()).onUpdate(gen.now()).default(now()),
    },
  },
  {
    model: 'IdUuidv4StringNamed',
    id: true,
    psl: { replacement: 'Char(36) @id(map: "IdUuidv4StringNamed_pk") @onCreate(uuid())' },
    ts: {
      preset: ({ field }) => field.id.uuidv4String({ name: 'IdUuidv4StringNamed_pk' }),
      replacement: ({ field, type, gen }) =>
        field.column(type.Char(36)).id({ name: 'IdUuidv4StringNamed_pk' }).onCreate(gen.uuid()),
    },
  },
];

export const sqliteRows: readonly SqlRow<SqliteHelpers>[] = [
  ...familyRows<SqliteHelpers>(
    (length) => `sql.Char(${length})`,
    ({ field, type }, length) => field.column(type.sql.Char(length)),
  ),
  ...generatedRows<SqliteHelpers>(
    (length) => `sql.Char(${length})`,
    ({ field, type }, length) => field.column(type.sql.Char(length)),
  ),
  {
    model: 'CreatedAt',
    psl: { preset: 'temporal.createdAt()', replacement: 'temporal.CreatedAt' },
    ts: {
      preset: ({ field }) => field.temporal.createdAt(),
      replacement: ({ field, type }) => field.column(type.temporal.CreatedAt()),
    },
  },
  {
    model: 'UpdatedAt',
    psl: { preset: 'temporal.updatedAt()', replacement: 'temporal.UpdatedAt' },
    ts: {
      preset: ({ field }) => field.temporal.updatedAt(),
      replacement: ({ field, type }) => field.column(type.temporal.UpdatedAt()),
    },
  },
  {
    model: 'DatetimeBothPhases',
    psl: {
      preset: 'temporal.datetime(onCreate: now, onUpdate: now)',
      replacement: 'DateTime @onCreate(now()) @onUpdate(now())',
    },
    ts: {
      preset: ({ field }) => field.temporal.datetime('now', 'now'),
      replacement: ({ field, type, gen }) =>
        field.column(type.DateTime()).onCreate(gen.now()).onUpdate(gen.now()),
    },
  },
  {
    model: 'DatetimeOnCreate',
    psl: { preset: 'temporal.datetime(onCreate: now)', replacement: 'DateTime @onCreate(now())' },
    ts: {
      preset: ({ field }) => field.temporal.datetime('now'),
      replacement: ({ field, type, gen }) => field.column(type.DateTime()).onCreate(gen.now()),
    },
  },
];

export const mongoRows: readonly MongoRow[] = [
  {
    model: 'CreatedAt',
    psl: { preset: 'temporal.createdAt()', replacement: 'temporal.CreatedAt' },
    ts: {
      preset: ({ field }) => field.temporal.createdAt(),
      replacement: ({ field, gen }) => field.date().onCreate(gen.now()),
    },
  },
  {
    model: 'UpdatedAt',
    psl: { preset: 'temporal.updatedAt()', replacement: 'temporal.UpdatedAt' },
    ts: {
      preset: ({ field }) => field.temporal.updatedAt(),
      replacement: ({ field, gen }) => field.date().onCreate(gen.now()).onUpdate(gen.now()),
    },
  },
  {
    model: 'TimestampBothPhases',
    psl: {
      preset: 'temporal.timestamp(onCreate: now, onUpdate: now)',
      replacement: 'Date @onCreate(now()) @onUpdate(now())',
    },
    ts: {
      preset: ({ field }) => field.temporal.timestamp('now', 'now'),
      replacement: ({ field, gen }) => field.date().onCreate(gen.now()).onUpdate(gen.now()),
    },
  },
  {
    model: 'TimestampOnUpdate',
    psl: { preset: 'temporal.timestamp(onUpdate: now)', replacement: 'Date @onUpdate(now())' },
    ts: {
      preset: ({ field }) => field.temporal.timestamp(undefined, 'now'),
      replacement: ({ field, gen }) => field.date().onUpdate(gen.now()),
    },
  },
];
