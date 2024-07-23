type TypedSqlInternal = {
  sql: string
  values: readonly unknown[]
}

const internals = new WeakMap<TypedSql<any, any>, TypedSqlInternal>()

export declare const PrivateResultType: unique symbol

export class TypedSql<Values extends readonly unknown[], Result> {
  declare [PrivateResultType]: Result

  constructor(sql: string, values: Values) {
    internals.set(this, {
      sql,
      values,
    })
  }

  get sql(): string {
    return internals.get(this)!.sql
  }

  get values(): Values {
    return internals.get(this)!.values as Values
  }
}

export type UnknownTypedSql = TypedSql<unknown[], unknown>

export type TypedSqlResult<Sql extends UnknownTypedSql> = Sql[typeof PrivateResultType]
