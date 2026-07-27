/**
 * Database-backed conformance harness for PostgreSQL codec JSON projections.
 *
 * For one codec descriptor and one representative application value the harness
 * encodes the value through the codec, stores it in a column of the codec's
 * native type, projects the stored column through `descriptor.projectJson()`,
 * renders the projection inside a JSON constructor, executes it, and parses the
 * JSON text the database produced.
 *
 * A projection conforms when both of these hold:
 *
 * 1. the parsed value deep-equals `codec.encodeJson(value)` — `encodeJson` is
 *    the specification and the projection is its SQL realization; and
 * 2. `codec.decodeJson` turns the parsed value back into the application value
 *    the case started from.
 *
 * The second condition is what makes the harness an oracle rather than a
 * tautology: a codec whose `encodeJson` loses information the same way the
 * database's native JSON conversion does satisfies condition 1 while still
 * failing to carry the value. Arbitrary-precision `numeric` is exactly that
 * case.
 *
 * `projectJson()` is called directly rather than reached through a
 * query-planning or rendering path, which is what lets the harness measure
 * projections that no production query reaches.
 *
 * The API is framework-independent and takes a caller-supplied connection, so
 * assertion style and case enumeration stay with the caller.
 */

import { isDeepStrictEqual } from 'node:util';
import type { JsonValue } from '@prisma-next/contract/types';
import type { CodecRef } from '@prisma-next/framework-components/codec';
import { validateCodecTypeParams } from '@prisma-next/framework-components/codec';
import type { SqlStorage } from '@prisma-next/sql-contract/types';
import {
  CastExpr,
  ColumnRef,
  JsonObjectExpr,
  NativeJsonValueProjection,
  ProjectionItem,
  SelectAst,
  TableSource,
} from '@prisma-next/sql-relational-core/ast';
import { postgresCodecDescriptorRegistry } from '@prisma-next/target-postgres/codecs';
import { createContract } from '@prisma-next/test-utils';
import { ifDefined } from '@prisma-next/utils/defined';
import { renderLoweredSql } from '../../src/core/sql-renderer';
import type { PostgresContract } from '../../src/core/types';

/**
 * Minimal execution surface the harness needs from a live database. A caller
 * adapts whichever client it already owns.
 */
export interface ConformanceConnection {
  query(sql: string, params?: readonly unknown[]): Promise<ReadonlyArray<Record<string, unknown>>>;
}

export interface PostgresCodecConformanceCase {
  /** Codec id resolved against the target's built-in descriptor registry. */
  readonly codecId: string;
  /** Identifies the value under test within its codec's cases. */
  readonly label: string;
  /** Application-level value handed to `codec.encode` and `codec.encodeJson`. */
  readonly value: unknown;
  /** Codec type params, for parameterized codecs. */
  readonly typeParams?: JsonValue;
  /** SQL executed before the storage table is created — e.g. `CREATE TYPE` for a native enum. */
  readonly setupSql?: readonly string[];
  /**
   * Why this codec's projection is not canonical for this value, when it is
   * not. The suite asserts that a case carrying a reason really does still fail,
   * so the list cannot rot once a projection becomes canonical.
   */
  readonly notYetCanonical?: string;
}

export interface CodecProjectionOutcome {
  /** The SELECT the harness executed. */
  readonly sql: string;
  /** The JSON document text the database produced, or `undefined` if the projection failed to execute. */
  readonly rawJson: string | undefined;
  /** The projected value parsed out of that document. */
  readonly projected: JsonValue | undefined;
  /** What `codec.encodeJson` specifies the projected value must equal. */
  readonly expected: JsonValue | undefined;
  /** Whether the projection realizes the codec's canonical JSON for this value. */
  readonly conforms: boolean;
  /** Why the projection does not conform, when it does not. */
  readonly mismatch: string | undefined;
}

const STORAGE_TABLE = 'codec_conformance';
const VALUE_COLUMN = 'value';
const DOCUMENT_ALIAS = 'document';
const DOCUMENT_KEY = 'value';

const conformanceContract: PostgresContract = {
  ...createContract<SqlStorage>({ target: 'postgres', targetFamily: 'sql' }),
  target: 'postgres',
};

/**
 * Widens a codec's wire value to the shape `pg` serializes unambiguously: a
 * `Buffer` for binary, and a UTC ISO string for a `Date` so the parameter's
 * wall-clock reading does not depend on the machine's time zone.
 */
