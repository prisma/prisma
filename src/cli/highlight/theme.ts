import { Theme } from './types'
import chalk from 'chalk'

export const darkBrightBlue = chalk.rgb(107, 139, 140)
// export const blue = chalk.rgb(24, 109, 178)
export const blue = chalk.cyan
export const brightBlue = chalk.rgb(127, 155, 155)
export const identity = str => str

export const theme: Theme = {
  keyword: blue,
  entity: blue,
  value: darkBrightBlue,
  punctuation: darkBrightBlue,
  directive: blue,
  function: blue,
  variable: brightBlue,
  string: chalk.greenBright,
  boolean: blue.bold,
  comment: chalk.dim,
}
