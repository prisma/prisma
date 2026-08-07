import type { CodecInstanceContext } from '@internal/framework-components/codec';
import { AggregateExpr, CastExpr, ColumnRef } from '@internal/sql-relational-core/ast';
import { describe, expect, it } from 'vitest';
import { SQLITE_BIGINT_NUMBER_CODEC_ID } from '../src/core/codec-ids';
import {
  sqliteBigintDescriptor,
  sqliteBigintNumberDescriptor,
  sqliteIntegerDescriptor,
} from '../src/core/codecs';
import { sqliteCodecDescriptorRegistry, sqliteCodecRegistry } from '../src/core/registry';

const instanceCtx: CodecInstanceContext = { name: 'test' };

describe('sqlite/bigint@1 number wire values', () => {
  const codec = sqliteBigintDescriptor.factory()(instanceCtx);

  it('reads a safe-integer number wire value exactly', async () => {
    expect(await codec.decode(42, {})).toBe(42n);
    expect(await codec.decode(9007199254740991, {})).toBe(9007199254740991n);
    expect(await codec.decode(-9007199254740991, {})).toBe(-9007199254740991n);
  });

  it('rejects a number wire value past the safe range, which has already lost precision', async () => {
    await expect(codec.decode(9007199254740992, {})).rejects.toMatchObject({
      code: 'RUNTIME.DECODE_FAILED',
      message:
        'sqlite/bigint@1 wire number must be an integer within the safe integer range, got 9007199254740992',
      meta: { codecId: 'sqlite/bigint@1', received: '9007199254740992' },
    });
    await expect(codec.decode(-9007199254740992, {})).rejects.toMatchObject({
      code: 'RUNTIME.DECODE_FAILED',
      meta: { codecId: 'sqlite/bigint@1', received: '-9007199254740992' },
    });
  });

  it('rejects a non-integral number wire value with a structured error', async () => {
    await expect(codec.decode(1.5, {})).rejects.toMatchObject({
      code: 'RUNTIME.DECODE_FAILED',
      message:
        'sqlite/bigint@1 wire number must be an integer within the safe integer range, got 1.5',
      meta: { codecId: 'sqlite/bigint@1', received: '1.5' },
    });
  });
});

