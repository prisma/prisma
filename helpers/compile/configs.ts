import { BuildOptions } from './build'

export const adapterConfig: BuildOptions[] = [
  {
    name: 'cjs',
    format: 'cjs',
    bundle: true,
    entryPoints: ['src/index.ts'],
    outfile: 'dist/index',
    emitTypes: true,
    packages: 'external',
  },
  {
    name: 'esm',
    format: 'esm',
    bundle: true,
    entryPoints: ['src/index.ts'],
    outfile: 'dist/index',
    emitTypes: false,
    packages: 'external',
  },
]
