import type * as esbuild from 'esbuild'

export const onErrorPlugin: esbuild.Plugin = {
  name: 'onErrorPlugin',
  setup(build) {
    build.onEnd((result) => {
      // if there were errors found on the build
      if (result.errors.length > 0) {
        if (process.env.WATCH === 'true') {
          // just display them if we're watching
          result.errors = []
        } else {
          // but exit the process in normal mode
          process.exit(1)
        }
      }
    })
  },
}
