import path from 'path'

import { Writer } from './ts-builders/Writer'

export type EnginePaths = {
  // key: target, value: path
  [binaryTarget: string]: string
}

/**
 * binaryTarget <-> file map is a workaround for some of the bundlers
 * In particular, webpack, parcel and vite.
 * For those browsers, every asset wrapped in `new URL("./relative-path/to/asset", import.meta.url)`
 * will get copied over, renamed and the resulting URL will be replaced with an actual path to a bundled asset.
 * Without the bundler, this call will just produce absolute path to a file, relative to a source file it defined in.
 * So, it will produce a correct result with or without bundling.
 *
 * We use this to ensure that engine is copied over when prisma client is bundled.
 * This map will contain an entry for each binary target schema file uses and will map
 * target name to an absolute path, wrapped in `new URL(..., import.meta.url)` construct.
 *
 * Since `import.meta` is a ESM construct (it causes syntax error in CJS), this map has to be put into .mjs file
 * and loaded via dynamic `import()` from CJS module.
 *
 * See also:
 * - packages/client/src/runtime/core/engines/common/resolveEnginePath.ts
 * -
 *
 * @param paths
 * @returns
 */
export function buildBinaryTargetFileMap(paths: EnginePaths) {
  const writer = new Writer(0, undefined)
  // import.meta.url can be undefined after some of the bundling
  // steps. In particular, esbuild with `--format=cjs` output
  writer.writeLine('export default (import.meta.url ? {')
  writer.withIndent(() => {
    for (const [binaryTarget, filePath] of Object.entries(paths)) {
      const key = JSON.stringify(binaryTarget)
      const relName = JSON.stringify(`./${path.basename(filePath)}`)
      writer.writeLine(`[${key}]: () => new URL(${relName}, import.meta.url).pathname,`)
    }
  })
  writer.writeLine('} : {})')

  return writer.toString()
}
