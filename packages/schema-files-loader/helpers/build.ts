import { build } from '../../../helpers/compile/build'

void build([
  {
    name: 'default',
    entryPoints: ['src/index.ts'],
    outfile: 'dist/index',
    external: ['fs-extra', '@prisma/prisma-schema-wasm'],
    bundle: true,
    emitTypes: true,
  },
])
