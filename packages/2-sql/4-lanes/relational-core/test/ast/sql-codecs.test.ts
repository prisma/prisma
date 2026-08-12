import { describe, expect, it } from 'vitest';
import {
  SQL_CHAR_CODEC_ID,
  SQL_FLOAT_CODEC_ID,
  SQL_INT_CODEC_ID,
  SQL_TEXT_CODEC_ID,
  SQL_TIMESTAMP_CODEC_ID,
  SQL_VARCHAR_CODEC_ID,
} from '../../src/ast/sql-codec-helpers';
import {
  sqlCharColumn,
  sqlCharDescriptor,
  sqlFloatColumn,
  sqlFloatDescriptor,
  sqlIntColumn,
  sqlIntDescriptor,
  sqlTextColumn,
  sqlTextDescriptor,
  sqlTimestampColumn,
  sqlTimestampDescriptor,
  sqlVarcharColumn,
  sqlVarcharDescriptor,
} from '../../src/ast/sql-codecs';

const instanceCtx = { name: '<test>' };
const callCtx = {};

describe('sql-codecs', () => {
  describe('sql/text@1', () => {
    const codec = sqlTextDescriptor.factory()(instanceCtx);

    it('id proxies through the descriptor', () => {
      expect(codec.id).toBe(SQL_TEXT_CODEC_ID);
    });

    it('encodes and decodes string values', async () => {
      expect(await codec.encode('hello', callCtx)).toBe('hello');
      expect(await codec.decode('hello', callCtx)).toBe('hello');
    });

    it('round-trips through JSON identity', () => {
      expect(codec.encodeJson('hello')).toBe('hello');
      expect(codec.decodeJson('hello')).toBe('hello');
    });
  });

  describe('sql/int@1', () => {
    const codec = sqlIntDescriptor.factory()(instanceCtx);

    it('id proxies through the descriptor', () => {
      expect(codec.id).toBe(SQL_INT_CODEC_ID);
    });

    it('encodes and decodes number values', async () => {
      expect(await codec.encode(42, callCtx)).toBe(42);
      expect(await codec.decode(42, callCtx)).toBe(42);
    });

    it('round-trips through JSON identity', () => {
      expect(codec.encodeJson(42)).toBe(42);
      expect(codec.decodeJson(42)).toBe(42);
    });
  });

  describe('sql/float@1', () => {
    const codec = sqlFloatDescriptor.factory()(instanceCtx);

    it('id proxies through the descriptor', () => {
      expect(codec.id).toBe(SQL_FLOAT_CODEC_ID);
    });

    it('encodes and decodes number values', async () => {
      expect(await codec.encode(3.14, callCtx)).toBe(3.14);
      expect(await codec.decode(3.14, callCtx)).toBe(3.14);
    });

    it('round-trips through JSON identity', () => {
      expect(codec.encodeJson(3.14)).toBe(3.14);
      expect(codec.decodeJson(3.14)).toBe(3.14);
    });

    // A database can hold a non-finite float and spells it as a JSON string —
    // PostgreSQL emits `"NaN"` and `"Infinity"` — which JSON has no number for.
    // The codec's application type is `number`, so it rejects rather than hand
    // back a string wearing that type.
    it('rejects a non-finite value it cannot spell as JSON', () => {
      expect(() => codec.encodeJson(Number.NaN)).toThrow(/finite/);
      expect(() => codec.encodeJson(Number.POSITIVE_INFINITY)).toThrow(/finite/);
    });

    it('rejects the strings a database uses for non-finite floats', () => {
      expect(() => codec.decodeJson('NaN')).toThrow(/sql\/float@1/);
      expect(() => codec.decodeJson('Infinity')).toThrow(/sql\/float@1/);
    });

    it('rejects a JSON value that is not a number', () => {
      expect(() => codec.decodeJson(true)).toThrow(/sql\/float@1/);
      expect(() => codec.decodeJson(null)).toThrow(/sql\/float@1/);
    });
  });

  describe('sql/char@1', () => {
    const codec = sqlCharDescriptor.factory({ length: 8 })(instanceCtx);

    it('id proxies through the descriptor (independent of params)', () => {
      expect(codec.id).toBe(SQL_CHAR_CODEC_ID);
    });

    it('encodes string values verbatim', async () => {
      expect(await codec.encode('user_001', callCtx)).toBe('user_001');
    });

    it('trims trailing spaces on decode', async () => {
      expect(await codec.decode('user_001                            ', callCtx)).toBe('user_001');
      expect(await codec.decode('user_001', callCtx)).toBe('user_001');
    });

    it('round-trips through JSON identity', () => {
      expect(codec.encodeJson('user_001')).toBe('user_001');
      expect(codec.decodeJson('user_001')).toBe('user_001');
    });

    it('renderOutputType returns Char<length>', () => {
      expect(sqlCharDescriptor.renderOutputType?.({ length: 36 })).toBe('Char<36>');
    });

    it('renderOutputType returns undefined when length absent', () => {
      expect(sqlCharDescriptor.renderOutputType?.({})).toBeUndefined();
    });
  });

  describe('sql/varchar@1', () => {
    const codec = sqlVarcharDescriptor.factory({ length: 255 })(instanceCtx);

    it('id proxies through the descriptor', () => {
      expect(codec.id).toBe(SQL_VARCHAR_CODEC_ID);
    });

    it('encodes and decodes string values verbatim', async () => {
      expect(await codec.encode('hello', callCtx)).toBe('hello');
      expect(await codec.decode('hello', callCtx)).toBe('hello');
    });

    it('round-trips through JSON identity', () => {
      expect(codec.encodeJson('hello')).toBe('hello');
      expect(codec.decodeJson('hello')).toBe('hello');
    });

    it('renderOutputType returns Varchar<length>', () => {
      expect(sqlVarcharDescriptor.renderOutputType?.({ length: 255 })).toBe('Varchar<255>');
    });

    it('renderOutputType returns undefined when length absent', () => {
      expect(sqlVarcharDescriptor.renderOutputType?.({})).toBeUndefined();
    });
  });

  describe('sql/timestamp@1', () => {
    const codec = sqlTimestampDescriptor.factory({ precision: 3 })(instanceCtx);

    it('id proxies through the descriptor', () => {
      expect(codec.id).toBe(SQL_TIMESTAMP_CODEC_ID);
    });

    it('round-trips Date values', async () => {
      const instant = new Date('2024-01-15T10:30:00Z');
      expect(await codec.encode(instant, callCtx)).toBe(instant);
      expect(await codec.decode(instant, callCtx)).toBe(instant);
    });

    it('serializes Date to a zone-less ISO 8601 string for JSON', () => {
      const instant = new Date('2024-01-15T10:30:00Z');
      expect(codec.encodeJson(instant)).toBe('2024-01-15T10:30:00.000');
      expect(codec.decodeJson('2024-01-15T10:30:00.000')).toEqual(instant);
    });

    // The pair is UTC on both sides, so the JSON is the same text on every
    // machine. Reading the zone-less form through `new Date` directly would
    // resolve it in the process's zone and shift the instant.
    it('reads the zone-less form as UTC whatever the process zone', () => {
      expect(codec.decodeJson('2024-07-15T10:30:00').getTime()).toBe(
        Date.UTC(2024, 6, 15, 10, 30, 0),
      );
    });

    it('rejects an offset-bearing string rather than reinterpreting it', () => {
      expect(() => codec.decodeJson('2024-01-15T10:30:00.000Z')).toThrow(
        /Expected a zone-less ISO date-time/,
      );
      expect(() => codec.decodeJson('2024-01-15T10:30:00+02:00')).toThrow(
        /Expected a zone-less ISO date-time/,
      );
    });

    it('throws on invalid JSON input', () => {
      expect(() => codec.decodeJson(42)).toThrow(/Expected ISO date string/);
      expect(() => codec.decodeJson('not-a-date')).toThrow(/Expected a zone-less ISO date-time/);
      expect(() => codec.decodeJson('2024-13-01T00:00:00')).toThrow(/Invalid ISO date string/);
    });

    it('renderOutputType returns Timestamp<precision>', () => {
      expect(sqlTimestampDescriptor.renderOutputType?.({ precision: 3 })).toBe('Timestamp<3>');
    });

    it('renderOutputType returns bare Timestamp when precision absent', () => {
      expect(sqlTimestampDescriptor.renderOutputType?.({})).toBe('Timestamp');
    });
  });

  describe('column helpers', () => {
    it('sqlTextColumn produces a ColumnSpec with text nativeType and no typeParams', () => {
      const spec = sqlTextColumn();
      expect(spec.codecId).toBe(SQL_TEXT_CODEC_ID);
      expect(spec.nativeType).toBe('text');
      expect(spec.typeParams).toBeUndefined();
    });

    it('sqlIntColumn produces a ColumnSpec with int nativeType', () => {
      const spec = sqlIntColumn();
      expect(spec.codecId).toBe(SQL_INT_CODEC_ID);
      expect(spec.nativeType).toBe('int');
    });

    it('sqlFloatColumn produces a ColumnSpec with float nativeType', () => {
      const spec = sqlFloatColumn();
      expect(spec.codecId).toBe(SQL_FLOAT_CODEC_ID);
      expect(spec.nativeType).toBe('float');
    });

    it('sqlCharColumn defaults typeParams to {} when invoked without arguments', () => {
      const spec = sqlCharColumn();
      expect(spec.codecId).toBe(SQL_CHAR_CODEC_ID);
      expect(spec.nativeType).toBe('char');
      expect(spec.typeParams).toEqual({});
    });

    it('sqlCharColumn carries the explicit length param', () => {
      const spec = sqlCharColumn({ length: 16 });
      expect(spec.typeParams).toEqual({ length: 16 });
    });

    it('sqlVarcharColumn defaults typeParams to {} when invoked without arguments', () => {
      const spec = sqlVarcharColumn();
      expect(spec.typeParams).toEqual({});
    });

    it('sqlVarcharColumn carries the explicit length param', () => {
      const spec = sqlVarcharColumn({ length: 64 });
      expect(spec.typeParams).toEqual({ length: 64 });
    });

    it('sqlTimestampColumn defaults typeParams to {} when invoked without arguments', () => {
      const spec = sqlTimestampColumn();
      expect(spec.typeParams).toEqual({});
    });

    it('sqlTimestampColumn carries the explicit precision param', () => {
      const spec = sqlTimestampColumn({ precision: 6 });
      expect(spec.typeParams).toEqual({ precision: 6 });
    });
  });

  describe('descriptor metadata', () => {
    it('codec ids match the SQL_*_CODEC_ID constants', () => {
      expect(sqlTextDescriptor.codecId).toBe(SQL_TEXT_CODEC_ID);
      expect(sqlIntDescriptor.codecId).toBe(SQL_INT_CODEC_ID);
      expect(sqlFloatDescriptor.codecId).toBe(SQL_FLOAT_CODEC_ID);
      expect(sqlCharDescriptor.codecId).toBe(SQL_CHAR_CODEC_ID);
      expect(sqlVarcharDescriptor.codecId).toBe(SQL_VARCHAR_CODEC_ID);
      expect(sqlTimestampDescriptor.codecId).toBe(SQL_TIMESTAMP_CODEC_ID);
    });

    it('exposes traits and targetTypes for each codec', () => {
      expect(sqlTextDescriptor.traits).toEqual(['equality', 'order', 'textual']);
      expect(sqlTextDescriptor.targetTypes).toEqual(['text']);

      expect(sqlIntDescriptor.traits).toEqual(['equality', 'order', 'numeric']);
      expect(sqlIntDescriptor.targetTypes).toEqual(['int']);

      expect(sqlFloatDescriptor.traits).toEqual(['equality', 'order', 'numeric']);
      expect(sqlFloatDescriptor.targetTypes).toEqual(['float']);

      expect(sqlCharDescriptor.targetTypes).toEqual(['char']);
      expect(sqlVarcharDescriptor.targetTypes).toEqual(['varchar']);
      expect(sqlTimestampDescriptor.targetTypes).toEqual(['timestamp']);
    });
  });
});
