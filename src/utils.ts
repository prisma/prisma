import leven from 'js-levenshtein'

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
    if ((value | 0) === value) {
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
      distance: str.length, // if the whole string would need to be replaced, it doesn't make sense
      str: null,
    },
  )

  return bestMatch.str
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