describe('sqlite/bigintnumber@1', () => {
  const codec = sqliteBigintNumberDescriptor.factory()(instanceCtx);

  describe('decode', () => {
    it('reads number, decimal-text, and bigint wire forms within the safe range', async () => {
      expect(await codec.decode(42, {})).toBe(42);
      expect(await codec.decode('9007199254740991', {})).toBe(9007199254740991);
      expect(await codec.decode(-9007199254740991n, {})).toBe(-9007199254740991);
    });

    it('throws at 2^53 on every wire form', async () => {
      await expect(codec.decode(9007199254740992, {})).rejects.toThrow(
        'sqlite/bigintnumber@1 value must be an integer within the safe integer range',
      );
      await expect(codec.decode('9007199254740992', {})).rejects.toThrow(
        'sqlite/bigintnumber@1 value must be an integer within the safe integer range',
      );
      await expect(codec.decode(9007199254740992n, {})).rejects.toThrow(
        'sqlite/bigintnumber@1 value must be an integer within the safe integer range',
      );
    });

    it('throws at -(2^53)', async () => {
      await expect(codec.decode(-9007199254740992n, {})).rejects.toThrow(
        'sqlite/bigintnumber@1 value must be an integer within the safe integer range',
      );
      await expect(codec.decode('-9007199254740992', {})).rejects.toThrow(
        'sqlite/bigintnumber@1 value must be an integer within the safe integer range',
      );
    });

    it('throws on decimal text a Number() coercion would silently round', async () => {
      await expect(codec.decode('9007199254740993', {})).rejects.toThrow(
        'sqlite/bigintnumber@1 value must be an integer within the safe integer range',
      );
    });

    it('throws on non-integral wire values', async () => {
      await expect(codec.decode(1.5, {})).rejects.toThrow(
        'sqlite/bigintnumber@1 value must be an integer within the safe integer range',
      );
      await expect(codec.decode('1.5', {})).rejects.toThrow(
        'sqlite/bigintnumber@1 wire value must be a decimal string',
      );
    });

    it('raises a structured error carrying the codec id and the received value', async () => {
      await expect(codec.decode(9007199254740992n, {})).rejects.toMatchObject({
        code: 'RUNTIME.DECODE_FAILED',
        meta: { codecId: 'sqlite/bigintnumber@1', received: '9007199254740992' },
      });
    });
  });

  describe('encode', () => {
    it('writes the integer wire value within the safe range', async () => {
      expect(await codec.encode(9007199254740991, {})).toBe(9007199254740991);
      expect(await codec.encode(-9007199254740991, {})).toBe(-9007199254740991);
    });

    it('negative zero encodes as plain zero', async () => {
      const wire = await codec.encode(-0, {});
      expect(wire).toBe(0);
      expect(await codec.decode(wire, {})).toBe(0);
    });

    it('rejects out-of-range writes at 2^53 and -(2^53)', async () => {
      await expect(codec.encode(9007199254740992, {})).rejects.toThrow(
        'sqlite/bigintnumber@1 value must be an integer within the safe integer range',
      );
      await expect(codec.encode(-9007199254740992, {})).rejects.toThrow(
        'sqlite/bigintnumber@1 value must be an integer within the safe integer range',
      );
    });

    it('rejects non-integral writes with a structured error', async () => {
      await expect(codec.encode(1.5, {})).rejects.toMatchObject({
        code: 'RUNTIME.ENCODE_FAILED',
        message:
          'sqlite/bigintnumber@1 value must be an integer within the safe integer range, got 1.5',
        meta: { codecId: 'sqlite/bigintnumber@1', received: '1.5' },
      });
    });
  });

  describe('encodeJson / decodeJson', () => {
    it('uses a JSON number as the canonical form at both safe-range boundaries', () => {
      expect(codec.encodeJson(9007199254740991)).toBe(9007199254740991);
      expect(codec.decodeJson(9007199254740991)).toBe(9007199254740991);
      expect(codec.encodeJson(-9007199254740991)).toBe(-9007199254740991);
      expect(codec.decodeJson(-9007199254740991)).toBe(-9007199254740991);
    });

    it('rejects a JSON string', () => {
      expect(() => codec.decodeJson('42')).toThrow(
        'sqlite/bigintnumber@1 database JSON value must be a number',
      );
    });

    it('rejects parsed numbers at 2^53 and -(2^53)', () => {
      expect(() => codec.decodeJson(9007199254740992)).toThrow(
        'sqlite/bigintnumber@1 value must be an integer within the safe integer range',
      );
      expect(() => codec.decodeJson(-9007199254740992)).toThrow(
        'sqlite/bigintnumber@1 value must be an integer within the safe integer range',
      );
    });

    it('rejects a non-integral parsed number', () => {
      expect(() => codec.decodeJson(1.5)).toThrow(
        'sqlite/bigintnumber@1 value must be an integer within the safe integer range',
      );
    });

    it('rejects out-of-range and non-integral values on the encode side', () => {
      expect(() => codec.encodeJson(9007199254740992)).toThrow(
        'sqlite/bigintnumber@1 value must be an integer within the safe integer range',
      );
      expect(() => codec.encodeJson(1.5)).toThrow(
        'sqlite/bigintnumber@1 value must be an integer within the safe integer range',
      );
    });
  });

  it('projects through an INTEGER cast, so the database emits a JSON number', () => {
    const expression = ColumnRef.of('records', 'value');
    expect(
      sqliteBigintNumberDescriptor.projectJson(expression, {
        codecId: SQLITE_BIGINT_NUMBER_CODEC_ID,
      }),
    ).toEqual(CastExpr.as(expression, 'INTEGER'));
  });

  // An aggregate whose result this codec carries reaches the projection already
  // cast to text, so the driver never reads a wide integer off the wire. The
  // projection is what puts such a value back into the codec's canonical JSON
  // form, and it has to do so whatever expression it is handed.
  it('projects a text-cast aggregate back to a JSON number', () => {
    const lowered = CastExpr.as(new AggregateExpr('count', undefined), 'text');
    expect(
      sqliteBigintNumberDescriptor.projectJson(lowered, {
        codecId: SQLITE_BIGINT_NUMBER_CODEC_ID,
      }),
    ).toEqual(CastExpr.as(lowered, 'INTEGER'));
  });

  it('claims no target type, so integer in type position keeps its current codecs', () => {
    expect(sqliteBigintNumberDescriptor.targetTypes).toEqual([]);
    expect(sqliteCodecRegistry.byTargetType('integer')).toEqual([
      sqliteIntegerDescriptor,
      sqliteBigintDescriptor,
    ]);
  });

  it('carries the numeric ordering traits', () => {
    expect(sqliteBigintNumberDescriptor.traits).toEqual(['equality', 'order', 'numeric']);
  });

  it('renders a default as a number literal', () => {
    expect(sqliteBigintNumberDescriptor.renderValueLiteral?.(42)).toBe('42');
  });

  it('resolves from both registries by codec id', () => {
    expect(sqliteCodecRegistry.descriptorFor(SQLITE_BIGINT_NUMBER_CODEC_ID)).toBe(
      sqliteBigintNumberDescriptor,
    );
    expect(sqliteCodecDescriptorRegistry.descriptorFor(SQLITE_BIGINT_NUMBER_CODEC_ID)).toBe(
      sqliteBigintNumberDescriptor,
    );
  });
});
