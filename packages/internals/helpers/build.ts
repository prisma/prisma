import type * as esbuild from 'esbuild'
import copyStaticFiles from 'esbuild-copy-static-files'
import fs from 'fs'
import path from 'path'

import type { BuildOptions } from '../../../helpers/compile/build'
import { build } from '../../../helpers/compile/build'

const wasmModulePlugin: esbuild.Plugin = {
  name: 'wasm',
  setup(build) {
    // run on each import path in each module that esbuild builds
    build.onResolve({ filter: /@prisma\/.*-wasm$/ }, (args) => {
      const internalsPath = path.join(__dirname, '..')
      const prismaWASMPath = path.join(internalsPath, 'node_modules', args.path)
      const { main } = require(path.join(prismaWASMPath, 'package.json'))
      const modulePath = path.join(prismaWASMPath, main)

      return {
        path: modulePath,
        namespace: 'wasm-binary',
      }
    })

    // run for each unique path/namespace pair that has not been marked as external
    build.onLoad({ filter: /.*/, namespace: 'wasm-binary' }, async (args) => {
      const contents = await fs.promises.readFile(args.path, 'utf8')

      // otherwise it would look for wasm modules in './internals/build/'
      const actualContents = contents.replace(/__dirname/g, `"${path.join(args.path, '..')}"`)

      return {
        contents: actualContents,
        loader: 'js',
      }
    })
  },
}

const internalsBuildConfig: BuildOptions = {
  name: 'default',
  plugins: [wasmModulePlugin],
}

void build([internalsBuildConfig])
