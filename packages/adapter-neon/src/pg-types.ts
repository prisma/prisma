import type neon from '@neondatabase/serverless'
import { ok, type Query, type Result } from '@prisma/driver-adapter-utils'

/**
 * PostgreSQL array column types (not defined in `import('@neondatabase/serverless').types.builtins`).
 *
 * See the semantics of each of this code in:
 *   https://github.com/postgres/postgres/blob/master/src/include/catalog/pg_type.dat
 */
export const ArrayColumnType = {
  BIT_ARRAY: 1561,
  BOOL_ARRAY: 1000,
  BYTEA_ARRAY: 1001,
  BPCHAR_ARRAY: 1014,
  CHAR_ARRAY: 1002,
  CIDR_ARRAY: 651,
  DATE_ARRAY: 1182,
  FLOAT4_ARRAY: 1021,
  FLOAT8_ARRAY: 1022,
  INET_ARRAY: 1041,
  INT2_ARRAY: 1005,
  INT4_ARRAY: 1007,
  INT8_ARRAY: 1016,
  JSONB_ARRAY: 3807,
  JSON_ARRAY: 199,
  MONEY_ARRAY: 791,
  NUMERIC_ARRAY: 1231,
  OID_ARRAY: 1028,
  TEXT_ARRAY: 1009,
  TIMESTAMP_ARRAY: 1115,
  TIME_ARRAY: 1183,
  UUID_ARRAY: 2951,
  VARBIT_ARRAY: 1563,
  VARCHAR_ARRAY: 1015,
  XML_ARRAY: 143,
}

/**
 * Maximal OID of system catalog entries
 */
export const maxSystemCatalogOID = 9999

/**
 * A PostgreSQL type representation with both OID and optional introspected type name.
 */
export type PgType = {
  readonly id: number
  readonly name?: string
}

/**
 * Postgres types cache pluggable into the client. All connections to the same database should
 * preferably use the same instance to avoid duplicating requests.
 */
export class PgTypesCache {
  // cache the promises and not the results to avoid concurrent requests for the same type
  #cachedRequests = new Map<number, Promise<Result<PgType>>>()

  constructor(
    private client: {
      performIO(query: Query): Promise<Result<neon.FullQueryResults<true> | neon.QueryArrayResult<unknown[]>>>
    },
  ) {}

  typeById(id: number): Promise<Result<PgType>> {
    let req = this.#cachedRequests.get(id)

    if (req === undefined) {
      req = this.#loadType(id)
      this.#cachedRequests.set(id, req)
    }

    return req
  }

  async #loadType(id: number): Promise<Result<PgType>> {
    if (id <= maxSystemCatalogOID && knownSystemTypeNames[id]) {
      return ok({
        id,
        name: knownSystemTypeNames[id],
      })
    }

    const result = (
      await this.client.performIO({
        sql: 'SELECT typname FROM pg_catalog.pg_type WHERE oid = $1',
        args: [id],
      })
    ).flatMap((nameQueryResult) => {
      if (nameQueryResult.rows.length < 1) {
        // there doesn't seem to be a way currently to return `err` with a generic
        // error without access to the error registry, but the error will be caught
        // and converted to `Result` at top level anyway
        throw new Error(`Invalid type ID: ${id}`)
      }

      const name = nameQueryResult.rows[0][0] as string
      return ok({ id, name })
    })

    if (!result.ok) {
      // retry next time
      this.#cachedRequests.delete(id)
    }

    return result
  }
}

/**
 * Known built-in type names
 */
const knownSystemTypeNames: Record<number, string | undefined> = {
  16: 'bool',
  17: 'bytea',
  18: 'char',
  19: 'name',
  20: 'int8',
  21: 'int2',
  22: 'int2vector',
  23: 'int4',
  24: 'regproc',
  25: 'text',
  26: 'oid',
  27: 'tid',
  28: 'xid',
  29: 'cid',
  30: 'oidvector',
  32: 'pg_ddl_command',
  71: 'pg_type',
  75: 'pg_attribute',
  81: 'pg_proc',
  83: 'pg_class',
  114: 'json',
  142: 'xml',
  194: 'pg_node_tree',
  269: 'table_am_handler',
  325: 'index_am_handler',
  600: 'point',
  601: 'lseg',
  602: 'path',
  603: 'box',
  604: 'polygon',
  628: 'line',
  650: 'cidr',
  700: 'float4',
  701: 'float8',
  705: 'unknown',
  718: 'circle',
  774: 'macaddr8',
  790: 'money',
  829: 'macaddr',
  869: 'inet',
  1033: 'aclitem',
  1042: 'bpchar',
  1043: 'varchar',
  1082: 'date',
  1083: 'time',
  1114: 'timestamp',
  1184: 'timestamptz',
  1186: 'interval',
  1266: 'timetz',
  1560: 'bit',
  1562: 'varbit',
  1700: 'numeric',
  1790: 'refcursor',
  2202: 'regprocedure',
  2203: 'regoper',
  2204: 'regoperator',
  2205: 'regclass',
  2206: 'regtype',
  2249: 'record',
  2275: 'cstring',
  2276: 'any',
  2277: 'anyarray',
  2278: 'void',
  2279: 'trigger',
  2280: 'language_handler',
  2281: 'internal',
  2283: 'anyelement',
  2287: '_record',
  2776: 'anynonarray',
  2950: 'uuid',
  2970: 'txid_snapshot',
  3115: 'fdw_handler',
  3220: 'pg_lsn',
  3310: 'tsm_handler',
  3361: 'pg_ndistinct',
  3402: 'pg_dependencies',
  3500: 'anyenum',
  3614: 'tsvector',
  3615: 'tsquery',
  3642: 'gtsvector',
  3734: 'regconfig',
  3769: 'regdictionary',
  3802: 'jsonb',
  3831: 'anyrange',
  3838: 'event_trigger',
  3904: 'int4range',
  3906: 'numrange',
  3908: 'tsrange',
  3910: 'tstzrange',
  3912: 'daterange',
  3926: 'int8range',
  4072: 'jsonpath',
  4089: 'regnamespace',
  4096: 'regrole',
  4191: 'regcollation',
  4451: 'int4multirange',
  4532: 'nummultirange',
  4533: 'tsmultirange',
  4534: 'tstzmultirange',
  4535: 'datemultirange',
  4536: 'int8multirange',
  4537: 'anymultirange',
  4538: 'anycompatiblemultirange',
  4600: 'pg_brin_bloom_summary',
  4601: 'pg_brin_minmax_multi_summary',
  5017: 'pg_mcv_list',
  5038: 'pg_snapshot',
  5069: 'xid8',
  5077: 'anycompatible',
  5078: 'anycompatiblearray',
  5079: 'anycompatiblenonarray',
  5080: 'anycompatiblerange',
}
