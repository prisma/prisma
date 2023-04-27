import { blue, bold, cyan, gray, green, yellow } from 'kleur/colors'

import type { Theme } from './types'

export const theme: Theme = {
  keyword: cyan,
  entity: cyan,
  value: (s) => bold(blue(s)),
  punctuation: blue,
  directive: cyan,
  function: cyan,
  variable: (s) => bold(blue(s)),
  string: (s) => bold(green(s)),
  boolean: yellow,
  number: cyan,
  comment: gray,
}
