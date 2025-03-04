import type { JsonQuery } from '../engines'

export function getBatchId(query: JsonQuery): string | undefined {
  if (query.action !== 'findUnique' && query.action !== 'findUniqueOrThrow') {
    return undefined
  }
  const parts: string[] = []
  if (query.modelName) {
    parts.push(query.modelName)
  }

  if (query.query.arguments) {
    parts.push(buildKeysString(query.query.arguments))
  }
  parts.push(buildKeysString(query.query.selection))

  return parts.join('')
}

function buildKeysString(obj: object): string {
  const keysArray = Object.keys(obj)
    .sort()
    .map((key) => {
      const value = obj[key]
      if (typeof value === 'object' && value !== null) {
        return `(${key} ${buildKeysString(value)})`
      }
      return key
    })

  return `(${keysArray.join(' ')})`
}
