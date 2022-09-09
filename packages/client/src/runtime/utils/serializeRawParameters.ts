import Decimal from 'decimal.js'

export function serializeRawParameters(parameters: any[]): string {
  try {
    return serializeRawParametersInternal(parameters, 'fast')
  } catch (error) {
    // Got TypeError, try replacing values unsupported by JSON (i.e., BigInts)
    // with strings inside arrays and objects.
    return serializeRawParametersInternal(parameters, 'slow')
  }
}

function serializeRawParametersInternal(parameters: any[], objectSerialization: 'fast' | 'slow'): string {
  return JSON.stringify(parameters.map((parameter) => encodeParameter(parameter, objectSerialization)))
}

function encodeParameter(parameter: any, objectSerialization: 'fast' | 'slow'): unknown {
  if (typeof parameter === 'bigint') {
    return {
      prisma__type: 'bigint',
      prisma__value: parameter.toString(),
    }
  }

  if (isDate(parameter)) {
    return {
      prisma__type: 'date',
      prisma__value: parameter.toJSON(),
    }
  }

  if (Decimal.isDecimal(parameter)) {
    return {
      prisma__type: 'decimal',
      prisma__value: parameter.toJSON(),
    }
  }

  if (Buffer.isBuffer(parameter)) {
    return {
      prisma__type: 'bytes',
      prisma__value: parameter.toString('base64'),
    }
  }

  if (isArrayBufferLike(parameter) || ArrayBuffer.isView(parameter)) {
    return {
      prisma__type: 'bytes',
      // TODO: node typings do not include ArrayBufferView as of 14.x
      prisma__value: Buffer.from(parameter as ArrayBuffer).toString('base64'),
    }
  }

  if (typeof parameter === 'object' && objectSerialization === 'slow') {
    return preprocessObject(parameter)
  }

  return parameter
}

function isDate(value: any): value is Date {
  if (value instanceof Date) {
    return true
  }

  // Support dates created in another V8 context
  // Note: dates don't have Symbol.toStringTag defined
  return Object.prototype.toString.call(value) === '[object Date]' && typeof value.toJSON === 'function'
}

function isArrayBufferLike(value: any): value is ArrayBufferLike {
  if (value instanceof ArrayBuffer || value instanceof SharedArrayBuffer) {
    return true
  }

  if (typeof value === 'object' && value !== null) {
    return value[Symbol.toStringTag] === 'ArrayBuffer' || value[Symbol.toStringTag] === 'SharedArrayBuffer'
  }

  return false
}

function preprocessObject(obj: any): unknown {
  if (typeof obj !== 'object' || obj === null) {
    return obj
  }

  if (typeof obj.toJSON === 'function') {
    return obj.toJSON()
  }

  // TODO: map from blaze would've been convenient here to map arrays and objects uniformly,
  // but importing it in this file causes compilation errors in tsd tests.

  if (Array.isArray(obj)) {
    return obj.map(preprocessValueInObject)
  }

  const result = {} as any

  for (const key of Object.keys(obj as object)) {
    result[key] = preprocessValueInObject(obj[key])
  }

  return result
}

function preprocessValueInObject(value: any): unknown {
  if (typeof value === 'bigint') {
    return value.toString()
  }

  return preprocessObject(value)
}
