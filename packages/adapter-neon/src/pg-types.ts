import type neon from '@neondatabase/serverless'
import { ok, type Query, type Result } from '@prisma/driver-adapter-utils'

/**
 * PostgreSQL array column types (not defined in `import('@neondatabase/serverless).types.builtins`).
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
  id: number
  name?: string
}

export class PgTypesCache {
  // cache the promises and not the results to avoid concurrent requests for the same type
  #cachedRequests = new Map<number, Promise<Result<PgType>>>()

  constructor(
    private client: {
      performIO(query: Query): Promise<Result<neon.FullQueryResults<true> | neon.QueryArrayResult<unknown[]>>>
    },
  ) {}

  typeById(id: number): Promise<Result<PgType>> {
    if (id <= maxSystemCatalogOID) {
      return Promise.resolve(ok({ id }))
    }

    let req = this.#cachedRequests.get(id)

    if (req === undefined) {
      req = this.#loadType(id)
      this.#cachedRequests.set(id, req)
    }

    return req
  }

  async #loadType(id: number): Promise<Result<PgType>> {
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
