import { highlightDatamodel } from './highlightDatamodel'
import { diffLines, diffChars } from 'diff'
import chalk from 'chalk'
import { strongGreen, strongRed } from './customColors'

// TODO diff on trimmed text
export function printDatamodelDiff(datamodelA: string, datamodelB?: string) {
  if (!datamodelB) {
    return highlightDatamodel(datamodelA)
  }
  const result = diffLines(normalizeText(datamodelA), normalizeText(datamodelB))
  return result
    .map((change, index, changes) => {
      if (change.added) {
        if (
          change.value.split('\n').length <= 2 &&
          index > 0 &&
          changes[index - 1] &&
          changes[index - 1].removed
        ) {
          const charChanges = diffChars(changes[index - 1].value, change.value)

          if (charChanges.length < change.value.length - 4) {
            return charChanges
              .map(charChange => {
                if (charChange.added) {
                  return strongGreen(charChange.value)
                }
                if (charChange.removed) {
                  return ''
                }

                return chalk.greenBright(trimNewLine(charChange.value))
              })
              .join('')
          }
        }
        return chalk.greenBright(trimNewLine(change.value))
      }
      if (change.removed) {
        if (
          change.value.split('\n').length <= 2 &&
          index > 0 &&
          changes[index + 1] &&
          changes[index + 1].added &&
          changes[index + 1].value.split('\n').length <= 2
        ) {
          const charChanges = diffChars(change.value, changes[index + 1].value)

          if (charChanges.length < change.value.length - 3) {
            return charChanges
              .map(charChange => {
                if (charChange.removed) {
                  return strongRed(charChange.value)
                }
                if (charChange.added) {
                  return ''
                }

                return chalk.redBright(trimNewLine(charChange.value))
              })
              .join('')
          }
        }
        return chalk.redBright(trimNewLine(change.value))
      }
      return highlightDatamodel(trimWholeModels(trimNewLine(change.value)))
    })
    .join('\n')
}

function trimNewLine(str: string) {
  if (str.slice(-1)[0] === '\n') {
    return str.slice(0, str.length - 1)
  }
  return str
}

type Position = {
  start: number
  end: number
}

function trimWholeModels(str: string) {
  const lines = str.split('\n')
  if (lines.length <= 2) {
    return str
  }
  const modelPositions: Position[] = []
  let modelOpen = false
  let currentStart = -1

  lines.forEach((line, index) => {
    const trimmed = line.trim()
    // TODO: add support for enum etc
    // maybe just by removing the startsWith
    if (trimmed.startsWith('model') && line.endsWith('{')) {
      modelOpen = true
      currentStart = index
    }
    if (trimmed.endsWith('}') && currentStart > -1 && modelOpen) {
      modelPositions.push({
        start: currentStart,
        end: index,
      })
      modelOpen = false
      currentStart = -1
    }
  })

  if (modelPositions.length === 0) {
    return str
  }

  return modelPositions
    .reduceRight((acc, position) => {
      acc.splice(position.start, position.end - position.start + 1)
      return acc
    }, lines)
    .join('\n')
    .trim()
}

// filter unnecessary space changes
function normalizeText(str: string) {
  return str
    .split('\n')
    .reduce<string[]>((acc, line) => {
      const trimmed = line.trim()
      if (trimmed.startsWith('#')) {
        return acc
      }

      if (trimmed.length <= 1) {
        acc.push(trimmed)
      } else {
        acc.push(line)
      }

      return acc
    }, [])
    .join('\n')
}
