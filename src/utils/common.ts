import indent from 'indent-string'
import leven from 'js-levenshtein'
import { DMMF } from '../dmmf-types'

export type Dictionary<T> = { [key: string]: T }

export const keyBy: <T>(collection: Array<T>, iteratee: (value: T) => string) => Dictionary<T> = (
  collection,
  iteratee,
) => {
  return collection.reduce((acc, curr) => {
    acc[iteratee(curr)] = curr
    return acc
  }, {})
}

export const ScalarTypeTable = {
  String: true,
  Int: true,
  Float: true,
  Boolean: true,
  Long: true,
  DateTime: true,
  ID: true,
  UUID: true,
  Json: true,
}

export function isScalar(str: string): boolean {
  if (typeof str !== 'string') {
    return false
  }
  return ScalarTypeTable[str] || false
}

export const GraphQLScalarToJSTypeTable = {
  String: 'string',
  Int: 'number',
  Float: 'number',
  Boolean: 'boolean',
  Long: 'number',
  DateTime: ['string', Date],
  ID: 'string',
  UUID: 'string',
  Json: 'object',
}

export const JSTypeToGraphQLType = {
  string: 'String',
  boolean: 'Boolean',
  object: 'Json',
}

export function stringifyGraphQLType(type: string, isList: boolean) {
  if (!isList) {
    return type
  }

  return `List<${type}>`
}

export function getGraphQLType(value: any): string {
  if (value === null) {
    return 'null'
  }
  if (Array.isArray(value)) {
    const scalarTypes = value.reduce((acc, val) => {
      const type = getGraphQLType(val)
      if (!acc.includes(type)) {
        acc.push(type)
      }
      return acc
    }, [])
    return `List<${scalarTypes.join(' | ')}>`
  }
  const jsType = typeof value
  if (jsType === 'number') {
    if (Math.trunc(value) === value) {
      return 'Int'
    } else {
      return 'Float'
    }
  }
  if (value instanceof Date) {
    return 'DateTime'
  }
  if (jsType === 'string') {
    const date = new Date(value)
    if (date.toString() === 'Invalid Date') {
      return 'String'
    }
    if (date.toISOString() === value) {
      return 'DateTime'
    }
  }
  return JSTypeToGraphQLType[jsType]
}

export function graphQLToJSType(gql: string) {
  return GraphQLScalarToJSTypeTable[gql]
}

export function getSuggestion(str: string, possibilities: string[]): string | null {
  const bestMatch = possibilities.reduce(
    (acc, curr) => {
      const distance = leven(str, curr)
      if (distance < acc.distance) {
        return {
          distance,
          str: curr,
        }
      }

      return acc
    },
    {
      // heuristic to be not too strict, but allow some big mistakes (<= ~ 5)
      distance: Math.min(Math.floor(str.length) * 1.1, ...possibilities.map(p => p.length * 3)),
      str: null,
    },
  )

  return bestMatch.str
}

export function stringifyInputType(input: string | DMMF.InputType): string {
  if (typeof input === 'string') {
    return input
  }
  const body = indent(
    input.args
      .map(
        arg =>
          `${arg.name}: ${typeof arg.type === 'string' ? stringifyGraphQLType(arg.type, arg.isList) : arg.type.name}`,
      )
      .join('\n'),
    2,
  )
  return `type ${input.name} {\n${body}\n}`
}

export function getInputTypeName(input: string | DMMF.InputType | DMMF.SchemaField) {
  if (typeof input === 'string') {
    return input
  }

  // if ((input as DMMF.SchemaField).type) {
  //   const type = (input as DMMF.SchemaField).type
  //   if (typeof type === 'string') {
  //     return type
  //   } else {
  //     return type.name
  //   }
  // }

  return input.name
}

export function inputTypeToJson(input: string | DMMF.InputType, isRequired: boolean): string | object {
  if (typeof input === 'string') {
    return input
  }

  // If the parent type is required and all fields are non-scalars,
  // it's very useful to show to the user, which options they actually have
  const showDeepType = isRequired && input.args.every(arg => !arg.isScalar)

  return input.args.reduce((acc, curr) => {
    acc[curr.name + (curr.isRequired ? '' : '?')] =
      curr.isRequired || showDeepType ? inputTypeToJson(curr.type, curr.isRequired) : getInputTypeName(curr.type)
    return acc
  }, {})
}

export function destroyCircular(from, seen = []) {
  const to: any = Array.isArray(from) ? [] : {}

  seen.push(from)

  for (const key of Object.keys(from)) {
    const value = from[key]

    if (typeof value === 'function') {
      continue
    }

    if (!value || typeof value !== 'object') {
      to[key] = value
      continue
    }

    if (seen.indexOf(from[key]) === -1) {
      to[key] = destroyCircular(from[key], seen.slice(0))
      continue
    }

    to[key] = '[Circular]'
  }

  if (typeof from.name === 'string') {
    to.name = from.name
  }

  if (typeof from.message === 'string') {
    to.message = from.message
  }

  if (typeof from.stack === 'string') {
    to.stack = from.stack
  }

  return to
}

export function unionBy<T>(arr1: T[], arr2: T[], iteratee: (element: T) => string | number): T[] {
  const map = {}

  for (const element of arr1) {
    map[iteratee(element)] = element
  }

  for (const element of arr2) {
    const key = iteratee(element)
    if (!map[key]) {
      map[key] = element
    }
  }

  return Object.values(map)
}

export function uniqBy<T>(arr: T[], iteratee: (element: T) => string | number): T[] {
  const map = {}

  for (const element of arr) {
    map[iteratee(element)] = element
  }

  return Object.values(map)
}

export function capitalize(str: string): string {
  return str[0].toUpperCase() + str.slice(1)
}
