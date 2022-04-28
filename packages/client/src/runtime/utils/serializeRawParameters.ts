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
  return JSON.stringify(map(parameters, (parameter) => prepareParameter(parameter, objectSerialization)))
}

function prepareParameter(parameter: any, objectSerialization: 'fast' | 'slow'): unknown {
  if (typeof parameter === 'bigint') {
    return parameter.toString()
  }

  if (isDate(parameter)) {
    return {
      prisma__type: 'date',
      prisma__value: parameter.toJSON(),
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
  return getTypeTag(value) === '[object Date]' && typeof value.toJSON === 'function'
}

function getTypeTag(value: any): string {
  return Object.prototype.toString.call(value)
}

function preprocessObject(obj: any): unknown {
  if (typeof obj !== 'object' || obj === null) {
    return obj
  }

  return map(obj, (value) => {
    if (typeof value === 'bigint') {
      return value.toString()
    }

    if (typeof value === 'object' && value !== null && typeof (value as any).toJSON === 'function') {
      return (value as any).toJSON()
    }

    return preprocessObject(value)
  })
}
