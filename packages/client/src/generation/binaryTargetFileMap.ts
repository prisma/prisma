import path from 'path'

import { Writer } from './ts-builders/Writer'

export type EnginePaths = {
  // key: target, value: path
  [binaryTarget: string]: string
}

export function buildBinaryTargetFileMap(paths: EnginePaths) {
  const writer = new Writer(0, undefined)
  writer.writeLine('export default {')
  writer.withIndent(() => {
    for (const [binaryTarget, filePath] of Object.entries(paths)) {
      const key = JSON.stringify(binaryTarget)
      const relName = JSON.stringify(`./${path.basename(filePath)}`)
      writer.writeLine(`[${key}]: () => new URL(${relName}, import.meta.url).pathname,`)
    }
  })
  writer.writeLine('}')

  return writer.toString()
}
