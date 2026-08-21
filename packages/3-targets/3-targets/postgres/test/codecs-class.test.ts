import { describe, expect, it } from 'vitest';
import {
  PG_BIT_CODEC_ID,
  PG_BOOL_CODEC_ID,
  PG_DATE_CODEC_ID,
  PG_FLOAT4_CODEC_ID,
  PG_FLOAT8_CODEC_ID,
  PG_INET_CODEC_ID,
  PG_INT2_CODEC_ID,
  PG_INT4_CODEC_ID,
  PG_INT8_CODEC_ID,
  PG_INTERVAL_CODEC_ID,
  PG_JSON_CODEC_ID,
  PG_JSONB_CODEC_ID,
  PG_NUMERIC_CODEC_ID,
  PG_TEXT_CODEC_ID,
  PG_TIME_CODEC_ID,
  PG_TIMESTAMP_CODEC_ID,
  PG_TIMESTAMPTZ_CODEC_ID,
  PG_TIMETZ_CODEC_ID,
  PG_UUID_CODEC_ID,
  PG_VARBIT_CODEC_ID,
} from '../src/core/codec-ids';
import {
  pgBitDescriptor,
  pgBoolDescriptor,
  pgDateDescriptor,
  pgFloat4Descriptor,
  pgFloat8Descriptor,
  pgInetDescriptor,
  pgInt2Descriptor,
  pgInt4Descriptor,
  pgInt8Descriptor,
  pgIntervalDescriptor,
  pgJsonbDescriptor,
  pgJsonDescriptor,
  pgNumericDescriptor,
  pgTextDescriptor,
  pgTimeDescriptor,
  pgTimestampDescriptor,
  pgTimestamptzDescriptor,
  pgTimetzDescriptor,
  pgUuidDescriptor,
  pgVarbitDescriptor,
} from '../src/core/codecs';

const instanceCtx = { name: '<test>' };
const callCtx = {};

