import { bold, dim, green, red } from 'kleur/colors'

import type { BasicBuilder } from '../../../generation/ts-builders/BasicBuilder'
import type { Writer } from '../../../generation/ts-builders/Writer'

type ColorFn = (str: string) => string
export type Colors = {
  bold: ColorFn
  red: ColorFn
  green: ColorFn
  dim: ColorFn
  // if false, all color functions are useless
  readonly enabled: boolean
}

const noop = (str: string) => str

export const inactiveColors: Colors = {
  bold: noop,
  red: noop,
  green: noop,
  dim: noop,
  enabled: false,
}

export const activeColors: Colors = {
  bold,
  red,
  green,
  dim,
  enabled: true,
}

export type ErrorRenderContext = {
  colors: Colors
}

export type ErrorWriter = Writer<ErrorRenderContext>
export type ErrorBasicBuilder = BasicBuilder<ErrorRenderContext>

export const fieldsSeparator: ErrorBasicBuilder = {
  write(writer) {
    writer.writeLine(',')
  },
}
