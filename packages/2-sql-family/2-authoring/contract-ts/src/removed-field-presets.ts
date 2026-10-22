import { answerMissingPropertyReads } from '@internal/contract-authoring';
import { contractError } from './contract-errors';

const GUIDE = 'The upgrade guide "Field presets are removed" lists every rewrite.';

const char = (length: number | 'n') => `field.column(type.sql.Char(${length}))`;
const id = (column: string, generator: string) => `${column}.id().onCreate(gen.${generator})`;
const withPhases = (type: string, precision: boolean) =>
  `field.column(type.${type}(${precision ? 'p' : ''})), with .onCreate(gen.now()) and .onUpdate(gen.now()) for the phases the preset set${precision ? ', and without p when it set no precision' : ''}`;

const REWRITES: Readonly<Record<string, string>> = {
  uuidString: char(36),
  ulid: char(26),
  nanoid: `${char(21)}, or ${char('n')} for nanoid({ size: n })`,
  cuid2: char(24),
  ksuid: char(27),
  text: 'field.column(type.String())',
  int: 'field.column(type.Int())',
  bigint: 'field.column(type.BigInt())',
  float: 'field.column(type.Float())',
  decimal: 'field.column(type.Decimal())',
  boolean: 'field.column(type.Boolean())',
  json: 'field.column(type.Jsonb())',
  bytes: 'field.column(type.Bytes())',
  dateTime: 'field.column(type.DateTime())',
  uuidNative: 'field.column(type.Uuid())',
  generated: `field.column(type.sql.Char(n)).onCreate(gen.fn()), such as ${char(36)}.onCreate(gen.uuid()) for field.generated(uuidv4())`,
  'id.uuidv4String': id(char(36), 'uuid()'),
  'id.uuidv7String': id(char(36), 'uuid(7)'),
  'id.ulid': id(char(26), 'ulid()'),
  'id.nanoid': `${id(char(21), 'nanoid()')}, or ${id(char('n'), 'nanoid(n)')} for id.nanoid({ size: n })`,
  'id.cuid2': id(char(24), 'cuid(2)'),
  'id.ksuid': id(char(27), 'ksuid()'),
  'id.uuidv4Native': id('field.column(type.Uuid())', 'uuid()'),
  'id.uuidv7Native': id('field.column(type.Uuid())', 'uuid(7)'),
  'temporal.createdAt': 'field.column(type.temporal.CreatedAt())',
  'temporal.updatedAt': 'field.column(type.temporal.UpdatedAt())',
  'temporal.createdAtString': 'field.column(type.temporal.CreatedAtString())',
  'temporal.updatedAtString': 'field.column(type.temporal.UpdatedAtString())',
  'temporal.createdAtJsDate': 'field.column(type.temporal.CreatedAtJsDate())',
  'temporal.updatedAtJsDate': 'field.column(type.temporal.UpdatedAtJsDate())',
  'temporal.timestamp': withPhases('Timestamp', true),
  'temporal.timestamptz': withPhases('Timestamptz', true),
  'temporal.timestampString': withPhases('TimestampString', true),
  'temporal.timestamptzString': withPhases('TimestamptzString', true),
  'temporal.timestamptzJsDate': withPhases('TimestamptzJsDate', true),
  'temporal.date': withPhases('Date', false),
  'temporal.dateString': withPhases('DateString', false),
  'temporal.time': withPhases('Time', true),
  'temporal.timeString': withPhases('TimeString', true),
  'temporal.timetz': withPhases('Timetz', true),
  'temporal.datetime': withPhases('DateTime', false),
};

const NAMESPACES = new Set(['id', 'temporal']);

function refuse(path: string): never {
  const helper = `field.${path}`;
  const rewrite = Object.hasOwn(REWRITES, path) ? REWRITES[path] : undefined;
  throw contractError(
    'CONTRACT.FIELD_HELPER_UNKNOWN',
    rewrite === undefined
      ? `${helper} does not exist. Prisma 8 removed field presets: declare a column as field.column(type.X(...)), add .id(), .onCreate(gen.fn()) and .onUpdate(gen.fn()) for what a preset set, or use a type alias such as field.column(type.temporal.CreatedAt()). ${GUIDE}`
      : `${helper} was a field preset, and Prisma 8 removed field presets. Write ${rewrite}. ${GUIDE}`,
    { meta: { helper } },
  );
}

/**
 * The SQL `field` helpers, where a read of a helper they do not have throws `CONTRACT.FIELD_HELPER_UNKNOWN`. A JavaScript caller, or a contract emitted before it is type-checked, that still calls a removed field preset learns its rewrite; `field.id` and `field.temporal`, which held presets, give the rewrite of the preset read from them.
 */
export function refusingRemovedFieldPresets<Helpers extends object>(helpers: Helpers): Helpers {
  return answerMissingPropertyReads(helpers, (name) =>
    NAMESPACES.has(name)
      ? answerMissingPropertyReads({}, (member) => refuse(`${name}.${member}`))
      : refuse(name),
  );
}