describe('codecs-class', () => {
  describe('pg/text@1', () => {
    const codec = pgTextDescriptor.factory()(instanceCtx);

    it('id proxies through the descriptor', () => {
      expect(codec.id).toBe(PG_TEXT_CODEC_ID);
    });

    it('encodes and decodes string values verbatim', async () => {
      expect(await codec.encode('hello', callCtx)).toBe('hello');
      expect(await codec.decode('hello', callCtx)).toBe('hello');
    });

    it('round-trips through JSON identity', () => {
      expect(codec.encodeJson('hello')).toBe('hello');
      expect(codec.decodeJson('hello')).toBe('hello');
    });
  });

  describe('pg/int4@1', () => {
    const codec = pgInt4Descriptor.factory()(instanceCtx);
    it('id proxies through the descriptor', () => {
      expect(codec.id).toBe(PG_INT4_CODEC_ID);
    });
    it('encodes and decodes number values verbatim', async () => {
      expect(await codec.encode(42, callCtx)).toBe(42);
      expect(await codec.decode(42, callCtx)).toBe(42);
    });
  });

  describe('pg/int2@1', () => {
    const codec = pgInt2Descriptor.factory()(instanceCtx);
    it('id proxies through the descriptor', () => {
      expect(codec.id).toBe(PG_INT2_CODEC_ID);
    });
    it('encodes and decodes number values verbatim', async () => {
      expect(await codec.encode(7, callCtx)).toBe(7);
      expect(await codec.decode(7, callCtx)).toBe(7);
    });
  });

  describe('pg/int8@1', () => {
    const codec = pgInt8Descriptor.factory()(instanceCtx);
    it('id proxies through the descriptor', () => {
      expect(codec.id).toBe(PG_INT8_CODEC_ID);
    });
    it('encodes to decimal text and decodes the wire string to bigint', async () => {
      expect(await codec.encode(9_999_999_999n, callCtx)).toBe('9999999999');
      expect(await codec.decode('9999999999', callCtx)).toBe(9_999_999_999n);
    });
    it('carries a value past the safe-integer range', async () => {
      expect(await codec.encode(9007199254740993n, callCtx)).toBe('9007199254740993');
      expect(await codec.decode('9007199254740993', callCtx)).toBe(9007199254740993n);
    });
  });

  describe('pg/float4@1', () => {
    const codec = pgFloat4Descriptor.factory()(instanceCtx);
    it('id proxies through the descriptor', () => {
      expect(codec.id).toBe(PG_FLOAT4_CODEC_ID);
    });
    it('encodes and decodes number values verbatim', async () => {
      expect(await codec.encode(3.14, callCtx)).toBe(3.14);
      expect(await codec.decode(3.14, callCtx)).toBe(3.14);
    });
  });

  describe('pg/float8@1', () => {
    const codec = pgFloat8Descriptor.factory()(instanceCtx);
    it('id proxies through the descriptor', () => {
      expect(codec.id).toBe(PG_FLOAT8_CODEC_ID);
    });
    it('encodes and decodes number values verbatim', async () => {
      expect(await codec.encode(Math.E, callCtx)).toBe(Math.E);
      expect(await codec.decode(Math.E, callCtx)).toBe(Math.E);
    });
  });

  describe('pg/bool@1', () => {
    const codec = pgBoolDescriptor.factory()(instanceCtx);
    it('id proxies through the descriptor', () => {
      expect(codec.id).toBe(PG_BOOL_CODEC_ID);
    });
    it('encodes and decodes boolean values verbatim', async () => {
      expect(await codec.encode(true, callCtx)).toBe(true);
      expect(await codec.decode(false, callCtx)).toBe(false);
    });
  });

  describe('pg/numeric@1', () => {
    const codec = pgNumericDescriptor.factory({ precision: 10, scale: 2 })(instanceCtx);

    it('id proxies through the descriptor (independent of params)', () => {
      expect(codec.id).toBe(PG_NUMERIC_CODEC_ID);
    });

    it('encodes string verbatim', async () => {
      expect(await codec.encode('123.45', callCtx)).toBe('123.45');
    });

    it('decodes string verbatim and coerces number to string', async () => {
      expect(await codec.decode('123.45', callCtx)).toBe('123.45');
      expect(await codec.decode(123 as unknown as string, callCtx)).toBe('123');
    });

    it('renderOutputType returns Numeric<precision, scale>', () => {
      expect(pgNumericDescriptor.renderOutputType?.({ precision: 10, scale: 2 })).toBe(
        'Numeric<10, 2>',
      );
    });

    it('renderOutputType returns Numeric<precision> when scale absent', () => {
      expect(pgNumericDescriptor.renderOutputType?.({ precision: 10 })).toBe('Numeric<10>');
    });
  });

  describe('pg/numeric@1 with no typeParams (unbounded numeric / bare Decimal)', () => {
    const codec = pgNumericDescriptor.factory({})(instanceCtx);

    it('id proxies through the descriptor', () => {
      expect(codec.id).toBe(PG_NUMERIC_CODEC_ID);
    });

    it('encodes and decodes strings verbatim with no precision/scale supplied', async () => {
      expect(await codec.encode('123.45', callCtx)).toBe('123.45');
      expect(await codec.decode('123.45', callCtx)).toBe('123.45');
    });

    it('renderOutputType returns undefined when precision is absent', () => {
      expect(pgNumericDescriptor.renderOutputType?.({})).toBeUndefined();
    });
  });

  describe('pg/date@1', () => {
    const codec = pgDateDescriptor.factory()(instanceCtx);

    it('id proxies through the descriptor', () => {
      expect(codec.id).toBe(PG_DATE_CODEC_ID);
    });

    it('decode normalizes a local-midnight Date into canonical UTC midnight', async () => {
      // Simulates what the pg driver hands the codec for a `date` column: a
      // `Date` built at *local* midnight (postgres-date's `getDate`), e.g.
      // `new Date(2024, 0, 15)`. Regardless of the process's timezone, decode
      // must recover the same calendar date at UTC midnight.
      const localMidnight = new Date(2024, 0, 15);
      const decoded = await codec.decode(localMidnight, callCtx);
      expect(decoded.getTime()).toBe(Date.UTC(2024, 0, 15));
    });

    it('encode formats the UTC calendar date as YYYY-MM-DD, independent of local getters', async () => {
      const utcMidnight = new Date(Date.UTC(2024, 0, 15));
      expect(await codec.encode(utcMidnight, callCtx)).toBe('2024-01-15');
    });

    it('round-trips a calendar date through encode -> decode unchanged', async () => {
      const original = new Date(Date.UTC(2024, 0, 15));
      const wireText = await codec.encode(original, callCtx);
      // The driver would parse `wireText` back into a Date; decode
      // canonicalizes whatever it receives to the same UTC-midnight instant.
      const roundTripped = await codec.decode(new Date(2024, 0, 15), callCtx);
      expect(wireText).toBe('2024-01-15');
      expect(roundTripped.getTime()).toBe(original.getTime());
    });

    it('encodeJson/decodeJson round-trip the YYYY-MM-DD representation', () => {
      const instant = new Date(Date.UTC(2024, 0, 15));
      expect(codec.encodeJson(instant)).toBe('2024-01-15');
      expect(codec.decodeJson('2024-01-15')).toEqual(instant);
    });

    it('throws on invalid JSON input', () => {
      expect(() => codec.decodeJson(42)).toThrow(/Expected date string for pg\/date@1/);
      expect(() => codec.decodeJson('not-a-date')).toThrow(/Invalid date string for pg\/date@1/);
      expect(() => codec.decodeJson('2024-01-15T10:30:00Z')).toThrow(
        /Invalid date string for pg\/date@1/,
      );
    });

    it('throws on calendar-invalid dates instead of silently normalizing them', () => {
      expect(() => codec.decodeJson('2024-02-31')).toThrow(/Invalid date string for pg\/date@1/);
      expect(() => codec.decodeJson('2024-13-01')).toThrow(/Invalid date string for pg\/date@1/);
      expect(() => codec.decodeJson('0024-01-15')).toThrow(/Invalid date string for pg\/date@1/);
    });

    it('still accepts a valid calendar date', () => {
      expect(codec.decodeJson('2024-01-15')).toEqual(new Date(Date.UTC(2024, 0, 15)));
    });

    it('exposes equality-order traits and the date target/native types', () => {
      expect(pgDateDescriptor.traits).toEqual(['equality', 'order']);
      expect(pgDateDescriptor.targetTypes).toEqual(['date']);
      expect(pgDateDescriptor.nativeTypeFor({ codecId: pgDateDescriptor.codecId })).toBe('date');
    });
  });

  describe('pg/timestamp@1', () => {
    const codec = pgTimestampDescriptor.factory({ precision: 3 })(instanceCtx);

    it('id proxies through the descriptor', () => {
      expect(codec.id).toBe(PG_TIMESTAMP_CODEC_ID);
    });

    it('round-trips Date values', async () => {
      const instant = new Date('2024-01-15T10:30:00Z');
      expect(await codec.encode(instant, callCtx)).toBe(instant);
      expect(await codec.decode(instant, callCtx)).toBe(instant);
    });

    it('uses the Postgres JSON timestamp representation', () => {
      const instant = new Date('2024-01-15T10:30:00Z');
      expect(codec.encodeJson(instant)).toBe('2024-01-15T10:30:00.000');
      expect(codec.decodeJson('2024-01-15T10:30:00.000')).toEqual(instant);
    });

    it('throws on invalid JSON input', () => {
      expect(() => codec.decodeJson(42)).toThrow(/Expected ISO date string/);
      expect(() => codec.decodeJson('not-a-date')).toThrow(/Invalid ISO date string/);
    });

    it('renderOutputType returns Timestamp<precision>', () => {
      expect(pgTimestampDescriptor.renderOutputType?.({ precision: 3 })).toBe('Timestamp<3>');
    });

    it('renderOutputType returns bare Timestamp when precision absent', () => {
      expect(pgTimestampDescriptor.renderOutputType?.({})).toBe('Timestamp');
    });
  });

  describe('pg/timestamptz@1', () => {
    const codec = pgTimestamptzDescriptor.factory({ precision: 6 })(instanceCtx);

    it('id proxies through the descriptor', () => {
      expect(codec.id).toBe(PG_TIMESTAMPTZ_CODEC_ID);
    });

    it('encodes the instant as a UTC ISO string and passes the parsed Date through on decode', async () => {
      const instant = new Date('2024-01-15T10:30:00Z');
      expect(await codec.encode(instant, callCtx)).toBe('2024-01-15T10:30:00.000Z');
      expect(await codec.decode(instant, callCtx)).toBe(instant);
    });

    it('uses the Postgres JSON timestamptz representation', () => {
      const instant = new Date('2024-01-15T10:30:00Z');
      expect(codec.encodeJson(instant)).toBe('2024-01-15T10:30:00.000+00:00');
      expect(codec.decodeJson('2024-01-15T10:30:00.000+00:00')).toEqual(instant);
    });

    it('throws on invalid JSON input with pg/timestamptz@1 label', () => {
      expect(() => codec.decodeJson(42)).toThrow(/pg\/timestamptz@1/);
    });
  });

  describe('pg/time@1', () => {
    const codec = pgTimeDescriptor.factory({ precision: 2 })(instanceCtx);
    it('id proxies through the descriptor', () => {
      expect(codec.id).toBe(PG_TIME_CODEC_ID);
    });
    it('round-trips strings verbatim', async () => {
      expect(await codec.encode('10:30:00', callCtx)).toBe('10:30:00');
      expect(await codec.decode('10:30:00', callCtx)).toBe('10:30:00');
    });
    it('renderOutputType formats Time<precision>', () => {
      expect(pgTimeDescriptor.renderOutputType?.({ precision: 2 })).toBe('Time<2>');
    });
  });

  describe('pg/timetz@1', () => {
    const codec = pgTimetzDescriptor.factory({})(instanceCtx);
    it('id proxies through the descriptor', () => {
      expect(codec.id).toBe(PG_TIMETZ_CODEC_ID);
    });
    it('round-trips strings verbatim', async () => {
      expect(await codec.encode('10:30:00+00', callCtx)).toBe('10:30:00+00');
      expect(await codec.decode('10:30:00+00', callCtx)).toBe('10:30:00+00');
    });
  });

  describe('pg/bit@1', () => {
    const codec = pgBitDescriptor.factory({ length: 8 })(instanceCtx);
    it('id proxies through the descriptor', () => {
      expect(codec.id).toBe(PG_BIT_CODEC_ID);
    });
    it('round-trips bit strings verbatim', async () => {
      expect(await codec.encode('10101010', callCtx)).toBe('10101010');
      expect(await codec.decode('10101010', callCtx)).toBe('10101010');
    });
    it('renderOutputType returns Bit<length>', () => {
      expect(pgBitDescriptor.renderOutputType?.({ length: 8 })).toBe('Bit<8>');
    });
    it('renderOutputType returns undefined when length absent', () => {
      expect(pgBitDescriptor.renderOutputType?.({})).toBeUndefined();
    });
  });

  describe('pg/varbit@1', () => {
    const codec = pgVarbitDescriptor.factory({ length: 16 })(instanceCtx);
    it('id proxies through the descriptor', () => {
      expect(codec.id).toBe(PG_VARBIT_CODEC_ID);
    });
    it('round-trips bit strings verbatim', async () => {
      expect(await codec.encode('1010', callCtx)).toBe('1010');
      expect(await codec.decode('1010', callCtx)).toBe('1010');
    });
    it('renderOutputType returns VarBit<length>', () => {
      expect(pgVarbitDescriptor.renderOutputType?.({ length: 16 })).toBe('VarBit<16>');
    });
  });

  describe('pg/interval@1', () => {
    const codec = pgIntervalDescriptor.factory({})(instanceCtx);

    it('id proxies through the descriptor', () => {
      expect(codec.id).toBe(PG_INTERVAL_CODEC_ID);
    });

    it('writes the value as the ISO duration PostgreSQL accepts', async () => {
      expect(await codec.encode({ months: 0, days: 1, micros: 0n }, callCtx)).toBe('P1D');
    });

    it('reads a text wire value into the three fields', async () => {
      expect(await codec.decode('P0Y1M', callCtx)).toEqual({ months: 1, days: 0, micros: 0n });
    });

    it('reads the driver component object into the three fields', async () => {
      expect(await codec.decode({ days: 1 } as unknown as string, callCtx)).toEqual({
        months: 0,
        days: 1,
        micros: 0n,
      });
    });
  });

  describe('pg/json@1', () => {
    const codec = pgJsonDescriptor.factory()(instanceCtx);

    it('id proxies through the descriptor', () => {
      expect(codec.id).toBe(PG_JSON_CODEC_ID);
    });

    it('encodes JsonValue to JSON string', async () => {
      expect(await codec.encode({ key: 'value' }, callCtx)).toBe('{"key":"value"}');
    });

    it('decodes JSON string to value', async () => {
      expect(await codec.decode('{"key":"value"}', callCtx)).toEqual({ key: 'value' });
    });

    it('decode passes through already-decoded values', async () => {
      expect(await codec.decode({ key: 'value' }, callCtx)).toEqual({ key: 'value' });
    });
  });

  describe('pg/jsonb@1', () => {
    const codec = pgJsonbDescriptor.factory()(instanceCtx);

    it('id proxies through the descriptor', () => {
      expect(codec.id).toBe(PG_JSONB_CODEC_ID);
    });

    it('encodes JsonValue to JSON string', async () => {
      expect(await codec.encode([1, 2, 3], callCtx)).toBe('[1,2,3]');
    });

    it('decodes JSON string to value', async () => {
      expect(await codec.decode('[1,2,3]', callCtx)).toEqual([1, 2, 3]);
    });

    it('decode passes through already-decoded values', async () => {
      expect(await codec.decode([1, 2, 3], callCtx)).toEqual([1, 2, 3]);
    });
  });

  describe('pg/uuid@1', () => {
    const codec = pgUuidDescriptor.factory()(instanceCtx);
    const SAMPLE_UUID = '550e8400-e29b-41d4-a716-446655440000';

    it('id proxies through the descriptor', () => {
      expect(codec.id).toBe(PG_UUID_CODEC_ID);
    });

    it('encodes and decodes string values verbatim', async () => {
      expect(await codec.encode(SAMPLE_UUID, callCtx)).toBe(SAMPLE_UUID);
      expect(await codec.decode(SAMPLE_UUID, callCtx)).toBe(SAMPLE_UUID);
    });

    it('round-trips through JSON identity', () => {
      expect(codec.encodeJson(SAMPLE_UUID)).toBe(SAMPLE_UUID);
      expect(codec.decodeJson(SAMPLE_UUID)).toBe(SAMPLE_UUID);
    });
  });

  describe('pg/inet@1', () => {
    const codec = pgInetDescriptor.factory()(instanceCtx);
    const SAMPLE_INET = '192.168.1.1';

    it('id proxies through the descriptor', () => {
      expect(codec.id).toBe(PG_INET_CODEC_ID);
    });

    it('encodes and decodes string values verbatim', async () => {
      expect(await codec.encode(SAMPLE_INET, callCtx)).toBe(SAMPLE_INET);
      expect(await codec.decode(SAMPLE_INET, callCtx)).toBe(SAMPLE_INET);
    });

    it('round-trips through JSON identity', () => {
      expect(codec.encodeJson(SAMPLE_INET)).toBe(SAMPLE_INET);
      expect(codec.decodeJson(SAMPLE_INET)).toBe(SAMPLE_INET);
    });
  });

  describe('descriptor metadata', () => {
    it('codec ids match the PG_*_CODEC_ID constants', () => {
      expect(pgTextDescriptor.codecId).toBe(PG_TEXT_CODEC_ID);
      expect(pgInt4Descriptor.codecId).toBe(PG_INT4_CODEC_ID);
      expect(pgInt2Descriptor.codecId).toBe(PG_INT2_CODEC_ID);
      expect(pgInt8Descriptor.codecId).toBe(PG_INT8_CODEC_ID);
      expect(pgFloat4Descriptor.codecId).toBe(PG_FLOAT4_CODEC_ID);
      expect(pgFloat8Descriptor.codecId).toBe(PG_FLOAT8_CODEC_ID);
      expect(pgBoolDescriptor.codecId).toBe(PG_BOOL_CODEC_ID);
      expect(pgNumericDescriptor.codecId).toBe(PG_NUMERIC_CODEC_ID);
      expect(pgTimestampDescriptor.codecId).toBe(PG_TIMESTAMP_CODEC_ID);
      expect(pgTimestamptzDescriptor.codecId).toBe(PG_TIMESTAMPTZ_CODEC_ID);
      expect(pgTimeDescriptor.codecId).toBe(PG_TIME_CODEC_ID);
      expect(pgTimetzDescriptor.codecId).toBe(PG_TIMETZ_CODEC_ID);
      expect(pgBitDescriptor.codecId).toBe(PG_BIT_CODEC_ID);
      expect(pgVarbitDescriptor.codecId).toBe(PG_VARBIT_CODEC_ID);
      expect(pgIntervalDescriptor.codecId).toBe(PG_INTERVAL_CODEC_ID);
      expect(pgJsonDescriptor.codecId).toBe(PG_JSON_CODEC_ID);
      expect(pgJsonbDescriptor.codecId).toBe(PG_JSONB_CODEC_ID);
      expect(pgUuidDescriptor.codecId).toBe(PG_UUID_CODEC_ID);
      expect(pgInetDescriptor.codecId).toBe(PG_INET_CODEC_ID);
    });

    it('states its PostgreSQL native type', () => {
      expect(pgTextDescriptor.nativeTypeFor({ codecId: pgTextDescriptor.codecId })).toBe('text');
      expect(pgInt4Descriptor.nativeTypeFor({ codecId: pgInt4Descriptor.codecId })).toBe('integer');
      expect(pgInt2Descriptor.nativeTypeFor({ codecId: pgInt2Descriptor.codecId })).toBe(
        'smallint',
      );
      expect(pgInt8Descriptor.nativeTypeFor({ codecId: pgInt8Descriptor.codecId })).toBe('bigint');
      expect(pgFloat4Descriptor.nativeTypeFor({ codecId: pgFloat4Descriptor.codecId })).toBe(
        'real',
      );
      expect(pgFloat8Descriptor.nativeTypeFor({ codecId: pgFloat8Descriptor.codecId })).toBe(
        'double precision',
      );
      expect(pgBoolDescriptor.nativeTypeFor({ codecId: pgBoolDescriptor.codecId })).toBe('boolean');
      expect(pgNumericDescriptor.nativeTypeFor({ codecId: pgNumericDescriptor.codecId })).toBe(
        'numeric',
      );
      expect(pgTimestampDescriptor.nativeTypeFor({ codecId: pgTimestampDescriptor.codecId })).toBe(
        'timestamp without time zone',
      );
      expect(
        pgTimestamptzDescriptor.nativeTypeFor({ codecId: pgTimestamptzDescriptor.codecId }),
      ).toBe('timestamp with time zone');
      expect(pgTimeDescriptor.nativeTypeFor({ codecId: pgTimeDescriptor.codecId })).toBe('time');
      expect(pgTimetzDescriptor.nativeTypeFor({ codecId: pgTimetzDescriptor.codecId })).toBe(
        'timetz',
      );
      expect(pgBitDescriptor.nativeTypeFor({ codecId: pgBitDescriptor.codecId })).toBe('bit');
      expect(pgVarbitDescriptor.nativeTypeFor({ codecId: pgVarbitDescriptor.codecId })).toBe(
        'bit varying',
      );
      expect(pgIntervalDescriptor.nativeTypeFor({ codecId: pgIntervalDescriptor.codecId })).toBe(
        'interval',
      );
      expect(pgJsonDescriptor.nativeTypeFor({ codecId: pgJsonDescriptor.codecId })).toBe('json');
      expect(pgJsonbDescriptor.nativeTypeFor({ codecId: pgJsonbDescriptor.codecId })).toBe('jsonb');
      expect(pgUuidDescriptor.nativeTypeFor({ codecId: pgUuidDescriptor.codecId })).toBe('uuid');
      expect(pgInetDescriptor.nativeTypeFor({ codecId: pgInetDescriptor.codecId })).toBe('inet');
    });

    it('exposes traits and targetTypes for each codec', () => {
      expect(pgTextDescriptor.traits).toEqual(['equality', 'order', 'textual']);
      expect(pgInt4Descriptor.traits).toEqual(['equality', 'order', 'numeric']);
      expect(pgBoolDescriptor.traits).toEqual(['equality', 'boolean']);
      expect(pgJsonDescriptor.traits).toEqual([]);
      expect(pgJsonbDescriptor.traits).toEqual(['equality']);

      expect(pgTextDescriptor.targetTypes).toEqual(['text']);
      expect(pgNumericDescriptor.targetTypes).toEqual(['numeric', 'decimal']);
      expect(pgBitDescriptor.targetTypes).toEqual(['bit']);
      expect(pgVarbitDescriptor.targetTypes).toEqual(['bit varying']);
      expect(pgUuidDescriptor.traits).toEqual(['equality', 'order']);
      expect(pgUuidDescriptor.targetTypes).toEqual(['uuid']);
      expect(pgInetDescriptor.traits).toEqual(['equality', 'order']);
      expect(pgInetDescriptor.targetTypes).toEqual(['inet']);
    });
  });
});
