import stringifyObject from './stringify'
import chalk from 'chalk'
import stripAnsi from 'strip-ansi'

export function printJsonErrors(ast: object, keyPaths: string[], valuePaths: string[]) {
  return stringifyObject(ast, {
    indent: '  ',
    transformLine: ({ indent, key, value, stringifiedValue, eol, path }) => {
      const dottedPath = path.join('.')
      const keyError = keyPaths.includes(dottedPath)
      const valueError = valuePaths.includes(dottedPath)

      let valueStr = stringifiedValue

      if (typeof value !== 'object' && !valueError) {
        valueStr = chalk.dim(valueStr)
      }

      const keyStr = keyError ? chalk.redBright(key) : key
      valueStr = valueError ? chalk.redBright(valueStr) : valueStr
      // valueStr can be multiple lines if it's an object
      let output = indent + keyStr + ': ' + valueStr + chalk.dim(eol)

      // if there is an error, add the scribble lines
      // 3 options:
      // error in key, but not in value
      // error in value, but not in key
      // error in both
      if (keyError || valueError) {
        const lines = output.split('\n')
        const keyLength = String(key).length
        const keyScribbles = keyError ? chalk.redBright('~'.repeat(keyLength)) : ' '.repeat(keyLength)

        const valueLength = valueError ? getValueLength(indent, key, value, stringifiedValue) : 0
        const hideValueScribbles = Boolean(valueError && typeof value === 'object')
        const valueScribbles = valueError ? '  ' + chalk.redBright('~'.repeat(valueLength)) : ''

        // Either insert both keyScribles and valueScribbles in one line
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
    },
  })
}

function getValueLength(indent: string, key: string, value: any, stringifiedValue: string) {
  if (typeof value === 'string') {
    return value.length + 2 // +2 for the quotes
  }

  if (typeof value === 'object') {
    return getLongestLine(`${key}: ${stripAnsi(stringifiedValue)}`) - indent.length
  }

  return String(value).length
}

function getLongestLine(str: string): number {
  return str.split('\n').reduce((max, curr) => (curr.length > max ? curr.length : max), 0)
}
