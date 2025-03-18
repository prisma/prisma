import { Writer } from '@prisma/ts-builders'

import { JsArgs } from '../types/exported/JsApi'
import { buildArgumentsRenderingTree } from './ArgumentsRenderingTree'
import { inactiveColors } from './base'

export function prettyPrintArguments(args?: JsArgs): string {
  if (args === undefined) {
    return ''
  }
  const tree = buildArgumentsRenderingTree(args)
  const writer = new Writer(0, { colors: inactiveColors })
  return writer.write(tree).toString()
}
