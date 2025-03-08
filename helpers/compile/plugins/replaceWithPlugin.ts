import type * as esbuild from 'esbuild'
import fs from 'node:fs'
import { builtinModules } from 'node:module'

type Replacement = [RegExp, string | ((regex: RegExp, contents: string) => string | Promise<string>)]

async function applyReplacements(originalContents: string, replacements: Replacement[]) {
  let newContents = originalContents
  for (const [regex, replacement] of replacements) {
    if (typeof replacement === 'string') {
      newContents = newContents.replace(regex, replacement)
    } else {
      newContents = await replacement(regex, newContents)
    }
  }

  return newContents
}

/**
 * Replace the contents of a file with the given replacements.
 * @param replacements
 * @returns
 */
export const replaceWithPlugin = (replacements: Replacement[]): esbuild.Plugin => {
  return {
    name: 'replaceWithPlugin',
    setup(build) {
      build.onLoad({ filter: /.*/ }, async (args) => {
        // we skip, don't attempt to edit files that aren't js
        if (builtinModules.includes(args.path)) return {}
        if (!/.*?(.js|.mjs)$/.exec(args.path)) return {}

        const contents = await fs.promises.readFile(args.path, 'utf8')

        return { contents: await applyReplacements(contents, replacements) }
      })
    },
  }
}

/**
 * Example
 */
// const inlineUndiciWasm = replaceWithPlugin([
//   [
//     /(await WebAssembly\.compile\().*?'(.*?)'\)\)\)/g,
//     async (regex, contents) => {
//       for (const match of contents.matchAll(regex)) {
//         if (match[2].includes('simd') === false) {
//           // we only bundle lhttp wasm files that are not simd compiled
//           const engineCoreDir = resolve.sync('@prisma/engine-core')
//           const undiciPackage = resolve.sync('undici/package.json', { basedir: engineCoreDir })
//           const lhttpWasmPath = path.join(path.dirname(undiciPackage), 'lib', match[2])
//           const wasmContents = (await fs.promises.readFile(lhttpWasmPath)).toString('base64')
//           const inlineWasm = `${match[1]}(Buffer.from("${wasmContents}", "base64")))`

//           contents = contents.replace(match[0], inlineWasm)
//         }
//       }

//       return contents
//     },
//   ],
// ])
