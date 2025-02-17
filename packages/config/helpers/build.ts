import { build } from '../../../helpers/compile/build'

void build([
  {
    name: 'default',
    bundle: true,
    emitTypes: true,
    external: ['esbuild', 'esbuild-register'],
  },
])
