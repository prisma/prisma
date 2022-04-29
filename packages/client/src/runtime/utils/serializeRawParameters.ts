import Decimal from 'decimal.js'

import { map } from '../../../../../helpers/blaze/map'

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
  return JSON.stringify(map(parameters, (parameter) => encodeParameter(parameter, objectSerialization)))
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
      prisma__value: Buffer.from(parameter).toString('base64'),
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

  return map(obj, (value) => {
    if (typeof value === 'bigint') {
      return value.toString()
    }

    return preprocessObject(value)
  })
}
