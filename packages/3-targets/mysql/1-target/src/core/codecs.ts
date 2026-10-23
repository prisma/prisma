/**
 * The MySQL target's codecs. The driver hands every column to a codec as the text MySQL sends for it (ADR 155), so each `fromWire` reads that text; `toWire` writes the value MySQL reads for a parameter.
 */

import type { JsonValue } from '@internal/contract/types';
import {
  type CodecCallContext,
  CodecImpl,
  type CodecInstanceContext,
  type DataTypeValue,
  decimalTextBigintLiteral,
  refuseJsonValue,
  renderTsLiteral,
} from '@internal/framework-components/codec';
import { sqlRawDataType } from '@internal/sql-contract/data-type';
import {
  SqlCharCodec,
  SqlRawCodec,
  SqlVarcharCodec,
  sqlCharDescriptor,
  sqlRawDescriptor,
  sqlVarcharDescriptor,
} from '@internal/sql-relational-core/ast';
import { MysqlCodecDescriptor, mysqlCodec } from './codec-descriptor';
import {
  MYSQL_BIGINT_CODEC_ID,
  MYSQL_DATETIME_CODEC_ID,
  MYSQL_ENUM_CODEC_ID,
  MYSQL_INT_CODEC_ID,
  MYSQL_TEXT_CODEC_ID,
} from './codec-ids';
import {
  mysqlBigint,
  mysqlChar,
  mysqlDatetime,
  mysqlDatetimeParams,
  mysqlEnum,
  mysqlEnumParams,
  mysqlInt,
  mysqlText,
  mysqlVarchar,
} from './data-types';
import { mysqlError } from './errors';

const DECIMAL_INTEGER = /^-?\d+$/;

function decodeFailed(codecId: string, expected: string, received: unknown): never {
  throw mysqlError('RUNTIME.DECODE_FAILED', `${codecId} wire value must be ${expected}`, {
    meta: { codecId, received: String(received) },
  });
}

function encodeFailed(codecId: string, expected: string, received: unknown): never {
  throw mysqlError('RUNTIME.ENCODE_FAILED', `${codecId} value must be ${expected}`, {
    meta: { codecId, received: String(received) },
  });
}

export const mysqlSqlCharDescriptor = mysqlCodec(sqlCharDescriptor, {
  dataType: mysqlChar,
  renderValueLiteral: renderTsLiteral,
  factory: (descriptor, dataType, params) => () => new SqlCharCodec(descriptor, dataType, params),
});

export const mysqlSqlVarcharDescriptor = mysqlCodec(sqlVarcharDescriptor, {
  dataType: mysqlVarchar,
  renderValueLiteral: renderTsLiteral,
  factory: (descriptor, dataType, params) => () =>
    new SqlVarcharCodec(descriptor, dataType, params),
});

export const mysqlSqlRawDescriptor = mysqlCodec(sqlRawDescriptor, {
  dataType: sqlRawDataType,
  factory: (descriptor, dataType, params) => () => new SqlRawCodec(descriptor, dataType, params),
});

export class MysqlTextCodec extends CodecImpl<
  typeof MYSQL_TEXT_CODEC_ID,
  readonly ['equality', 'order', 'textual'],
  string,
  string
> {
  async toWire(value: string, _ctx: CodecCallContext): Promise<string> {
    return value;
  }
  async fromWire(wire: string, _ctx: CodecCallContext): Promise<string> {
    return wire;
  }
  fromDataTypeValue(value: DataTypeValue<string>): string {
    return value.value;
  }
  toDataTypeValue(input: string): DataTypeValue {
    return this.dataTypeValueOf(input);
  }
}

export class MysqlTextDescriptor extends MysqlCodecDescriptor<void> {
  override readonly dataType = mysqlText.id;
  override readonly codecId = MYSQL_TEXT_CODEC_ID;
  override readonly traits = ['equality', 'order', 'textual'] as const;
  override readonly paramsSchema = undefined;
  override renderValueLiteral(value: JsonValue): string | undefined {
    return renderTsLiteral(value);
  }
  override factory(): (ctx: CodecInstanceContext) => MysqlTextCodec {
    return () => new MysqlTextCodec(this, mysqlText);
  }
}

