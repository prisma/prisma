import { build } from '../../../helpers/compile/build'

void build([
  {
    name: 'default',
    bundle: true,
    emitTypes: true,
    entryPoints: ['src/index.ts'],
    outfile: 'dist/index',
    external: ['esbuild', 'esbuild-register'],
  },
])
