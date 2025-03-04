import { assertNever } from '@prisma/internals'
import Decimal from 'decimal.js'
import { Sql } from 'sql-template-tag'

import { isFieldRef } from '../core/model/FieldRef'
import { isTypedSql, TypedSql, type UnknownTypedSql } from '../core/types/exported'
import type { JsArgs, JsInputValue } from '../core/types/exported/JsApi'
import { ObjectEnumValue } from '../core/types/exported/ObjectEnums'
import type { RawQueryArgs } from '../core/types/exported/RawQueryArgs'
import { isDate } from './date'
import { isDecimalJsLike } from './decimalJsLike'

export function deepCloneArgs(args: JsArgs | RawQueryArgs): JsArgs | RawQueryArgs {
  if (args instanceof Sql) {
    return cloneSql(args)
  }

  if (isTypedSql(args)) {
    return cloneTypedSql(args)
  }

  if (Array.isArray(args)) {
    const clone: RawQueryArgs = [args[0]]

    for (let i = 1; i < args.length; i++) {
      clone[i] = deepCloneValue(args[i] as JsInputValue)
    }

    return clone
  }
  const clone: JsArgs = {}
  for (const k in args) {
    clone[k] = deepCloneValue(args[k])
  }
  return clone
}

function cloneSql(rawParam: Sql): Sql {
  return new Sql(rawParam.strings, rawParam.values)
}

function cloneTypedSql(rawParam: UnknownTypedSql): UnknownTypedSql {
  return new TypedSql(rawParam.sql, rawParam.values)
}

// based on https://github.com/lukeed/klona/blob/v2.0.6/src/index.js
function deepCloneValue(x: JsInputValue): JsInputValue {
  if (typeof x !== 'object' || x == null || x instanceof ObjectEnumValue || isFieldRef(x)) {
    return x
  }

  if (isDecimalJsLike(x)) {
    return new Decimal(x.toFixed())
  }

  if (isDate(x)) {
    return new Date(+x)
  }

  if (ArrayBuffer.isView(x)) {
    return x.slice(0)
  }

  if (Array.isArray(x)) {
    let k = x.length
    let copy
    for (copy = Array(k); k--; ) {
      copy[k] = deepCloneValue(x[k])
    }
    return copy
  }

  if (typeof x === 'object') {
    const copy = {}
    for (const k in x) {
      if (k === '__proto__') {
        Object.defineProperty(copy, k, {
          value: deepCloneValue(x[k]),
          configurable: true,
          enumerable: true,
          writable: true,
        })
      } else {
        copy[k] = deepCloneValue(x[k])
      }
    }
    return copy
  }

  assertNever(x, 'Unknown value')
}
