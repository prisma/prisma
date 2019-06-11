import { highlightDatamodel } from '../cli/highlight/highlight'
import { diffLines, diffWords, Change } from 'diff'
import chalk from 'chalk'
import { strongGreen, strongRed } from './customColors'
import stripAnsi from 'strip-ansi'

// TODO diff on trimmed text
export function printDatamodelDiff(rawDatamodelA: string, rawDatamodelB?: string) {
  const datamodelA = trimWholeBlocks(rawDatamodelA, ['source', 'datasource', 'generator'])
  if (!rawDatamodelB) {
    return highlightDatamodel(datamodelA)
  }
  const datamodelB = trimWholeBlocks(rawDatamodelB, ['source', 'datasource', 'generator'])
  const result = fixCurly(diffLines(normalizeText(datamodelA), normalizeText(datamodelB)))
  const diff = result
    .map((change, index, changes) => {
      if (change.added) {
        if (change.value.split('\n').length <= 2 && index > 0 && changes[index - 1] && changes[index - 1].removed) {
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
      return highlightDatamodel(trimWholeBlocks(trimNewLine(change.value)))
    })
    .join('\n')
    .trim()
  return trimMultiEmptyLines(diff)
}

// trims to consecutive empty lines from a string
function trimMultiEmptyLines(str: string) {
  const lines = str.split('\n')
  const newLines: string[] = []

  let i = lines.length
  while (i--) {
    const line = lines[i]
    const trimmed = line.trim()
    if (trimmed.length > 0) {
      newLines.unshift(line)
      continue
    }
    // in this case it's an empty line
    // if the next line is also empty, remove this one
    if (lines[i - 1] && lines[i - 1].trim().length > 0) {
      newLines.unshift(line)
    }
  }

  return newLines.join('\n')
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

function trimWholeBlocks(str: string, blocks = ['model', 'enum', 'datasource', 'generator']) {
  const lines = str.split('\n')
  if (lines.length <= 2) {
    return str
  }
  const modelPositions: Position[] = []
  let blockOpen = false
  let currentStart = -1

  lines.forEach((line, index) => {
    const trimmed = line.trim()
    // TODO: add support for enum etc
    // maybe just by removing the startsWith
    if (blocks.some(b => line.startsWith(b)) && line.endsWith('{')) {
      blockOpen = true
      currentStart = index
    }
    if (trimmed.endsWith('}') && currentStart > -1 && blockOpen) {
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

function fixCurly(changes: Change[]): Change[] {
  return fixCurlyRemoved(fixCurlyRemovedDangling(fixCurlyAdded(changes)))
}

function fixCurlyAdded(changes: Change[]): Change[] {
  changes.forEach((change, index) => {
    if (!change.added && !change.removed && change.value.trim() === '}' && index > 0 && changes[index - 1].added) {
      const correspondingIndex = changes.slice(0, index).findIndex(c => {
        if (!c.added) {
          return false
        }
        let sawOpen = false
        let hasCloseBeforeOpen = false
        const lines = c.value.split('\n')
        for (const line of lines) {
          if (!sawOpen && line.trim() === '}') {
            hasCloseBeforeOpen = true
            break
          }
        }
        return hasCloseBeforeOpen
      })
      if (correspondingIndex > -1) {
        const correspondingChange = changes[correspondingIndex]
        // 1. Merge our lonely curly with the added before and delete it
        changes[index - 1].value = changes[index - 1].value + change.value
        changes.splice(index, 1)
        // 2. get rid of the unnecessary } in the corresponding block we just found
        // and turn it into a normal curly
        const lines = correspondingChange.value.split('\n')
        const indexOfWrongCurly = lines.findIndex(l => l.trim() === '}')
        const newChanges: Change[] = [
          {
            value: lines.slice(0, indexOfWrongCurly).join('\n'),
            added: true,
          },
          {
            value: stripAnsi(lines[indexOfWrongCurly]) + '\n\n',
          },
          {
            value: lines.slice(indexOfWrongCurly + 1).join('\n'),
            added: true,
          },
        ]
        changes.splice(correspondingIndex, 1, ...newChanges)
      }
    }
  })
  return changes.filter(change => change.value !== '')
}

function fixCurlyRemoved(changes: Change[]): Change[] {
  changes.forEach((change, index) => {
    if (!change.added && !change.removed && change.value.trim() === '}' && index > 0 && changes[index - 1].removed) {
      const correspondingIndex = changes.slice(0, index).findIndex(c => {
        if (!c.removed) {
          return false
        }
        let sawOpen = false
        let hasCloseBeforeOpen = false
        const lines = c.value.split('\n')
        for (const line of lines) {
          if (!sawOpen && line.trim() === '}') {
            hasCloseBeforeOpen = true
            break
          }
        }
        return hasCloseBeforeOpen
      })
      if (correspondingIndex > -1) {
        const correspondingChange = changes[correspondingIndex]
        // 1. Merge our lonely curly with the removed before and delete it
        changes[index - 1].value = changes[index - 1].value + change.value
        changes.splice(index, 1)
        // 2. get rid of the unnecessary } in the corresponding block we just found
        // and turn it into a normal curly
        const lines = correspondingChange.value.split('\n')
        const indexOfWrongCurly = lines.findIndex(l => l.trim() === '}')
        const newChanges: Change[] = [
          {
            value: lines.slice(0, indexOfWrongCurly).join('\n'),
            removed: true,
          },
          {
            value: stripAnsi(lines[indexOfWrongCurly]) + '\n\n',
          },
          {
            value: lines.slice(indexOfWrongCurly + 1).join('\n'),
            removed: true,
          },
        ]
        changes.splice(correspondingIndex, 1, ...newChanges)
      }
    }
  })
  return changes.filter(change => change.value !== '')
}

// // jsdiff spreads the } curly braces all over the place
// // we don't want that
function fixCurlyRemovedDangling(changes: Change[]): Change[] {
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
