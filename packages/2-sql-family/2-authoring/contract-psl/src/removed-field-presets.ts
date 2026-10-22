import {
  type ContributedTypeNamespace,
  contributedTypeAt,
  contributedTypeCodecId,
  type ResolvedTypeConstructorCall,
} from '@internal/psl-parser';
import { argumentsByParameter, printTypeConstructorCall } from '@internal/psl-parser/interpret';

/**
 * A field preset Prisma 8 removed, and how to write what it stored. The preset is named only where its rewrite's type resolves to `codecId`, so a row does not fire on a target the preset never existed on; a row with no `codecId` writes a type alias that only the targets with the preset contribute.
 */
interface RemovedFieldPreset {
  readonly type: readonly string[];
  readonly codecId?: string;
  readonly rewrite: (call: ResolvedTypeConstructorCall) => string;
}

const CHARACTER_CODEC_ID = 'sql/char@1';
const PHASES = ['onCreate', 'onUpdate'] as const;

function fixed(written: string, codecId?: string): RemovedFieldPreset {
  const [type = written] = written.split(/[ (]/);
  return {
    type: type.split('.'),
    ...(codecId === undefined ? {} : { codecId }),
    rewrite: () => `Write ${written}.`,
  };
}

function phased(type: string, codecId: string, takesPrecision: boolean): RemovedFieldPreset {
  const parameters = takesPrecision ? ['precision', ...PHASES] : [...PHASES];
  const fallback = `Write ${type}${takesPrecision ? '(...)' : ''} with @onCreate(now()) and @onUpdate(now()) for the phases the preset set.`;
  return {
    type: [type],
    codecId,
    rewrite: (call) => {
      const args = argumentsByParameter(call.args, parameters);
      const precision = args?.get('precision');
      if (
        args === undefined ||
        (precision !== undefined && !/^\d+$/.test(precision)) ||
        PHASES.some((phase) => args.has(phase) && args.get(phase) !== 'now')
      ) {
        return fallback;
      }
      const attributes = PHASES.filter((phase) => args.has(phase)).map(
        (phase) => ` @${phase}(now())`,
      );
      return `Write ${type}${precision === undefined ? '' : `(${precision})`}${attributes.join('')}.`;
    },
  };
}

const NANOID_OPTIONS = /^\{\s*(?:size\s*:\s*(\d+)\s*,?\s*)?\}$/;

function nanoidSize(call: ResolvedTypeConstructorCall): { readonly size?: string } | undefined {
  const [options, ...rest] = call.args;
  if (options === undefined) return {};
  if (rest.length > 0 || options.kind !== 'positional') return undefined;
  const match = NANOID_OPTIONS.exec(options.value);
  if (match === null) return undefined;
  return match[1] === undefined ? {} : { size: match[1] };
}

function nanoid(id: boolean): RemovedFieldPreset {
  const write = (size: string | undefined) =>
    id ? `sql.Char(${size ?? 21}) @id @onCreate(nanoid(${size ?? ''}))` : `sql.Char(${size ?? 21})`;
  return {
    type: ['sql', 'Char'],
    codecId: CHARACTER_CODEC_ID,
    rewrite: (call) => {
      const options = nanoidSize(call);
      return options === undefined
        ? `Write ${write(undefined)}, or ${write('n')} for a size of n.`
        : `Write ${write(options.size)}.`;
    },
  };
}

const REMOVED_FIELD_PRESETS: Readonly<Record<string, RemovedFieldPreset>> = {
  uuidString: fixed('sql.Char(36)', CHARACTER_CODEC_ID),
  ulid: fixed('sql.Char(26)', CHARACTER_CODEC_ID),
  nanoid: nanoid(false),
  cuid2: fixed('sql.Char(24)', CHARACTER_CODEC_ID),
  ksuid: fixed('sql.Char(27)', CHARACTER_CODEC_ID),
  'id.uuidv4String': fixed('sql.Char(36) @id @onCreate(uuid())', CHARACTER_CODEC_ID),
  'id.uuidv7String': fixed('sql.Char(36) @id @onCreate(uuid(7))', CHARACTER_CODEC_ID),
  'id.ulid': fixed('sql.Char(26) @id @onCreate(ulid())', CHARACTER_CODEC_ID),
  'id.nanoid': nanoid(true),
  'id.cuid2': fixed('sql.Char(24) @id @onCreate(cuid(2))', CHARACTER_CODEC_ID),
  'id.ksuid': fixed('sql.Char(27) @id @onCreate(ksuid())', CHARACTER_CODEC_ID),
  text: fixed('String', 'pg/text@1'),
  int: fixed('Int', 'pg/int4@1'),
  bigint: fixed('BigInt', 'pg/int8@1'),
  float: fixed('Float', 'pg/float8@1'),
  decimal: fixed('Decimal', 'pg/numeric@1'),
  boolean: fixed('Boolean', 'pg/bool@1'),
  json: fixed('Jsonb', 'pg/jsonb@1'),
  bytes: fixed('Bytes', 'pg/bytea@1'),
  dateTime: fixed('DateTime', 'pg/timestamptz-temporal@1'),
  uuidNative: fixed('Uuid', 'pg/uuid@1'),
  'id.uuidv4Native': fixed('Uuid @id @onCreate(uuid())', 'pg/uuid@1'),
  'id.uuidv7Native': fixed('Uuid @id @onCreate(uuid(7))', 'pg/uuid@1'),
  'temporal.createdAt': fixed('temporal.CreatedAt'),
  'temporal.updatedAt': fixed('temporal.UpdatedAt'),
  'temporal.createdAtString': fixed('temporal.CreatedAtString'),
  'temporal.updatedAtString': fixed('temporal.UpdatedAtString'),
  'temporal.createdAtJsDate': fixed('temporal.CreatedAtJsDate'),
  'temporal.updatedAtJsDate': fixed('temporal.UpdatedAtJsDate'),
  'temporal.timestamp': phased('Timestamp', 'pg/timestamp-temporal@1', true),
  'temporal.timestamptz': phased('Timestamptz', 'pg/timestamptz-temporal@1', true),
  'temporal.timestampString': phased('TimestampString', 'pg/timestamp-string@1', true),
  'temporal.timestamptzString': phased('TimestamptzString', 'pg/timestamptz-string@1', true),
  'temporal.timestamptzJsDate': phased('TimestamptzJsDate', 'pg/timestamptz-date@1', true),
  'temporal.date': phased('Date', 'pg/date-temporal@1', false),
  'temporal.dateString': phased('DateString', 'pg/date-string@1', false),
  'temporal.time': phased('Time', 'pg/time-temporal@1', true),
  'temporal.timeString': phased('TimeString', 'pg/time-string@1', true),
  'temporal.timetz': phased('Timetz', 'pg/timetz@1', true),
  'temporal.datetime': phased('DateTime', 'sqlite/datetime@1', false),
};

/**
 * The refusal of a call to a field preset Prisma 8 removed, naming what to write instead, or `undefined` when the call names no removed preset of a target whose types `types` holds.
 */
export function describeRemovedFieldPreset(
  call: ResolvedTypeConstructorCall,
  types: ContributedTypeNamespace,
): string | undefined {
  const path = call.path.join('.');
  const preset = Object.hasOwn(REMOVED_FIELD_PRESETS, path)
    ? REMOVED_FIELD_PRESETS[path]
    : undefined;
  if (preset === undefined) return undefined;
  const replacement = contributedTypeAt(types, preset.type);
  if (
    replacement === undefined ||
    (preset.codecId !== undefined && contributedTypeCodecId(replacement) !== preset.codecId)
  ) {
    return undefined;
  }
  return `${printTypeConstructorCall(call)} was a field preset, and Prisma 8 removed field presets. ${preset.rewrite(call)}`;
}
