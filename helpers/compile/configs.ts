import { BuildOptions } from './build'

export const adapterConfig: BuildOptions[] = [
  {
    name: 'cjs',
    format: 'cjs',
    bundle: true,
    entryPoints: ['src/index.ts'],
    outfile: 'dist/index',
    outExtension: { '.js': '.js' },
    emitTypes: true,
    minify: true,
  },
  {
    name: 'esm',
    format: 'esm',
    bundle: true,
    entryPoints: ['src/index.ts'],
    outfile: 'dist/index',
    outExtension: { '.js': '.mjs' },
    emitTypes: true,
    minify: true,
  },
]
