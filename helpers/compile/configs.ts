import { BuildOptions } from './build'
import { defaultFillersConfig, fillPlugin } from './plugins/fill-plugin/fillPlugin'

const fill = fillPlugin({
  defaultFillers: false,
  fillerOverrides: {
    util: defaultFillersConfig.util,
  },
})

export const adapterConfig: BuildOptions[] = [
  {
    name: 'cjs',
    format: 'cjs',
    bundle: true,
    entryPoints: ['src/index.ts'],
    outfile: 'dist/index',
    outExtension: { '.js': '.js' },
    emitTypes: true,
    plugins: [fill],
  },
  {
    name: 'esm',
    format: 'esm',
    bundle: true,
    entryPoints: ['src/index.ts'],
    outfile: 'dist/index',
    outExtension: { '.js': '.mjs' },
    emitTypes: true,
    plugins: [fill],
  },
]
