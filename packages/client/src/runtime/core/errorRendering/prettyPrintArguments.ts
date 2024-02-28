import { Writer } from '../../../generation/ts-builders/Writer'
import { JsArgs } from '../types/exported/JsApi'
import { buildArgumentsRenderingTree } from './ArgumentsRenderingTree'
import { inactiveColors } from './base'

export function prettyPrintArguments(args?: JsArgs): string {
  if (args === undefined) {
    return ''
  }
  if (TARGET_BUILD_TYPE === 'wasm') {
    return JSON.stringify(args, null, 2)
  } else {
    const tree = buildArgumentsRenderingTree(args)
    const writer = new Writer(0, { colors: inactiveColors })
    return writer.write(tree).toString()
  }
}
