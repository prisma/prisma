import chalk from 'chalk'
import type { Theme } from './types'

export const orange = chalk.rgb(246, 145, 95)
export const darkBrightBlue = chalk.rgb(107, 139, 140)
export const blue = chalk.cyan
export const brightBlue = chalk.rgb(127, 155, 155)
export const identity = (str) => str

export const theme: Theme = {
  keyword: blue,
  entity: blue,
  value: brightBlue,
  punctuation: darkBrightBlue,
  directive: blue,
  function: blue,
  variable: brightBlue,
  string: chalk.greenBright,
  boolean: orange,
  number: chalk.cyan,
  comment: chalk.grey,
}
