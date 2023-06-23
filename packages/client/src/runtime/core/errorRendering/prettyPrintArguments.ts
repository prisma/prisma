import { Writer } from '../../../generation/ts-builders/Writer'
import { JsArgs } from '../types/JsApi'
import { buildArgumentsRenderingTree } from './ArgumentsRenderingTree'
import { inactiveColors } from './base'

export function prettyPrintArguments(args: JsArgs): string {
  const tree = buildArgumentsRenderingTree(args)
  const writer = new Writer(0, { colors: inactiveColors })
  return writer.write(tree).toString()
}
