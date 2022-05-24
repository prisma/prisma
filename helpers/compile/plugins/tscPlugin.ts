import type * as esbuild from 'esbuild'

import { run } from '../run'

/**
 * Triggers the TypeScript compiler.
 */
export const tscPlugin: esbuild.Plugin = {
  name: 'tscPlugin',
  setup(build) {
    const options = build.initialOptions

    if (process.env.DEV === 'true') return

    build.onStart(async () => {
      await run(`tsc --build ${options.tsconfig}`)
    })
  },
}
