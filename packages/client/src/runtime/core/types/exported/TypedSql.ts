type TypedSqlInternal = {
  sql: string
  values: readonly unknown[]
}

const internals = new WeakMap<TypedSql<any, any>, TypedSqlInternal>()
const TypedSqlMarker = '$$PrismaTypedSql'

export declare const PrivateResultType: unique symbol

export class TypedSql<Values extends readonly unknown[], Result> {
  declare [PrivateResultType]: Result

  constructor(sql: string, values: Values) {
    internals.set(this, {
      sql,
      values,
    })

    Object.defineProperty(this, TypedSqlMarker, { value: TypedSqlMarker })
  }

  get sql(): string {
    return internals.get(this)!.sql
  }

  get values(): Values {
    return internals.get(this)!.values as Values
  }
}

export type UnknownTypedSql = TypedSql<unknown[], unknown>

export function makeTypedQueryFactory(sql: string) {
  return (...values) => new TypedSql(sql, values)
}

// used so we could detect typed sql instances, created by different instance of runtime
// or after hmr trigger
export function isTypedSql(value: unknown): value is UnknownTypedSql {
  return value != null && value[TypedSqlMarker] === TypedSqlMarker
}