export const mysqlTextDescriptor = new MysqlTextDescriptor();

/** A MySQL `int` as a JavaScript number. MySQL sends it as decimal text. */
export class MysqlIntCodec extends CodecImpl<
  typeof MYSQL_INT_CODEC_ID,
  readonly ['equality', 'order', 'numeric'],
  string | number,
  number
> {
  async toWire(value: number, _ctx: CodecCallContext): Promise<number> {
    if (!Number.isSafeInteger(value)) {
      return encodeFailed(MYSQL_INT_CODEC_ID, 'an integer', value);
    }
    return value;
  }
  async fromWire(wire: string | number, _ctx: CodecCallContext): Promise<number> {
    if (typeof wire === 'number') return wire;
    if (!DECIMAL_INTEGER.test(wire)) {
      return decodeFailed(MYSQL_INT_CODEC_ID, 'the decimal text of an integer', wire);
    }
    return Number(wire);
  }
  fromDataTypeValue(value: DataTypeValue<number>): number {
    return value.value;
  }
  toDataTypeValue(input: number): DataTypeValue {
    return this.dataTypeValueOf(input);
  }
}

export class MysqlIntDescriptor extends MysqlCodecDescriptor<void> {
  override readonly dataType = mysqlInt.id;
  override readonly codecId = MYSQL_INT_CODEC_ID;
  override readonly traits = ['equality', 'order', 'numeric'] as const;
  override readonly paramsSchema = undefined;
  override renderValueLiteral(value: JsonValue): string | undefined {
    return renderTsLiteral(value);
  }
  override factory(): (ctx: CodecInstanceContext) => MysqlIntCodec {
    return () => new MysqlIntCodec(this, mysqlInt);
  }
}

export const mysqlIntDescriptor = new MysqlIntDescriptor();

/** A MySQL `bigint` as a JavaScript bigint. MySQL sends it as decimal text. */
export class MysqlBigintCodec extends CodecImpl<
  typeof MYSQL_BIGINT_CODEC_ID,
  readonly ['equality', 'order', 'numeric'],
  string,
  bigint
> {
  async toWire(value: bigint, _ctx: CodecCallContext): Promise<string> {
    if (typeof value !== 'bigint') return encodeFailed(MYSQL_BIGINT_CODEC_ID, 'a bigint', value);
    return value.toString();
  }
  async fromWire(wire: string, _ctx: CodecCallContext): Promise<bigint> {
    if (!DECIMAL_INTEGER.test(wire)) {
      return decodeFailed(MYSQL_BIGINT_CODEC_ID, 'the decimal text of an integer', wire);
    }
    return BigInt(wire);
  }
  fromDataTypeValue(value: DataTypeValue<string>): bigint {
    return BigInt(value.value);
  }
  toDataTypeValue(input: bigint): DataTypeValue {
    return this.dataTypeValueOf(input.toString());
  }
}

export class MysqlBigintDescriptor extends MysqlCodecDescriptor<void> {
  override readonly dataType = mysqlBigint.id;
  override readonly codecId = MYSQL_BIGINT_CODEC_ID;
  override readonly traits = ['equality', 'order', 'numeric'] as const;
  override readonly paramsSchema = undefined;
  override renderValueLiteral(value: JsonValue): string | undefined {
    return decimalTextBigintLiteral(value);
  }
  override factory(): (ctx: CodecInstanceContext) => MysqlBigintCodec {
    return () => new MysqlBigintCodec(this, mysqlBigint);
  }
}

export const mysqlBigintDescriptor = new MysqlBigintDescriptor();

const WIRE_DATETIME = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2}(?:\.\d+)?)$/;

/**
 * Reads the text MySQL sends for a `datetime` as the instant it names in UTC: the codec writes every value in UTC, so the column holds no time zone of its own.
 */
export function decodeMysqlDatetime(wire: string): Date {
  const match = WIRE_DATETIME.exec(wire);
  const date = match === null ? undefined : new Date(`${match[1]}T${match[2]}Z`);
  if (date === undefined || Number.isNaN(date.getTime())) {
    return decodeFailed(MYSQL_DATETIME_CODEC_ID, 'a date and time as MySQL prints it', wire);
  }
  return date;
}

