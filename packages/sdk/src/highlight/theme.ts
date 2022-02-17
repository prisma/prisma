import chalk from 'chalk'

import type { Theme } from './types'

// https://www.wnycstudios.org/story/211119-colors
export const gamboge = chalk.rgb(228, 155, 15)

export const darkBrightBlue = chalk.rgb(107, 139, 140)
export const blue = chalk.cyan
export const brightBlue = chalk.rgb(127, 155, 175)
export const identity = (str?: string): string => str || ''

export const theme: Theme = {
  keyword: blue,
  entity: blue,
  value: brightBlue,
  punctuation: darkBrightBlue,
  directive: blue,
  function: blue,
  variable: brightBlue,
  string: brightBlue,
  boolean: gamboge,
  comment: chalk.dim,
}
