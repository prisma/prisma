import { build } from '../../../helpers/compile/build'

void build([
  {
    name: 'default',
    entryPoints: ['src/index.ts'],
    outfile: 'dist/index',
    bundle: true,
    minify: true,
    sourcemap: true,
    emitTypes: true,
  },
])
