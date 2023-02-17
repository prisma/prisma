export type Range = { kind: 'constant'; value: number } | { kind: 'range'; start: number; end: number; step: number }

export function parseRange(str: string): Range {
  if (!str.includes(':')) {
    return { kind: 'constant', value: toInt(str) }
  }

  const parts = str.split(':')
  if (parts.length < 2 || parts.length > 3) {
    throw new Error(`Invalid range string ${str}`)
  }
  const intParts = parts.map(toInt)
  return { kind: 'range', start: intParts[0], end: intParts[1], step: intParts[2] ?? 1 }
}

function toInt(str: string) {
  const result = Number.parseInt(str, 10)
  if (Number.isNaN(result)) {
    throw new Error(`Non numeric string ${result}`)
  }
  return result
}

export function* getRangeIterator(models: Range, relations: Range, enums: Range) {
  if (models.kind === 'range') {
    if (enums.kind === 'range' || relations.kind === 'range') {
      throw new Error('Only one of models, enums or relations can be a range')
    }

    for (let i = models.start; i <= models.end; i += models.step) {
      yield { numModels: i, numRelations: relations.value, numEnums: enums.value }
    }
    return
  }

  if (relations.kind === 'range') {
    if (enums.kind === 'range') {
      throw new Error('Only one of models, enums or relations can be a range')
    }

    for (let i = relations.start; i <= relations.end; i += relations.step) {
      yield { numModels: models.value, numRelations: i, numEnums: enums.value }
    }
    return
  }

  if (enums.kind === 'range') {
    for (let i = enums.start; i <= enums.end; i += enums.step) {
      yield { numModels: models.value, numRelations: relations.value, numEnums: i }
    }
    return
  }

  yield { numModels: models.value, numRelations: relations.value, numEnums: enums.value }
}
