import { bold, dim, green, red } from 'kleur/colors'

import { BasicBuilder } from '../../../generation/ts-builders/BasicBuilder'
import { Writer } from '../../../generation/ts-builders/Writer'

type ColorFn = (str: string) => string
export type Colors = {
  bold: ColorFn
  red: ColorFn
  green: ColorFn
  dim: ColorFn
}

const noop = (str: string) => str

export const inactiveColors: Colors = {
  bold: noop,
  red: noop,
  green: noop,
  dim: noop,
}

export const activeColors: Colors = {
  bold,
  red,
  green,
  dim,
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