/** The text MySQL reads for an instant in UTC, with millisecond digits. */
export function encodeMysqlDatetime(value: Date): string {
  if (Number.isNaN(value.getTime())) {
    return encodeFailed(MYSQL_DATETIME_CODEC_ID, 'a valid Date', value);
  }
  return value.toISOString().replace('T', ' ').replace('Z', '');
}

/** A MySQL `datetime` as a JavaScript `Date`, read and written in UTC. */
export class MysqlDatetimeCodec extends CodecImpl<
  typeof MYSQL_DATETIME_CODEC_ID,
  readonly ['equality', 'order'],
  string,
  Date
> {
  async toWire(value: Date, _ctx: CodecCallContext): Promise<string> {
    return encodeMysqlDatetime(value);
  }
  async fromWire(wire: string, _ctx: CodecCallContext): Promise<Date> {
    return decodeMysqlDatetime(wire);
  }
  fromDataTypeValue(value: DataTypeValue<string>): Date {
    if (/[1-9]/.test(/\.(\d+)/.exec(value.value)?.[1]?.slice(3) ?? '')) {
      return refuseJsonValue(
        this.id,
        `a datetime with no digits below a millisecond, which a Date drops: ${JSON.stringify(value.value)} has them`,
        value.value,
      );
    }
    return new Date(`${value.value}Z`);
  }
  toDataTypeValue(input: Date): DataTypeValue {
    return this.dataTypeValueOf(input.toISOString().replace('Z', ''));
  }
}

type DatetimeParams = typeof mysqlDatetimeParams.infer;

export class MysqlDatetimeDescriptor extends MysqlCodecDescriptor<DatetimeParams> {
  override readonly dataType = mysqlDatetime.id;
  override readonly codecId = MYSQL_DATETIME_CODEC_ID;
  override readonly traits = ['equality', 'order'] as const;
  override readonly paramsSchema = mysqlDatetimeParams;
  override factory(params: DatetimeParams): (ctx: CodecInstanceContext) => MysqlDatetimeCodec {
    return () => new MysqlDatetimeCodec(this, mysqlDatetime, params);
  }
}

export const mysqlDatetimeDescriptor = new MysqlDatetimeDescriptor();

/** A native MySQL enum column, whose value is the member's text. */
export class MysqlEnumCodec extends CodecImpl<
  typeof MYSQL_ENUM_CODEC_ID,
  readonly ['equality', 'order', 'textual'],
  string,
  string
> {
  async toWire(value: string, _ctx: CodecCallContext): Promise<string> {
    return value;
  }
  async fromWire(wire: string, _ctx: CodecCallContext): Promise<string> {
    return wire;
  }
  fromDataTypeValue(value: DataTypeValue<string>): string {
    return value.value;
  }
  toDataTypeValue(input: string): DataTypeValue {
    return this.dataTypeValueOf(input);
  }
}

type EnumParams = typeof mysqlEnumParams.infer;

export class MysqlEnumDescriptor extends MysqlCodecDescriptor<EnumParams> {
  override readonly dataType = mysqlEnum.id;
  override readonly codecId = MYSQL_ENUM_CODEC_ID;
  override readonly traits = ['equality', 'order', 'textual'] as const;
  override readonly paramsSchema = mysqlEnumParams;
  override renderValueLiteral(value: JsonValue): string | undefined {
    return renderTsLiteral(value);
  }
  override factory(params: EnumParams): (ctx: CodecInstanceContext) => MysqlEnumCodec {
    return () => new MysqlEnumCodec(this, mysqlEnum, params);
  }
}

export const mysqlEnumDescriptor = new MysqlEnumDescriptor();

/** Every codec descriptor this target ships. */
export const codecDescriptors = [
  mysqlSqlCharDescriptor,
  mysqlSqlVarcharDescriptor,
  mysqlSqlRawDescriptor,
  mysqlTextDescriptor,
  mysqlIntDescriptor,
  mysqlBigintDescriptor,
  mysqlDatetimeDescriptor,
  mysqlEnumDescriptor,
] as const;
