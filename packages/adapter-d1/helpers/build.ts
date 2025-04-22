import { build } from '../../../helpers/compile/build'
import { adapterConfig } from '../../../helpers/compile/configs'

void build([
  ...adapterConfig,
  {
    name: 'edge-cjs',
    format: 'cjs',
    bundle: true,
    entryPoints: ['src/index-edge.ts'],
    outfile: 'dist/index-edge',
    outExtension: { '.js': '.js' },
    emitTypes: true,
  },
  {
    name: 'edge-esm',
    format: 'esm',
    bundle: true,
    entryPoints: ['src/index-edge.ts'],
    outfile: 'dist/index-edge',
    outExtension: { '.js': '.mjs' },
    emitTypes: true,
  },
])