function toDriverParam(wire: unknown): unknown {
  if (wire instanceof Uint8Array && !Buffer.isBuffer(wire)) return Buffer.from(wire);
  if (wire instanceof Date) return wire.toISOString();
  return wire;
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function codecRefOf(conformanceCase: PostgresCodecConformanceCase): CodecRef {
  return {
    codecId: conformanceCase.codecId,
    ...ifDefined('typeParams', conformanceCase.typeParams),
  };
}

function descriptorFor(codecId: string) {
  const descriptor = postgresCodecDescriptorRegistry.descriptorFor(codecId);
  if (descriptor === undefined) {
    throw new Error(`No built-in PostgreSQL codec descriptor is registered for '${codecId}'.`);
  }
  return descriptor;
}

/**
 * Builds `SELECT CAST(json_build_object('value', <projection>) AS text)`, so the
 * document arrives as text and the harness — not the driver — owns the parse.
 */
export function buildProjectionSql(conformanceCase: PostgresCodecConformanceCase): string {
  const descriptor = descriptorFor(conformanceCase.codecId);
  const projection = descriptor.projectJson(
    ColumnRef.of(STORAGE_TABLE, VALUE_COLUMN),
    codecRefOf(conformanceCase),
  );
  const document = JsonObjectExpr.fromEntries([
    JsonObjectExpr.entry(DOCUMENT_KEY, new NativeJsonValueProjection(projection)),
  ]);
  const select = SelectAst.from(TableSource.named(STORAGE_TABLE)).withProjection([
    ProjectionItem.of(DOCUMENT_ALIAS, CastExpr.as(document, 'text')),
  ]);

  return renderLoweredSql(select, conformanceContract, postgresCodecDescriptorRegistry).sql;
}

export async function runPostgresCodecProjection(
  connection: ConformanceConnection,
  conformanceCase: PostgresCodecConformanceCase,
): Promise<CodecProjectionOutcome> {
  const descriptor = descriptorFor(conformanceCase.codecId);
  const ref = codecRefOf(conformanceCase);
  const params = validateCodecTypeParams(descriptor, ref);
  const codec = descriptor.factory(params)({ name: VALUE_COLUMN });

  await connection.query(`DROP TABLE IF EXISTS "${STORAGE_TABLE}"`);
  for (const statement of conformanceCase.setupSql ?? []) {
    await connection.query(statement);
  }
  await connection.query(
    `CREATE TABLE "${STORAGE_TABLE}" ("${VALUE_COLUMN}" ${descriptor.nativeTypeFor(ref)})`,
  );

  const wire = await codec.encode(conformanceCase.value, {});
  await connection.query(`INSERT INTO "${STORAGE_TABLE}" ("${VALUE_COLUMN}") VALUES ($1)`, [
    toDriverParam(wire),
  ]);

  const sql = buildProjectionSql(conformanceCase);

  let rawJson: string;
  try {
    const rows = await connection.query(sql);
    rawJson = String(rows[0]?.[DOCUMENT_ALIAS]);
  } catch (error) {
    return {
      sql,
      rawJson: undefined,
      projected: undefined,
      expected: undefined,
      conforms: false,
      mismatch: `the projection failed to execute: ${describeError(error)}`,
    };
  }

  const document: { readonly [key: string]: JsonValue } = JSON.parse(rawJson);
  const projected = document[DOCUMENT_KEY];
  if (projected === undefined) {
    throw new Error(`Projection for '${conformanceCase.codecId}' produced no document: ${rawJson}`);
  }

  let expected: JsonValue;
  try {
    expected = codec.encodeJson(conformanceCase.value);
  } catch (error) {
    return {
      sql,
      rawJson,
      projected,
      expected: undefined,
      conforms: false,
      mismatch: `encodeJson rejects the value: ${describeError(error)}`,
    };
  }

  const base = { sql, rawJson, projected, expected } as const;

  if (!isDeepStrictEqual(projected, expected)) {
    return {
      ...base,
      conforms: false,
      mismatch: `projected ${JSON.stringify(projected)} but encodeJson specifies ${JSON.stringify(expected)}`,
    };
  }

  let roundTripped: unknown;
  try {
    roundTripped = codec.decodeJson(projected);
  } catch (error) {
    return {
      ...base,
      conforms: false,
      mismatch: `decodeJson rejects the projected value: ${describeError(error)}`,
    };
  }

  if (!isDeepStrictEqual(roundTripped, conformanceCase.value)) {
    return {
      ...base,
      conforms: false,
      mismatch: `the projection loses information: decodeJson returned ${String(roundTripped)} for an application value of ${String(conformanceCase.value)}`,
    };
  }

  return { ...base, conforms: true, mismatch: undefined };
}
