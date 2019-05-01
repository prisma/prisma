import stringifyObject from './stringify'
import chalk from 'chalk'

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
      if (valueError && typeof value === 'object') {
        throw new Error(`Cannot render an error for a value that's an object`)
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
        const valueLength = String(value).length + (typeof value === 'string' ? 2 : 0) // add 2 chars for the '' when it's a string
        const valueScribbles = valueError ? '  ' + chalk.redBright('~'.repeat(valueLength)) : ''
        lines.splice(1, 1, indent + keyScribbles + valueScribbles)
        output = lines.join('\n') + (lines.length === 2 ? '\n' : '')
      }
      return output
    },
  })
}
