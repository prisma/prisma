import { answerMissingPropertyReads } from '@internal/contract-authoring';
import {
  type AuthoringTypeNamespace,
  isAuthoringTypeAliasDescriptor,
  isAuthoringTypeDescriptor,
} from '@internal/framework-components/authoring';
import { contractError } from './contract-errors';

const GUIDE = 'The upgrade guide "Field presets are removed" lists every rewrite.';

const CHARACTER_CODEC_ID = 'sql/char@1';

/** A removed field preset: its rewrite, named only where the type the rewrite writes resolves, and to `codecId` when one is given, so a row does not fire on a target the preset never existed on. */
interface RemovedFieldPreset {
  readonly type: readonly string[];
  readonly codecId: string | undefined;
  readonly rewrite: string;
}

/** A preset whose rewrite is `rewrite`; its type is the first `type.X(` that `rewrite` writes. */
function writtenAs(rewrite: string, codecId?: string): RemovedFieldPreset {
  const type = /type\.([\w.]+)\(/.exec(rewrite)?.[1] ?? '';
  return { type: type.split('.'), codecId, rewrite };
}

/** Where an identifier alias is looked up: a target's own top-level name first, then the `sql.` name every SQL target has. ADR 307. */
const IDENTIFIER_NAMESPACES = ['', 'sql.'] as const;

type IdentifierNamespace = (typeof IDENTIFIER_NAMESPACES)[number];

/** The rows of a preset whose rewrite `write` makes for each namespace, each named where the namespace has the identifier alias `alias`. */
function identifier(
  alias: string,
  write: (namespace: IdentifierNamespace) => string,
): readonly RemovedFieldPreset[] {
  return IDENTIFIER_NAMESPACES.map((namespace) => ({
    type: `${namespace}${alias}`.split('.'),
    codecId: CHARACTER_CODEC_ID,
    rewrite: write(namespace),
  }));
}

const column = (namespace: IdentifierNamespace, type: string) =>
  `field.column(type.${namespace}${type})`;
const id = (columnText: string, generator: string) =>
  `${columnText}.id().onCreate(gen.${generator})`;
const aliasColumn = (alias: string) =>
  identifier(alias, (namespace) => column(namespace, `${alias}()`));
const aliasId = (alias: string, generator: string) =>
  identifier(alias, (namespace) => id(column(namespace, `${alias}()`), generator));
const withPhases = (type: string, codecId: string, precision: boolean) =>
  writtenAs(
    `field.column(type.${type}(${precision ? 'p' : ''})), with .onCreate(gen.now()) and .onUpdate(gen.now()) for the phases the preset set${precision ? ', and without p when it set no precision' : ''}`,
    codecId,
  );

export const PRESETS: Readonly<Record<string, RemovedFieldPreset | readonly RemovedFieldPreset[]>> =
  {
    uuidString: aliasColumn('UuidString'),
    ulid: aliasColumn('Ulid'),
    nanoid: identifier(
      'Nanoid',
      (namespace) =>
        `${column(namespace, 'Nanoid()')}, or ${column(namespace, 'Char(n)')} for nanoid({ size: n })`,
    ),
    cuid2: aliasColumn('Cuid2'),
    ksuid: aliasColumn('Ksuid'),
    text: writtenAs('field.column(type.String())', 'pg/text@1'),
    int: writtenAs('field.column(type.Int())', 'pg/int4@1'),
    bigint: writtenAs('field.column(type.BigInt())', 'pg/int8@1'),
    float: writtenAs('field.column(type.Float())', 'pg/float8@1'),
    decimal: writtenAs('field.column(type.Decimal())', 'pg/numeric@1'),
    boolean: writtenAs('field.column(type.Boolean())', 'pg/bool@1'),
    json: writtenAs('field.column(type.Jsonb())', 'pg/jsonb@1'),
    bytes: writtenAs('field.column(type.Bytes())', 'pg/bytea@1'),
    dateTime: writtenAs('field.column(type.DateTime())', 'pg/timestamptz-temporal@1'),
    uuidNative: writtenAs('field.column(type.Uuid())', 'pg/uuid@1'),
    generated: identifier(
      'UuidString',
      (namespace) =>
        `${column(namespace, 'Char(n)')}.onCreate(gen.fn()), such as ${column(namespace, 'UuidString()')}.onCreate(gen.uuid()) for field.generated(uuidv4())`,
    ),
    'id.uuidv4String': aliasId('UuidString', 'uuid()'),
    'id.uuidv7String': aliasId('UuidString', 'uuid(7)'),
    'id.ulid': aliasId('Ulid', 'ulid()'),
    'id.nanoid': identifier(
      'Nanoid',
      (namespace) =>
        `${id(column(namespace, 'Nanoid()'), 'nanoid()')}, or ${id(column(namespace, 'Char(n)'), 'nanoid(n)')} for id.nanoid({ size: n })`,
    ),
    'id.cuid2': aliasId('Cuid2', 'cuid(2)'),
    'id.ksuid': aliasId('Ksuid', 'ksuid()'),
    'id.uuidv4Native': writtenAs(id('field.column(type.Uuid())', 'uuid()'), 'pg/uuid@1'),
    'id.uuidv7Native': writtenAs(id('field.column(type.Uuid())', 'uuid(7)'), 'pg/uuid@1'),
    'temporal.createdAt': writtenAs('field.column(type.temporal.CreatedAt())'),
    'temporal.updatedAt': writtenAs('field.column(type.temporal.UpdatedAt())'),
    'temporal.createdAtString': writtenAs('field.column(type.temporal.CreatedAtString())'),
    'temporal.updatedAtString': writtenAs('field.column(type.temporal.UpdatedAtString())'),
    'temporal.createdAtJsDate': writtenAs('field.column(type.temporal.CreatedAtJsDate())'),
    'temporal.updatedAtJsDate': writtenAs('field.column(type.temporal.UpdatedAtJsDate())'),
    'temporal.timestamp': withPhases('Timestamp', 'pg/timestamp-temporal@1', true),
    'temporal.timestamptz': withPhases('Timestamptz', 'pg/timestamptz-temporal@1', true),
    'temporal.timestampString': withPhases('TimestampString', 'pg/timestamp-string@1', true),
    'temporal.timestamptzString': withPhases('TimestamptzString', 'pg/timestamptz-string@1', true),
    'temporal.timestamptzJsDate': withPhases('TimestamptzJsDate', 'pg/timestamptz-date@1', true),
    'temporal.date': withPhases('Date', 'pg/date-temporal@1', false),
    'temporal.dateString': withPhases('DateString', 'pg/date-string@1', false),
    'temporal.time': withPhases('Time', 'pg/time-temporal@1', true),
    'temporal.timeString': withPhases('TimeString', 'pg/time-string@1', true),
    'temporal.timetz': withPhases('Timetz', 'pg/timetz@1', true),
    'temporal.datetime': withPhases('DateTime', 'sqlite/datetime@1', false),
  };

function codecIdAt(types: AuthoringTypeNamespace, path: readonly string[]): string | undefined {
  const [name, ...rest] = path;
  if (name === undefined || !Object.hasOwn(types, name)) return undefined;
  const value = types[name];
  if (value === undefined) return undefined;
  if (!isAuthoringTypeDescriptor(value)) return codecIdAt(value, rest);
  if (rest.length > 0) return undefined;
  return isAuthoringTypeAliasDescriptor(value) ? value.output.type.codecId : value.output.codecId;
}

function appliesTo(preset: RemovedFieldPreset, types: AuthoringTypeNamespace): boolean {
  const codecId = codecIdAt(types, preset.type);
  return codecId !== undefined && (preset.codecId === undefined || codecId === preset.codecId);
}

function rowsOf(
  entry: RemovedFieldPreset | readonly RemovedFieldPreset[],
): readonly RemovedFieldPreset[] {
  return 'rewrite' in entry ? [entry] : entry;
}

function refuse(path: string, types: AuthoringTypeNamespace): never {
  const helper = `field.${path}`;
  const entry = Object.hasOwn(PRESETS, path) ? PRESETS[path] : undefined;
  const preset =
    entry === undefined ? undefined : rowsOf(entry).find((row) => appliesTo(row, types));
  throw contractError(
    'CONTRACT.FIELD_HELPER_UNKNOWN',
    preset !== undefined
      ? `${helper} was a field preset, and Prisma 8 removed field presets. Write ${preset.rewrite}. ${GUIDE}`
      : `${helper} does not exist. Prisma 8 removed field presets: declare a column as field.column(type.X(...)), add .id(), .onCreate(gen.fn()) and .onUpdate(gen.fn()) for what a preset set, or use a type alias such as field.column(type.temporal.CreatedAt()). ${GUIDE}`,
    { meta: { helper } },
  );
}

function membersOf(namespace: string): ReadonlySet<string> {
  return new Set(
    Object.keys(PRESETS)
      .filter((path) => path.startsWith(`${namespace}.`))
      .map((path) => path.slice(namespace.length + 1)),
  );
}

const NAMES: ReadonlySet<string> = new Set(
  Object.keys(PRESETS).map((path) => path.split('.')[0] ?? path),
);

/**
 * The SQL `field` helpers, where a read of a removed field preset throws `CONTRACT.FIELD_HELPER_UNKNOWN`, so a JavaScript caller, or a contract emitted before it is type-checked, learns what to write instead. The rewrite is named where `types`, the stack's `type` namespace, has the type it writes and that type stores the preset's codec; elsewhere the message names the forms that replace presets. `field.id` and `field.temporal`, which held presets, answer the same way for the presets read from them. Every other read behaves as on `helpers`.
 */
export function refusingRemovedFieldPresets<Helpers extends object>(
  helpers: Helpers,
  types: AuthoringTypeNamespace,
): Helpers {
  return answerMissingPropertyReads(helpers, NAMES, (name) =>
    Object.hasOwn(PRESETS, name)
      ? refuse(name, types)
      : answerMissingPropertyReads({}, membersOf(name), (member) =>
          refuse(`${name}.${member}`, types),
        ),
  );
}
