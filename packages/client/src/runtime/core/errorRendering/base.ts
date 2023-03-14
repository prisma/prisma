import { Chalk } from 'chalk'

import { BasicBuilder } from '../../../generation/ts-builders/BasicBuilder'
import { Writer } from '../../../generation/ts-builders/Writer'

export type ErrorRenderContext = {
  chalk: Chalk
}

export type ErrorWriter = Writer<ErrorRenderContext>
export type ErrorBasicBuilder = BasicBuilder<ErrorRenderContext>

export const fieldsSeparator: ErrorBasicBuilder = {
  write(writer) {
    writer.writeLine(',')
  },
}
