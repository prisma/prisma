import Decimal from 'decimal.js'

import type { DMMF } from './dmmf-types'
import { isDecimalJsLike } from './utils/decimalJsLike'

const RFC_3339_REGEX =
  /^(\d{4}-(0[1-9]|1[012])-(0[1-9]|[12][0-9]|3[01])T([01][0-9]|2[0-3]):([0-5][0-9]):([0-5][0-9]|60))(\.\d{1,})?(([Z])|([+|-]([01][0-9]|2[0-3]):[0-5][0-9]))$/

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

interface Type {
  acceptsValue(value: unknown): boolean
}

class NullType implements Type {
  acceptsValue(value: unknown): boolean {
    return value === null
  }
}

class BooleanType implements Type {
  acceptsValue(value: unknown): boolean {
    return typeof value === 'boolean'
  }
}

class IntType implements Type {
  acceptsValue(value: unknown): boolean {
    return Number.isInteger(value)
  }
}

class BigIntType implements Type {
  acceptsValue(value: unknown): boolean {
    return typeof value === 'bigint' || Number.isInteger(value)
  }
}

class FloatType implements Type {
  acceptsValue(value: unknown): boolean {
    return typeof value === 'number'
  }
}

class UuidType implements Type {
  acceptsValue(value: unknown): boolean {
    return typeof value === 'string' && UUID_REGEX.test(value)
  }
}

class IdType implements Type {
  acceptsValue(value: unknown): boolean {
    return typeof value === 'string'
  }
}

class DateTimeType implements Type {
  acceptsValue(value: unknown): boolean {
    if (Object.prototype.toString.call(value) === '[object Date]') {
      return true
    }

    if (typeof value !== 'string') {
      return false
    }

    return RFC_3339_REGEX.test(value) && String(new Date(value)) !== 'Invalid Date'
  }
}

class StringType implements Type {
  acceptsValue(value: unknown): boolean {
    return typeof value === 'string'
  }
}

class DecimalType implements Type {
  acceptsValue(value: unknown): boolean {
    if (Decimal.isDecimal(value) || typeof value === 'number') {
      return true
    }

    if (isDecimalJsLike(value)) {
      return true
    }

    if (typeof value === 'string') {
      // https://github.com/MikeMcl/decimal.js/blob/master/decimal.js#L116
      return /^\-?(\d+(\.\d*)?|\.\d+)(e[+-]?\d+)?$/i.test(value)
    }

    return false
  }
}

class BytesType implements Type {
  acceptsValue(value: unknown): boolean {
    return Buffer.isBuffer(value)
  }
}

class JsonType implements Type {
  acceptsValue(value: unknown): boolean {
    return true
  }
}

class ListType implements Type {
  readonly elementType: Type

  constructor(elementType: Type) {
    this.elementType = elementType
  }

  acceptsValue(value: unknown): boolean {
    if (!Array.isArray(value)) {
      return false
    }

    return value.every((item) => this.elementType.acceptsValue(item))
  }
}

class EnumType implements Type {
  readonly name: string
  readonly values: string[]

  constructor(name: string, choices: string[]) {
    this.name = name
    this.values = choices
  }

  acceptsValue(value: unknown): boolean {
    return typeof value === 'string' && this.values.includes(value)
  }
}

const dmmfTypesMapping = {
  Null: NullType,
  Boolean: BooleanType,
  Int: IntType,
  BigInt: BigIntType,
  Float: FloatType,
  UUID: UuidType,
  ID: IdType,
  DateTime: DateTimeType,
  String: StringType,
  Decimal: DecimalType,
  Bytes: BytesType,
  Json: JsonType,
}

export function makeScalarInputType(dmmfArgType: DMMF.SchemaArgInputType): Type {
  let type: Type
  const dmmfType = dmmfArgType.type
  if (typeof dmmfType === 'string') {
    type = typeByName(dmmfType)
  } else if ((dmmfType as DMMF.SchemaEnum).values) {
    type = new EnumType(dmmfType.name, (dmmfType as DMMF.SchemaEnum).values)
  } else {
    type = typeByName(dmmfType.name)
  }

  if (dmmfArgType.isList) {
    return new ListType(type)
  }

  return type
}

function typeByName(name: string): Type {
  const TypeConstructor = dmmfTypesMapping[name]
  if (!TypeConstructor) {
    throw new TypeError(`Unknown scalar type: ${name}`)
  }
  return new TypeConstructor()
}
