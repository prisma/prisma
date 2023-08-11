export type Position = {
  start: number
  end: number
}

export function trimNewLine(str: string): string {
  if (str === '') {
    return str
  }
  let newStr = str
  if (/\r?\n|\r/.exec(newStr[0])) {
    newStr = newStr.slice(1)
  }
  if (newStr.length > 0 && /\r?\n|\r/.exec(newStr[newStr.length - 1])) {
    newStr = newStr.slice(0, newStr.length - 1)
  }
  return newStr
}

export function trimBlocksFromSchema(str: string, blocks = ['model', 'enum', 'datasource', 'generator']): string {
  const lines = str.split(/\r\n|\r|\n/g)

  if (lines.length <= 2) {
    return str
  }
  const modelPositions: Position[] = []
  let blockOpen = false
  let currentStart = -1

  lines.forEach((line, index) => {
    const lineTrimmed = line.trim()

    if (blocks.some((b) => lineTrimmed.startsWith(b)) && lineTrimmed.endsWith('{')) {
      blockOpen = true
      currentStart = index
    }
    if (lineTrimmed.endsWith('}') && currentStart > -1 && blockOpen) {
      modelPositions.push({
        start: currentStart,
        end: index,
      })
      blockOpen = false
      currentStart = -1
    }
  })

  if (modelPositions.length === 0) {
    return str
  }

  return trimNewLine(
    modelPositions
      .reduceRight((acc, position) => {
        acc.splice(position.start, position.end - position.start + 1)
        return acc
      }, lines)
      .join('\n'),
  )
}
