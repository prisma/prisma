import { JsonQuery } from '../engines'

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
  const object = obj as Record<string, unknown>
  const keysArray = Object.keys(obj).sort()
  let result = '('

  for (let i = 0; i < keysArray.length; i++) {
    const key = keysArray[i]
    const value = object[key]

    if (i > 0) {
      result += ' '
    }

    if (typeof value === 'object' && value !== null) {
      result += `(${key} ${buildKeysString(value)})`
    } else {
      result += key
    }
  }

  return `${result})`
}
