import { bold, dim, green, red } from 'kleur/colors'
import stripAnsi from 'strip-ansi'

import { ObjectEnumValue } from '../object-enums'
import { isDate, isValidDate } from './date'
import { deepSet } from './deep-set'
import stringifyObject from './stringifyObject'

export interface MissingItem {
  path: string
  isRequired: boolean
  type: string | object
}

const DIM_TOKEN = '@@__DIM_POINTER__@@'

export type PrintJsonWithErrorsArgs = {
  ast: object
  keyPaths: string[]
  valuePaths: string[]
  missingItems: MissingItem[]
}

export function printJsonWithErrors({ ast, keyPaths, valuePaths, missingItems }: PrintJsonWithErrorsArgs) {
  let obj = ast
  for (const { path, type } of missingItems) {
    obj = deepSet(obj, path, type)
  }

  return stringifyObject(obj, {
    indent: '  ',
    transformLine: ({ indent, key, value, stringifiedValue, eol, path }) => {
      const dottedPath = path.join('.')
      const keyError = keyPaths.includes(dottedPath)
      const valueError = valuePaths.includes(dottedPath)
      const missingItem = missingItems.find((item) => item.path === dottedPath)

      let valueStr = stringifiedValue

      if (missingItem) {
        // trim away the '' from the string
        if (typeof value === 'string') {
          valueStr = valueStr.slice(1, valueStr.length - 1)
        }
        const isRequiredStr = missingItem.isRequired ? '' : '?'
        const prefix = missingItem.isRequired ? '+' : '?'
        const color = missingItem.isRequired ? (s: string) => bold(green(s)) : green
        let output = color(prefixLines(key + isRequiredStr + ': ' + valueStr + eol, indent, prefix))
        if (!missingItem.isRequired) {
          output = dim(output)
        }
        return output
      } else {
        const isOnMissingItemPath = missingItems.some((item) => dottedPath.startsWith(item.path))
        const isOptional = key[key.length - 2] === '?'
        if (isOptional) {
          key = key.slice(1, key.length - 1)
        }
        if (isOptional && typeof value === 'object' && value !== null) {
          valueStr = valueStr
            .split('\n')
            .map((line, index, arr) => (index === arr.length - 1 ? line + DIM_TOKEN : line))
            .join('\n')
        }
        if (isOnMissingItemPath && typeof value === 'string') {
          valueStr = valueStr.slice(1, valueStr.length - 1)
          if (!isOptional) {
            valueStr = bold(valueStr)
          }
        }
        if ((typeof value !== 'object' || value === null) && !valueError && !isOnMissingItemPath) {
          valueStr = dim(valueStr)
        }

        const keyStr = keyError ? red(key) : key
        valueStr = valueError ? red(valueStr) : valueStr
        // valueStr can be multiple lines if it's an object
        let output = indent + keyStr + ': ' + valueStr + (isOnMissingItemPath ? eol : dim(eol))

        // if there is an error, add the scribble lines
        // 3 options:
        // error in key, but not in value
        // error in value, but not in key
        // error in both
        if (keyError || valueError) {
          const lines = output.split('\n')
          const keyLength = String(key).length
          const keyScribbles = keyError ? red('~'.repeat(keyLength)) : ' '.repeat(keyLength)

          const valueLength = valueError ? getValueLength(indent, key, value, stringifiedValue) : 0
          const hideValueScribbles = valueError && isRenderedAsObject(value)
          const valueScribbles = valueError ? '  ' + red('~'.repeat(valueLength)) : ''

          // Either insert both keyScribbles and valueScribbles in one line
          if (keyScribbles && keyScribbles.length > 0 && !hideValueScribbles) {
            lines.splice(1, 0, indent + keyScribbles + valueScribbles)
          }

          // or the valueScribbles for a multiline string
          if (keyScribbles && keyScribbles.length > 0 && hideValueScribbles) {
            lines.splice(lines.length - 1, 0, indent.slice(0, indent.length - 2) + valueScribbles)
          }

          output = lines.join('\n')
        }
        return output
      }
    },
  })
}

function getValueLength(indent: string, key: string, value: any, stringifiedValue: string) {
  if (value === null) {
    return 4
  }
  if (typeof value === 'string') {
    return value.length + 2 // +2 for the quotes
  }

  if (isRenderedAsObject(value)) {
    return Math.abs(getLongestLine(`${key}: ${stripAnsi(stringifiedValue)}`) - indent.length)
  }

  if (isDate(value)) {
    if (isValidDate(value)) {
      return `new Date('${value.toISOString()}')`.length
    }
    return `new Date('Invalid Date')`.length
  }

  return String(value).length
}

function isRenderedAsObject(value: any) {
  return typeof value === 'object' && value !== null && !(value instanceof ObjectEnumValue) && !isDate(value)
}

function getLongestLine(str: string): number {
  return str.split('\n').reduce((max, curr) => (curr.length > max ? curr.length : max), 0)
}

function prefixLines(str: string, indent: string, prefix: string): string {
  return str
    .split('\n')
    .map((line, index, arr) =>
      index === 0 ? prefix + indent.slice(1) + line : index < arr.length - 1 ? prefix + line.slice(1) : line,
    )
    .map((line) => {
      // we need to use a special token to "mark" a line a "to be dimmed", as ansi doesn't allow nesting of dimmed & colored content
      return stripAnsi(line).includes(DIM_TOKEN)
        ? dim(line.replace(DIM_TOKEN, ''))
        : line.includes('?')
        ? dim(line)
        : line
    })
    .join('\n')
}
