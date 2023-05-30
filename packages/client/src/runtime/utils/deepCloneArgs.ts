import { assertNever } from '@prisma/internals'
import Decimal from 'decimal.js'

import { isFieldRef } from '../core/model/FieldRef'
import { JsArgs, JsInputValue } from '../core/types/JsApi'
import { ObjectEnumValue } from '../object-enums'
import { isDate } from './date'
import { isDecimalJsLike } from './decimalJsLike'

export function deepCloneArgs(args: JsArgs): JsArgs {
  const clone: JsArgs = {}
  for (const k in args) {
    clone[k] = deepCloneValue(args[k])
  }
  return clone
}

// based on https://raw.githubusercontent.com/lukeed/klona/master/src/index.js
function deepCloneValue(x: JsInputValue): JsInputValue {
  if (typeof x !== 'object' || x === null || x instanceof ObjectEnumValue || isFieldRef(x)) {
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
