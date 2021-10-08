import type * as esbuild from 'esbuild'

export const exitOnErrorPlugin: esbuild.Plugin = {
  name: 'exitOnError',
  setup(build) {
    if (process.env.WATCH === 'true') return

    build.onEnd((result) => {
      if (result.errors.length > 0) {
        process.exit(1)
      }
    })
  },
}
