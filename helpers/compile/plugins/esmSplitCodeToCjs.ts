import * as esbuild from 'esbuild'

/**
 * Code splitting only works in ESM at the moment, this plugin will convert the
 * ESM code to CJS automatically after the build. Only works with `outdir` set.
 */
export const esmSplitCodeToCjs: esbuild.Plugin = {
  name: 'esmSplitCodeToCjs',
  setup(build) {
    build.onEnd(async (result) => {
      const outFiles = Object.keys(result.metafile?.outputs ?? {})
      const jsFiles = outFiles.filter((f) => f.endsWith('js'))

      await esbuild.build({
        outdir: build.initialOptions.outdir,
        entryPoints: jsFiles,
        allowOverwrite: true,
        format: 'cjs',
        logLevel: 'error',
        packages: 'external',
      })
    })
  },
}
