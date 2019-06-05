import { highlightDatamodel } from '../cli/highlight/highlight'
import { diffLines, diffWords, Change } from 'diff'
import chalk from 'chalk'
import { strongGreen, strongRed } from './customColors'

// TODO diff on trimmed text
export function printDatamodelDiff(datamodelA: string, datamodelB?: string) {
  if (!datamodelB) {
    return highlightDatamodel(datamodelA)
  }
  const result = fixCurly(
    diffLines(normalizeText(datamodelA), normalizeText(datamodelB)),
  )
  return result
    .map((change, index, changes) => {
      if (change.added) {
        if (
          change.value.split('\n').length <= 2 &&
          index > 0 &&
          changes[index - 1] &&
          changes[index - 1].removed
        ) {
          const charChanges = diffWords(changes[index - 1].value, change.value)

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
          const charChanges = diffWords(change.value, changes[index + 1].value)

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
    .trim()
}

function trimNewLine(str: string) {
  let newStr = str
  if (str.slice(-1)[0] === '\n') {
    newStr = str.slice(0, str.length - 1)
  }
  if (newStr[0] === '\n') {
    newStr = str.slice(1)
  }
  return newStr
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

  return trimNewLine(
    modelPositions
      .reduceRight((acc, position) => {
        acc.splice(position.start, position.end - position.start + 1)
        return acc
      }, lines)
      .join('\n'),
  )
  // .trim()
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

// jsdiff spreads the } curly braces all over the place
// we don't want that
function fixCurly(changes: Change[]): Change[] {
  return changes.reduce<Change[]>((acc, change, index) => {
    if (
      change.removed &&
      change.value.trim() === '}' &&
      changes[index + 1] &&
      changes[index + 1].value.startsWith('}')
    ) {
      return acc
    }

    if (change.added && change.value.startsWith('}')) {
      const lastValue = acc.slice(-1)[0]
      if (lastValue) {
        acc[acc.indexOf(lastValue)] = {
          ...lastValue,
          value: lastValue.value + '}',
        }
        acc.push({
          ...change,
          value: change.value.slice(2), // trim away the } and the \n after that
        })
        return acc
      }
    }

    acc.push(change)

    return acc
  }, [])
}
